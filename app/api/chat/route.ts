import { anthropic, AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { UIMessage, convertToModelMessages } from "ai";
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

import { Experimental_Agent as Agent, stepCountIs } from 'ai';




import {
  experimental_createMCPClient,

} from '@ai-sdk/mcp';


// Lazy initialization of MCP clients and agent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let calAgent: any = null;

async function getCalAgent() {
  if (calAgent) {
    return calAgent;
  }

  // Connect to an HTTP MCP server directly via the client transport config
  const minizinc = await experimental_createMCPClient({
    transport: {
      type: 'sse',
      url: 'https://minizinc-mcp.up.railway.app/sse',
    },
  });

  const toolSetMinizinc = await minizinc.tools();

  const transport = new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['-y', 'github:r33drichards/caldav-mcp'],
    env: {
      "CALDAV_BASE_URL": "https://docker-radicale-production.up.railway.app",
      "CALDAV_USERNAME": "rwendt1337@gmail.com",
      "CALDAV_PASSWORD": process.env.CALDAV_PASSWORD || "#XZ#5N4B*ZvoBC",
    },
  });

  const caldav = await experimental_createMCPClient({
    transport,
  });

  const toolSetCaldav = await caldav.tools();

  // Connect to Time MCP server for timezone and time conversion capabilities
  const timeTransport = new Experimental_StdioMCPTransport({
    command: 'python3',
    args: ['-m', 'mcp_server_time', '--local-timezone=America/New_York'],
  });

  const timeMcp = await experimental_createMCPClient({
    transport: timeTransport,
  });

  const toolSetTime = await timeMcp.tools();

  const tools = {
    ...toolSetMinizinc,
    ...toolSetCaldav,
    ...toolSetTime,
  };


  calAgent = new Agent({
    model: anthropic("claude-haiku-4-5-20251001"),
    tools,
    stopWhen: stepCountIs(1000),
    system: "you are a helpful assistant that can help me with my calendar. There is a bocce calendar you can find with list calendar tool. when you are finished with your task, write a short paragraph indicating that you are finished and summarize your task and how you solved it. always use timeout with minizinc, always use 30 second timeout. If a user doesn't specify when they want the games, scheduled, ask clarifying questions to figure out when to schedule games. if a user says eomthing like next week, use get current time mcp tool to get current time"
  });

  return calAgent;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const agent = await getCalAgent();
  const result = agent.stream({
    messages: convertToModelMessages(messages),
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 12000 },
      } satisfies AnthropicProviderOptions,
    },
  });

  return result.toUIMessageStreamResponse();
}

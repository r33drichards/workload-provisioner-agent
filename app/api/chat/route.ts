import { anthropic, AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { UIMessage, convertToModelMessages } from "ai";

import { Experimental_Agent as Agent, stepCountIs } from "ai";

import { experimental_createMCPClient } from "@ai-sdk/mcp";

// Lazy initialization of MCP clients and agent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let workloadAgent: any = null;

async function getWorkloadAgent() {
  if (workloadAgent) {
    return workloadAgent;
  }

  // Connect to an HTTP MCP server directly via the client transport config
  const minizinc = await experimental_createMCPClient({
    transport: {
      type: "sse",
      url: "https://minizinc-mcp.up.railway.app/sse",
    },
  });

  const toolSetMinizinc = await minizinc.tools();

  // Connect to Instances MCP server for AWS instance provisioning
  const instances = await experimental_createMCPClient({
    transport: {
      type: "sse",
      url: "https://instances-mcp.vantage.sh/mcp/e1e3a775-73b5-4afb-86c0-f433c8144b5a",
    },
  });

  const toolSetInstances = await instances.tools();

  const tools = {
    ...toolSetMinizinc,
    ...toolSetInstances,
  };

  workloadAgent = new Agent({
    model: anthropic("claude-haiku-4-5-20251001"),
    tools,
    stopWhen: stepCountIs(1000),
    system:
      "You are a helpful AWS workload provisioning assistant that helps users cost-optimize their AWS infrastructure. Your role is to:\n\n1. Understand the user's workload requirements (CPU, memory, storage, network needs, etc.)\n2. Ask clarifying questions if any critical information is missing\n3. Use the instances MCP tool to get available AWS instance types and their specifications\n4. Use MiniZinc constraint solver (CSP) to bin-pack the workload across available instance types for optimal cost efficiency\n5. Always use a 30-second timeout when calling MiniZinc\n6. Present recommendations with cost breakdowns and justification\n\nWhen you complete a task, write a short paragraph summarizing what you did and how you solved the optimization problem.",
  });

  return workloadAgent;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const agent = await getWorkloadAgent();
  const result = agent.stream({
    messages: convertToModelMessages(messages),
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 12000 },
      } satisfies AnthropicProviderOptions,
    },
  });

  return result.toUIMessageStreamResponse();
}

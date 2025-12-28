import { anthropic, AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { UIMessage, convertToModelMessages } from "ai";

import { Experimental_Agent as Agent, stepCountIs } from "ai";

import { experimental_createMCPClient } from "@ai-sdk/mcp";

// Lazy initialization of MCP clients and agent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let workloadAgent: any = null;
let initializationPromise: Promise<typeof workloadAgent> | null = null;

// Helper to add timeout to promises
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
    ),
  ]);
}

async function initializeAgent() {
  console.log("[chat] Starting agent initialization...");

  // Connect to MiniZinc MCP server
  console.log("[chat] Connecting to MiniZinc MCP server...");
  const minizinc = await withTimeout(
    experimental_createMCPClient({
      transport: {
        type: "sse",
        url: "https://minizinc-mcp.up.railway.app/sse",
      },
    }),
    30000,
    "MiniZinc MCP connection timed out after 30s",
  );
  console.log("[chat] MiniZinc MCP connected, fetching tools...");

  const toolSetMinizinc = await withTimeout(
    minizinc.tools(),
    10000,
    "MiniZinc tools fetch timed out after 10s",
  );
  console.log(
    "[chat] MiniZinc tools loaded:",
    Object.keys(toolSetMinizinc).join(", "),
  );

  // Connect to Instances MCP server for AWS instance provisioning
  console.log("[chat] Connecting to Instances MCP server...");
  const instances = await withTimeout(
    experimental_createMCPClient({
      transport: {
        type: "sse",
        url: "https://instances-mcp.vantage.sh/mcp/e1e3a775-73b5-4afb-86c0-f433c8144b5a",
      },
    }),
    30000,
    "Instances MCP connection timed out after 30s",
  );
  console.log("[chat] Instances MCP connected, fetching tools...");

  const toolSetInstances = await withTimeout(
    instances.tools(),
    10000,
    "Instances tools fetch timed out after 10s",
  );
  console.log(
    "[chat] Instances tools loaded:",
    Object.keys(toolSetInstances).join(", "),
  );

  const tools = {
    ...toolSetMinizinc,
    ...toolSetInstances,
  };

  console.log("[chat] Creating agent with tools:", Object.keys(tools).join(", "));

  const agent = new Agent({
    model: anthropic("claude-haiku-4-5-20251001"),
    tools,
    stopWhen: stepCountIs(1000),
    system:
      "You are a helpful AWS workload provisioning assistant that helps users cost-optimize their AWS infrastructure. Your role is to:\n\n1. Understand the user's workload requirements (CPU, memory, storage, network needs, etc.)\n2. Ask clarifying questions if any critical information is missing\n3. Use the instances MCP tool to get available AWS instance types and their specifications\n4. Use MiniZinc constraint solver (CSP) to bin-pack the workload across available instance types for optimal cost efficiency\n5. Always use a 30-second timeout when calling MiniZinc\n6. Present recommendations with cost breakdowns and justification\n\nWhen you complete a task, write a short paragraph summarizing what you did and how you solved the optimization problem.",
  });

  console.log("[chat] Agent initialized successfully");
  return agent;
}

async function getWorkloadAgent() {
  if (workloadAgent) {
    console.log("[chat] Returning cached agent");
    return workloadAgent;
  }

  // Prevent multiple concurrent initializations
  if (initializationPromise) {
    console.log("[chat] Agent initialization in progress, waiting...");
    return initializationPromise;
  }

  console.log("[chat] Starting new agent initialization");
  initializationPromise = initializeAgent();

  try {
    workloadAgent = await initializationPromise;
    return workloadAgent;
  } catch (error) {
    console.error("[chat] Agent initialization failed:", error);
    initializationPromise = null; // Reset so we can retry
    throw error;
  }
}

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[chat:${requestId}] POST request received`);

  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    const lastMessage = messages[messages.length - 1];
    const lastMessagePreview = lastMessage?.parts
      ?.map((part) => (part.type === "text" ? part.text : `[${part.type}]`))
      .join("")
      .substring(0, 100);
    console.log(
      `[chat:${requestId}] Parsed ${messages.length} messages, last message (${lastMessage?.role}): "${lastMessagePreview}..."`,
    );

    console.log(`[chat:${requestId}] Getting agent...`);
    const agent = await getWorkloadAgent();
    console.log(`[chat:${requestId}] Agent acquired, starting stream...`);

    const result = agent.stream({
      messages: convertToModelMessages(messages),
      providerOptions: {
        anthropic: {
          thinking: { type: "enabled", budgetTokens: 12000 },
        } satisfies AnthropicProviderOptions,
      },
    });

    console.log(`[chat:${requestId}] Stream started, returning response`);
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error(`[chat:${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

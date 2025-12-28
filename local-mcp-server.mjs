import http from "http";
import { randomUUID } from "crypto";

const PORT = 3001;

// Store active SSE connections by session ID
const sessions = new Map();

// Mock tools that mimic MiniZinc and Instances MCP
const mockTools = {
  solve_constraint: {
    name: "solve_constraint",
    description: "Solve a MiniZinc constraint satisfaction problem",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          type: "string",
          description: "The MiniZinc model to solve",
        },
        timeout: {
          type: "number",
          description: "Timeout in seconds",
        },
      },
      required: ["model"],
    },
  },
  get_instances: {
    name: "get_instances",
    description: "Get AWS EC2 instance types and pricing",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "AWS region",
        },
        instance_family: {
          type: "string",
          description: "Instance family filter (e.g., m5, c5)",
        },
      },
    },
  },
};

function handleJsonRpcRequest(request) {
  const { method, params, id } = request;

  console.log(`[MCP] JSON-RPC request: ${method}`, params);

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "local-test-mcp-server",
            version: "1.0.0",
          },
        },
      };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: Object.values(mockTools),
        },
      };

    case "tools/call":
      const toolName = params?.name;
      console.log(`[MCP] Tool call: ${toolName}`, params?.arguments);

      // Simulate tool execution
      let toolResult;
      if (toolName === "solve_constraint") {
        toolResult = {
          status: "OPTIMAL_SOLUTION",
          solution: {
            objective: 42,
            variables: { x: 1, y: 2, z: 3 },
          },
          statistics: {
            solveTime: "0.5s",
            nodes: 100,
          },
        };
      } else if (toolName === "get_instances") {
        toolResult = {
          instances: [
            {
              type: "m5.large",
              vcpu: 2,
              memory: 8,
              price_per_hour: 0.096,
            },
            {
              type: "m5.xlarge",
              vcpu: 4,
              memory: 16,
              price_per_hour: 0.192,
            },
            {
              type: "c5.large",
              vcpu: 2,
              memory: 4,
              price_per_hour: 0.085,
            },
          ],
        };
      } else {
        toolResult = { message: `Unknown tool: ${toolName}` };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(toolResult, null, 2),
            },
          ],
        },
      };

    case "notifications/initialized":
      // This is a notification, no response needed
      return null;

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
  }
}

const server = http.createServer((req, res) => {
  console.log(`[MCP] ${req.method} ${req.url}`);

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // SSE endpoint
  if (req.method === "GET" && req.url === "/sse") {
    const sessionId = randomUUID();
    console.log(`[MCP] New SSE connection, session: ${sessionId}`);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Store the response object for this session
    sessions.set(sessionId, res);

    // Send the endpoint event with the session URL
    const endpointEvent = `event: endpoint\ndata: /message?sessionId=${sessionId}\n\n`;
    res.write(endpointEvent);
    console.log(`[MCP] Sent endpoint event: /message?sessionId=${sessionId}`);

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 30000);

    req.on("close", () => {
      console.log(`[MCP] SSE connection closed, session: ${sessionId}`);
      clearInterval(heartbeat);
      sessions.delete(sessionId);
    });

    return;
  }

  // Message endpoint for JSON-RPC requests
  if (req.method === "POST" && req.url?.startsWith("/message")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId || !sessions.has(sessionId)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid or expired session" }));
      return;
    }

    const sseRes = sessions.get(sessionId);
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const request = JSON.parse(body);
        const response = handleJsonRpcRequest(request);

        if (response) {
          // Send response via SSE
          const sseMessage = `event: message\ndata: ${JSON.stringify(response)}\n\n`;
          sseRes.write(sseMessage);
          console.log(`[MCP] Sent SSE response for request ${request.id}`);
        }

        // Acknowledge the POST request
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "accepted" }));
      } catch (error) {
        console.error("[MCP] Error processing request:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });

    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", sessions: sessions.size }));
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[MCP] Local MCP SSE server running on http://localhost:${PORT}`);
  console.log(`[MCP] SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`[MCP] Health check: http://localhost:${PORT}/health`);
  console.log(`[MCP] Available tools: ${Object.keys(mockTools).join(", ")}`);
});

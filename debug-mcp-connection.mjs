import { experimental_createMCPClient } from "@ai-sdk/mcp";

const MINIZINC_URL = "https://minizinc-mcp.up.railway.app/sse";
const INSTANCES_URL = "https://instances-mcp.vantage.sh/mcp/e1e3a775-73b5-4afb-86c0-f433c8144b5a";

async function testConnection(name, url) {
  console.log(`\n=== Testing ${name} ===`);
  console.log(`URL: ${url}`);

  const startTime = Date.now();

  try {
    console.log(`[${Date.now() - startTime}ms] Creating MCP client...`);

    const client = await experimental_createMCPClient({
      transport: {
        type: "sse",
        url: url,
      },
    });

    console.log(`[${Date.now() - startTime}ms] Client created, fetching tools...`);

    const tools = await client.tools();

    console.log(`[${Date.now() - startTime}ms] Tools loaded:`, Object.keys(tools));
    console.log(`✓ ${name} connection successful!`);

    return { success: true, tools: Object.keys(tools) };
  } catch (error) {
    console.error(`[${Date.now() - startTime}ms] ✗ Error:`, error.message);
    console.error("Full error:", error);
    return { success: false, error: error.message };
  }
}

async function testRawSSE(name, url) {
  console.log(`\n=== Raw SSE test for ${name} ===`);
  console.log(`URL: ${url}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        "Accept": "text/event-stream",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const text = await response.text();
      console.log(`Body:`, text.substring(0, 500));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    const readTimeout = setTimeout(() => {
      console.log("Read timeout - no data received in 5s");
      reader.cancel();
    }, 5000);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        console.log(`Received chunk:`, buffer);

        // Just read first chunk for debugging
        clearTimeout(readTimeout);
        reader.cancel();
        break;
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Read error:", e);
      }
    }

  } catch (error) {
    console.error(`Error:`, error.message);
  }
}

async function main() {
  console.log("Testing MCP SSE connections...\n");

  // First test raw SSE to see what the servers return
  await testRawSSE("MiniZinc", MINIZINC_URL);
  await testRawSSE("Instances", INSTANCES_URL);

  // Then test with the SDK
  await testConnection("MiniZinc", MINIZINC_URL);
  await testConnection("Instances", INSTANCES_URL);
}

main().catch(console.error);

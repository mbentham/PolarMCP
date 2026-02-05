#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { userTools } from "./tools/users.js";
import { exerciseTools } from "./tools/exercises.js";
import { activityTools } from "./tools/activities.js";
import {
  physicalInfoTools,
  heartRateTools,
  sleepTools,
  nightlyRechargeTools,
} from "./tools/physical.js";
import { oauthTools } from "./tools/oauth.js";

// Combine all tools
const allTools = {
  ...oauthTools,
  ...userTools,
  ...exerciseTools,
  ...activityTools,
  ...physicalInfoTools,
  ...heartRateTools,
  ...sleepTools,
  ...nightlyRechargeTools,
};

// Create MCP server
const server = new McpServer({
  name: "polar-accesslink",
  version: "1.0.0",
});

// Register all tools
for (const [, toolDef] of Object.entries(allTools)) {
  server.tool(
    toolDef.name,
    toolDef.description,
    toolDef.inputSchema.shape,
    toolDef.annotations,
    async (args: Record<string, unknown>) => {
      try {
        // Parse and validate input
        const parsed = toolDef.inputSchema.parse(args);
        const result = await toolDef.handler(parsed as never);

        return {
          content: [
            {
              type: "text" as const,
              text: result,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Polar AccessLink MCP Server started");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

import { z } from "zod";
import { getApiClient } from "../services/api-client.js";
import { ENDPOINTS } from "../constants.js";
import { schemas } from "../schemas/input.js";
import type { PolarUser, ResponseFormat } from "../types.js";

function formatUserMarkdown(user: PolarUser): string {
  const lines = [
    "## User Information",
    "",
    `- **Polar User ID**: ${user["polar-user-id"]}`,
    `- **Member ID**: ${user["member-id"]}`,
    `- **Registration Date**: ${user["registration-date"]}`,
  ];

  if (user["first-name"]) lines.push(`- **First Name**: ${user["first-name"]}`);
  if (user["last-name"]) lines.push(`- **Last Name**: ${user["last-name"]}`);
  if (user.birthdate) lines.push(`- **Birthdate**: ${user.birthdate}`);
  if (user.gender) lines.push(`- **Gender**: ${user.gender}`);
  if (user.weight) lines.push(`- **Weight**: ${user.weight} kg`);
  if (user.height) lines.push(`- **Height**: ${user.height} cm`);

  if (user.extra_info && user.extra_info.length > 0) {
    lines.push("", "### Extra Information");
    for (const info of user.extra_info) {
      lines.push(`- **${info.key}**: ${info.value}`);
    }
  }

  return lines.join("\n");
}

function formatResponse<T>(data: T, format: ResponseFormat, markdownFormatter: (data: T) => string): string {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }
  return markdownFormatter(data);
}

export async function registerUser(input: z.infer<typeof schemas.registerUser>): Promise<string> {
  const client = getApiClient();
  const userId = client.getUserId();

  const result = await client.post<PolarUser>(ENDPOINTS.USERS, {
    "member-id": userId,
  });

  return formatResponse(result, input.format, formatUserMarkdown);
}

export async function getUser(input: z.infer<typeof schemas.getUser>): Promise<string> {
  const client = getApiClient();
  const userId = client.getUserId();

  const result = await client.get<PolarUser>(ENDPOINTS.USER(userId));

  return formatResponse(result, input.format, formatUserMarkdown);
}

export async function deleteUser(input: z.infer<typeof schemas.deleteUser>): Promise<string> {
  const client = getApiClient();
  const userId = client.getUserId();

  await client.delete(ENDPOINTS.USER(userId));

  if (input.format === "json") {
    return JSON.stringify({ success: true, message: "User deleted successfully" }, null, 2);
  }
  return "## User Deleted\n\nUser registration has been successfully deleted.";
}

export const userTools = {
  polar_register_user: {
    name: "polar_register_user",
    description: "Register a new user with the Polar AccessLink API. This creates a link between your application and the Polar user.",
    inputSchema: schemas.registerUser,
    handler: registerUser,
    annotations: {
      title: "Register User",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_get_user: {
    name: "polar_get_user",
    description: "Get information about the registered Polar user including registration date, name, and physical attributes.",
    inputSchema: schemas.getUser,
    handler: getUser,
    annotations: {
      title: "Get User",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_delete_user: {
    name: "polar_delete_user",
    description: "Delete the user registration from Polar AccessLink. This removes the link between your application and the Polar user.",
    inputSchema: schemas.deleteUser,
    handler: deleteUser,
    annotations: {
      title: "Delete User",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

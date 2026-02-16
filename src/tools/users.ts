import { z } from "zod";
import { getApiClient } from "../services/api-client.js";
import { ENDPOINTS } from "../constants.js";
import { schemas } from "../schemas/input.js";
import type { PolarUser } from "../types.js";
import { formatResponse } from "../utils/format.js";

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
};

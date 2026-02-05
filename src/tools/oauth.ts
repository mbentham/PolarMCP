import { z } from "zod";
import axios from "axios";
import { OAUTH_BASE_URL, OAUTH_TOKEN_URL } from "../constants.js";
import { schemas } from "../schemas/input.js";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  x_user_id: number;
}

export async function getAuthorizationUrl(
  input: z.infer<typeof schemas.getAuthorizationUrl>
): Promise<string> {
  const redirectUri = input.redirectUri || "https://localhost:8080/callback";
  const authUrl = new URL("/oauth2/authorization", OAUTH_BASE_URL);

  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", input.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "accesslink.read_all");

  const lines = [
    "## Polar OAuth Authorization",
    "",
    "### Step 1: Visit the Authorization URL",
    "",
    "Open this URL in your browser to authorize the application:",
    "",
    "```",
    authUrl.toString(),
    "```",
    "",
    "### Step 2: Grant Access",
    "",
    "Log in with your Polar Flow credentials and grant access to the application.",
    "",
    "### Step 3: Get the Authorization Code",
    "",
    "After granting access, you'll be redirected to:",
    `\`${redirectUri}?code=<AUTHORIZATION_CODE>\``,
    "",
    "Copy the `code` parameter value from the URL.",
    "",
    "### Step 4: Exchange for Access Token",
    "",
    "Use the `polar_exchange_authorization_code` tool with:",
    "- Your `clientId`",
    "- Your `clientSecret`",
    "- The `authorizationCode` you just received",
    "",
    "This will give you the `POLAR_ACCESS_TOKEN` and `POLAR_USER_ID` needed to use the API.",
    "",
    "### Step 5: Register the User (REQUIRED)",
    "",
    "**IMPORTANT**: After setting up the environment variables, you MUST call",
    "`polar_register_user` before accessing any data. Without registration,",
    "all API calls will return 'Access Denied' errors.",
  ];

  return lines.join("\n");
}

export async function exchangeAuthorizationCode(
  input: z.infer<typeof schemas.exchangeAuthorizationCode>
): Promise<string> {
  const credentials = Buffer.from(
    `${input.clientId}:${input.clientSecret}`
  ).toString("base64");
  const redirectUri = input.redirectUri || "https://localhost:8080/callback";

  try {
    const response = await axios.post<TokenResponse>(
      OAUTH_TOKEN_URL,
      new URLSearchParams({
        grant_type: "authorization_code",
        code: input.authorizationCode,
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    const { access_token, token_type, expires_in, x_user_id } = response.data;

    const expiresDate = new Date(Date.now() + expires_in * 1000);

    const lines = [
      "## OAuth Token Exchange Successful",
      "",
      "Your access token and user ID have been retrieved.",
      "",
      "### Environment Variables",
      "",
      "Add these to your MCP server configuration:",
      "",
      "```",
      `POLAR_ACCESS_TOKEN=${access_token}`,
      `POLAR_USER_ID=${x_user_id}`,
      "```",
      "",
      "### Token Details",
      "",
      `- **Token Type**: ${token_type}`,
      `- **Expires In**: ${expires_in} seconds`,
      `- **Expires At**: ${expiresDate.toISOString()}`,
      `- **Polar User ID**: ${x_user_id}`,
      "",
      "### REQUIRED: Register the User",
      "",
      "**After configuring the environment variables and restarting the MCP server,",
      "you MUST call `polar_register_user` before accessing any data.**",
      "",
      "Without registration, all API calls will fail with 'Access Denied' errors.",
      "",
      "### Additional Notes",
      "",
      "- The access token is valid for approximately 1 year unless revoked",
      "- Store these values securely and do not share them",
    ];

    return lines.join("\n");
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 400) {
        return [
          "## OAuth Token Exchange Failed",
          "",
          "**Error**: Invalid or expired authorization code",
          "",
          "The authorization code may have:",
          "- Already been used (codes are single-use)",
          "- Expired (codes expire quickly)",
          "- Been incorrectly copied",
          "",
          "Please restart the OAuth flow by using `polar_get_authorization_url` again.",
          "",
          `**Details**: ${JSON.stringify(data)}`,
        ].join("\n");
      }

      if (status === 401) {
        return [
          "## OAuth Token Exchange Failed",
          "",
          "**Error**: Invalid client credentials",
          "",
          "Please verify that your `clientId` and `clientSecret` are correct.",
          "You can find these at https://admin.polaraccesslink.com/",
          "",
          `**Details**: ${JSON.stringify(data)}`,
        ].join("\n");
      }

      return [
        "## OAuth Token Exchange Failed",
        "",
        `**HTTP ${status}**: ${error.message}`,
        "",
        `**Details**: ${JSON.stringify(data)}`,
      ].join("\n");
    }

    throw error;
  }
}

export const oauthTools = {
  polar_get_authorization_url: {
    name: "polar_get_authorization_url",
    description:
      "Generate the Polar OAuth authorization URL. Use this to start the OAuth flow and get an authorization code. Requires your Polar API client ID from https://admin.polaraccesslink.com/",
    inputSchema: schemas.getAuthorizationUrl,
    handler: getAuthorizationUrl,
    annotations: {
      title: "Get Authorization URL",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  polar_exchange_authorization_code: {
    name: "polar_exchange_authorization_code",
    description:
      "Exchange an OAuth authorization code for an access token. Returns the POLAR_ACCESS_TOKEN and POLAR_USER_ID needed to configure the MCP server.",
    inputSchema: schemas.exchangeAuthorizationCode,
    handler: exchangeAuthorizationCode,
    annotations: {
      title: "Exchange Authorization Code",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
};

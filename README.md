# Polar AccessLink MCP Server

An MCP (Model Context Protocol) server that integrates with the Polar AccessLink API v3 to retrieve exercise, daily activity, and physical information data from Polar fitness devices and watches.

## Features

- **User Management**: Register, retrieve, and delete user registrations
- **Exercise Data**: List and retrieve workout sessions with heart rate, calories, distance, and GPS data
- **Daily Activity**: Access daily step counts, calories, and activity goals
- **Physical Information**: Weight, height, VO2 max, and fitness metrics
- **Continuous Heart Rate**: 24/7 heart rate monitoring data
- **Sleep Tracking**: Sleep stages, sleep score, and sleep quality metrics
- **Nightly Recharge**: Recovery metrics including HRV and ANS charge

## Requirements

- Node.js 18 or later

## Getting Started

This MCP server includes built-in OAuth helper tools that let Claude guide you through the entire setup process. Follow these steps to get started:

### Step 1: Register at Polar Admin Portal

1. Go to https://admin.polaraccesslink.com/
2. Create a new API client
3. Note your `client_id` and `client_secret`
4. Set the redirect URI to `https://localhost:8080/callback` (this is the default)

### Step 2: Install and Configure the MCP Server

```bash
npm install
npm run build
```

Add the server to your MCP client configuration (e.g., Claude Code's `settings.json`):

```json
{
  "mcpServers": {
    "polar-accesslink": {
      "command": "node",
      "args": ["/path/to/polar-accesslink-mcp-server/dist/index.js"]
    }
  }
}
```

> **Note**: Don't add `POLAR_ACCESS_TOKEN` or `POLAR_USER_ID` yet — you'll get these in the next steps.

### Step 3: Generate Your Authorization URL

Ask Claude to generate your authorization URL:

> "Generate a Polar authorization URL using client ID `your_client_id`"

Claude will use the `polar_get_authorization_url` tool and provide you with a URL to visit.

### Step 4: Authorize in Your Browser

1. Open the authorization URL in your browser
2. Log in with your Polar Flow credentials
3. Grant access to the application
4. You'll be redirected to a URL like: `https://localhost:8080/callback?code=AUTHORIZATION_CODE`
5. Copy the `code` parameter value from the URL

### Step 5: Exchange Your Authorization Code

Ask Claude to exchange your code for an access token:

> "Exchange this Polar authorization code for an access token:
> - Client ID: `your_client_id`
> - Client Secret: `your_client_secret`
> - Authorization Code: `the_code_you_copied`"

Claude will use the `polar_exchange_authorization_code` tool and return your `POLAR_ACCESS_TOKEN` and `POLAR_USER_ID`.

### Step 6: Update Your MCP Configuration

Add the token and user ID to your MCP server configuration:

```json
{
  "mcpServers": {
    "polar-accesslink": {
      "command": "node",
      "args": ["/path/to/polar-accesslink-mcp-server/dist/index.js"],
      "env": {
        "POLAR_ACCESS_TOKEN": "your_access_token",
        "POLAR_USER_ID": "your_user_id"
      }
    }
  }
}
```

Restart Claude Code (or your MCP client) to apply the changes.

### Step 7: Register Your User (Required!)

**This step is required before accessing any data.** Ask Claude:

> "Register my Polar user"

Claude will use the `polar_register_user` tool to link your application to your Polar account. Without this step, all API calls will fail with "Access Denied" errors.

### You're Ready!

You can now ask Claude about your Polar data:
- "Show me my recent exercises"
- "What was my sleep like last night?"
- "How many steps did I take this week?"

## Available Tools

### OAuth
- `polar_get_authorization_url` - Generate the OAuth authorization URL to start the setup flow
- `polar_exchange_authorization_code` - Exchange an authorization code for an access token

### User Management
- `polar_register_user` - Register a new user with Polar AccessLink (required before accessing data)
- `polar_get_user` - Get user information
- `polar_delete_user` - Delete user registration

### Exercises
- `polar_list_exercises` - List exercises from the last 30 days
- `polar_get_exercise` - Get detailed exercise information
- `polar_download_exercise_fit` - Download exercise in FIT format
- `polar_download_exercise_tcx` - Download exercise in TCX format
- `polar_download_exercise_gpx` - Download exercise route in GPX format

### Daily Activity
- `polar_list_activities` - List daily activity summaries (last 28 days)
- `polar_get_activity` - Get activity for a specific date
- `polar_list_activity_samples` - List activity sample data
- `polar_get_activity_samples` - Get activity samples for a specific date

### Physical Information
- `polar_list_physical_info` - List physical information entries
- `polar_get_physical_info` - Get specific physical information entry

### Heart Rate
- `polar_list_heart_rate` - List heart rate data for a date range
- `polar_get_heart_rate` - Get heart rate data for a specific date

### Sleep
- `polar_list_sleep` - List sleep records
- `polar_get_sleep` - Get specific night's sleep data

### Nightly Recharge
- `polar_list_nightly_recharge` - List nightly recharge data
- `polar_get_nightly_recharge` - Get specific night's recharge data

## Response Formats

All tools support two response formats:
- `markdown` (default) - Human-readable formatted output
- `json` - Full structured JSON response

## Data Retention Limits

The Polar AccessLink API only provides access to recent data. Older data is not available through the API:

| Data Type | Retention Period |
|-----------|------------------|
| Exercises | 30 days |
| Daily Activity | 28 days |
| Activity Samples | 28 days |
| Continuous Heart Rate | 28 days |
| Sleep | 28 days |
| Nightly Recharge | 28 days |
| Physical Information | No limit (all entries available) |

If you need to preserve historical data, export it regularly using the FIT/TCX/GPX download tools or the JSON format.

## Troubleshooting

### "Access Denied" errors
You forgot to register your user. Run `polar_register_user` after configuring your access token.

### Invalid or expired authorization code
Authorization codes are single-use and expire quickly. If the token exchange fails:
1. Generate a new authorization URL with `polar_get_authorization_url`
2. Complete the authorization flow again
3. Use the new code immediately

### 401 Unauthorized errors
Verify your `client_id` and `client_secret` are correct. You can find these at https://admin.polaraccesslink.com/

### No data returned
- Ensure your Polar device has synced with Polar Flow
- The API only returns recent data (see [Data Retention Limits](#data-retention-limits))
- Check that your Polar Flow account has the data you're looking for

---

<details>
<summary><strong>Manual OAuth Setup (Alternative)</strong></summary>

If you prefer not to use Claude's OAuth helper tools, you can complete the setup manually:

1. Create an application at https://admin.polaraccesslink.com/
2. Set your redirect URI (e.g., `https://localhost:8080/callback`)
3. Direct users to authorize:
   ```
   https://flow.polar.com/oauth2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&scope=accesslink.read_all
   ```
4. After authorization, copy the `code` parameter from the redirect URL
5. Exchange the authorization code for tokens:
   ```bash
   curl -X POST https://polarremote.com/v2/oauth2/token \
     -u "CLIENT_ID:CLIENT_SECRET" \
     -d "grant_type=authorization_code&code=AUTH_CODE&redirect_uri=YOUR_REDIRECT_URI"
   ```
6. The response contains `access_token` and `x_user_id` — use these as `POLAR_ACCESS_TOKEN` and `POLAR_USER_ID`
7. **Important**: You must still call the user registration endpoint before accessing data:
   ```bash
   curl -X POST https://www.polaraccesslink.com/v3/users \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"member-id": "your_unique_id"}'
   ```

</details>

## License

MIT

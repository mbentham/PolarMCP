# Polar Fitness MCP Server

**An MCP server that turns raw Polar device data into AI-ready fitness insights. Exercise samples, heart rate streams, sleep hypnograms, and recovery metrics are preprocessed into compact summaries — so an AI assistant can analyse days of health data without blowing its context window.**

## Quick Start

**1. Register** at [admin.polaraccesslink.com](https://admin.polaraccesslink.com/) — create a new API client, note your `client_id` and `client_secret`, and set the redirect URI to `https://localhost:8080/callback`.

**2. Install**

```bash
npm install
npm run build
```

**3. Configure** — add to your MCP client (Claude Code `settings.json`, Claude Desktop, etc.):

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

**4. Authenticate** — ask Claude to generate your authorization URL using your client ID, complete the browser flow, then exchange the code for an access token. Add the returned credentials to your config:

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

**5. Register your user** — after restarting, ask Claude to call `polar_register_user`. This is required before accessing any data.

## Features

- **Exercise tracking** — workouts with heart rate zones, training load, and preprocessed sample metrics (pace splits, power, altitude, cadence, HRV)
- **Daily activity** — steps, calories, active/inactive duration with hourly step buckets and activity zone breakdowns
- **Sleep analysis** — sleep score, stages (light/deep/REM), sleep architecture, and heart rate trends during sleep
- **Continuous heart rate** — 24/7 heart rate data with preprocessed half-hourly buckets (avg/min/max)
- **Nightly recharge** — ANS charge, HRV trends, and breathing rate analysis
- **Cardio load** — daily strain, tolerance, and load ratio metrics
- **SleepWise alertness** — hourly alertness predictions based on sleep quality
- **Exercise downloads** — export workouts in FIT, TCX, or GPX format
- **Dual output** — all tools support `markdown` (human-readable) or `json` (structured) response formats

## Why Preprocessing Matters

The Polar AccessLink API returns raw sensor data — thousands of individual heart rate readings, comma-separated sample strings with tens of thousands of values, and per-minute hypnogram entries. Passing this directly to an AI assistant would consume most of the context window on a single tool call, leaving little room for conversation or multi-tool workflows.

This server preprocesses raw data into compact, meaningful summaries before it reaches the AI:

| Raw API Data | Preprocessed Output |
|---|---|
| ~5,000 comma-separated speed/distance values | Per-km pace splits with avg speed |
| ~8,000 heart rate samples per day | 48 half-hourly buckets (avg/min/max) + daily stats |
| Per-minute sleep hypnogram entries | Sleep architecture: cycle count, deep/REM distribution, time to first deep sleep |
| Per-minute heart rate during sleep | Min, avg, nadir (rolling average), and trend slope (bpm/hr) |
| Raw HRV and breathing samples | Min/max/trend statistics via linear regression |
| Raw power samples | Avg, normalized power, max, and variability index |
| Per-second altitude readings | Total ascent/descent + elevation range |

The result is that a full day of activity, sleep, and heart rate data fits comfortably in a few hundred tokens instead of tens of thousands — making multi-day queries and cross-domain analysis practical within a single conversation.

## Tools

The server provides 13 tools across 5 domains.

### OAuth

| Tool | Description |
|------|-------------|
| `polar_get_authorization_url` | Generate the OAuth authorization URL to start the setup flow. |
| `polar_exchange_authorization_code` | Exchange an authorization code for an access token. Returns `POLAR_ACCESS_TOKEN` and `POLAR_USER_ID`. |

### User Management

| Tool | Description |
|------|-------------|
| `polar_register_user` | Register a new user with Polar AccessLink. Required before accessing any data. |
| `polar_get_user` | Get user information including name, registration date, and physical attributes. |

### Exercises

| Tool | Description |
|------|-------------|
| `polar_get_exercises` | Get exercises from the last 30 days. Optionally include preprocessed sample metrics (pace splits, power, altitude, cadence, HRV, temperature). Supports date range filtering. |
| `polar_download_exercise` | Download exercise data to a file in FIT, TCX, or GPX format. |

### Daily Activity

| Tool | Description |
|------|-------------|
| `polar_get_activities` | Get daily activity summaries with preprocessed hourly step buckets and activity zone duration breakdowns. Returns last 28 days by default, or a custom date range. |

### Health & Recovery

| Tool | Description |
|------|-------------|
| `polar_list_physical_info` | List physical information entries including weight, height, heart rate zones, and VO2 max. |
| `polar_get_heart_rate` | Get continuous heart rate data with preprocessed half-hourly buckets (avg/min/max) and daily statistics. |
| `polar_list_sleep` | List sleep records with sleep score, stages, continuity, and preprocessed sleep architecture (cycle analysis, deep/REM distribution). |
| `polar_list_nightly_recharge` | List nightly recharge data with ANS charge, HRV min/max/trend, and breathing rate analysis. |
| `polar_get_cardio_load` | Get daily cardio load metrics including strain, tolerance, load ratio, and load level thresholds. |
| `polar_get_sleepwise` | Get SleepWise alertness predictions with hourly breakdowns including alertness grade, classification, and sleep inertia. |

## Data Retention

The Polar AccessLink API only provides access to recent data:

| Data Type | Retention |
|-----------|-----------|
| Exercises | 30 days |
| Daily Activity | 28 days |
| Continuous Heart Rate | 28 days |
| Sleep | 28 days |
| Nightly Recharge | 28 days |
| Cardio Load | 28 days |
| SleepWise Alertness | 28 days |
| Physical Information | No limit |

To preserve historical data, export regularly using `polar_download_exercise` or the `json` response format.

## Troubleshooting

### "Access Denied" errors
You need to register your user. Ask Claude to call `polar_register_user` after configuring your access token.

### Invalid or expired authorization code
Authorization codes are single-use and expire quickly. Generate a new authorization URL and complete the flow again.

### 401 Unauthorized errors
Verify your `client_id` and `client_secret` are correct at [admin.polaraccesslink.com](https://admin.polaraccesslink.com/).

### No data returned
- Ensure your Polar device has synced with Polar Flow
- The API only returns recent data (see [Data Retention](#data-retention))

<details>
<summary><strong>Manual OAuth Setup</strong></summary>

If you prefer not to use Claude's OAuth helper tools:

1. Create an application at [admin.polaraccesslink.com](https://admin.polaraccesslink.com/)
2. Set your redirect URI (e.g., `https://localhost:8080/callback`)
3. Direct users to authorize:
   ```
   https://flow.polar.com/oauth2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&scope=accesslink.read_all
   ```
4. Copy the `code` parameter from the redirect URL
5. Exchange the code for tokens:
   ```bash
   curl -X POST https://polarremote.com/v2/oauth2/token \
     -u "CLIENT_ID:CLIENT_SECRET" \
     -d "grant_type=authorization_code&code=AUTH_CODE&redirect_uri=YOUR_REDIRECT_URI"
   ```
6. Use `access_token` as `POLAR_ACCESS_TOKEN` and `x_user_id` as `POLAR_USER_ID`
7. Register your user:
   ```bash
   curl -X POST https://www.polaraccesslink.com/v3/users \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"member-id": "YOUR_USER_ID"}'
   ```

</details>

## License

[MIT](LICENSE)

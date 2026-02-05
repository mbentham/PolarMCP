import { z } from "zod";
import { getApiClient } from "../services/api-client.js";
import { ENDPOINTS } from "../constants.js";
import { schemas } from "../schemas/input.js";
import type { DailyActivity, DailyActivityList, ActivitySamples, ActivitySamplesList, ResponseFormat } from "../types.js";

function formatActivityMarkdown(activity: DailyActivity): string {
  // Extract date from start_time (format: "2026-02-03T00:00")
  const date = activity.start_time?.split("T")[0] || "Unknown";

  const lines = [
    `### Activity: ${date}`,
    "",
    `- **Date**: ${date}`,
    `- **Calories**: ${activity.calories} kcal`,
  ];

  if (activity.active_calories) lines.push(`- **Active Calories**: ${activity.active_calories} kcal`);
  if (activity.steps) lines.push(`- **Steps**: ${activity.steps}`);
  if (activity.active_duration) lines.push(`- **Active Duration**: ${activity.active_duration}`);
  if (activity.inactive_duration) lines.push(`- **Inactive Duration**: ${activity.inactive_duration}`);
  if (activity.daily_activity !== undefined) lines.push(`- **Daily Activity Goal**: ${activity.daily_activity.toFixed(1)}%`);
  if (activity.distance_from_steps) lines.push(`- **Distance**: ${activity.distance_from_steps} m`);
  if (activity.inactivity_alert_count !== undefined) lines.push(`- **Inactivity Alerts**: ${activity.inactivity_alert_count}`);

  return lines.join("\n");
}

function formatActivityListMarkdown(data: DailyActivityList): string {
  if (!data.activities || data.activities.length === 0) {
    return "## Daily Activities\n\nNo activities found.";
  }

  const lines = [
    "## Daily Activities",
    "",
    `Found ${data.activities.length} activity record(s):`,
    "",
  ];

  for (const activity of data.activities) {
    lines.push(formatActivityMarkdown(activity));
    lines.push("");
  }

  return lines.join("\n");
}

function formatActivitySamplesMarkdown(data: ActivitySamples): string {
  const lines = [
    `### Activity Samples: ${data.date}`,
    "",
    `- **Date**: ${data.date}`,
  ];

  // Step samples
  if (data.steps) {
    lines.push(`- **Total Steps**: ${data.steps.total_steps}`);
    lines.push(`- **Sample Interval**: ${data.steps.interval_ms / 1000}s`);

    if (data.steps.samples && data.steps.samples.length > 0) {
      lines.push("", "#### Step Samples (first 10)");
      const sampleCount = Math.min(data.steps.samples.length, 10);
      for (let i = 0; i < sampleCount; i++) {
        const sample = data.steps.samples[i];
        const time = sample.timestamp.split("T")[1] || sample.timestamp;
        lines.push(`- **${time}**: ${sample.steps} steps`);
      }
      if (data.steps.samples.length > 10) {
        lines.push(`- ... and ${data.steps.samples.length - 10} more samples`);
      }
    }
  }

  // Activity zones summary
  if (data.activity_zones?.samples && data.activity_zones.samples.length > 0) {
    lines.push("", "#### Activity Zones (first 10)");
    const zoneCount = Math.min(data.activity_zones.samples.length, 10);
    for (let i = 0; i < zoneCount; i++) {
      const zone = data.activity_zones.samples[i];
      const time = zone.timestamp.split("T")[1] || zone.timestamp;
      lines.push(`- **${time}**: ${zone.zone}`);
    }
    if (data.activity_zones.samples.length > 10) {
      lines.push(`- ... and ${data.activity_zones.samples.length - 10} more zones`);
    }
  }

  // Inactivity stamps
  if (data.inactivity_stamps?.samples && data.inactivity_stamps.samples.length > 0) {
    lines.push("", "#### Inactivity Alerts");
    for (const stamp of data.inactivity_stamps.samples) {
      lines.push(`- ${stamp.stamp}`);
    }
  }

  return lines.join("\n");
}

function formatActivitySamplesListMarkdown(data: ActivitySamplesList): string {
  if (!data.samples || data.samples.length === 0) {
    return "## Activity Samples\n\nNo activity samples found.";
  }

  const lines = [
    "## Activity Samples",
    "",
    `Found ${data.samples.length} sample record(s):`,
    "",
  ];

  for (const samples of data.samples) {
    lines.push(formatActivitySamplesMarkdown(samples));
    lines.push("");
  }

  return lines.join("\n");
}

function formatResponse<T>(data: T, format: ResponseFormat, markdownFormatter: (data: T) => string): string {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }
  return markdownFormatter(data);
}

export async function listActivities(input: z.infer<typeof schemas.listActivities>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<DailyActivityList>(ENDPOINTS.ACTIVITIES, {
    limit: input.limit,
    offset: input.offset,
  });

  return formatResponse(result, input.format, formatActivityListMarkdown);
}

export async function getActivity(input: z.infer<typeof schemas.getActivity>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<DailyActivity>(ENDPOINTS.ACTIVITY(input.date));

  return formatResponse(result, input.format, (data) => {
    return "## Daily Activity Details\n\n" + formatActivityMarkdown(data);
  });
}

export async function listActivitySamples(input: z.infer<typeof schemas.listActivitySamples>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<ActivitySamplesList>(ENDPOINTS.ACTIVITY_SAMPLES, {
    limit: input.limit,
    offset: input.offset,
  });

  return formatResponse(result, input.format, formatActivitySamplesListMarkdown);
}

export async function getActivitySamples(input: z.infer<typeof schemas.getActivitySamples>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<ActivitySamples>(ENDPOINTS.ACTIVITY_SAMPLES_DATE(input.date));

  return formatResponse(result, input.format, (data) => {
    return "## Activity Samples Details\n\n" + formatActivitySamplesMarkdown(data);
  });
}

export const activityTools = {
  polar_list_activities: {
    name: "polar_list_activities",
    description: "List daily activity summaries from the last 28 days. Returns daily calories, steps, and activity goals.",
    inputSchema: schemas.listActivities,
    handler: listActivities,
    annotations: {
      title: "List Activities",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_get_activity: {
    name: "polar_get_activity",
    description: "Get daily activity summary for a specific date including calories burned, steps taken, and goal progress.",
    inputSchema: schemas.getActivity,
    handler: getActivity,
    annotations: {
      title: "Get Activity",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_list_activity_samples: {
    name: "polar_list_activity_samples",
    description: "List activity sample data from the last 28 days. Returns time-series data with steps, calories, and activity levels.",
    inputSchema: schemas.listActivitySamples,
    handler: listActivitySamples,
    annotations: {
      title: "List Activity Samples",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_get_activity_samples: {
    name: "polar_get_activity_samples",
    description: "Get activity sample data for a specific date. Returns detailed time-series data throughout the day.",
    inputSchema: schemas.getActivitySamples,
    handler: getActivitySamples,
    annotations: {
      title: "Get Activity Samples",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

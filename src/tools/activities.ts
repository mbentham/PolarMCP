import { z } from "zod";
import { getApiClient } from "../services/api-client.js";
import { ENDPOINTS } from "../constants.js";
import { schemas } from "../schemas/input.js";
import type {
  DailyActivity,
  ActivitySamples,
  StepSample,
  ActivityZoneSample,
  ProcessedActivity,
  ZoneSummary,
} from "../types.js";

function aggregateHourlySteps(samples: StepSample[]): { hour: number; steps: number }[] {
  const buckets: Record<number, number> = {};

  for (const sample of samples) {
    const hour = parseInt(sample.timestamp.split("T")[1].split(":")[0], 10);
    buckets[hour] = (buckets[hour] || 0) + sample.steps;
  }

  return Object.entries(buckets)
    .map(([h, s]) => ({ hour: Number(h), steps: s }))
    .filter((b) => b.steps > 0)
    .sort((a, b) => a.hour - b.hour);
}

function computeZoneDurations(samples: ActivityZoneSample[]): ZoneSummary {
  const summary: ZoneSummary = {
    sedentary_minutes: 0,
    light_minutes: 0,
    moderate_minutes: 0,
    vigorous_minutes: 0,
  };

  const zoneMap: Record<string, keyof ZoneSummary> = {
    SEDENTARY: "sedentary_minutes",
    LIGHT: "light_minutes",
    MODERATE: "moderate_minutes",
    VIGOROUS: "vigorous_minutes",
  };

  for (let i = 0; i < samples.length - 1; i++) {
    const zone = samples[i].zone;
    const key = zoneMap[zone];
    if (!key) continue; // skip SLEEP, NON_WEAR

    const start = new Date(samples[i].timestamp).getTime();
    const end = new Date(samples[i + 1].timestamp).getTime();
    const minutes = (end - start) / 60000;

    if (minutes > 0) {
      summary[key] += minutes;
    }
  }

  // Round to nearest integer
  summary.sedentary_minutes = Math.round(summary.sedentary_minutes);
  summary.light_minutes = Math.round(summary.light_minutes);
  summary.moderate_minutes = Math.round(summary.moderate_minutes);
  summary.vigorous_minutes = Math.round(summary.vigorous_minutes);

  return summary;
}

function preprocessActivity(
  activity: DailyActivity,
  samples: ActivitySamples | null
): ProcessedActivity {
  const date = activity.start_time?.split("T")[0] || "Unknown";

  const hourlySteps = samples?.steps?.samples
    ? aggregateHourlySteps(samples.steps.samples)
    : [];

  const zoneSummary = samples?.activity_zones?.samples
    ? computeZoneDurations(samples.activity_zones.samples)
    : { sedentary_minutes: 0, light_minutes: 0, moderate_minutes: 0, vigorous_minutes: 0 };

  return {
    date,
    active_duration: activity.active_duration || "PT0S",
    inactive_duration: activity.inactive_duration || "PT0S",
    calories: activity.calories,
    active_calories: activity.active_calories || 0,
    steps: activity.steps || 0,
    distance_from_steps: activity.distance_from_steps || 0,
    hourly_steps: hourlySteps,
    zone_summary: zoneSummary,
  };
}

function formatActivitiesMarkdown(activities: ProcessedActivity[]): string {
  if (activities.length === 0) {
    return "## Daily Activities\n\nNo activities found.";
  }

  const lines = [
    "## Daily Activities",
    "",
    `Found ${activities.length} day(s):`,
    "",
  ];

  for (const a of activities) {
    lines.push(`### ${a.date}`);
    lines.push(
      `- **Active**: ${a.active_duration} | **Inactive**: ${a.inactive_duration}`
    );
    lines.push(
      `- **Calories**: ${a.calories} (active: ${a.active_calories}) | **Steps**: ${a.steps} | **Distance**: ${a.distance_from_steps}m`
    );

    if (a.hourly_steps.length > 0) {
      lines.push("");
      lines.push("| Hour | Steps |");
      lines.push("|------|-------|");
      for (const h of a.hourly_steps) {
        lines.push(`| ${h.hour} | ${h.steps} |`);
      }
    }

    const z = a.zone_summary;
    lines.push("");
    lines.push(
      `**Zones**: Sedentary ${z.sedentary_minutes}min | Light ${z.light_minutes}min | Moderate ${z.moderate_minutes}min | Vigorous ${z.vigorous_minutes}min`
    );
    lines.push("");
  }

  return lines.join("\n");
}

function generateDateRange(from?: string, to?: string): string[] {
  const todayStr = new Date().toISOString().split("T")[0];

  const startStr = from || (() => {
    const d = new Date(todayStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 27); // 28 days including today
    return d.toISOString().split("T")[0];
  })();

  const endStr = to || todayStr;

  const dates: string[] = [];
  const current = new Date(startStr + "T00:00:00Z");
  const end = new Date(endStr + "T00:00:00Z");
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function getActivities(
  input: z.infer<typeof schemas.getActivities>
): Promise<string> {
  const client = getApiClient();

  const dates = generateDateRange(input.from, input.to);

  // Fetch summary + samples for each date with concurrency limit
  const fetchDate = async (date: string): Promise<ProcessedActivity | null> => {
    let activity: DailyActivity | null = null;
    let samples: ActivitySamples | null = null;

    try {
      activity = await client.get<DailyActivity>(ENDPOINTS.ACTIVITY(date));
    } catch {
      return null; // No activity data for this date
    }

    try {
      samples = await client.get<ActivitySamples>(
        ENDPOINTS.ACTIVITY_SAMPLES_DATE(date)
      );
    } catch {
      // Samples may not be available
    }

    return preprocessActivity(activity, samples);
  };

  const CONCURRENCY = 5;
  const results: (ProcessedActivity | null)[] = [];
  for (let i = 0; i < dates.length; i += CONCURRENCY) {
    const batch = dates.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(fetchDate));
    results.push(...batchResults);
  }

  const processed = results.filter((r): r is ProcessedActivity => r !== null);

  if (input.format === "json") {
    return JSON.stringify(processed, null, 2);
  }
  return formatActivitiesMarkdown(processed);
}

export const activityTools = {
  polar_get_activities: {
    name: "polar_get_activities",
    description:
      "Get daily activity summaries from the last 28 days with preprocessed hourly step buckets and zone duration breakdowns. Optionally filter by date range.",
    inputSchema: schemas.getActivities,
    handler: getActivities,
    annotations: {
      title: "Get Activities",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

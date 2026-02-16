import { z } from "zod";
import { getApiClient } from "../services/api-client.js";
import { ENDPOINTS } from "../constants.js";
import { schemas } from "../schemas/input.js";
import type {
  PhysicalInfo,
  TransactionLocation,
  PhysicalInfoUrlList,
  ContinuousHeartRateList,
  HeartRateSample,
  HalfHourBucket,
  ProcessedHeartRate,
  Sleep,
  SleepList,
  SleepHeartRateStats,
  SleepArchitecture,
  ProcessedSleep,
  NightlyRecharge,
  NightlyRechargeList,
  ProcessedNightlyRecharge,
  CardioLoad,
  SleepWiseAlertness,
  ProcessedSleepWiseAlertness,
} from "../types.js";
import { formatResponse } from "../utils/format.js";

// Physical Info formatters
function formatPhysicalInfoMarkdown(info: PhysicalInfo): string {
  const lines = [
    `### Physical Info: ${info.created.split("T")[0]}`,
    "",
    `- **ID**: ${info.id}`,
    `- **Created**: ${info.created}`,
  ];

  if (info.weight) lines.push(`- **Weight**: ${info.weight} kg`);
  if (info["weight-source"]) lines.push(`- **Weight Source**: ${info["weight-source"]}`);
  if (info.height) lines.push(`- **Height**: ${info.height} cm`);
  if (info["maximum-heart-rate"]) lines.push(`- **Max Heart Rate**: ${info["maximum-heart-rate"]} bpm`);
  if (info["resting-heart-rate"]) lines.push(`- **Resting Heart Rate**: ${info["resting-heart-rate"]} bpm`);
  if (info["vo2-max"]) lines.push(`- **VO2 Max**: ${info["vo2-max"]}`);
  if (info["aerobic-threshold"]) lines.push(`- **Aerobic Threshold**: ${info["aerobic-threshold"]} bpm`);
  if (info["anaerobic-threshold"]) lines.push(`- **Anaerobic Threshold**: ${info["anaerobic-threshold"]} bpm`);
  if (info["body-mass-index"]) lines.push(`- **BMI**: ${info["body-mass-index"]}`);
  if (info["fat-percent"]) lines.push(`- **Body Fat**: ${info["fat-percent"]}%`);

  return lines.join("\n");
}

function formatPhysicalInfoListMarkdown(data: PhysicalInfo[]): string {
  if (data.length === 0) {
    return "## Physical Information\n\nNo physical information records found.";
  }

  const lines = [
    "## Physical Information",
    "",
    `Found ${data.length} record(s):`,
    "",
  ];

  for (const info of data) {
    lines.push(formatPhysicalInfoMarkdown(info));
    lines.push("");
  }

  return lines.join("\n");
}

// Heart Rate preprocessing
function bucketHeartRateSamples(samples: HeartRateSample[]): HalfHourBucket[] {
  // Accumulate into 48 buckets (0-47), each covering 30 minutes
  const bucketSums: number[] = new Array(48).fill(0);
  const bucketMins: number[] = new Array(48).fill(Infinity);
  const bucketMaxs: number[] = new Array(48).fill(-Infinity);
  const bucketCounts: number[] = new Array(48).fill(0);

  for (const sample of samples) {
    const parts = sample.sample_time.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const bucketIndex = hours * 2 + (minutes >= 30 ? 1 : 0);

    bucketSums[bucketIndex] += sample.heart_rate;
    bucketCounts[bucketIndex]++;
    if (sample.heart_rate < bucketMins[bucketIndex]) bucketMins[bucketIndex] = sample.heart_rate;
    if (sample.heart_rate > bucketMaxs[bucketIndex]) bucketMaxs[bucketIndex] = sample.heart_rate;
  }

  const buckets: HalfHourBucket[] = [];
  for (let i = 0; i < 48; i++) {
    if (bucketCounts[i] === 0) continue;
    // Label = end of the 30-min window
    const labelMinutesTotal = (i + 1) * 30;
    const labelHours = Math.floor(labelMinutesTotal / 60);
    const labelMins = labelMinutesTotal % 60;
    const label = `${String(labelHours).padStart(2, "0")}:${String(labelMins).padStart(2, "0")}`;

    buckets.push({
      time: label,
      avg: Math.round(bucketSums[i] / bucketCounts[i]),
      min: bucketMins[i],
      max: bucketMaxs[i],
      samples: bucketCounts[i],
    });
  }

  return buckets;
}

function preprocessHeartRate(date: string, samples: HeartRateSample[]): ProcessedHeartRate {
  const buckets = bucketHeartRateSamples(samples);
  const heartRates = samples.map((s) => s.heart_rate);
  const dailyAvg = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length);

  return {
    date,
    buckets,
    daily_avg: dailyAvg,
    daily_min: Math.min(...heartRates),
    daily_max: Math.max(...heartRates),
    total_samples: samples.length,
  };
}

function formatProcessedHeartRateMarkdown(data: ProcessedHeartRate[]): string {
  if (data.length === 0) {
    return "## Continuous Heart Rate\n\nNo heart rate data found.";
  }

  const lines = [
    "## Continuous Heart Rate",
    "",
    `Found ${data.length} day(s) of data:`,
  ];

  for (const day of data) {
    lines.push("");
    lines.push(`### ${day.date}`);
    lines.push(`- **Samples**: ${day.total_samples} | **Avg**: ${day.daily_avg} bpm | **Min**: ${day.daily_min} bpm | **Max**: ${day.daily_max} bpm`);
    lines.push("");
    lines.push("| Time  | Avg | Min | Max | Samples |");
    lines.push("|-------|-----|-----|-----|---------|");
    for (const bucket of day.buckets) {
      lines.push(`| ${bucket.time} | ${bucket.avg} | ${bucket.min} | ${bucket.max} | ${bucket.samples} |`);
    }
  }

  return lines.join("\n");
}

// Sleep preprocessing

/** Midnight-aware time parsing: times before ~18:00 are treated as next day when sleep starts in the evening */
function parseSleepTime(timeStr: string, sleepStartHour: number): number {
  const [h, m] = timeStr.split(":").map(Number);
  let minutes = h * 60 + m;
  if (sleepStartHour >= 18 && h < 18) minutes += 1440;
  return minutes;
}

/** Linear regression slope in units/hour over midnight-aware time samples */
function computeTrendSlope(samples: Record<string, number>, sleepStartHour: number): number {
  const entries = Object.entries(samples);
  const values = entries.map(([, v]) => v);
  const timePoints = entries.map(([k]) => parseSleepTime(k, sleepStartHour));
  const firstTime = timePoints[0];
  const xHours = timePoints.map((t) => (t - firstTime) / 60);

  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xHours[i];
    sumY += values[i];
    sumXY += xHours[i] * values[i];
    sumX2 += xHours[i] * xHours[i];
  }
  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : Math.round(((n * sumXY - sumX * sumY) / denom) * 100) / 100;
}

function computeSleepHrStats(samples: Record<string, number>, sleepStartHour: number): SleepHeartRateStats {
  const values = Object.values(samples);

  const min = Math.min(...values);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  // Nadir: minimum of 3-point rolling average
  let nadir: number;
  if (values.length < 3) {
    nadir = min;
  } else {
    nadir = Infinity;
    for (let i = 0; i <= values.length - 3; i++) {
      const rollingAvg = (values[i] + values[i + 1] + values[i + 2]) / 3;
      if (rollingAvg < nadir) nadir = rollingAvg;
    }
    nadir = Math.round(nadir);
  }

  const trend_slope = computeTrendSlope(samples, sleepStartHour);

  return { min, avg, nadir, trend_slope };
}

function computeSleepArchitecture(hypnogram: Record<string, number>, sleep: Sleep, sleepStartHour: number): SleepArchitecture {
  // Sort entries by midnight-aware time
  const entries = Object.entries(hypnogram)
    .map(([time, stage]) => ({ time, stage, minutes: parseSleepTime(time, sleepStartHour) }))
    .sort((a, b) => a.minutes - b.minutes);

  // Compute segments with durations
  const segments: { stage: number; start: number; duration: number }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const start = entries[i].minutes;
    const end = i < entries.length - 1 ? entries[i + 1].minutes : start;
    segments.push({ stage: entries[i].stage, start, duration: end - start });
  }

  const sleepStart = entries[0].minutes;
  const sleepEnd = entries[entries.length - 1].minutes;
  const totalDuration = sleepEnd - sleepStart;
  const midpoint = sleepStart + totalDuration / 2;

  // Time to first deep sleep (stage 4)
  const firstDeep = segments.find((s) => s.stage === 4);
  const time_to_first_deep_sleep_min = firstDeep
    ? Math.round(firstDeep.start - sleepStart)
    : 0;

  // Number of REM cycles: transitions into stage 1 from non-1
  let number_of_rem_cycles = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].stage === 1 && (i === 0 || segments[i - 1].stage !== 1)) {
      number_of_rem_cycles++;
    }
  }

  // Avg cycle length using API's sleep_cycles field, fallback to REM cycles
  const cycleCount = sleep.sleep_cycles || number_of_rem_cycles;
  const totalSleepSeconds = (sleep.light_sleep || 0) + (sleep.deep_sleep || 0) + (sleep.rem_sleep || 0);
  const avg_cycle_length_min = cycleCount > 0
    ? Math.round(totalSleepSeconds / 60 / cycleCount)
    : 0;

  // Deep sleep in first half
  let firstHalfDeep = 0;
  let totalDeep = 0;
  for (const seg of segments) {
    if (seg.stage === 4) {
      totalDeep += seg.duration;
      if (seg.start < midpoint) {
        const effectiveEnd = Math.min(seg.start + seg.duration, midpoint);
        firstHalfDeep += effectiveEnd - seg.start;
      }
    }
  }
  const deep_sleep_in_first_half_pct = totalDeep > 0
    ? Math.round(firstHalfDeep / totalDeep * 100)
    : 0;

  // REM sleep in second half
  let secondHalfRem = 0;
  let totalRem = 0;
  for (const seg of segments) {
    if (seg.stage === 1) {
      totalRem += seg.duration;
      const segEnd = seg.start + seg.duration;
      if (segEnd > midpoint) {
        const effectiveStart = Math.max(seg.start, midpoint);
        secondHalfRem += segEnd - effectiveStart;
      }
    }
  }
  const rem_sleep_in_second_half_pct = totalRem > 0
    ? Math.round(secondHalfRem / totalRem * 100)
    : 0;

  return {
    time_to_first_deep_sleep_min,
    number_of_rem_cycles,
    avg_cycle_length_min,
    deep_sleep_in_first_half_pct,
    rem_sleep_in_second_half_pct,
  };
}

function preprocessSleep(sleep: Sleep): ProcessedSleep {
  const sleepStartHour = parseInt(sleep.sleep_start_time.split("T")[1]?.split(":")[0] || "22", 10);

  const processed: ProcessedSleep = {
    date: sleep.date,
    sleep_start_time: sleep.sleep_start_time,
    sleep_end_time: sleep.sleep_end_time,
  };

  // Copy scalar fields (omit polar_user, device_id, unrecognized_sleep_stage, sleep_goal)
  if (sleep.continuity !== undefined) processed.continuity = sleep.continuity;
  if (sleep.continuity_class !== undefined) processed.continuity_class = sleep.continuity_class;
  if (sleep.light_sleep !== undefined) processed.light_sleep = sleep.light_sleep;
  if (sleep.deep_sleep !== undefined) processed.deep_sleep = sleep.deep_sleep;
  if (sleep.rem_sleep !== undefined) processed.rem_sleep = sleep.rem_sleep;
  if (sleep.sleep_score !== undefined) processed.sleep_score = sleep.sleep_score;
  if (sleep.total_interruption_duration !== undefined) processed.total_interruption_duration = sleep.total_interruption_duration;
  if (sleep.sleep_charge !== undefined) processed.sleep_charge = sleep.sleep_charge;
  if (sleep.sleep_rating !== undefined) processed.sleep_rating = sleep.sleep_rating;
  if (sleep.short_interruption_duration !== undefined) processed.short_interruption_duration = sleep.short_interruption_duration;
  if (sleep.long_interruption_duration !== undefined) processed.long_interruption_duration = sleep.long_interruption_duration;
  if (sleep.sleep_cycles !== undefined) processed.sleep_cycles = sleep.sleep_cycles;
  if (sleep.group_duration_score !== undefined) processed.group_duration_score = sleep.group_duration_score;
  if (sleep.group_solidity_score !== undefined) processed.group_solidity_score = sleep.group_solidity_score;
  if (sleep.group_regeneration_score !== undefined) processed.group_regeneration_score = sleep.group_regeneration_score;

  // Preprocess heart rate samples
  if (sleep.heart_rate_samples && Object.keys(sleep.heart_rate_samples).length > 0) {
    processed.heart_rate = computeSleepHrStats(sleep.heart_rate_samples, sleepStartHour);
  }

  // Preprocess hypnogram into sleep architecture
  if (sleep.hypnogram && Object.keys(sleep.hypnogram).length > 1) {
    processed.sleep_architecture = computeSleepArchitecture(sleep.hypnogram, sleep, sleepStartHour);
  }

  return processed;
}

function formatProcessedSleepMarkdown(data: ProcessedSleep[]): string {
  if (data.length === 0) {
    return "## Sleep Records\n\nNo sleep records found.";
  }

  const lines = [
    "## Sleep Records",
    "",
    `Found ${data.length} night(s) of data:`,
  ];

  for (const night of data) {
    const startTime = night.sleep_start_time.split("T")[1]?.substring(0, 5) || night.sleep_start_time;
    const endTime = night.sleep_end_time.split("T")[1]?.substring(0, 5) || night.sleep_end_time;

    lines.push("");
    lines.push(`### ${night.date}`);

    // Main line
    const mainParts = [`**Sleep**: ${startTime} → ${endTime}`];
    if (night.sleep_score !== undefined) mainParts.push(`**Score**: ${night.sleep_score}`);
    if (night.sleep_cycles !== undefined) mainParts.push(`**Cycles**: ${night.sleep_cycles}`);
    lines.push(`- ${mainParts.join(" | ")}`);

    // Stage durations
    const stageParts: string[] = [];
    if (night.light_sleep !== undefined) stageParts.push(`**Light**: ${Math.round(night.light_sleep / 60)} min`);
    if (night.deep_sleep !== undefined) stageParts.push(`**Deep**: ${Math.round(night.deep_sleep / 60)} min`);
    if (night.rem_sleep !== undefined) stageParts.push(`**REM**: ${Math.round(night.rem_sleep / 60)} min`);
    if (stageParts.length > 0) lines.push(`- ${stageParts.join(" | ")}`);

    // Continuity & interruptions
    const contParts: string[] = [];
    if (night.continuity !== undefined) contParts.push(`**Continuity**: ${night.continuity}`);
    if (night.total_interruption_duration !== undefined) contParts.push(`**Interruptions**: ${Math.round(night.total_interruption_duration / 60)} min`);
    if (contParts.length > 0) lines.push(`- ${contParts.join(" | ")}`);

    // Heart rate stats
    if (night.heart_rate) {
      const hr = night.heart_rate;
      lines.push("");
      lines.push(`**Heart Rate**: Avg ${hr.avg} bpm | Min ${hr.min} bpm | Nadir ${hr.nadir} bpm | Trend ${hr.trend_slope} bpm/hr`);
    }

    // Sleep architecture table
    if (night.sleep_architecture) {
      const arch = night.sleep_architecture;
      lines.push("");
      lines.push("**Sleep Architecture**");
      lines.push("| Metric | Value |");
      lines.push("|--------|-------|");
      lines.push(`| Time to first deep sleep | ${arch.time_to_first_deep_sleep_min} min |`);
      lines.push(`| REM cycles | ${arch.number_of_rem_cycles} |`);
      lines.push(`| Avg cycle length | ${arch.avg_cycle_length_min} min |`);
      lines.push(`| Deep sleep in first half | ${arch.deep_sleep_in_first_half_pct}% |`);
      lines.push(`| REM in second half | ${arch.rem_sleep_in_second_half_pct}% |`);
    }
  }

  return lines.join("\n");
}

// Nightly Recharge preprocessing

function computeSampleStats(samples: Record<string, number>, sleepStartHour: number): { min: number; max: number; trend_slope: number } {
  const values = Object.values(samples);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    trend_slope: computeTrendSlope(samples, sleepStartHour),
  };
}

function preprocessNightlyRecharge(recharge: NightlyRecharge): ProcessedNightlyRecharge {
  const processed: ProcessedNightlyRecharge = { date: recharge.date };

  if (recharge.nightly_recharge_status !== undefined) processed.nightly_recharge_status = recharge.nightly_recharge_status;
  if (recharge.ans_charge !== undefined) processed.ans_charge = recharge.ans_charge;
  if (recharge.ans_charge_status !== undefined) processed.ans_charge_status = recharge.ans_charge_status;
  if (recharge.heart_rate_avg !== undefined) processed.heart_rate_avg = recharge.heart_rate_avg;
  if (recharge.beat_to_beat_avg !== undefined) processed.beat_to_beat_avg = recharge.beat_to_beat_avg;

  // Derive sleepStartHour from first sample key
  const firstSampleKey = recharge.hrv_samples ? Object.keys(recharge.hrv_samples)[0]
    : recharge.breathing_samples ? Object.keys(recharge.breathing_samples)[0]
    : undefined;
  const sleepStartHour = firstSampleKey ? parseInt(firstSampleKey.split(":")[0], 10) : 22;

  if (recharge.heart_rate_variability_avg !== undefined && recharge.hrv_samples && Object.keys(recharge.hrv_samples).length > 0) {
    const stats = computeSampleStats(recharge.hrv_samples, sleepStartHour);
    processed.hrv = { avg: recharge.heart_rate_variability_avg, ...stats };
  } else if (recharge.heart_rate_variability_avg !== undefined) {
    processed.hrv = { avg: recharge.heart_rate_variability_avg, min: 0, max: 0, trend_slope: 0 };
  }

  if (recharge.breathing_rate_avg !== undefined && recharge.breathing_samples && Object.keys(recharge.breathing_samples).length > 0) {
    const stats = computeSampleStats(recharge.breathing_samples, sleepStartHour);
    processed.breathing_rate = { avg: recharge.breathing_rate_avg, ...stats };
  } else if (recharge.breathing_rate_avg !== undefined) {
    processed.breathing_rate = { avg: recharge.breathing_rate_avg, min: 0, max: 0, trend_slope: 0 };
  }

  return processed;
}

function formatProcessedRechargeMarkdown(data: ProcessedNightlyRecharge[]): string {
  if (data.length === 0) {
    return "## Nightly Recharge\n\nNo recharge data found.";
  }

  const lines = [
    "## Nightly Recharge",
    "",
    `Found ${data.length} night(s) of data:`,
  ];

  for (const night of data) {
    lines.push("");
    lines.push(`### ${night.date}`);

    const mainParts: string[] = [];
    if (night.ans_charge !== undefined) mainParts.push(`**ANS Charge**: ${night.ans_charge}`);
    if (night.ans_charge_status !== undefined) mainParts.push(`**Status**: ${night.ans_charge_status}`);
    if (night.nightly_recharge_status !== undefined) mainParts.push(`**Recharge Status**: ${night.nightly_recharge_status}`);
    if (mainParts.length > 0) lines.push(`- ${mainParts.join(" | ")}`);

    const hrParts: string[] = [];
    if (night.heart_rate_avg !== undefined) hrParts.push(`**Heart Rate**: Avg ${night.heart_rate_avg} bpm`);
    if (night.beat_to_beat_avg !== undefined) hrParts.push(`**Beat-to-Beat**: Avg ${night.beat_to_beat_avg} ms`);
    if (hrParts.length > 0) lines.push(`- ${hrParts.join(" | ")}`);

    if (night.hrv) {
      lines.push("");
      lines.push(`**HRV**: Avg ${night.hrv.avg} ms | Min ${night.hrv.min} ms | Max ${night.hrv.max} ms | Trend ${night.hrv.trend_slope} ms/hr`);
    }
    if (night.breathing_rate) {
      lines.push(`**Breathing**: Avg ${night.breathing_rate.avg} br/min | Min ${night.breathing_rate.min} br/min | Max ${night.breathing_rate.max} br/min | Trend ${night.breathing_rate.trend_slope} br/min/hr`);
    }
  }

  return lines.join("\n");
}

// Physical Info handler (transactional pull-notification flow)
export async function listPhysicalInfo(input: z.infer<typeof schemas.listPhysicalInfo>): Promise<string> {
  const client = getApiClient();
  const userId = client.getUserId();

  // 1. Create transaction (201 = new data, 204 = no new data)
  const txnLocation = await client.post<TransactionLocation>(
    ENDPOINTS.PHYSICAL_INFO_TRANSACTIONS(userId)
  );

  // 204 No Content returns empty/undefined body
  if (!txnLocation || !txnLocation["transaction-id"]) {
    return formatResponse([] as PhysicalInfo[], input.format, formatPhysicalInfoListMarkdown);
  }

  const txnId = String(txnLocation["transaction-id"]);

  // 2. List physical info URLs in this transaction
  const urlList = await client.get<PhysicalInfoUrlList>(
    ENDPOINTS.PHYSICAL_INFO_TRANSACTION(userId, txnId)
  );

  const urls = urlList["physical-informations"] || [];

  // 3. Fetch each individual record (extract info ID from URL)
  const records: PhysicalInfo[] = [];
  for (const url of urls) {
    const parts = url.split("/");
    const infoId = parts[parts.length - 1];
    const record = await client.get<PhysicalInfo>(
      ENDPOINTS.PHYSICAL_INFO_ENTITY(userId, txnId, infoId)
    );
    records.push(record);
  }

  // Transaction is intentionally NOT committed so data remains
  // available for future pulls (Polar auto-expires uncommitted transactions)

  return formatResponse(records, input.format, formatPhysicalInfoListMarkdown);
}

// Heart Rate handler
export async function getHeartRate(input: z.infer<typeof schemas.getHeartRate>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<ContinuousHeartRateList>(ENDPOINTS.HEART_RATE, {
    from: input.from,
    to: input.to,
  });

  const processed: ProcessedHeartRate[] = [];
  if (result.heart_rates) {
    for (const hr of result.heart_rates) {
      if (hr.heart_rate_samples && hr.heart_rate_samples.length > 0) {
        processed.push(preprocessHeartRate(hr.date, hr.heart_rate_samples));
      }
    }
  }

  return formatResponse(processed, input.format, formatProcessedHeartRateMarkdown);
}

// Sleep handler
export async function listSleep(input: z.infer<typeof schemas.listSleep>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<SleepList>(ENDPOINTS.SLEEP);

  let nights = result.nights || [];
  if (input.from) nights = nights.filter((n) => n.date >= input.from!);
  if (input.to) nights = nights.filter((n) => n.date <= input.to!);

  const processed = nights.map(preprocessSleep);

  return formatResponse(processed, input.format, formatProcessedSleepMarkdown);
}

// Nightly Recharge handler
export async function listNightlyRecharge(input: z.infer<typeof schemas.listNightlyRecharge>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<NightlyRechargeList>(ENDPOINTS.NIGHTLY_RECHARGE);

  let recharges = result.recharges || [];
  if (input.from) recharges = recharges.filter((r) => r.date >= input.from!);
  if (input.to) recharges = recharges.filter((r) => r.date <= input.to!);

  const processed = recharges.map(preprocessNightlyRecharge);

  return formatResponse(processed, input.format, formatProcessedRechargeMarkdown);
}

// Cardio Load formatters
function formatCardioLoadListMarkdown(data: CardioLoad[]): string {
  if (!data || data.length === 0) {
    return "## Cardio Load\n\nNo cardio load data found.";
  }

  const lines = [
    "## Cardio Load",
    "",
    `Found ${data.length} day(s) of data:`,
    "",
    "| Date | Status | Load | Strain | Tolerance | Ratio |",
    "|------|--------|------|--------|-----------|-------|",
  ];

  for (const entry of data) {
    const status = entry.cardio_load_status ?? "—";
    const load = entry.cardio_load !== undefined ? entry.cardio_load.toFixed(1) : "—";
    const strain = entry.strain !== undefined ? entry.strain.toFixed(1) : "—";
    const tolerance = entry.tolerance !== undefined ? entry.tolerance.toFixed(1) : "—";
    const ratio = entry.cardio_load_ratio !== undefined ? entry.cardio_load_ratio.toFixed(2) : "—";
    lines.push(`| ${entry.date} | ${status} | ${load} | ${strain} | ${tolerance} | ${ratio} |`);
  }

  return lines.join("\n");
}

// Cardio Load handler
export async function getCardioLoad(input: z.infer<typeof schemas.getCardioLoad>): Promise<string> {
  const client = getApiClient();

  let result: CardioLoad[];
  if (input.from && input.to) {
    result = await client.get<CardioLoad[]>(ENDPOINTS.CARDIO_LOAD_DATE, {
      from: input.from,
      to: input.to,
    });
  } else {
    result = await client.get<CardioLoad[]>(ENDPOINTS.CARDIO_LOAD);
  }

  return formatResponse(result, input.format, formatCardioLoadListMarkdown);
}

// Export tool definitions
export const physicalInfoTools = {
  polar_list_physical_info: {
    name: "polar_list_physical_info",
    description: "List physical information entries including weight, height, heart rate zones, and VO2 max. Creates a temporary transaction to pull data (not committed, so data remains available for future pulls).",
    inputSchema: schemas.listPhysicalInfo,
    handler: listPhysicalInfo,
    annotations: {
      title: "List Physical Info",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
};

export const heartRateTools = {
  polar_get_heart_rate: {
    name: "polar_get_heart_rate",
    description: "Get continuous heart rate data for a date range with preprocessed half-hourly buckets (avg/min/max). Always returns heart rate zone summaries and daily statistics.",
    inputSchema: schemas.getHeartRate,
    handler: getHeartRate,
    annotations: {
      title: "Get Heart Rate",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

export const sleepTools = {
  polar_list_sleep: {
    name: "polar_list_sleep",
    description: "List sleep records including sleep score, duration, and sleep stages (light, deep, REM). Always returns heart rate stats and sleep architecture summary from preprocessed hypnogram and heart rate samples.",
    inputSchema: schemas.listSleep,
    handler: listSleep,
    annotations: {
      title: "List Sleep",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

export const nightlyRechargeTools = {
  polar_list_nightly_recharge: {
    name: "polar_list_nightly_recharge",
    description: "List nightly recharge data including ANS charge, HRV, and recovery metrics. Always returns preprocessed sample data (heart rate stats, HRV min/max/trend, breathing rate min/max/trend) positioned alongside existing API averages.",
    inputSchema: schemas.listNightlyRecharge,
    handler: listNightlyRecharge,
    annotations: {
      title: "List Nightly Recharge",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

export const cardioLoadTools = {
  polar_get_cardio_load: {
    name: "polar_get_cardio_load",
    description: "Get daily cardio load metrics including strain, tolerance, load ratio, and load level thresholds. Returns last 28 days by default, or a custom date range.",
    inputSchema: schemas.getCardioLoad,
    handler: getCardioLoad,
    annotations: {
      title: "Get Cardio Load",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

// SleepWise preprocessing
function processSleepWise(alertness: SleepWiseAlertness): ProcessedSleepWiseAlertness {
  return {
    grade: alertness.grade,
    grade_type: alertness.grade_type,
    grade_classification: alertness.grade_classification,
    validity: alertness.validity,
    sleep_inertia: alertness.sleep_inertia,
    sleep_type: alertness.sleep_type,
    period_start_time: alertness.period_start_time,
    period_end_time: alertness.period_end_time,
    sleep_period_start_time: alertness.sleep_period_start_time,
    sleep_period_end_time: alertness.sleep_period_end_time,
    hourly_data: alertness.hourly_data,
  };
}

function formatSleepWiseMarkdown(data: ProcessedSleepWiseAlertness[]): string {
  if (!data || data.length === 0) {
    return "## SleepWise Alertness\n\nNo alertness data found.";
  }

  const lines = [
    "## SleepWise Alertness",
    "",
    `Found ${data.length} alertness period(s):`,
  ];

  for (const period of data) {
    lines.push("");
    lines.push(`### ${period.period_start_time} → ${period.period_end_time}`);

    const mainParts: string[] = [];
    mainParts.push(`**Grade**: ${period.grade}`);
    mainParts.push(`**Classification**: ${period.grade_classification}`);
    mainParts.push(`**Type**: ${period.grade_type}`);
    lines.push(`- ${mainParts.join(" | ")}`);

    const detailParts: string[] = [];
    detailParts.push(`**Validity**: ${period.validity}`);
    detailParts.push(`**Sleep Inertia**: ${period.sleep_inertia}`);
    detailParts.push(`**Sleep Type**: ${period.sleep_type}`);
    lines.push(`- ${detailParts.join(" | ")}`);

    lines.push(`- **Sleep Period**: ${period.sleep_period_start_time} → ${period.sleep_period_end_time}`);

    if (period.hourly_data && period.hourly_data.length > 0) {
      lines.push("");
      lines.push("| Start | End | Alertness Level | Validity |");
      lines.push("|-------|-----|-----------------|----------|");
      for (const hour of period.hourly_data) {
        lines.push(`| ${hour.start_time} | ${hour.end_time} | ${hour.alertness_level} | ${hour.validity} |`);
      }
    }
  }

  return lines.join("\n");
}

// SleepWise handler
export async function getSleepWise(input: z.infer<typeof schemas.getSleepWise>): Promise<string> {
  const client = getApiClient();

  let raw: unknown;
  if (input.from && input.to) {
    // Alertness periods are keyed by sleep-start date (previous evening),
    // so shift 'from' back one day to capture the period whose alertness
    // covers the requested date.
    const adjustedFrom = new Date(input.from + "T00:00:00Z");
    adjustedFrom.setUTCDate(adjustedFrom.getUTCDate() - 1);
    const fromStr = adjustedFrom.toISOString().slice(0, 10);

    raw = await client.get<unknown>(ENDPOINTS.SLEEPWISE_ALERTNESS_DATE, {
      from: fromStr,
      to: input.to,
    });
  } else {
    raw = await client.get<unknown>(ENDPOINTS.SLEEPWISE_ALERTNESS);
  }

  // API may return a bare array or an object wrapping one
  let result: SleepWiseAlertness[];
  if (Array.isArray(raw)) {
    result = raw;
  } else if (raw && typeof raw === "object") {
    const values = Object.values(raw as Record<string, unknown>);
    const arr = values.find(Array.isArray);
    result = (arr ?? []) as SleepWiseAlertness[];
  } else {
    result = [];
  }

  let processed = result.map(processSleepWise);

  // Trim hourly data to the requested date range
  if (input.from && input.to) {
    const rangeStart = input.from + "T00:00:00";
    const rangeEnd = input.to + "T23:59:59";
    processed = processed.map((p) => ({
      ...p,
      hourly_data: p.hourly_data.filter((h) => h.start_time >= rangeStart && h.start_time <= rangeEnd),
    }));
  }

  return formatResponse(processed, input.format, formatSleepWiseMarkdown);
}

export const sleepWiseTools = {
  polar_get_sleepwise: {
    name: "polar_get_sleepwise",
    description: "Get SleepWise alertness data with hourly breakdowns including alertness grade, classification, and sleep inertia. Returns last 28 days by default, or a custom date range.",
    inputSchema: schemas.getSleepWise,
    handler: getSleepWise,
    annotations: {
      title: "Get SleepWise Alertness",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

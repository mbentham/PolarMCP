import { z } from "zod";
import { getApiClient } from "../services/api-client.js";
import { ENDPOINTS } from "../constants.js";
import { schemas } from "../schemas/input.js";
import type {
  PhysicalInfo,
  PhysicalInfoList,
  ContinuousHeartRate,
  ContinuousHeartRateList,
  Sleep,
  SleepList,
  NightlyRecharge,
  NightlyRechargeList,
  ResponseFormat,
} from "../types.js";

// Response formatter helper
function formatResponse<T>(data: T, format: ResponseFormat, markdownFormatter: (data: T) => string): string {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }
  return markdownFormatter(data);
}

// Physical Info formatters
function formatPhysicalInfoMarkdown(info: PhysicalInfo): string {
  const lines = [
    `### Physical Info: ${info.created.split("T")[0]}`,
    "",
    `- **ID**: ${info.id}`,
    `- **Created**: ${info.created}`,
  ];

  if (info.weight) lines.push(`- **Weight**: ${info.weight} kg`);
  if (info.height) lines.push(`- **Height**: ${info.height} cm`);
  if (info["maximum-heart-rate"]) lines.push(`- **Max Heart Rate**: ${info["maximum-heart-rate"]} bpm`);
  if (info["resting-heart-rate"]) lines.push(`- **Resting Heart Rate**: ${info["resting-heart-rate"]} bpm`);
  if (info.vo2max) lines.push(`- **VO2 Max**: ${info.vo2max}`);
  if (info["aerobic-threshold"]) lines.push(`- **Aerobic Threshold**: ${info["aerobic-threshold"]} bpm`);
  if (info["anaerobic-threshold"]) lines.push(`- **Anaerobic Threshold**: ${info["anaerobic-threshold"]} bpm`);
  if (info["body-mass-index"]) lines.push(`- **BMI**: ${info["body-mass-index"]}`);
  if (info["fat-percent"]) lines.push(`- **Body Fat**: ${info["fat-percent"]}%`);

  return lines.join("\n");
}

function formatPhysicalInfoListMarkdown(data: PhysicalInfoList): string {
  if (!data["physical-informations"] || data["physical-informations"].length === 0) {
    return "## Physical Information\n\nNo physical information records found.";
  }

  const lines = [
    "## Physical Information",
    "",
    `Found ${data["physical-informations"].length} record(s):`,
    "",
  ];

  for (const info of data["physical-informations"]) {
    lines.push(formatPhysicalInfoMarkdown(info));
    lines.push("");
  }

  return lines.join("\n");
}

// Heart Rate formatters
function formatHeartRateMarkdown(data: ContinuousHeartRate): string {
  const lines = [
    `### Heart Rate: ${data.date}`,
    "",
    `- **Date**: ${data.date}`,
  ];

  if (data.heart_rate_samples && data.heart_rate_samples.length > 0) {
    const samples = data.heart_rate_samples;
    const heartRates = samples.map((s) => s.heart_rate);
    const avg = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length);
    const min = Math.min(...heartRates);
    const max = Math.max(...heartRates);

    lines.push(`- **Samples**: ${samples.length}`);
    lines.push(`- **Average**: ${avg} bpm`);
    lines.push(`- **Min**: ${min} bpm`);
    lines.push(`- **Max**: ${max} bpm`);

    // Show first and last sample times
    const firstSample = samples[0];
    const lastSample = samples[samples.length - 1];
    lines.push(`- **First Sample**: ${firstSample.sample_time} (${firstSample.heart_rate} bpm)`);
    lines.push(`- **Last Sample**: ${lastSample.sample_time} (${lastSample.heart_rate} bpm)`);
  } else {
    lines.push(`- **Samples**: No heart rate samples available`);
  }

  return lines.join("\n");
}

function formatHeartRateListMarkdown(data: ContinuousHeartRateList): string {
  if (!data.continuous_heart_rate || data.continuous_heart_rate.length === 0) {
    return "## Continuous Heart Rate\n\nNo heart rate data found.";
  }

  const lines = [
    "## Continuous Heart Rate",
    "",
    `Found ${data.continuous_heart_rate.length} day(s) of data:`,
    "",
  ];

  for (const hr of data.continuous_heart_rate) {
    lines.push(formatHeartRateMarkdown(hr));
    lines.push("");
  }

  return lines.join("\n");
}

// Sleep formatters
function formatSleepMarkdown(sleep: Sleep): string {
  const lines = [
    `### Sleep: ${sleep.date}`,
    "",
    `- **Date**: ${sleep.date}`,
    `- **Sleep Start**: ${sleep.sleep_start_time}`,
    `- **Sleep End**: ${sleep.sleep_end_time}`,
  ];

  if (sleep.sleep_score) lines.push(`- **Sleep Score**: ${sleep.sleep_score}`);
  if (sleep.sleep_rating) lines.push(`- **Sleep Rating**: ${sleep.sleep_rating}/5`);
  if (sleep.continuity) lines.push(`- **Continuity**: ${sleep.continuity}`);
  if (sleep.light_sleep) lines.push(`- **Light Sleep**: ${Math.round(sleep.light_sleep / 60)} min`);
  if (sleep.deep_sleep) lines.push(`- **Deep Sleep**: ${Math.round(sleep.deep_sleep / 60)} min`);
  if (sleep.rem_sleep) lines.push(`- **REM Sleep**: ${Math.round(sleep.rem_sleep / 60)} min`);
  if (sleep.sleep_cycles) lines.push(`- **Sleep Cycles**: ${sleep.sleep_cycles}`);
  if (sleep.total_interruption_duration) {
    lines.push(`- **Total Interruptions**: ${Math.round(sleep.total_interruption_duration / 60)} min`);
  }

  return lines.join("\n");
}

function formatSleepListMarkdown(data: SleepList): string {
  if (!data.nights || data.nights.length === 0) {
    return "## Sleep Records\n\nNo sleep records found.";
  }

  const lines = [
    "## Sleep Records",
    "",
    `Found ${data.nights.length} night(s) of data:`,
    "",
  ];

  for (const sleep of data.nights) {
    lines.push(formatSleepMarkdown(sleep));
    lines.push("");
  }

  return lines.join("\n");
}

// Nightly Recharge formatters
function formatNightlyRechargeMarkdown(recharge: NightlyRecharge): string {
  const lines = [
    `### Nightly Recharge: ${recharge.date}`,
    "",
    `- **Date**: ${recharge.date}`,
  ];

  if (recharge.ans_charge !== undefined) lines.push(`- **ANS Charge**: ${recharge.ans_charge}`);
  if (recharge["ans-charge-status"]) lines.push(`- **ANS Charge Status**: ${recharge["ans-charge-status"]}`);
  if (recharge["hrv-rmssd"]) lines.push(`- **HRV RMSSD**: ${recharge["hrv-rmssd"]} ms`);
  if (recharge["breathing-rate"]) lines.push(`- **Breathing Rate**: ${recharge["breathing-rate"]} breaths/min`);
  if (recharge["heart-rate-avg"]) lines.push(`- **Avg Heart Rate**: ${recharge["heart-rate-avg"]} bpm`);
  if (recharge["nightly-recharge-status"]) lines.push(`- **Recharge Status**: ${recharge["nightly-recharge-status"]}`);

  return lines.join("\n");
}

function formatNightlyRechargeListMarkdown(data: NightlyRechargeList): string {
  if (!data.recharges || data.recharges.length === 0) {
    return "## Nightly Recharge\n\nNo recharge data found.";
  }

  const lines = [
    "## Nightly Recharge",
    "",
    `Found ${data.recharges.length} night(s) of data:`,
    "",
  ];

  for (const recharge of data.recharges) {
    lines.push(formatNightlyRechargeMarkdown(recharge));
    lines.push("");
  }

  return lines.join("\n");
}

// Physical Info handlers
export async function listPhysicalInfo(input: z.infer<typeof schemas.listPhysicalInfo>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<PhysicalInfoList>(ENDPOINTS.PHYSICAL_INFO, {
    limit: input.limit,
    offset: input.offset,
  });

  return formatResponse(result, input.format, formatPhysicalInfoListMarkdown);
}

export async function getPhysicalInfo(input: z.infer<typeof schemas.getPhysicalInfo>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<PhysicalInfo>(ENDPOINTS.PHYSICAL_INFO_ID(input.physicalInfoId));

  return formatResponse(result, input.format, (data) => {
    return "## Physical Info Details\n\n" + formatPhysicalInfoMarkdown(data);
  });
}

// Heart Rate handlers
export async function getHeartRate(input: z.infer<typeof schemas.getHeartRate>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<ContinuousHeartRate>(ENDPOINTS.HEART_RATE_DATE(input.date));

  return formatResponse(result, input.format, (data) => {
    return "## Heart Rate Details\n\n" + formatHeartRateMarkdown(data);
  });
}

export async function listHeartRate(input: z.infer<typeof schemas.listHeartRate>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<ContinuousHeartRateList>(ENDPOINTS.HEART_RATE, {
    from: input.from,
    to: input.to,
  });

  return formatResponse(result, input.format, formatHeartRateListMarkdown);
}

// Sleep handlers
export async function listSleep(input: z.infer<typeof schemas.listSleep>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<SleepList>(ENDPOINTS.SLEEP, {
    limit: input.limit,
    offset: input.offset,
  });

  return formatResponse(result, input.format, formatSleepListMarkdown);
}

export async function getSleep(input: z.infer<typeof schemas.getSleep>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<Sleep>(ENDPOINTS.SLEEP_NIGHT(input.nightId));

  return formatResponse(result, input.format, (data) => {
    return "## Sleep Details\n\n" + formatSleepMarkdown(data);
  });
}

// Nightly Recharge handlers
export async function listNightlyRecharge(input: z.infer<typeof schemas.listNightlyRecharge>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<NightlyRechargeList>(ENDPOINTS.NIGHTLY_RECHARGE, {
    limit: input.limit,
    offset: input.offset,
  });

  return formatResponse(result, input.format, formatNightlyRechargeListMarkdown);
}

export async function getNightlyRecharge(input: z.infer<typeof schemas.getNightlyRecharge>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<NightlyRecharge>(ENDPOINTS.NIGHTLY_RECHARGE_NIGHT(input.nightId));

  return formatResponse(result, input.format, (data) => {
    return "## Nightly Recharge Details\n\n" + formatNightlyRechargeMarkdown(data);
  });
}

// Export tool definitions
export const physicalInfoTools = {
  polar_list_physical_info: {
    name: "polar_list_physical_info",
    description: "List physical information entries including weight, height, heart rate zones, and VO2 max.",
    inputSchema: schemas.listPhysicalInfo,
    handler: listPhysicalInfo,
    annotations: {
      title: "List Physical Info",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_get_physical_info: {
    name: "polar_get_physical_info",
    description: "Get detailed physical information for a specific entry including body metrics and fitness data.",
    inputSchema: schemas.getPhysicalInfo,
    handler: getPhysicalInfo,
    annotations: {
      title: "Get Physical Info",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

export const heartRateTools = {
  polar_get_heart_rate: {
    name: "polar_get_heart_rate",
    description: "Get continuous heart rate data for a specific date including all samples throughout the day.",
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
  polar_list_heart_rate: {
    name: "polar_list_heart_rate",
    description: "List continuous heart rate data for a date range. Provides daily summaries with average, min, and max values.",
    inputSchema: schemas.listHeartRate,
    handler: listHeartRate,
    annotations: {
      title: "List Heart Rate",
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
    description: "List sleep records including sleep score, duration, and sleep stages (light, deep, REM).",
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
  polar_get_sleep: {
    name: "polar_get_sleep",
    description: "Get detailed sleep data for a specific night including sleep stages, hypnogram, and heart rate samples.",
    inputSchema: schemas.getSleep,
    handler: getSleep,
    annotations: {
      title: "Get Sleep",
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
    description: "List nightly recharge data including ANS charge, HRV, and recovery metrics.",
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
  polar_get_nightly_recharge: {
    name: "polar_get_nightly_recharge",
    description: "Get detailed nightly recharge data for a specific night including HRV samples and breathing rate.",
    inputSchema: schemas.getNightlyRecharge,
    handler: getNightlyRecharge,
    annotations: {
      title: "Get Nightly Recharge",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

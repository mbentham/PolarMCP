import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { getApiClient } from "../services/api-client.js";
import { ENDPOINTS } from "../constants.js";
import { schemas } from "../schemas/input.js";
import { preprocessSamples } from "../services/exercise-preprocessor.js";
import type {
  Exercise,
  ProcessedExercise,
  HeartRateZone,
  TrainingLoadPro,
} from "../types.js";
import { formatResponse } from "../utils/format.js";


// --- ISO 8601 duration helper ---

function formatIsoDuration(iso: string): string {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) return iso;

  // Convert everything to total seconds first, then decompose into h/m/s
  let totalSeconds = 0;
  if (match[1]) totalSeconds += parseInt(match[1]) * 3600;
  if (match[2]) totalSeconds += parseInt(match[2]) * 60;
  if (match[3]) totalSeconds += Math.round(parseFloat(match[3]));

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return parts.join(" ");
}

// --- Process exercise: strip useless fields, preprocess samples ---

function processExercise(
  exercise: Exercise,
  samplesRequested: boolean
): ProcessedExercise {
  const processed: ProcessedExercise = {
    id: exercise.id,
    start_time: exercise.start_time,
    start_time_utc_offset: exercise.start_time_utc_offset,
    duration: exercise.duration,
    calories: exercise.calories,
  };

  if (exercise.distance !== undefined) processed.distance = exercise.distance;
  if (exercise.heart_rate) processed.heart_rate = exercise.heart_rate;
  if (exercise.training_load !== undefined) processed.training_load = exercise.training_load;
  if (exercise.sport) processed.sport = exercise.sport;
  if (exercise.detailed_sport_info) processed.detailed_sport_info = exercise.detailed_sport_info;
  if (exercise.fat_percentage !== undefined) processed.fat_percentage = exercise.fat_percentage;
  if (exercise.carbohydrate_percentage !== undefined) processed.carbohydrate_percentage = exercise.carbohydrate_percentage;
  if (exercise.protein_percentage !== undefined) processed.protein_percentage = exercise.protein_percentage;
  if (exercise["running-index"] !== undefined) processed["running-index"] = exercise["running-index"];
  if (exercise.training_load_pro) processed.training_load_pro = exercise.training_load_pro;
  if (exercise.heart_rate_zones) processed.heart_rate_zones = exercise.heart_rate_zones;

  if (samplesRequested && exercise.samples && exercise.samples.length > 0) {
    Object.assign(processed, preprocessSamples(exercise.samples));
  }

  return processed;
}

// --- Markdown formatters ---

function formatExerciseDetailed(exercise: ProcessedExercise): string {
  const lines = [
    `### ${exercise.sport || "Unknown Sport"}`,
    "",
    `- **Start Time**: ${exercise.start_time}`,
    `- **Duration**: ${formatIsoDuration(exercise.duration)}`,
    `- **Calories**: ${exercise.calories} kcal`,
  ];

  if (exercise.distance !== undefined) {
    lines.push(`- **Distance**: ${(exercise.distance / 1000).toFixed(2)} km`);
  }
  if (exercise.heart_rate) {
    const hr = exercise.heart_rate;
    let hrLine = `- **Heart Rate**: avg ${hr.average} / max ${hr.maximum}`;
    if (hr.minimum !== undefined) hrLine += ` / min ${hr.minimum}`;
    hrLine += " bpm";
    lines.push(hrLine);
  }
  if (exercise.training_load !== undefined) {
    lines.push(`- **Training Load**: ${exercise.training_load}`);
  }
  if (exercise.detailed_sport_info) {
    lines.push(`- **Sport Details**: ${exercise.detailed_sport_info}`);
  }
  if (exercise["running-index"] !== undefined) {
    lines.push(`- **Running Index**: ${exercise["running-index"]}`);
  }

  // Macronutrients
  const macros: string[] = [];
  if (exercise.fat_percentage !== undefined) macros.push(`fat ${exercise.fat_percentage}%`);
  if (exercise.carbohydrate_percentage !== undefined) macros.push(`carbs ${exercise.carbohydrate_percentage}%`);
  if (exercise.protein_percentage !== undefined) macros.push(`protein ${exercise.protein_percentage}%`);
  if (macros.length > 0) {
    lines.push(`- **Macronutrients**: ${macros.join(", ")}`);
  }

  // Training Load Pro
  if (exercise.training_load_pro) {
    lines.push("");
    lines.push(formatTrainingLoadPro(exercise.training_load_pro));
  }

  // Heart Rate Zones
  if (exercise.heart_rate_zones && exercise.heart_rate_zones.length > 0) {
    lines.push("");
    lines.push(formatHeartRateZones(exercise.heart_rate_zones));
  }

  // Sample metrics (flattened)
  const sampleLines = formatSampleMetrics(exercise);
  if (sampleLines) {
    lines.push("");
    lines.push(sampleLines);
  }

  return lines.join("\n");
}

function formatTrainingLoadPro(tlp: TrainingLoadPro): string {
  const lines = ["**Training Load Pro**"];
  if (tlp["cardio-load"] !== undefined) {
    let line = `- Cardio: ${tlp["cardio-load"]}`;
    if (tlp["cardio-load-interpretation"]) line += ` (${tlp["cardio-load-interpretation"]})`;
    lines.push(line);
  }
  if (tlp["muscle-load"] !== undefined) {
    let line = `- Muscle: ${tlp["muscle-load"]}`;
    if (tlp["muscle-load-interpretation"]) line += ` (${tlp["muscle-load-interpretation"]})`;
    lines.push(line);
  }
  if (tlp["perceived-load"] !== undefined) {
    lines.push(`- Perceived: ${tlp["perceived-load"]}`);
  }
  if (tlp["user-rpe"]) {
    lines.push(`- User RPE: ${tlp["user-rpe"]}`);
  }
  return lines.join("\n");
}

function formatHeartRateZones(zones: HeartRateZone[]): string {
  const lines = [
    "**Heart Rate Zones**",
    "",
    "| Zone | Range (bpm) | Time |",
    "|------|-------------|------|",
  ];

  for (const zone of zones) {
    const range = `${zone.lower_limit}–${zone.upper_limit}`;
    const time = formatIsoDuration(zone.in_zone);
    lines.push(`| ${zone.index + 1} | ${range} | ${time} |`);
  }

  return lines.join("\n");
}

function formatSampleMetrics(exercise: ProcessedExercise): string | null {
  const sections: string[] = [];

  if (exercise.pace) {
    sections.push("**Pace**");
    sections.push("");
    sections.push("| km | Pace (min/km) | Speed (km/h) |");
    sections.push("|----|---------------|--------------|");
    for (const split of exercise.pace.splits) {
      const label = split.km === 0 ? "Overall" : `${split.km}`;
      sections.push(`| ${label} | ${split.pace_min_per_km} | ${split.avg_speed_kmh} |`);
    }
  }

  if (exercise.cadence) {
    sections.push(`- Cadence: avg ${exercise.cadence.avg}, max ${exercise.cadence.max} rpm`);
  }

  if (exercise.running_cadence) {
    sections.push(`- Running Cadence: avg ${exercise.running_cadence.avg}, max ${exercise.running_cadence.max} spm`);
  }

  if (exercise.altitude) {
    const alt = exercise.altitude;
    sections.push(`- Altitude: ↑${alt.total_ascent}m ↓${alt.total_descent}m (${alt.min_elevation}–${alt.max_elevation}m)`);
  }

  if (exercise.power) {
    const p = exercise.power;
    sections.push(`- Power: avg ${p.avg_power}W, NP ${p.normalized_power}W, max ${p.max_power}W (VI ${p.variability_index})`);
  }

  if (exercise.power_pedaling_index) {
    sections.push(`- Pedaling Index: avg ${exercise.power_pedaling_index.avg}%`);
  }

  if (exercise.power_lr_balance) {
    sections.push(`- L/R Balance: avg ${exercise.power_lr_balance.avg}%`);
  }

  if (exercise.air_pressure) {
    const ap = exercise.air_pressure;
    sections.push(`- Air Pressure: avg ${ap.avg}, min ${ap.min}, max ${ap.max} hPa`);
  }

  if (exercise.temperature) {
    const t = exercise.temperature;
    sections.push(`- Temperature: avg ${t.avg}, min ${t.min}, max ${t.max} °C`);
  }

  if (exercise.rr_intervals) {
    const rr = exercise.rr_intervals;
    sections.push(`- RR Intervals: RMSSD ${rr.rmssd}ms, SDNN ${rr.sdnn}ms, mean ${rr.mean_rr}ms, pNN50 ${rr.pnn50}%`);
  }

  return sections.length > 0 ? sections.join("\n") : null;
}

function formatExerciseCompact(exercise: ProcessedExercise): string {
  const parts = [
    exercise.sport || "Unknown",
    formatIsoDuration(exercise.duration),
    `${exercise.calories} kcal`,
  ];

  if (exercise.distance !== undefined) {
    parts.push(`${(exercise.distance / 1000).toFixed(2)} km`);
  }
  if (exercise.heart_rate) {
    parts.push(`HR avg ${exercise.heart_rate.average}/${exercise.heart_rate.maximum}`);
  }
  if (exercise.training_load !== undefined) {
    parts.push(`TL ${exercise.training_load}`);
  }

  let line = `- **${exercise.start_time}**: ${parts.join(" | ")}`;

  const brief = formatSampleOneLiner(exercise);
  if (brief) line += `\n  ${brief}`;

  return line;
}

function formatSampleOneLiner(exercise: ProcessedExercise): string {
  const parts: string[] = [];

  if (exercise.pace && exercise.pace.splits.length > 0) {
    const first = exercise.pace.splits[0];
    parts.push(`pace ${first.pace_min_per_km} min/km`);
  }
  if (exercise.altitude) parts.push(`↑${exercise.altitude.total_ascent}m`);
  if (exercise.power) parts.push(`NP ${exercise.power.normalized_power}W`);
  if (exercise.running_cadence) parts.push(`cad ${exercise.running_cadence.avg} spm`);

  return parts.length > 0 ? `Samples: ${parts.join(", ")}` : "";
}

// --- Tool handlers ---

type GetExercisesInput = z.infer<typeof schemas.getExercises>;

export async function getExercises(input: GetExercisesInput): Promise<string> {
  const client = getApiClient();
  const samplesParam = input.samples;

  // List exercises
  const params: Record<string, unknown> = { zones: true, samples: samplesParam, route: false };
  const raw = await client.get<Exercise[]>(ENDPOINTS.EXERCISES, params);

  // Client-side date range filter
  let exercises = raw;
  if (input.from) exercises = exercises.filter((e) => e.start_time.split("T")[0] >= input.from!);
  if (input.to) exercises = exercises.filter((e) => e.start_time.split("T")[0] <= input.to!);

  const processed = exercises.map((e) => processExercise(e, samplesParam));

  return formatResponse(processed, input.format, (data) => {
    if (data.length === 0) {
      return "## Exercises\n\nNo exercises found.";
    }

    const lines = [
      "## Exercises",
      "",
      `Found ${data.length} exercise(s):`,
      "",
    ];

    if (samplesParam) {
      // Detailed format with sample metrics
      for (const ex of data) {
        lines.push(formatExerciseDetailed(ex));
        lines.push("");
      }
    } else {
      // Compact format
      for (const ex of data) {
        lines.push(formatExerciseCompact(ex));
      }
    }

    return lines.join("\n");
  });
}

type DownloadExerciseInput = z.infer<typeof schemas.downloadExercise>;

export async function downloadExercise(input: DownloadExerciseInput): Promise<string> {
  const client = getApiClient();

  const extMatch = input.filePath.match(/\.(fit|tcx|gpx)$/i);
  if (!extMatch) throw new Error("filePath must end in .fit, .tcx, or .gpx");
  const ext = extMatch[1].toLowerCase();

  let endpoint: string;
  switch (ext) {
    case "fit":
      endpoint = ENDPOINTS.EXERCISE_FIT(input.exerciseId);
      break;
    case "tcx":
      endpoint = ENDPOINTS.EXERCISE_TCX(input.exerciseId);
      break;
    case "gpx":
      endpoint = ENDPOINTS.EXERCISE_GPX(input.exerciseId);
      break;
    default:
      throw new Error(`Unsupported format: ${ext}`);
  }

  const buffer = await client.getBinary(endpoint);
  await writeFile(input.filePath, buffer);

  const sizeHuman = buffer.length < 1024
    ? `${buffer.length} B`
    : buffer.length < 1024 * 1024
      ? `${(buffer.length / 1024).toFixed(1)} KB`
      : `${(buffer.length / (1024 * 1024)).toFixed(1)} MB`;

  return JSON.stringify({
    success: true,
    filePath: input.filePath,
    format: ext.toUpperCase(),
    size: buffer.length,
    sizeHuman,
  }, null, 2);
}

// --- Tool definitions ---

export const exerciseTools = {
  polar_get_exercises: {
    name: "polar_get_exercises",
    description: "Get exercises from the last 30 days. Optionally filter by date range or include preprocessed sample metrics (heart rate stats, speed splits, power, altitude, etc.). Always returns heart rate zones and training load data.",
    inputSchema: schemas.getExercises,
    handler: getExercises,
    annotations: {
      title: "Get Exercises",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_download_exercise: {
    name: "polar_download_exercise",
    description: "Download exercise data to a file in FIT, TCX, or GPX format. The format is determined by the file extension. GPX is only available for exercises with GPS data.",
    inputSchema: schemas.downloadExercise,
    handler: downloadExercise,
    annotations: {
      title: "Download Exercise",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

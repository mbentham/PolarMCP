import { z } from "zod";
import { getApiClient } from "../services/api-client.js";
import { ENDPOINTS } from "../constants.js";
import { schemas } from "../schemas/input.js";
import type { Exercise, ExerciseList, ResponseFormat } from "../types.js";

function formatExerciseMarkdown(exercise: Exercise): string {
  const lines = [
    `### Exercise: ${exercise.sport || "Unknown Sport"}`,
    "",
    `- **ID**: ${exercise.id}`,
    `- **Start Time**: ${exercise["start-time"]}`,
    `- **Duration**: ${exercise.duration}`,
    `- **Calories**: ${exercise.calories} kcal`,
  ];

  if (exercise.distance) lines.push(`- **Distance**: ${(exercise.distance / 1000).toFixed(2)} km`);
  if (exercise["heart-rate"]) {
    lines.push(`- **Heart Rate**: avg ${exercise["heart-rate"].average} / max ${exercise["heart-rate"].maximum} bpm`);
  }
  if (exercise["training-load"]) lines.push(`- **Training Load**: ${exercise["training-load"]}`);
  if (exercise.device) lines.push(`- **Device**: ${exercise.device}`);
  if (exercise["has-route"]) lines.push(`- **Has Route**: Yes`);
  if (exercise["detailed-sport-info"]) lines.push(`- **Sport Details**: ${exercise["detailed-sport-info"]}`);

  return lines.join("\n");
}

function formatExerciseListMarkdown(data: ExerciseList): string {
  if (!data.exercises || data.exercises.length === 0) {
    return "## Exercises\n\nNo exercises found.";
  }

  const lines = [
    "## Exercises",
    "",
    `Found ${data.exercises.length} exercise(s):`,
    "",
  ];

  for (const exercise of data.exercises) {
    lines.push(formatExerciseMarkdown(exercise));
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

export async function listExercises(input: z.infer<typeof schemas.listExercises>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<ExerciseList>(ENDPOINTS.EXERCISES, {
    limit: input.limit,
    offset: input.offset,
  });

  return formatResponse(result, input.format, formatExerciseListMarkdown);
}

export async function getExercise(input: z.infer<typeof schemas.getExercise>): Promise<string> {
  const client = getApiClient();

  const result = await client.get<Exercise>(ENDPOINTS.EXERCISE(input.exerciseId));

  return formatResponse(result, input.format, (data) => {
    return "## Exercise Details\n\n" + formatExerciseMarkdown(data);
  });
}

export async function downloadExerciseFit(input: z.infer<typeof schemas.downloadExerciseFit>): Promise<string> {
  const client = getApiClient();

  const buffer = await client.getBinary(ENDPOINTS.EXERCISE_FIT(input.exerciseId));
  const base64 = buffer.toString("base64");

  return JSON.stringify({
    exerciseId: input.exerciseId,
    format: "FIT",
    encoding: "base64",
    size: buffer.length,
    data: base64,
  }, null, 2);
}

export async function downloadExerciseTcx(input: z.infer<typeof schemas.downloadExerciseTcx>): Promise<string> {
  const client = getApiClient();

  const buffer = await client.getBinary(ENDPOINTS.EXERCISE_TCX(input.exerciseId));
  const content = buffer.toString("utf-8");

  return JSON.stringify({
    exerciseId: input.exerciseId,
    format: "TCX",
    encoding: "utf-8",
    size: buffer.length,
    data: content,
  }, null, 2);
}

export async function downloadExerciseGpx(input: z.infer<typeof schemas.downloadExerciseGpx>): Promise<string> {
  const client = getApiClient();

  const buffer = await client.getBinary(ENDPOINTS.EXERCISE_GPX(input.exerciseId));
  const content = buffer.toString("utf-8");

  return JSON.stringify({
    exerciseId: input.exerciseId,
    format: "GPX",
    encoding: "utf-8",
    size: buffer.length,
    data: content,
  }, null, 2);
}

export const exerciseTools = {
  polar_list_exercises: {
    name: "polar_list_exercises",
    description: "List exercises from the last 30 days. Returns workout sessions including duration, calories, distance, heart rate, and sport type.",
    inputSchema: schemas.listExercises,
    handler: listExercises,
    annotations: {
      title: "List Exercises",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_get_exercise: {
    name: "polar_get_exercise",
    description: "Get detailed information about a specific exercise including heart rate data, training load, and route information.",
    inputSchema: schemas.getExercise,
    handler: getExercise,
    annotations: {
      title: "Get Exercise",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_download_exercise_fit: {
    name: "polar_download_exercise_fit",
    description: "Download exercise data in FIT format. Returns base64-encoded binary data.",
    inputSchema: schemas.downloadExerciseFit,
    handler: downloadExerciseFit,
    annotations: {
      title: "Download Exercise FIT",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_download_exercise_tcx: {
    name: "polar_download_exercise_tcx",
    description: "Download exercise data in TCX (Training Center XML) format.",
    inputSchema: schemas.downloadExerciseTcx,
    handler: downloadExerciseTcx,
    annotations: {
      title: "Download Exercise TCX",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  polar_download_exercise_gpx: {
    name: "polar_download_exercise_gpx",
    description: "Download exercise route data in GPX format. Only available for exercises with GPS data.",
    inputSchema: schemas.downloadExerciseGpx,
    handler: downloadExerciseGpx,
    annotations: {
      title: "Download Exercise GPX",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
};

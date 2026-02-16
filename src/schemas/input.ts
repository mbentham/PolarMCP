import { z } from "zod";
import { DATE_REGEX, DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT } from "../constants.js";

// Response format schema
export const formatSchema = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Response format: 'markdown' for human-readable or 'json' for structured data");

// Pagination schemas
export const limitSchema = z
  .number()
  .int()
  .min(MIN_LIMIT)
  .max(MAX_LIMIT)
  .default(DEFAULT_LIMIT)
  .describe(`Number of results to return (${MIN_LIMIT}-${MAX_LIMIT}, default ${DEFAULT_LIMIT})`);

export const offsetSchema = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe("Number of results to skip (default 0)");

// Date schema
export const dateSchema = z
  .string()
  .regex(DATE_REGEX, "Date must be in YYYY-MM-DD format")
  .describe("Date in YYYY-MM-DD format");

export const optionalDateSchema = z
  .string()
  .regex(DATE_REGEX, "Date must be in YYYY-MM-DD format")
  .optional()
  .describe("Date in YYYY-MM-DD format");

// Base schemas
export const baseInputSchema = z.object({
  format: formatSchema,
}).strict();

export const paginatedInputSchema = baseInputSchema.extend({
  limit: limitSchema,
  offset: offsetSchema,
}).strict();

export const dateRangeInputSchema = paginatedInputSchema.extend({
  from: optionalDateSchema.describe("Start date (YYYY-MM-DD)"),
  to: optionalDateSchema.describe("End date (YYYY-MM-DD)"),
}).strict();

// User tool schemas
export const registerUserSchema = z.object({
  format: formatSchema,
}).strict();

export const getUserSchema = z.object({
  format: formatSchema,
}).strict();

export const deleteUserSchema = z.object({
  format: formatSchema,
}).strict();

// Exercise tool schemas
// Base schemas (ZodObject) used for .shape access in MCP tool registration
export const getExercisesBaseSchema = paginatedInputSchema.extend({
  exerciseId: z.string().min(1).optional().describe("If provided, fetch a single exercise by ID"),
  date: z.string().regex(DATE_REGEX, "Date must be in YYYY-MM-DD format").optional().describe("If provided, filter exercises by date (YYYY-MM-DD)"),
  samples: z.boolean().default(false).describe("Include preprocessed sample data (heart rate stats, speed splits, power metrics, etc.)"),
}).strict();

// Refined schemas (ZodEffects) used for validation with cross-field constraints
export const getExercisesSchema = getExercisesBaseSchema.refine(
  (data) => !(data.exerciseId && data.date),
  { message: "Cannot specify both exerciseId and date" }
);

export const downloadExerciseBaseSchema = z.object({
  exerciseId: z.string().min(1).describe("The exercise ID"),
  filePath: z.string().min(1).describe("File path to save the exercise data (must end in .fit, .tcx, or .gpx)"),
}).strict();

export const downloadExerciseSchema = downloadExerciseBaseSchema.refine(
  (data) => /\.(fit|tcx|gpx)$/i.test(data.filePath),
  { message: "filePath must end in .fit, .tcx, or .gpx" }
);

// Activity tool schemas
export const getActivitiesSchema = z.object({
  from: optionalDateSchema.describe("Start date (YYYY-MM-DD). If omitted, returns last 28 days."),
  to: optionalDateSchema.describe("End date (YYYY-MM-DD). If omitted, returns last 28 days."),
  format: formatSchema,
}).strict();

// Physical info tool schemas
export const listPhysicalInfoSchema = paginatedInputSchema.extend({}).strict();

export const getPhysicalInfoSchema = z.object({
  physicalInfoId: z.string().min(1).describe("The physical info entry ID"),
  format: formatSchema,
}).strict();

// Heart rate tool schemas
export const getHeartRateSchema = z.object({
  date: dateSchema.describe("Heart rate date (YYYY-MM-DD)"),
  format: formatSchema,
}).strict();

export const listHeartRateSchema = z.object({
  from: dateSchema.describe("Start date (YYYY-MM-DD)"),
  to: dateSchema.describe("End date (YYYY-MM-DD)"),
  format: formatSchema,
}).strict();

// Sleep tool schemas
export const listSleepSchema = paginatedInputSchema.extend({}).strict();

export const getSleepSchema = z.object({
  nightId: z.string().min(1).describe("The sleep night ID"),
  format: formatSchema,
}).strict();

// Nightly recharge tool schemas
export const listNightlyRechargeSchema = paginatedInputSchema.extend({}).strict();

export const getNightlyRechargeSchema = z.object({
  nightId: z.string().min(1).describe("The nightly recharge night ID"),
  format: formatSchema,
}).strict();

// Cardio load tool schemas
export const getCardioLoadSchema = z.object({
  from: optionalDateSchema.describe("Start date (YYYY-MM-DD). If omitted, returns last 28 days."),
  to: optionalDateSchema.describe("End date (YYYY-MM-DD). Required if 'from' is provided."),
  format: formatSchema,
}).strict();

// OAuth tool schemas
export const getAuthorizationUrlSchema = z.object({
  clientId: z.string().min(1).describe("Your Polar API client ID from https://admin.polaraccesslink.com/"),
  redirectUri: z.string().url().optional().describe("OAuth redirect URI (optional, defaults to https://localhost:8080/callback)"),
}).strict();

export const exchangeAuthorizationCodeSchema = z.object({
  clientId: z.string().min(1).describe("Your Polar API client ID"),
  clientSecret: z.string().min(1).describe("Your Polar API client secret"),
  authorizationCode: z.string().min(1).describe("The authorization code received from the OAuth callback"),
  redirectUri: z.string().url().optional().describe("OAuth redirect URI (must match the one used in authorization, defaults to https://localhost:8080/callback)"),
}).strict();

// Export all schemas as a map for easy access
export const schemas = {
  // Users
  registerUser: registerUserSchema,
  getUser: getUserSchema,
  deleteUser: deleteUserSchema,
  // Exercises (base schemas for .shape access)
  getExercises: getExercisesBaseSchema,
  downloadExercise: downloadExerciseBaseSchema,
  // Activities
  getActivities: getActivitiesSchema,
  // Physical info
  listPhysicalInfo: listPhysicalInfoSchema,
  getPhysicalInfo: getPhysicalInfoSchema,
  // Heart rate
  getHeartRate: getHeartRateSchema,
  listHeartRate: listHeartRateSchema,
  // Sleep
  listSleep: listSleepSchema,
  getSleep: getSleepSchema,
  // Nightly recharge
  listNightlyRecharge: listNightlyRechargeSchema,
  getNightlyRecharge: getNightlyRechargeSchema,
  // Cardio load
  getCardioLoad: getCardioLoadSchema,
  // OAuth
  getAuthorizationUrl: getAuthorizationUrlSchema,
  exchangeAuthorizationCode: exchangeAuthorizationCodeSchema,
} as const;

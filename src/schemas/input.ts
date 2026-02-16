import { z } from "zod";
import { DATE_REGEX } from "../constants.js";

// Response format schema
export const formatSchema = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Response format: 'markdown' for human-readable or 'json' for structured data");

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

// User tool schemas
export const registerUserSchema = z.object({
  format: formatSchema,
}).strict();

export const getUserSchema = z.object({
  format: formatSchema,
}).strict();

// Exercise tool schemas
export const getExercisesBaseSchema = baseInputSchema.extend({
  from: optionalDateSchema.describe("Start date (YYYY-MM-DD). If omitted, returns last 30 days."),
  to: optionalDateSchema.describe("End date (YYYY-MM-DD). If omitted, returns up to today."),
  samples: z.boolean().default(false).describe("Include preprocessed sample data (heart rate stats, speed splits, power metrics, etc.)"),
}).strict();

export const downloadExerciseSchema = z.object({
  exerciseId: z.string().min(1).describe("The exercise ID"),
  filePath: z.string().min(1).describe("File path to save the exercise data (must end in .fit, .tcx, or .gpx)"),
}).strict();

// Activity tool schemas
export const getActivitiesSchema = z.object({
  from: optionalDateSchema.describe("Start date (YYYY-MM-DD). If omitted, returns last 28 days."),
  to: optionalDateSchema.describe("End date (YYYY-MM-DD). If omitted, returns last 28 days."),
  format: formatSchema,
}).strict();

// Physical info tool schemas
export const listPhysicalInfoSchema = baseInputSchema.extend({}).strict();

// Heart rate tool schemas
export const getHeartRateSchema = z.object({
  from: dateSchema.describe("Start date (YYYY-MM-DD)"),
  to: dateSchema.describe("End date (YYYY-MM-DD)"),
  format: formatSchema,
}).strict();

// Sleep tool schemas
export const listSleepSchema = baseInputSchema.extend({
  from: optionalDateSchema.describe("Start date (YYYY-MM-DD). If omitted, returns last 28 days."),
  to: optionalDateSchema.describe("End date (YYYY-MM-DD). If omitted, returns up to today."),
}).strict();

// Nightly recharge tool schemas
export const listNightlyRechargeSchema = baseInputSchema.extend({
  from: optionalDateSchema.describe("Start date (YYYY-MM-DD). If omitted, returns last 28 days."),
  to: optionalDateSchema.describe("End date (YYYY-MM-DD). If omitted, returns up to today."),
}).strict();

// SleepWise tool schemas
export const getSleepWiseSchema = z.object({
  from: optionalDateSchema.describe("Start date (YYYY-MM-DD). If omitted, returns last 28 days."),
  to: optionalDateSchema.describe("End date (YYYY-MM-DD). Required if 'from' is provided."),
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
  // Exercises
  getExercises: getExercisesBaseSchema,
  downloadExercise: downloadExerciseSchema,
  // Activities
  getActivities: getActivitiesSchema,
  // Physical info
  listPhysicalInfo: listPhysicalInfoSchema,
  // Heart rate
  getHeartRate: getHeartRateSchema,
  // Sleep
  listSleep: listSleepSchema,
  // Nightly recharge
  listNightlyRecharge: listNightlyRechargeSchema,
  // SleepWise
  getSleepWise: getSleepWiseSchema,
  // Cardio load
  getCardioLoad: getCardioLoadSchema,
  // OAuth
  getAuthorizationUrl: getAuthorizationUrlSchema,
  exchangeAuthorizationCode: exchangeAuthorizationCodeSchema,
} as const;

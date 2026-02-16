export const API_BASE_URL = "https://www.polaraccesslink.com";
export const OAUTH_BASE_URL = "https://flow.polar.com";
export const OAUTH_TOKEN_URL = "https://polarremote.com/v2/oauth2/token";
export const API_VERSION = "v3";

export const ENDPOINTS = {
  // User management
  USERS: "/v3/users",
  USER: (userId: string) => `/v3/users/${userId}`,

  // Exercises
  EXERCISES: "/v3/exercises",
  EXERCISE: (exerciseId: string) => `/v3/exercises/${exerciseId}`,
  EXERCISE_FIT: (exerciseId: string) => `/v3/exercises/${exerciseId}/fit`,
  EXERCISE_TCX: (exerciseId: string) => `/v3/exercises/${exerciseId}/tcx`,
  EXERCISE_GPX: (exerciseId: string) => `/v3/exercises/${exerciseId}/gpx`,

  // Daily Activity
  ACTIVITIES: "/v3/users/activities",
  ACTIVITY: (date: string) => `/v3/users/activities/${date}`,
  ACTIVITY_SAMPLES: "/v3/users/activities/samples",
  ACTIVITY_SAMPLES_DATE: (date: string) => `/v3/users/activities/samples/${date}`,

  // Physical Information (transactional)
  PHYSICAL_INFO_TRANSACTIONS: (userId: string) => `/v3/users/${userId}/physical-information-transactions`,
  PHYSICAL_INFO_TRANSACTION: (userId: string, txnId: string) => `/v3/users/${userId}/physical-information-transactions/${txnId}`,
  PHYSICAL_INFO_ENTITY: (userId: string, txnId: string, infoId: string) => `/v3/users/${userId}/physical-information-transactions/${txnId}/physical-informations/${infoId}`,

  // Continuous Heart Rate
  HEART_RATE: "/v3/users/continuous-heart-rate",
  HEART_RATE_DATE: (date: string) => `/v3/users/continuous-heart-rate/${date}`,

  // Sleep
  SLEEP: "/v3/users/sleep",
  SLEEP_NIGHT: (nightId: string) => `/v3/users/sleep/${nightId}`,

  // Nightly Recharge
  NIGHTLY_RECHARGE: "/v3/users/nightly-recharge",
  NIGHTLY_RECHARGE_NIGHT: (nightId: string) => `/v3/users/nightly-recharge/${nightId}`,

  // Cardio Load
  CARDIO_LOAD: "/v3/users/cardio-load",
  CARDIO_LOAD_DATE: "/v3/users/cardio-load/date",

  // SleepWise
  SLEEPWISE_ALERTNESS: "/v3/users/sleepwise/alertness",
  SLEEPWISE_ALERTNESS_DATE: "/v3/users/sleepwise/alertness/date",
} as const;

export const DEFAULT_TIMEOUT = 30000; // 30 seconds

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

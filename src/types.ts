// User types
export interface PolarUser {
  "polar-user-id": number;
  "member-id": string;
  "registration-date": string;
  "first-name"?: string;
  "last-name"?: string;
  birthdate?: string;
  gender?: string;
  weight?: number;
  height?: number;
  extra_info?: Array<{ key: string; value: string }>;
}

export interface UserRegistration {
  "member-id": string;
}

// Exercise types
export interface Exercise {
  id: string;
  "upload-time": string;
  "polar-user": string;
  device?: string;
  "device-id"?: string;
  "start-time": string;
  "start-time-utc-offset": number;
  duration: string;
  calories: number;
  distance?: number;
  "heart-rate"?: HeartRateSummary;
  "training-load"?: number;
  sport?: string;
  "has-route"?: boolean;
  "club-id"?: number;
  "club-name"?: string;
  "detailed-sport-info"?: string;
  "fat-percentage"?: number;
  "carbohydrate-percentage"?: number;
  "protein-percentage"?: number;
}

export interface ExerciseList {
  exercises: Exercise[];
}

export interface HeartRateSummary {
  average: number;
  maximum: number;
  minimum?: number;
}

// Daily Activity types (Pull Notifications API uses snake_case)
export interface DailyActivity {
  start_time: string;
  end_time: string;
  active_duration?: string;
  inactive_duration?: string;
  daily_activity?: number;
  calories: number;
  active_calories?: number;
  steps?: number;
  inactivity_alert_count?: number;
  distance_from_steps?: number;
}

export interface DailyActivityList {
  activities: DailyActivity[];
}

export interface ActivitySamples {
  date: string;
  steps?: {
    interval_ms: number;
    total_steps: number;
    samples: StepSample[];
  };
  activity_zones?: {
    samples: ActivityZoneSample[];
  };
  inactivity_stamps?: {
    samples: InactivityStamp[];
  };
}

export interface StepSample {
  steps: number;
  timestamp: string;
}

export interface ActivityZoneSample {
  timestamp: string;
  zone: string;
}

export interface InactivityStamp {
  stamp: string;
}

export interface ActivitySamplesList {
  samples: ActivitySamples[];
}

// Physical Information types
export interface PhysicalInfo {
  id: string;
  "polar-user": string;
  "transaction-id"?: number;
  created: string;
  weight?: number;
  height?: number;
  "maximum-heart-rate"?: number;
  "resting-heart-rate"?: number;
  "aerobic-threshold"?: number;
  "anaerobic-threshold"?: number;
  vo2max?: number;
  "body-mass-index"?: number;
  "fat-percent"?: number;
}

export interface PhysicalInfoList {
  "physical-informations": PhysicalInfo[];
}

// Continuous Heart Rate types (Pull Notifications API uses snake_case)
export interface ContinuousHeartRate {
  polar_user: string;
  date: string;
  heart_rate_samples?: HeartRateSample[];
}

export interface HeartRateSample {
  sample_time: string;
  heart_rate: number;
}

export interface ContinuousHeartRateList {
  continuous_heart_rate: ContinuousHeartRate[];
}

// Sleep types (API uses snake_case for this endpoint)
export interface Sleep {
  polar_user: string;
  date: string;
  sleep_start_time: string;
  sleep_end_time: string;
  device_id?: string;
  continuity?: number;
  continuity_class?: number;
  light_sleep?: number;
  deep_sleep?: number;
  rem_sleep?: number;
  unrecognized_sleep_stage?: number;
  sleep_score?: number;
  total_interruption_duration?: number;
  sleep_charge?: number;
  sleep_goal?: number;
  sleep_rating?: number;
  short_interruption_duration?: number;
  long_interruption_duration?: number;
  sleep_cycles?: number;
  group_duration_score?: number;
  group_solidity_score?: number;
  group_regeneration_score?: number;
  hypnogram?: Record<string, number>;
  heart_rate_samples?: Record<string, number>;
}

export interface SleepList {
  nights: Sleep[];
}

// Nightly Recharge types
export interface NightlyRecharge {
  "polar-user": string;
  date: string;
  "heart-rate-variability-samples"?: HrvSample[];
  "breathing-samples"?: BreathingSample[];
  ans_charge?: number;
  "ans-charge-status"?: number;
  "hrv-rmssd"?: number;
  "breathing-rate"?: number;
  "beat-to-beat-avg"?: number;
  "heart-rate-avg"?: number;
  "heart-rate-variability-avg"?: number;
  "nightly-recharge-status"?: number;
}

export interface HrvSample {
  time: string;
  "hrv-rmssd": number;
}

export interface BreathingSample {
  time: string;
  "breathing-rate": number;
}

export interface NightlyRechargeList {
  recharges: NightlyRecharge[];
}

// Response format type
export type ResponseFormat = "markdown" | "json";

// Tool input base type
export interface BaseToolInput {
  format?: ResponseFormat;
}

// Pagination input type
export interface PaginatedInput extends BaseToolInput {
  limit?: number;
  offset?: number;
}

// Date range input type
export interface DateRangeInput extends PaginatedInput {
  from?: string;
  to?: string;
}

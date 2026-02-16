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

// Exercise types (Polar API v3 uses snake_case for most fields, kebab-case for some nested)
export interface Exercise {
  id: string;
  upload_time: string;
  polar_user: string;
  device?: string;
  device_id?: string;
  start_time: string;
  start_time_utc_offset: number;
  duration: string;
  calories: number;
  distance?: number;
  heart_rate?: HeartRateSummary;
  training_load?: number;
  sport?: string;
  has_route?: boolean;
  club_id?: number;
  club_name?: string;
  detailed_sport_info?: string;
  fat_percentage?: number;
  carbohydrate_percentage?: number;
  protein_percentage?: number;
  "running-index"?: number;
  training_load_pro?: TrainingLoadPro;
  heart_rate_zones?: HeartRateZone[];
  samples?: ExerciseSample[];
  route?: unknown;
}

export interface HeartRateSummary {
  average: number;
  maximum: number;
  minimum?: number;
}

export interface HeartRateZone {
  index: number;
  lower_limit: number;
  upper_limit: number;
  in_zone: string; // ISO 8601 duration e.g. "PT1H2M30S"
}

export interface ExerciseSample {
  recording_rate: number;
  sample_type: number;
  data: string; // comma-separated values
}

export interface TrainingLoadPro {
  "cardio-load"?: number;
  "muscle-load"?: number;
  "perceived-load"?: number;
  "cardio-load-interpretation"?: string;
  "muscle-load-interpretation"?: string;
  "user-rpe"?: string;
}

// Preprocessed sample types
export interface BasicStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p5: number;
  p95: number;
  std_dev: number;
}

export interface SpeedSplit {
  km: number;
  pace_min_per_km: number;
  avg_speed_kmh: number;
}

export interface AltitudeStats {
  total_ascent: number;
  total_descent: number;
  min_elevation: number;
  max_elevation: number;
}

export interface PowerStats {
  avg_power: number;
  normalized_power: number;
  max_power: number;
  variability_index: number;
}

export interface HrvStats {
  rmssd: number;
  sdnn: number;
  mean_rr: number;
  pnn50: number;
}

export interface PreprocessedSamples {
  pace?: { splits: SpeedSplit[] };
  cadence?: { avg: number; max: number };
  altitude?: AltitudeStats;
  power?: PowerStats;
  power_pedaling_index?: { avg: number };
  power_lr_balance?: { avg: number };
  air_pressure?: { avg: number; min: number; max: number };
  running_cadence?: { avg: number; max: number };
  temperature?: { avg: number; min: number; max: number };
  rr_intervals?: HrvStats;
}

export interface ProcessedExercise {
  id: string;
  start_time: string;
  start_time_utc_offset: number;
  duration: string;
  calories: number;
  distance?: number;
  heart_rate?: HeartRateSummary;
  training_load?: number;
  sport?: string;
  detailed_sport_info?: string;
  fat_percentage?: number;
  carbohydrate_percentage?: number;
  protein_percentage?: number;
  "running-index"?: number;
  training_load_pro?: TrainingLoadPro;
  heart_rate_zones?: HeartRateZone[];
  // Sample metrics (flattened from preprocessor)
  pace?: { splits: SpeedSplit[] };
  cadence?: { avg: number; max: number };
  altitude?: AltitudeStats;
  power?: PowerStats;
  power_pedaling_index?: { avg: number };
  power_lr_balance?: { avg: number };
  air_pressure?: { avg: number; min: number; max: number };
  running_cadence?: { avg: number; max: number };
  temperature?: { avg: number; min: number; max: number };
  rr_intervals?: HrvStats;
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

// Preprocessed activity types
export interface ZoneSummary {
  sedentary_minutes: number;
  light_minutes: number;
  moderate_minutes: number;
  vigorous_minutes: number;
}

export interface ProcessedActivity {
  date: string;
  active_duration: string;
  inactive_duration: string;
  calories: number;
  active_calories: number;
  steps: number;
  distance_from_steps: number;
  hourly_steps: { hour: number; steps: number }[];
  zone_summary: ZoneSummary;
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

// Cardio Load types
export interface CardioLoadLevel {
  very_low?: number;
  low?: number;
  medium?: number;
  high?: number;
  "very-high"?: number;
}

export interface CardioLoad {
  date: string;
  cardio_load_status?: string;
  cardio_load?: number;
  strain?: number;
  tolerance?: number;
  cardio_load_ratio?: number;
  cardio_load_level?: CardioLoadLevel;
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

import type {
  ExerciseSample,
  PreprocessedSamples,
  SpeedSplit,
  AltitudeStats,
  PowerStats,
  HrvStats,
} from "../types.js";

// Speed is already in km/h per API docs. Temperature raw values are in 0.1°C increments.
const TEMP_SCALE = 10;

// --- Parsing helpers ---

function parseSampleData(data: string): (number | null)[] {
  return data.split(",").map((v) => {
    const trimmed = v.trim();
    if (trimmed === "" || trimmed === "NULL" || trimmed === "null") return null;
    const num = Number(trimmed);
    return isNaN(num) ? null : num;
  });
}

function filterNulls(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null);
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// --- Type-specific processors ---

function processSpeedSplits(
  speedValues: number[],
  speedRecordingRate: number,
  distanceValues: number[] | null
): { splits: SpeedSplit[] } | null {
  if (speedValues.length === 0) return null;

  const speedKmh = speedValues;

  // If we have distance data, compute per-km splits
  if (distanceValues && distanceValues.length > 0) {
    const splits: SpeedSplit[] = [];
    let currentKm = 1;
    let splitStartIdx = 0;

    for (let i = 0; i < distanceValues.length; i++) {
      const distanceKm = distanceValues[i] / 1000;
      if (distanceKm >= currentKm || i === distanceValues.length - 1) {
        const splitEndIdx = i;
        const samplesInSplit = splitEndIdx - splitStartIdx + 1;

        // Use speed data for the same index range (guard against different lengths)
        const speedSlice = speedKmh.slice(
          splitStartIdx,
          Math.min(splitEndIdx + 1, speedKmh.length)
        );

        if (speedSlice.length > 0) {
          const avgSpeed = speedSlice.reduce((a, b) => a + b, 0) / speedSlice.length;
          const pace = avgSpeed > 0 ? 60 / avgSpeed : 0;

          splits.push({
            km: currentKm,
            pace_min_per_km: round(pace),
            avg_speed_kmh: round(avgSpeed),
          });
        }

        currentKm++;
        splitStartIdx = i + 1;
      }
    }

    if (splits.length > 0) return { splits };
  }

  // Fallback: compute overall stats as a single "split"
  const avgSpeed = speedKmh.reduce((a, b) => a + b, 0) / speedKmh.length;
  const pace = avgSpeed > 0 ? 60 / avgSpeed : 0;
  return {
    splits: [
      {
        km: 0,
        pace_min_per_km: round(pace),
        avg_speed_kmh: round(avgSpeed),
      },
    ],
  };
}

function processAltitude(values: number[]): AltitudeStats | null {
  if (values.length === 0) return null;

  let totalAscent = 0;
  let totalDescent = 0;

  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (delta > 0) totalAscent += delta;
    else totalDescent += Math.abs(delta);
  }

  return {
    total_ascent: round(totalAscent),
    total_descent: round(totalDescent),
    min_elevation: Math.min(...values),
    max_elevation: Math.max(...values),
  };
}

function processPower(values: number[], recordingRate: number): PowerStats | null {
  if (values.length === 0) return null;

  const avgPower = values.reduce((a, b) => a + b, 0) / values.length;
  const maxPower = Math.max(...values);

  // Normalized Power: 30s rolling average, then raise to 4th power, average, then 4th root
  const windowSize = Math.ceil(30 / recordingRate);

  let normalizedPower: number;
  if (values.length < windowSize) {
    // Degenerate: exercise shorter than 30s window
    normalizedPower = avgPower;
  } else {
    const rollingAvgs: number[] = [];
    let windowSum = 0;

    for (let i = 0; i < values.length; i++) {
      windowSum += values[i];
      if (i >= windowSize) {
        windowSum -= values[i - windowSize];
      }
      if (i >= windowSize - 1) {
        rollingAvgs.push(windowSum / windowSize);
      }
    }

    const fourthPowerAvg =
      rollingAvgs.reduce((acc, v) => acc + v ** 4, 0) / rollingAvgs.length;
    normalizedPower = fourthPowerAvg ** 0.25;
  }

  const variabilityIndex = avgPower > 0 ? normalizedPower / avgPower : 0;

  return {
    avg_power: round(avgPower),
    normalized_power: round(normalizedPower),
    max_power: round(maxPower),
    variability_index: round(variabilityIndex),
  };
}

function processRrIntervals(values: number[]): HrvStats | null {
  if (values.length < 2) return null;

  const meanRR = values.reduce((a, b) => a + b, 0) / values.length;

  // SDNN: standard deviation of all RR intervals
  const variance = values.reduce((acc, v) => acc + (v - meanRR) ** 2, 0) / values.length;
  const sdnn = Math.sqrt(variance);

  // RMSSD: root mean square of successive differences
  let sumSquaredDiffs = 0;
  let nn50Count = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    sumSquaredDiffs += diff ** 2;
    if (Math.abs(diff) > 50) nn50Count++;
  }
  const rmssd = Math.sqrt(sumSquaredDiffs / (values.length - 1));

  // pNN50: percentage of successive differences > 50ms
  const pnn50 = ((nn50Count / (values.length - 1)) * 100);

  return {
    rmssd: round(rmssd),
    sdnn: round(sdnn),
    mean_rr: round(meanRR),
    pnn50: round(pnn50),
  };
}

// --- Main orchestrator ---

export function preprocessSamples(
  rawSamples: ExerciseSample[]
): PreprocessedSamples {
  const result: PreprocessedSamples = {};

  // Index samples by type for cross-referencing
  const samplesByType = new Map<number, { values: (number | null)[]; recordingRate: number }>();
  for (const sample of rawSamples) {
    samplesByType.set(sample.sample_type, {
      values: parseSampleData(sample.data),
      recordingRate: sample.recording_rate,
    });
  }

  // Type 1: Speed (needs type 10 distance for splits)
  const speedData = samplesByType.get(1);
  if (speedData) {
    const speedValues = filterNulls(speedData.values);
    const distData = samplesByType.get(10);
    const distValues = distData ? filterNulls(distData.values) : null;
    const splits = processSpeedSplits(speedValues, speedData.recordingRate, distValues);
    if (splits) result.pace = splits;
  }

  // Type 2: Cadence
  const cadenceData = samplesByType.get(2);
  if (cadenceData) {
    const values = filterNulls(cadenceData.values);
    if (values.length > 0) {
      result.cadence = {
        avg: round(values.reduce((a, b) => a + b, 0) / values.length),
        max: Math.max(...values),
      };
    }
  }

  // Type 3: Altitude
  const altData = samplesByType.get(3);
  if (altData) {
    const values = filterNulls(altData.values);
    const stats = processAltitude(values);
    if (stats) result.altitude = stats;
  }

  // Type 4: Power
  const powerData = samplesByType.get(4);
  if (powerData) {
    const values = filterNulls(powerData.values);
    const stats = processPower(values, powerData.recordingRate);
    if (stats) result.power = stats;
  }

  // Type 5: Power pedaling index
  const pedalData = samplesByType.get(5);
  if (pedalData) {
    const values = filterNulls(pedalData.values);
    if (values.length > 0) {
      result.power_pedaling_index = {
        avg: round(values.reduce((a, b) => a + b, 0) / values.length),
      };
    }
  }

  // Type 6: Power L/R balance
  const balanceData = samplesByType.get(6);
  if (balanceData) {
    const values = filterNulls(balanceData.values);
    if (values.length > 0) {
      result.power_lr_balance = {
        avg: round(values.reduce((a, b) => a + b, 0) / values.length),
      };
    }
  }

  // Type 7: Air pressure
  const pressureData = samplesByType.get(7);
  if (pressureData) {
    const values = filterNulls(pressureData.values);
    if (values.length > 0) {
      result.air_pressure = {
        avg: round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }
  }

  // Type 8: Running cadence
  const runCadenceData = samplesByType.get(8);
  if (runCadenceData) {
    const values = filterNulls(runCadenceData.values);
    if (values.length > 0) {
      result.running_cadence = {
        avg: round(values.reduce((a, b) => a + b, 0) / values.length),
        max: Math.max(...values),
      };
    }
  }

  // Type 9: Temperature (raw values in 0.1°C increments)
  const tempData = samplesByType.get(9);
  if (tempData) {
    const values = filterNulls(tempData.values).map((v) => v / TEMP_SCALE);
    if (values.length > 0) {
      result.temperature = {
        avg: round(values.reduce((a, b) => a + b, 0) / values.length),
        min: round(Math.min(...values)),
        max: round(Math.max(...values)),
      };
    }
  }

  // Type 10: Distance — used internally by speed splits, not output directly

  // Type 11: RR intervals
  const rrData = samplesByType.get(11);
  if (rrData) {
    const values = filterNulls(rrData.values);
    const stats = processRrIntervals(values);
    if (stats) result.rr_intervals = stats;
  }

  return result;
}

import { Measurement, Goal } from "@prisma/client";

// Shared types for metric computation
export type MetricMeasurement = {
  date: Date;
  systolic: number | null;
  diastolic: number | null;
  glucose: number | null;
  weight: number | null;
};

export type MetricGoals = {
  systolicMin: number;
  systolicMax: number;
  diastolicMin: number;
  diastolicMax: number;
  glucoseMin: number;
  glucoseMax: number;
  weightBaseline: number | null;
  weightWeeklyAlertThreshold: number;
};

export type AllMetrics = {
  bp: {
    percentInRange14d: number;
    avgSys3d: number;
    avgDia3d: number;
  };
  glucose: {
    percentInRange14d: number;
    avgGlucose3d: number;
  };
  weight: {
    change7d: number | null;
    weeklyAlert: boolean;
  };
};

// Helper to normalize raw Prisma models into metric inputs
export function mapMeasurements(measurements: Measurement[]): MetricMeasurement[] {
  return measurements.map((m) => ({
    date: m.date,
    systolic: m.systolic,
    diastolic: m.diastolic,
    glucose: m.glucose,
    weight: m.weight,
  }));
}

export function mapGoals(goals: Goal | null): MetricGoals {
  // Fall back to sensible defaults when goals are missing
  return {
    systolicMin: goals?.systolicMin ?? 110,
    systolicMax: goals?.systolicMax ?? 135,
    diastolicMin: goals?.diastolicMin ?? 70,
    diastolicMax: goals?.diastolicMax ?? 85,
    glucoseMin: goals?.glucoseMin ?? 70,
    glucoseMax: goals?.glucoseMax ?? 180,
    weightBaseline: goals?.weightBaseline ?? null,
    weightWeeklyAlertThreshold: goals?.weightWeeklyAlertThreshold ?? 5.0,
  };
}

export function computeAllMetrics(
  measurements: MetricMeasurement[],
  goals: MetricGoals
): AllMetrics {
  // Ensure measurements are sorted by date descending (most recent first)
  const sorted = [...measurements].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const bpMetrics = computeBPMetrics(sorted, goals);
  const glucoseMetrics = computeGlucoseMetrics(sorted, goals);
  const weightMetrics = computeWeightMetrics(sorted, goals);

  return {
    bp: bpMetrics,
    glucose: glucoseMetrics,
    weight: weightMetrics,
  };
}

function computeBPMetrics(
  measurements: MetricMeasurement[],
  goals: MetricGoals
): AllMetrics["bp"] {
  const bpPoints = measurements
    .filter((m) => m.systolic !== null && m.diastolic !== null)
    .map((m) => ({
      systolic: m.systolic as number,
      diastolic: m.diastolic as number,
    }));

  const last14 = bpPoints.slice(0, 14);
  const last3 = bpPoints.slice(0, 3);

  const inRangeCount = last14.filter((p) => {
    const sysInRange =
      p.systolic >= goals.systolicMin && p.systolic <= goals.systolicMax;
    const diaInRange =
      p.diastolic >= goals.diastolicMin && p.diastolic <= goals.diastolicMax;
    return sysInRange && diaInRange;
  }).length;

  const percentInRange14d =
    last14.length > 0 ? Math.round((inRangeCount / last14.length) * 100) : 0;

  const avgSys3d =
    last3.length > 0
      ? Math.round(
          last3.reduce((sum, p) => sum + p.systolic, 0) / last3.length
        )
      : 0;
  const avgDia3d =
    last3.length > 0
      ? Math.round(
          last3.reduce((sum, p) => sum + p.diastolic, 0) / last3.length
        )
      : 0;

  return {
    percentInRange14d,
    avgSys3d,
    avgDia3d,
  };
}

function computeGlucoseMetrics(
  measurements: MetricMeasurement[],
  goals: MetricGoals
): AllMetrics["glucose"] {
  const glucosePoints = measurements
    .filter((m) => m.glucose !== null)
    .map((m) => ({
      glucose: m.glucose as number,
    }));

  const last14 = glucosePoints.slice(0, 14);
  const last3 = glucosePoints.slice(0, 3);

  const inRangeCount = last14.filter(
    (p) => p.glucose >= goals.glucoseMin && p.glucose <= goals.glucoseMax
  ).length;

  const percentInRange14d =
    last14.length > 0 ? Math.round((inRangeCount / last14.length) * 100) : 0;

  const avgGlucose3d =
    last3.length > 0
      ? Math.round(
          last3.reduce((sum, p) => sum + p.glucose, 0) / last3.length
        )
      : 0;

  return {
    percentInRange14d,
    avgGlucose3d,
  };
}

function computeWeightMetrics(
  measurements: MetricMeasurement[],
  goals: MetricGoals
): AllMetrics["weight"] {
  const weightPoints = measurements
    .filter((m) => m.weight !== null)
    .map((m) => ({
      date: m.date,
      weight: m.weight as number,
    }));

  if (weightPoints.length === 0) {
    return {
      change7d: null,
      weeklyAlert: false,
    };
  }

  const today = weightPoints[0];

  // Find a point approximately 7 days ago (6–8 day window)
  const weekAgo = weightPoints.find((p, idx) => {
    if (idx === 0) return false;
    const daysDiff =
      (today.date.getTime() - p.date.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff >= 6 && daysDiff <= 8;
  });

  const change7d =
    weekAgo && today.weight && weekAgo.weight
      ? parseFloat((today.weight - weekAgo.weight).toFixed(1))
      : null;

  const weeklyAlert =
    change7d !== null &&
    Math.abs(change7d) > (goals.weightWeeklyAlertThreshold ?? 5.0);

  return {
    change7d,
    weeklyAlert,
  };
}



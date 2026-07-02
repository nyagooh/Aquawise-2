import { SensorReading, RiskLevel } from '../data/mockData';

export interface RiskScore {
  score: number;        // 0–100
  level: RiskLevel;
  label: string;
  color: string;
  bgColor: string;
  factors: { name: string; impact: 'low' | 'medium' | 'high'; message: string }[];
  recommendation: string;
}

export function getSensorRisk(reading: SensorReading): RiskLevel {
  const { value, safeMin, safeMax } = reading;
  const range = safeMax - safeMin;
  const buffer = range * 0.1; // 10% buffer before warning
  if (value < safeMin - buffer || value > safeMax + buffer) return 'danger';
  if (value < safeMin || value > safeMax) return 'warning';
  return 'safe';
}

export function getSensorPercent(reading: SensorReading): number {
  const { value, safeMin, safeMax } = reading;
  const clampedMin = safeMin * 0.8;
  const clampedMax = safeMax * 1.2;
  return Math.min(100, Math.max(0, ((value - clampedMin) / (clampedMax - clampedMin)) * 100));
}

export function calculateOverallRisk(readings: SensorReading[]): RiskScore {
  const weights: Record<string, number> = {
    turbidity: 0.25,
    ph: 0.20,
    dissolved_oxygen: 0.20,
    nitrates: 0.15,
    temperature: 0.10,
    conductivity: 0.10,
  };

  let weightedScore = 0;
  const factors: RiskScore['factors'] = [];

  readings.forEach((r) => {
    const risk = getSensorRisk(r);
    const weight = weights[r.id] ?? 0.10;
    let sensorScore = 0;

    if (risk === 'safe') {
      sensorScore = 15;
    } else if (risk === 'warning') {
      sensorScore = 55;
      factors.push({
        name: r.name,
        impact: 'medium',
        message: `${r.name} is slightly outside the safe range (${r.value} ${r.unit})`,
      });
    } else {
      sensorScore = 90;
      factors.push({
        name: r.name,
        impact: 'high',
        message: `${r.name} is dangerously out of range (${r.value} ${r.unit})`,
      });
    }

    weightedScore += sensorScore * weight;
  });

  const score = Math.round(weightedScore);

  let level: RiskLevel;
  let label: string;
  let color: string;
  let bgColor: string;
  let recommendation: string;

  if (score < 25) {
    level = 'safe';
    label = 'Safe';
    color = '#16a34a';
    bgColor = '#dcfce7';
    recommendation = 'Water quality is within safe limits. Continue regular monitoring.';
  } else if (score < 55) {
    level = 'warning';
    label = 'Caution';
    color = '#d97706';
    bgColor = '#fef3c7';
    recommendation = 'Some parameters are elevated. Increase monitoring frequency and investigate sources.';
  } else {
    level = 'danger';
    label = 'High Risk';
    color = '#dc2626';
    bgColor = '#fee2e2';
    recommendation = 'Critical contamination risk detected. Restrict use and notify authorities immediately.';
  }

  return { score, level, label, color, bgColor, factors, recommendation };
}

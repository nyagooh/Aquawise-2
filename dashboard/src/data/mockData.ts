// Types shared across the app. All data now comes from the Django API via DataContext.

export type RiskLevel = 'safe' | 'warning' | 'danger';

export interface Region {
  id: string;
  name: string;
  water_body: string;
}

export interface SensorReading {
  id: string;
  name: string;
  value: number;
  unit: string;
  safeMin: number;
  safeMax: number;
  isReal: boolean;
  description: string;
}

export interface TimePoint {
  time: string;
  temperature: number;
  turbidity: number;
  ph: number;
  dissolvedOxygen: number;
  conductivity: number;
  nitrates: number;
}

export interface WaterSource {
  id: string;
  name: string;
  regionId: string;
  risk: RiskLevel;
  lastUpdated: string;
}

export interface Alert {
  id: string;
  time: string;
  source: string;
  regionId: string;
  parameter: string;
  value: string;
  risk: RiskLevel;
  action: string;
}

export interface RegionPrediction {
  id: string;
  region: string;
  waterBody: string;
  riskScore: number;
  riskLevel: RiskLevel;
  prediction: string;
  nextRisk: 'rising' | 'falling' | 'stable';
  contaminationProbability: number;
  topConcern: string;
  forecastDays: { day: string; score: number }[];
}

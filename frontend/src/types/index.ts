export type Role = "admin" | "engineer" | "viewer";
export type Severity = "normal" | "low" | "medium" | "high" | "critical";
export type SensorKind = "temperature" | "humidity" | "pressure" | "vibration" | "voltage" | "current" | "rpm";

export interface User { id: number; email: string; name: string; role: Role }
export interface Sensor { id: number; kind: SensorKind; unit: string; min_normal: number; max_normal: number }
export interface Device {
  id: number; name: string; type: string; location: string; status: string; health_score: number;
  sim_mode: string; sim_interval_s: number; last_active: string | null; sensors: Sensor[];
}
export interface RecentDiagnosis {
  id: number; device: string; fault: string; severity: Severity; confidence: number; status: string; detected_at: string;
}
export interface DashboardData {
  total_devices: number; online_devices: number; offline_devices: number;
  active_faults: number; critical_faults: number; warning_faults: number; system_health: number;
  severity_distribution: Record<string, number>;
  recent_diagnoses: RecentDiagnosis[];
  fault_frequency: { fault: string; count: number }[];
  fault_trend: { date: string; count: number }[];
  device_health: { id: number; name: string; status: string; health_score: number }[];
}
export type SeriesData = Record<string, { unit: string; points: { ts: string; value: number }[] }>;

export interface LiveTick {
  type: "tick"; device_id: number; device: string; readings: Record<string, number>;
  health_score: number; overall_severity: Severity;
}
export interface LiveFault {
  type: "fault"; id: number; device_id: number; device: string; fault: string; severity: Severity; confidence: number;
}
export type LiveEvent = LiveTick | LiveFault;

export interface Evidence { sensor: string; value: number; op: string; threshold: number; explanation: string }
export interface DiagnosisItem {
  id?: number; new?: boolean; fault: string; severity: Severity; confidence: number; what_happened: string;
  evidence: Evidence[]; causes: string[]; actions: string[]; prevention: string[]; detected_at: string;
}
export interface DiagnosisReport {
  device: string; readings: Record<string, number>; diagnoses: DiagnosisItem[]; healthy: boolean; overall_severity: Severity;
}
export interface TickResult {
  device_id: number; device: string; mode: string; readings: Record<string, number>; health_score: number; diagnosis: DiagnosisReport;
}
export interface SimStatus { device_id: number; running: boolean; mode: string; interval_s: number; overrides: Record<string, number> }
export interface Scenario { key: string; label: string; values: Record<string, number>; expected: string }
export type FaultStatus = "detected" | "investigating" | "resolved" | "ignored";
export interface FaultRecord {
  id: number; device_id: number; fault: string; severity: Severity; confidence: number; status: FaultStatus; summary: string;
  readings: Record<string, number>; resolution_notes: string; detected_at: string; evidence: Evidence[];
}
export const DEVICE_TYPES = ["Industrial Motor", "HVAC System", "Pump", "Generator", "Smart Machine", "Cooling System"] as const;
export interface DeviceInput { name: string; type: (typeof DEVICE_TYPES)[number]; location: string; sim_interval_s: number }

export const SENSOR_KINDS = ["temperature", "humidity", "pressure", "vibration", "voltage", "current", "rpm"] as const;
export interface Condition { sensor: string; op: ">" | ">=" | "<" | "<="; threshold: number; weight: number }
export interface KnowledgeRule { id?: number; mode: "all" | "any"; severity: "low" | "medium" | "high" | "critical"; conditions: Condition[]; actions: string[]; enabled?: boolean }
export interface KnowledgeEntry { id: number; fault_name: string; description: string; symptoms: string[]; causes: string[]; prevention: string[]; rule: KnowledgeRule | null }
export type KnowledgeInput = Omit<KnowledgeEntry, "id" | "rule"> & { rule: KnowledgeRule };
export interface AlertItem { id: number; device_id: number; device: string; diagnosis_id: number; level: Severity; message: string; is_read: boolean; created_at: string }
export interface UserItem { id: number; email: string; name: string; role: Role; created_at: string }
export interface FaultFilters { device_id: string; severity: string; status: string; date_from: string; date_to: string; sort: string }

export interface AssistantReply { answer: string; source: "rules" | "llm"; device: string | null }

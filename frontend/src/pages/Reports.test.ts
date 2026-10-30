import { summarize } from "./Reports";
import type { FaultRecord } from "../types";

const f = (id: number, fault: string, severity: FaultRecord["severity"], status: FaultRecord["status"], day: string): FaultRecord =>
  ({ id, device_id: 1, fault, severity, confidence: 90, status, summary: "", readings: {}, resolution_notes: "", detected_at: `${day}T10:00:00`, evidence: [] });

describe("report summary", () => {
  const items = [f(1, "Bearing Failure", "high", "resolved", "2026-03-01"), f(2, "Bearing Failure", "high", "detected", "2026-03-01"), f(3, "Overheating", "critical", "investigating", "2026-03-02"), f(4, "High Humidity", "low", "ignored", "2026-03-02")];
  it("computes totals, open count, critical and resolution rate", () => {
    const s = summarize(items);
    expect(s).toMatchObject({ total: 4, resolved: 1, open: 2, critical: 1, resolutionRate: 25 });
  });
  it("ranks fault types and buckets by day and status", () => {
    const s = summarize(items);
    expect(s.faults[0]).toEqual({ fault: "Bearing Failure", count: 2 });
    expect(s.trend).toEqual([{ date: "2026-03-01", count: 2 }, { date: "2026-03-02", count: 2 }]);
    expect(s.statuses.find((x) => x.name === "ignored")?.count).toBe(1);
  });
  it("handles an empty list", () => expect(summarize([]).resolutionRate).toBe(0));
});

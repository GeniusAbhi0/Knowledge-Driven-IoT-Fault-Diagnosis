import { dayLabel, groupByDay } from "./Faults";
import type { FaultRecord } from "../types";

const f = (id: number, detected_at: string): FaultRecord => ({ id, device_id: 1, fault: "x", severity: "high", confidence: 80, status: "detected", summary: "", readings: {}, resolution_notes: "", detected_at, evidence: [] });
const now = new Date(2026, 5, 15, 12, 0, 0);

describe("fault timeline grouping", () => {
  it("labels today and yesterday", () => {
    expect(dayLabel(new Date(2026, 5, 15, 9).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 5, 14, 23).toISOString(), now)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 5, 1, 9).toISOString(), now)).toMatch(/2026/);
  });
  it("keeps order and groups consecutive items by day", () => {
    const groups = groupByDay([f(1, new Date(2026, 5, 15, 11).toISOString()), f(2, new Date(2026, 5, 15, 8).toISOString()), f(3, new Date(2026, 5, 14, 20).toISOString())], now);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([["Today", [1, 2]], ["Yesterday", [3]]]);
  });
});

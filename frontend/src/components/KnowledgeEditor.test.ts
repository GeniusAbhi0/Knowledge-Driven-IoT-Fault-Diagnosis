import { describeRule, validateKnowledge } from "./KnowledgeEditor";
import type { KnowledgeEntry, KnowledgeInput } from "../types";

const base: KnowledgeInput = { fault_name: "Motor Overheating", description: "", symptoms: [], causes: [], prevention: [],
  rule: { mode: "all", severity: "critical", actions: [], conditions: [{ sensor: "temperature", op: ">", threshold: 85, weight: 1 }] } };

describe("validateKnowledge", () => {
  it("accepts a complete rule", () => expect(validateKnowledge(base)).toBeNull());
  it("requires a name and at least one condition", () => {
    expect(validateKnowledge({ ...base, fault_name: " " })).toMatch(/name/);
    expect(validateKnowledge({ ...base, rule: { ...base.rule, conditions: [] } })).toMatch(/condition/);
  });
  it("rejects non-numeric thresholds and non-positive weights", () => {
    const c = base.rule.conditions[0];
    expect(validateKnowledge({ ...base, rule: { ...base.rule, conditions: [{ ...c, threshold: NaN }] } })).toMatch(/numeric/);
    expect(validateKnowledge({ ...base, rule: { ...base.rule, conditions: [{ ...c, weight: 0 }] } })).toMatch(/weight/);
  });
});

describe("describeRule", () => {
  it("joins conditions with AND / OR", () => {
    const two = [{ sensor: "temperature", op: ">" as const, threshold: 85, weight: 1 }, { sensor: "current", op: ">" as const, threshold: 10, weight: 1 }];
    const e = (mode: "all" | "any"): KnowledgeEntry => ({ id: 1, ...base, rule: { ...base.rule, mode, conditions: two } });
    expect(describeRule(e("all"))).toBe("temperature > 85 AND current > 10");
    expect(describeRule(e("any"))).toBe("temperature > 85 OR current > 10");
  });
});

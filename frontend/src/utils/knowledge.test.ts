import { buildGraph, categoryOf, layoutGraph } from "./knowledge";
import type { KnowledgeEntry } from "../types";

const entry = (id: number, name: string, sensors: string[], causes: string[], actions: string[], mode: "all" | "any" = "all"): KnowledgeEntry => ({
  id, fault_name: name, description: "", symptoms: [], prevention: [], causes,
  rule: { mode, severity: "high", actions, conditions: sensors.map((sensor) => ({ sensor, op: ">" as const, threshold: 1, weight: 1 })) },
});

describe("knowledge graph", () => {
  const list = [entry(1, "Bearing Failure", ["vibration", "temperature"], ["Wear", "Lubrication"], ["Inspect"]), entry(2, "Overheating", ["temperature"], ["wear"], ["Inspect", "Cool"])];

  it("links sensors to faults to causes/actions and merges duplicates case-insensitively", () => {
    const { nodes, edges } = buildGraph(list);
    expect(nodes.filter((n) => n.kind === "fault")).toHaveLength(2);
    expect(nodes.filter((n) => n.kind === "sensor").map((n) => n.label).sort()).toEqual(["temperature", "vibration"]);
    expect(nodes.filter((n) => n.kind === "cause")).toHaveLength(2);   // "Wear" and "wear" merged
    expect(nodes.filter((n) => n.kind === "action")).toHaveLength(2);  // "Inspect" shared
    expect(edges).toContainEqual({ from: "sensor:temperature", to: "fault:2" });
    expect(edges).toContainEqual({ from: "fault:1", to: "cause:wear" });
    expect(edges).toContainEqual({ from: "fault:2", to: "cause:wear" });
  });

  it("lays out every node in its column", () => {
    const { nodes, edges } = buildGraph(list);
    const pos = layoutGraph(nodes, edges);
    expect(Object.keys(pos)).toHaveLength(nodes.length);
    expect(pos["sensor:vibration"].x).toBe(0);
    expect(pos["fault:1"].x).toBe(260);
    expect(pos["action:cool"].x).toBe(780);
  });

  it("categorises by the sensors a rule uses", () => {
    expect(categoryOf(entry(1, "a", ["temperature"], [], []))).toBe("Thermal");
    expect(categoryOf(entry(2, "b", ["current"], [], []))).toBe("Electrical");
    expect(categoryOf(entry(3, "c", ["vibration"], [], []))).toBe("Mechanical");
    expect(categoryOf(entry(4, "d", ["temperature", "humidity"], [], [], "any"))).toBe("Sensor integrity");
  });
});

import { render, screen } from "@testing-library/react";
import DiagnosticFlow, { stageDetails } from "./DiagnosticFlow";
import type { DiagnosisReport } from "../types";

const report: DiagnosisReport = { device: "M", readings: {}, overall_severity: "critical", healthy: false, diagnoses: [{
  fault: "Motor Overheating", severity: "critical", confidence: 94, what_happened: "", causes: [], prevention: [], detected_at: "2026-01-01T00:00:00",
  actions: ["a", "b", "c"], evidence: [{ sensor: "temperature", value: 95, op: ">", threshold: 85, explanation: "" }, { sensor: "current", value: 12, op: ">", threshold: 10, explanation: "" }] }] };

describe("DiagnosticFlow", () => {
  it("summarises each stage from the real diagnosis result", () => {
    const d = stageDetails(report, 7);
    expect(d[0]).toBe("7 readings"); expect(d[1]).toBe("2 outside rules"); expect(d[2]).toBe("1 rule fired");
    expect(d[3]).toBe("Motor Overheating"); expect(d[5]).toBe("critical · 94%"); expect(d[6]).toBe("3 steps");
  });
  it("reports a healthy system when nothing fired", () => {
    const d = stageDetails({ ...report, diagnoses: [], healthy: true, overall_severity: "normal" }, 7);
    expect(d[1]).toBe("none found"); expect(d[5]).toBe("System healthy");
  });
  it("shows an idle hint, then completion", () => {
    const { rerender } = render(<DiagnosticFlow running={false} report={null} readingCount={0} />);
    expect(screen.getByText(/Run a diagnosis to see/)).toBeInTheDocument();
    rerender(<DiagnosticFlow running={false} report={report} readingCount={7} />);
    expect(screen.getByText("Diagnosis complete")).toBeInTheDocument();
    expect(screen.getByText("Motor Overheating")).toBeInTheDocument();
  });
});

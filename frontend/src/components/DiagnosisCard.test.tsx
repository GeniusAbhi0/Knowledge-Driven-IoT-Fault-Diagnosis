import { render, screen } from "@testing-library/react";
import { DiagnosisReportView } from "./DiagnosisCard";
import type { DiagnosisReport } from "../types";

const base = { device: "Motor-001", readings: {}, overall_severity: "critical" as const };

describe("DiagnosisReportView", () => {
  it("shows a healthy state when nothing is detected", () => {
    render(<DiagnosisReportView report={{ ...base, diagnoses: [], healthy: true, overall_severity: "normal" }} />);
    expect(screen.getByText("System healthy")).toBeInTheDocument();
  });

  it("explains a fault with evidence, causes and ordered actions", () => {
    const report: DiagnosisReport = { ...base, healthy: false, diagnoses: [{
      fault: "Motor Overheating", severity: "critical", confidence: 94, what_happened: "Temperature exceeded the safe threshold.",
      evidence: [{ sensor: "temperature", value: 92, op: ">", threshold: 85, explanation: "temperature = 92" }],
      causes: ["Cooling system failure"], actions: ["Inspect cooling system", "Check motor load"], prevention: [], detected_at: "2026-01-01T00:00:00",
    }] };
    render(<DiagnosisReportView report={report} />);
    expect(screen.getByRole("heading", { name: "Motor Overheating" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Confidence" })).toHaveAttribute("aria-valuenow", "94");
    expect(screen.getByText("92")).toBeInTheDocument();
    expect(screen.getByText(/above 85/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Cooling system failure", "Inspect cooling system", "Check motor load"]);
  });
});

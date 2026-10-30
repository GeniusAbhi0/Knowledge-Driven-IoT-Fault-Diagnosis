"""Explainable rule-based diagnosis engine. Pure Python: no DB or web imports."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Mapping

SEVERITY_ORDER = ["normal", "low", "medium", "high", "critical"]
OPS = {
    ">": lambda v, t: v > t, ">=": lambda v, t: v >= t,
    "<": lambda v, t: v < t, "<=": lambda v, t: v <= t,
}
OP_WORDS = {">": "above", ">=": "at or above", "<": "below", "<=": "at or below"}


@dataclass
class Condition:
    sensor: str
    op: str
    threshold: float
    weight: float = 1.0

    def __post_init__(self) -> None:
        if self.op not in OPS:
            raise ValueError(f"Unsupported operator: {self.op}")


@dataclass
class Rule:
    fault: str
    description: str
    severity: str
    mode: str  # "all" = AND, "any" = OR
    conditions: list[Condition]
    causes: list[str] = field(default_factory=list)
    actions: list[str] = field(default_factory=list)
    prevention: list[str] = field(default_factory=list)
    enabled: bool = True

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> "Rule":
        if d["severity"] not in SEVERITY_ORDER:
            raise ValueError(f"Invalid severity: {d['severity']}")
        if d["mode"] not in ("all", "any"):
            raise ValueError("mode must be 'all' or 'any'")
        conds = [Condition(**c) for c in d["conditions"]]
        if not conds:
            raise ValueError("A rule needs at least one condition")
        return cls(
            fault=d["fault"], description=d.get("description", ""), severity=d["severity"],
            mode=d["mode"], conditions=conds, causes=list(d.get("causes", [])),
            actions=list(d.get("actions", [])), prevention=list(d.get("prevention", [])),
            enabled=d.get("enabled", True),
        )


@dataclass
class Evidence:
    sensor: str
    value: float
    op: str
    threshold: float
    explanation: str


@dataclass
class Diagnosis:
    fault: str
    severity: str
    confidence: int  # 0-100
    what_happened: str
    evidence: list[Evidence]
    causes: list[str]
    actions: list[str]
    prevention: list[str]
    detected_at: datetime


@dataclass
class DiagnosisReport:
    device: str
    readings: dict[str, float]
    diagnoses: list[Diagnosis]  # ranked, most urgent first
    healthy: bool
    overall_severity: str


class DiagnosisEngine:
    def __init__(self, rules: list[Rule]):
        self.rules = [r for r in rules if r.enabled]

    def _evaluate(self, rule: Rule, readings: Mapping[str, float]) -> Diagnosis | None:
        matched: list[tuple[Condition, float]] = []
        for c in rule.conditions:
            value = readings.get(c.sensor)
            if value is not None and OPS[c.op](value, c.threshold):
                matched.append((c, value))
        if not matched or (rule.mode == "all" and len(matched) < len(rule.conditions)):
            return None

        total_w = sum(c.weight for c in rule.conditions)
        coverage = sum(c.weight for c, _ in matched) / total_w
        # Margin: how far past the threshold each matched reading is (saturates at 25%).
        margins = [min(1.0, abs(v - c.threshold) / max(abs(c.threshold) * 0.25, 1e-9)) for c, v in matched]
        confidence = round(100 * (0.7 * coverage + 0.3 * sum(margins) / len(margins)))

        evidence = [
            Evidence(c.sensor, v, c.op, c.threshold,
                     f"{c.sensor} = {v:g}, which is {OP_WORDS[c.op]} the {c.threshold:g} threshold")
            for c, v in matched
        ]
        return Diagnosis(
            fault=rule.fault, severity=rule.severity, confidence=confidence,
            what_happened=f"{rule.description} ({len(matched)} of {len(rule.conditions)} conditions met).",
            evidence=evidence, causes=rule.causes, actions=rule.actions,
            prevention=rule.prevention, detected_at=datetime.now(timezone.utc),
        )

    def diagnose(self, device: str, readings: Mapping[str, float]) -> DiagnosisReport:
        found = [d for r in self.rules if (d := self._evaluate(r, readings))]
        found.sort(key=lambda d: (SEVERITY_ORDER.index(d.severity), d.confidence), reverse=True)
        overall = found[0].severity if found else "normal"
        return DiagnosisReport(device, dict(readings), found, not found, overall)

import { fireEvent, render, screen } from "@testing-library/react";
import TwinFallback from "./TwinFallback";
import type { Device } from "../types";

const dev = (id: number, name: string, status: string, health: number): Device =>
  ({ id, name, type: "Industrial Motor", location: "", status, health_score: health, sim_mode: "normal", sim_interval_s: 5, last_active: null, sensors: [] });

describe("TwinFallback (2D topology)", () => {
  const devices = [dev(1, "Motor-01", "online", 100), dev(2, "Motor-02", "online", 30), dev(3, "Pump-01", "offline", 90)];

  it("shows every real device with its computed state", () => {
    render(<TwinFallback devices={devices} selectedId={null} onSelect={() => undefined} />);
    expect(screen.getByRole("button", { name: "Motor-01, Healthy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Motor-02, Critical" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pump-01, Offline" })).toBeInTheDocument();
  });

  it("selects a device on click and on keyboard activation", () => {
    const onSelect = vi.fn();
    render(<TwinFallback devices={devices} selectedId={2} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Motor-01, Healthy" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Pump-01, Offline" }), { key: "Enter" });
    expect(onSelect).toHaveBeenNthCalledWith(1, 1);
    expect(onSelect).toHaveBeenNthCalledWith(2, 3);
    expect(screen.getByRole("button", { name: "Motor-02, Critical" })).toHaveAttribute("aria-pressed", "true");
  });
});

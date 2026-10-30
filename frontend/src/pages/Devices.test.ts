import { validateDevice } from "./Devices";

const ok = { name: "Motor-001", type: "Pump" as const, location: "", sim_interval_s: 5 };

describe("validateDevice", () => {
  it("accepts a valid device", () => expect(validateDevice(ok)).toBeNull());
  it("requires a name", () => expect(validateDevice({ ...ok, name: "  " })).toMatch(/required/));
  it("rejects out-of-range or fractional intervals", () => {
    expect(validateDevice({ ...ok, sim_interval_s: 0 })).toMatch(/Interval/);
    expect(validateDevice({ ...ok, sim_interval_s: 4000 })).toMatch(/Interval/);
    expect(validateDevice({ ...ok, sim_interval_s: 2.5 })).toMatch(/Interval/);
  });
});

import { deviceState } from "./deviceState";

describe("deviceState", () => {
  it("classifies by health score for online devices", () => {
    expect(deviceState({ status: "online", health_score: 100 })).toBe("healthy");
    expect(deviceState({ status: "online", health_score: 80 })).toBe("healthy");
    expect(deviceState({ status: "online", health_score: 79 })).toBe("warning");
    expect(deviceState({ status: "online", health_score: 50 })).toBe("warning");
    expect(deviceState({ status: "online", health_score: 49 })).toBe("critical");
  });
  it("treats anything not online as offline regardless of health", () => {
    expect(deviceState({ status: "offline", health_score: 100 })).toBe("offline");
  });
});

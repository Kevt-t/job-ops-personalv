import { describe, expect, it } from "vitest";
import { canFinalizeTailoring } from "./rules";

describe("canFinalizeTailoring", () => {
  it("returns true unconditionally", () => {
    expect(canFinalizeTailoring()).toBe(true);
  });
});

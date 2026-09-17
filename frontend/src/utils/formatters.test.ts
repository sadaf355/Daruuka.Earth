import { describe, expect, it } from "vitest";
import { formatArea, formatDate } from "./formatters";

describe("formatArea", () => {
  it("caps the precision at two decimals", () => {
    expect(formatArea(842.4239)).toBe("842.42");
  });

  it("formats whole numbers without trailing zeros", () => {
    expect(formatArea(500)).toBe("500");
  });

  it("handles zero", () => {
    expect(formatArea(0)).toBe("0");
  });
});

describe("formatDate", () => {
  it("renders an ISO date without throwing", () => {
    expect(formatDate("2026-09-17T10:30:00Z")).toMatch(/2026/);
  });
});

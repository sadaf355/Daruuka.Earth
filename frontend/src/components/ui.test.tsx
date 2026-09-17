import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthBadge, Kpi } from "./ui";

describe("HealthBadge", () => {
  it("renders the at_risk enum value as human-readable text", () => {
    render(<HealthBadge health="at_risk" />);
    expect(screen.getByText("At Risk")).toBeInTheDocument();
  });

  it("applies a health-specific class so the colour matches the map legend", () => {
    const { container } = render(<HealthBadge health="watch" />);
    expect(container.querySelector(".badge.watch")).not.toBeNull();
  });
});

describe("Kpi", () => {
  it("marks a positive trend as up", () => {
    const { container } = render(<Kpi label="Carbon" value="4,821" sub="+8.2%" trend={8.2} />);
    expect(container.querySelector(".trend.up")).not.toBeNull();
  });

  it("marks a negative trend as down", () => {
    const { container } = render(<Kpi label="NDVI" value="0.68" sub="-12.4%" trend={-12.4} />);
    expect(container.querySelector(".trend.down")).not.toBeNull();
  });

  it("falls back to a neutral state with no trend", () => {
    const { container } = render(<Kpi label="Area" value="842" sub="hectares" />);
    expect(container.querySelector(".trend")).toBeNull();
  });
});

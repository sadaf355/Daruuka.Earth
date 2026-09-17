import { describe, expect, it } from "vitest";
import { polygonAreaHa, polygonCenter } from "./geo";
import type { GeoJSONPolygon } from "../types";

/**
 * The live area readout while drawing is a client-side preview only — PostGIS is the source
 * of truth on save. These tests pin the preview to a known-good order of magnitude so a
 * unit slip (m² vs hectares) can't silently ship.
 */

/** ~1.11 km x ~1.11 km at the equator => ~123 ha. */
const SQUARE: GeoJSONPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01],
      [0, 0],
    ],
  ],
};

describe("polygonAreaHa", () => {
  it("returns hectares, not square metres", () => {
    const area = polygonAreaHa(SQUARE);
    expect(area).toBeGreaterThan(100);
    expect(area).toBeLessThan(150);
  });

  it("scales roughly with the square of the side length", () => {
    const doubled: GeoJSONPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0.02, 0],
          [0.02, 0.02],
          [0, 0.02],
          [0, 0],
        ],
      ],
    };
    expect(polygonAreaHa(doubled) / polygonAreaHa(SQUARE)).toBeCloseTo(4, 1);
  });

  it("is never negative regardless of ring winding order", () => {
    const reversed: GeoJSONPolygon = {
      type: "Polygon",
      coordinates: [[...SQUARE.coordinates[0]].reverse()],
    };
    expect(polygonAreaHa(reversed)).toBeGreaterThan(0);
  });
});

describe("polygonCenter", () => {
  it("returns the centroid as [lng, lat]", () => {
    const [lng, lat] = polygonCenter(SQUARE);
    expect(lng).toBeCloseTo(0.005, 3);
    expect(lat).toBeCloseTo(0.005, 3);
  });

  it("keeps longitude first, matching Mapbox's coordinate order", () => {
    const offset: GeoJSONPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [-60, 10],
          [-59.99, 10],
          [-59.99, 10.01],
          [-60, 10.01],
          [-60, 10],
        ],
      ],
    };
    const [lng, lat] = polygonCenter(offset);
    expect(lng).toBeLessThan(0);
    expect(lat).toBeGreaterThan(0);
  });
});

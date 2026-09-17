import * as turf from "@turf/turf";
import type { GeoJSONPolygon } from "../types";

export function polygonAreaHa(geometry: GeoJSONPolygon) {
  return turf.area(turf.feature(geometry)) / 10000;
}

export function polygonCenter(geometry: GeoJSONPolygon): [number, number] {
  const center = turf.centroid(turf.feature(geometry));
  return center.geometry.coordinates as [number, number];
}

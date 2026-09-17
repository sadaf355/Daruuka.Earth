import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { Crosshair, Layers, Maximize2, Minus, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ApiSite, GeoJSONPolygon, Health } from "../../types";
import { formatArea } from "../../utils/formatters";
import { polygonCenter } from "../../utils/geo";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const DEFAULT_CENTER: [number, number] = [-58, 5];

const STYLES = {
  street: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

const HEALTH_COLOR: Record<Health, string> = {
  healthy: "#22c55e",
  watch: "#f59e0b",
  at_risk: "#ef4444",
};

/** Below this zoom a site polygon is a few pixels wide, so we show clustered centroids instead. */
const CLUSTER_MAX_ZOOM = 7;

/**
 * A Mapbox data-driven style expression: pick the fill/stroke colour from each feature's
 * `health` property, so the ML model's output literally paints the map.
 *
 * Typed loosely on purpose. The name of the expression type has moved across
 * @types/mapbox-gl major versions (`Expression` -> `ExpressionSpecification`), and pinning
 * it here would break the build on a types bump for no safety benefit — the shape is
 * validated by Mapbox at runtime either way.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const healthMatchExpression: any = [
  "match",
  ["get", "health"],
  "healthy",
  HEALTH_COLOR.healthy,
  "watch",
  HEALTH_COLOR.watch,
  "at_risk",
  HEALTH_COLOR.at_risk,
  HEALTH_COLOR.healthy,
];

/**
 * Minimal shape of a Mapbox layer-click event. Same reasoning as above:
 * `MapboxGeoJSONFeature` was renamed to `MapGeoJSONFeature` in the v3 types.
 */
interface MapLayerClickEvent {
  features?: Array<{
    properties?: Record<string, unknown> | null;
    geometry?: { type: string; coordinates?: unknown };
  }>;
}

export interface PortfolioMapSite extends ApiSite {
  projectName?: string;
}

interface PortfolioMapProps {
  draw?: boolean;
  sites?: PortfolioMapSite[];
  onDrawChange?: (geometry: GeoJSONPolygon | null, previewAreaHa: number | null) => void;
  center?: [number, number];
  zoom?: number;
}

function healthFromSite(site: PortfolioMapSite): Health {
  return site.status ?? "healthy";
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character,
  );
}

export function PortfolioMap({
  draw = false,
  sites = [],
  onDrawChange,
  center = DEFAULT_CENTER,
  zoom = 2.2,
}: PortfolioMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const navigate = useNavigate();
  const [satellite, setSatellite] = useState(false);
  const [ready, setReady] = useState(false);

  // Polygons for the detail view, centroid points for the clustered overview. Both are
  // derived once here so neither the map effect nor a re-render recomputes them.
  const polygonCollection = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: sites
        .filter((site) => site.geometry?.type === "Polygon")
        .map((site) => ({
          type: "Feature" as const,
          properties: {
            id: site.id,
            name: site.name,
            projectName: site.projectName ?? "",
            health: healthFromSite(site),
            areaHa: site.area_ha,
          },
          geometry: site.geometry,
        })),
    }),
    [sites],
  );

  const pointCollection = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: polygonCollection.features.map((feature) => ({
        type: "Feature" as const,
        properties: feature.properties,
        geometry: {
          type: "Point" as const,
          coordinates: polygonCenter(feature.geometry as GeoJSONPolygon),
        },
      })),
    }),
    [polygonCollection],
  );

  const openSitePopup = useCallback(
    (map: mapboxgl.Map, siteId: string) => {
      const site = sites.find((item) => item.id === siteId);
      if (!site) return;
      popupRef.current?.remove();
      const popup = new mapboxgl.Popup({ offset: 14, closeButton: true })
        .setLngLat(polygonCenter(site.geometry))
        .setHTML(
          `<div class="map-popup">
            <strong>${escapeHtml(site.name)}</strong>
            ${site.projectName ? `<span>${escapeHtml(site.projectName)}</span>` : ""}
            <div class="map-popup-row"><span>Area</span><b>${formatArea(site.area_ha)} ha</b></div>
            <div class="map-popup-row"><span>Health</span><b>${escapeHtml(
              healthFromSite(site).replace("_", " "),
            )}</b></div>
            <button data-darukaa-site="${escapeHtml(site.id)}" class="map-popup-action">View site →</button>
          </div>`,
        )
        .addTo(map);
      popupRef.current = popup;
      popup
        .getElement()
        ?.querySelector<HTMLButtonElement>("[data-darukaa-site]")
        ?.addEventListener("click", () => navigate(`/app/sites/${siteId}`), { once: true });
    },
    [navigate, sites],
  );

  // --- Map creation (runs once) --------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLES.street,
      center,
      zoom,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
    mapRef.current = map;

    let drawControl: MapboxDraw | null = null;
    if (draw) {
      drawControl = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: "draw_polygon",
      });
      drawRef.current = drawControl;
      map.addControl(drawControl, "top-left");

      const emitChange = () => {
        const feature = drawControl?.getAll().features.find((item) => item.geometry.type === "Polygon");
        if (!feature || feature.geometry.type !== "Polygon") {
          onDrawChange?.(null, null);
          return;
        }
        const geometry = feature.geometry as GeoJSONPolygon;
        const areaHa = turf.area(turf.feature(geometry)) / 10000;
        onDrawChange?.(geometry, Math.round(areaHa * 100) / 100);
      };

      map.on("draw.create", emitChange);
      map.on("draw.update", emitChange);
      map.on("draw.delete", emitChange);
    }

    const markReady = () => setReady(true);
    map.on("load", markReady);
    map.on("style.load", markReady);

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      popupRef.current = null;
      setReady(false);
    };
    // Intentionally excludes `sites` — data changes are handled by the layer effect below,
    // so updating a site never tears down and rebuilds the whole map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  // --- Layers + data (re-runs whenever the sites change or the basemap reloads) ---------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || draw || !ready) return;

    const polygonSource = map.getSource("portfolio-sites") as mapboxgl.GeoJSONSource | undefined;
    if (polygonSource) polygonSource.setData(polygonCollection);
    else map.addSource("portfolio-sites", { type: "geojson", data: polygonCollection });

    const pointSource = map.getSource("portfolio-points") as mapboxgl.GeoJSONSource | undefined;
    if (pointSource) pointSource.setData(pointCollection);
    else
      map.addSource("portfolio-points", {
        type: "geojson",
        data: pointCollection,
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: 48,
      });

    if (!map.getLayer("portfolio-sites-fill")) {
      map.addLayer({
        id: "portfolio-sites-fill",
        type: "fill",
        source: "portfolio-sites",
        minzoom: CLUSTER_MAX_ZOOM,
        paint: { "fill-color": healthMatchExpression, "fill-opacity": 0.24 },
      });
    }
    if (!map.getLayer("portfolio-sites-line")) {
      map.addLayer({
        id: "portfolio-sites-line",
        type: "line",
        source: "portfolio-sites",
        minzoom: CLUSTER_MAX_ZOOM,
        paint: { "line-color": healthMatchExpression, "line-width": 2, "line-opacity": 0.9 },
      });
    }

    // Clustered overview: one bubble per group of nearby sites, sized by count.
    if (!map.getLayer("portfolio-clusters")) {
      map.addLayer({
        id: "portfolio-clusters",
        type: "circle",
        source: "portfolio-points",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0f766e",
          "circle-opacity": 0.85,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#5eead4",
          "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 20, 30],
        },
      });
    }
    if (!map.getLayer("portfolio-cluster-count")) {
      map.addLayer({
        id: "portfolio-cluster-count",
        type: "symbol",
        source: "portfolio-points",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 13,
        },
        paint: { "text-color": "#f0fdfa" },
      });
    }
    if (!map.getLayer("portfolio-unclustered")) {
      map.addLayer({
        id: "portfolio-unclustered",
        type: "circle",
        source: "portfolio-points",
        filter: ["!", ["has", "point_count"]],
        maxzoom: CLUSTER_MAX_ZOOM,
        paint: {
          "circle-color": healthMatchExpression,
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(9,18,16,.85)",
        },
      });
    }

    const onSiteClick = (event: MapLayerClickEvent) => {
      const id = event.features?.[0]?.properties?.id as string | undefined;
      if (id) openSitePopup(map, id);
    };

    /** Clicking a cluster zooms into it — the standard Mapbox cluster interaction. */
    const onClusterClick = (event: MapLayerClickEvent) => {
      const feature = event.features?.[0];
      const clusterId = feature?.properties?.cluster_id as number | undefined;
      const center = feature?.geometry?.coordinates as [number, number] | undefined;
      if (clusterId === undefined || !center) return;
      const source = map.getSource("portfolio-points") as mapboxgl.GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (error: unknown, expansionZoom?: number | null) => {
        if (error || expansionZoom == null) return;
        map.easeTo({ center, zoom: expansionZoom });
      });
    };

    const pointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const reset = () => {
      map.getCanvas().style.cursor = "";
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const on = map.on.bind(map) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const off = map.off.bind(map) as any;

    const clickable = ["portfolio-sites-fill", "portfolio-unclustered"];
    clickable.forEach((layer) => {
      on("click", layer, onSiteClick);
      on("mouseenter", layer, pointer);
      on("mouseleave", layer, reset);
    });
    on("click", "portfolio-clusters", onClusterClick);
    on("mouseenter", "portfolio-clusters", pointer);
    on("mouseleave", "portfolio-clusters", reset);

    if (polygonCollection.features.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      polygonCollection.features.forEach((feature) =>
        turf.coordEach(feature, (coord) => bounds.extend(coord as [number, number])),
      );
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 70, maxZoom: 12, duration: 700 });
    }

    return () => {
      clickable.forEach((layer) => {
        off("click", layer, onSiteClick);
        off("mouseenter", layer, pointer);
        off("mouseleave", layer, reset);
      });
      off("click", "portfolio-clusters", onClusterClick);
      off("mouseenter", "portfolio-clusters", pointer);
      off("mouseleave", "portfolio-clusters", reset);
      popupRef.current?.remove();
    };
  }, [draw, openSitePopup, pointCollection, polygonCollection, ready]);

  function toggleBasemap() {
    const map = mapRef.current;
    if (!map) return;
    const next = !satellite;
    setSatellite(next);
    setReady(false); // layers are dropped by a style change; the effect re-adds them on style.load
    map.setStyle(next ? STYLES.satellite : STYLES.street);
  }

  function clearDrawing() {
    drawRef.current?.deleteAll();
    onDrawChange?.(null, null);
  }

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-wrap">
        <div className="fake-map">
          <div className="map-msg">
            <strong>Mapbox is not configured.</strong>
            <span>
              Set <code>VITE_MAPBOX_TOKEN</code> in <code>frontend/.env</code> to enable the live
              geospatial workspace.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="mapbox-container" />
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <Plus />
        </button>
        <button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <Minus />
        </button>
        <button
          aria-label={satellite ? "Switch to street basemap" : "Switch to satellite basemap"}
          disabled={draw}
          onClick={toggleBasemap}
        >
          <Layers />
        </button>
        {draw && (
          <button aria-label="Clear polygon" onClick={clearDrawing}>
            <Crosshair />
          </button>
        )}
        <button aria-label="Fullscreen" onClick={() => containerRef.current?.requestFullscreen?.()}>
          <Maximize2 />
        </button>
      </div>
      {!draw && (
        <div className="map-legend">
          <b>Site health</b>
          <span>
            <i className="dot healthy" /> Healthy
          </span>
          <span>
            <i className="dot watch" /> Watch
          </span>
          <span>
            <i className="dot at_risk" /> At Risk
          </span>
          <small>Zoom in past level {CLUSTER_MAX_ZOOM} for site boundaries</small>
        </div>
      )}
      {draw && (
        <div className="draw-hint">
          Draw a polygon to define the monitoring site. The area preview updates live.
        </div>
      )}
    </div>
  );
}

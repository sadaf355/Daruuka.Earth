import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// jsdom has no canvas/WebGL, so Mapbox GL cannot initialise. Every component under test
// that renders a map gets this stub instead — we assert on our own logic, not Mapbox's.
vi.mock("mapbox-gl", () => {
  class Map {
    on() {}
    off() {}
    once() {}
    remove() {}
    addControl() {}
    addSource() {}
    addLayer() {}
    getSource() {
      return undefined;
    }
    getLayer() {
      return undefined;
    }
    getCanvas() {
      return { style: {} };
    }
    isStyleLoaded() {
      return false;
    }
    setStyle() {}
    fitBounds() {}
    easeTo() {}
    zoomIn() {}
    zoomOut() {}
  }
  class Popup {
    setLngLat() {
      return this;
    }
    setHTML() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
    getElement() {
      return null;
    }
  }
  class LngLatBounds {
    extend() {}
    isEmpty() {
      return true;
    }
  }
  return {
    default: { Map, Popup, LngLatBounds, NavigationControl: class {}, accessToken: "" },
    Map,
    Popup,
    LngLatBounds,
    NavigationControl: class {},
  };
});

vi.mock("@mapbox/mapbox-gl-draw", () => ({
  default: class {
    getAll() {
      return { features: [] };
    }
    deleteAll() {}
  },
}));

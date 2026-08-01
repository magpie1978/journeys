// =====================================================
// AIRPORTS.JS — FINAL UNIFIED BUILD

// This file has four main responsibilities:
//     Load airport metadata for the currently displayed flight routes.
//     Draw airport and non-flight endpoint markers.
//     Add hover and click interactions.
//     Filter the displayed routes when an airport is selected.
// =====================================================

// =====================================================
// AIRPORTS.JS
// Airport markers, non-flight endpoints and filtering
// =====================================================


// =====================================================
// STATE
// =====================================================

window.activeAirportFilter =
  window.activeAirportFilter || null;

/*
 * loadAirports() can run repeatedly.
 * These flags prevent duplicate Mapbox event handlers.
 */
const airportHandlerState = {
  airportHoverBound: false,
  mapClickBound: false,
  nonFlightHoverBound: false
};

/*
 * Stores the complete route collection that was visible
 * immediately before an airport filter was applied.
 */
let routesBeforeAirportFilter = null;


// =====================================================
// MAP SOURCE AND LAYER IDS
// =====================================================

const AIRPORT_SOURCE_ID = "airports";
const AIRPORT_CIRCLE_LAYER_ID = "airports-circle";
const AIRPORT_HIT_LAYER_ID = "airports-hit";

const ENDPOINT_SOURCE_ID = "journey-endpoints";
const ENDPOINT_CIRCLE_LAYER_ID =
  "journey-endpoints-circle";
const ENDPOINT_HIT_LAYER_ID =
  "journey-endpoints-hit";


// =====================================================
// BASIC HELPERS
// =====================================================

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: []
  };
}


function getCurrentMapMode() {
  if (window.appState?.mode) {
    return window.appState.mode;
  }

  if (typeof mapMode !== "undefined") {
    return mapMode;
  }

  return "routes";
}


function getActiveAirportFilter() {
  return (
    window.appState?.activeAirport ||
    window.activeAirportFilter ||
    null
  );
}


function setActiveAirportFilter(airportCode) {
  const nextAirport =
    airportCode || null;

  window.activeAirportFilter =
    nextAirport;

  if (window.appState) {
    window.appState.activeAirport =
      nextAirport;
  }
}


function clearIsolatedRoute() {
  if (window.appState) {
    window.appState.isolatedUid = null;
  }

  /*
   * Compatibility with older files that still use
   * the standalone isolatedUid variable.
   */
  if (typeof isolatedUid !== "undefined") {
    isolatedUid = null;
  }
}


function escapePopupHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// SOURCE AND LAYER HELPERS
// =====================================================

function clearGeoJsonSource(sourceId) {
  if (
    typeof map === "undefined" ||
    !map
  ) {
    return;
  }

  if (typeof clearSource === "function") {
    clearSource(sourceId);
    return;
  }

  const source =
    map.getSource(sourceId);

  if (
    source &&
    typeof source.setData === "function"
  ) {
    source.setData(
      emptyFeatureCollection()
    );
  }
}


function setLayerVisibility(
  layerId,
  visibility
) {
  if (
    typeof map === "undefined" ||
    !map ||
    !map.getLayer(layerId)
  ) {
    return;
  }

  map.setLayoutProperty(
    layerId,
    "visibility",
    visibility
  );
}


// =====================================================
// LOAD AIRPORTS AND ENDPOINTS
// =====================================================

async function loadAirports(routes) {
  if (
    typeof map === "undefined" ||
    !map
  ) {
    return;
  }

  if (getCurrentMapMode() !== "routes") {
    hideAirportLayers();
    return;
  }

  const safeRoutes =
    Array.isArray(routes)
      ? routes.filter(Boolean)
      : [];

  // -------------------------------------------------
  // COLLECT AIRPORT CODES USED BY FLIGHTS
  // -------------------------------------------------

  const flightCodes = new Set();

  safeRoutes.forEach(route => {
    const journeyType =
      String(
        route.journey_type || ""
      ).toLowerCase();

    if (journeyType !== "flight") {
      return;
    }

    if (route.origin) {
      flightCodes.add(route.origin);
    }

    if (route.destination) {
      flightCodes.add(
        route.destination
      );
    }
  });

  // -------------------------------------------------
  // LOAD AND RENDER FLIGHT AIRPORTS
  // -------------------------------------------------

  if (flightCodes.size > 0) {
    const { data, error } = await sb
      .from("journey_locations")
      .select(`
        airport_code,
        city,
        country,
        longitude,
        latitude
      `)
      .in(
        "airport_code",
        [...flightCodes]
      );

    if (error) {
      console.error(
        "[airports] Airport lookup failed:",
        error
      );

      clearGeoJsonSource(
        AIRPORT_SOURCE_ID
      );

      setLayerVisibility(
        AIRPORT_CIRCLE_LAYER_ID,
        "none"
      );

      setLayerVisibility(
        AIRPORT_HIT_LAYER_ID,
        "none"
      );
    } else {
      renderAirportMarkers(
        data || []
      );
    }
  } else {
    clearGeoJsonSource(
      AIRPORT_SOURCE_ID
    );

    setLayerVisibility(
      AIRPORT_CIRCLE_LAYER_ID,
      "none"
    );

    setLayerVisibility(
      AIRPORT_HIT_LAYER_ID,
      "none"
    );
  }

  // -------------------------------------------------
  // NON-FLIGHT ENDPOINTS
  // -------------------------------------------------

  renderNonFlightEndpoints(
    safeRoutes
  );

  // -------------------------------------------------
  // MAP CLICK CONTROLLER
  // -------------------------------------------------

  bindAirportMapClick();
}

window.loadAirports = loadAirports;


// =====================================================
// RENDER FLIGHT AIRPORT MARKERS
// =====================================================

function renderAirportMarkers(airports) {
  const featureCollection = {
    type: "FeatureCollection",

    features: (airports || [])
      .filter(airport =>
        Number.isFinite(
          Number(airport.longitude)
        ) &&
        Number.isFinite(
          Number(airport.latitude)
        )
      )
      .map(airport => ({
        type: "Feature",

        geometry: {
          type: "Point",

          coordinates: [
            Number(airport.longitude),
            Number(airport.latitude)
          ]
        },

        properties: {
          airport_code:
            airport.airport_code || "",

          city:
            airport.city || "",

          country:
            airport.country || ""
        }
      }))
  };

  const existingSource =
    map.getSource(
      AIRPORT_SOURCE_ID
    );

  if (existingSource) {
    existingSource.setData(
      featureCollection
    );
  } else {
    map.addSource(
      AIRPORT_SOURCE_ID,
      {
        type: "geojson",
        data: featureCollection
      }
    );
  }

  if (
    !map.getLayer(
      AIRPORT_CIRCLE_LAYER_ID
    )
  ) {
    map.addLayer({
      id: AIRPORT_CIRCLE_LAYER_ID,
      type: "circle",
      source: AIRPORT_SOURCE_ID,

      paint: {
        "circle-radius": 6,
        "circle-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-stroke-color":
          "#000000"
      }
    });
  }

  if (
    !map.getLayer(
      AIRPORT_HIT_LAYER_ID
    )
  ) {
    map.addLayer({
      id: AIRPORT_HIT_LAYER_ID,
      type: "circle",
      source: AIRPORT_SOURCE_ID,

      paint: {
        "circle-radius": 18,
        "circle-color":
          "rgba(0, 0, 0, 0)"
      }
    });
  }

  /*
   * Keep the visible marker above the larger invisible
   * interaction layer.
   */
  if (
    map.getLayer(
      AIRPORT_HIT_LAYER_ID
    )
  ) {
    map.moveLayer(
      AIRPORT_HIT_LAYER_ID
    );
  }

  if (
    map.getLayer(
      AIRPORT_CIRCLE_LAYER_ID
    )
  ) {
    map.moveLayer(
      AIRPORT_CIRCLE_LAYER_ID
    );
  }

  setLayerVisibility(
    AIRPORT_CIRCLE_LAYER_ID,
    "visible"
  );

  setLayerVisibility(
    AIRPORT_HIT_LAYER_ID,
    "visible"
  );

  bindAirportHover();
  bindAirportMapClick();
}


// =====================================================
// ROUTE ENDPOINT EXTRACTION
// =====================================================

function getRouteEndpointCoordinates(route) {
  const geometry =
    route?.geom;

  if (
    !geometry ||
    !Array.isArray(
      geometry.coordinates
    )
  ) {
    return null;
  }

  // Standard LineString
  if (
    geometry.type === "LineString"
  ) {
    const coordinates =
      geometry.coordinates;

    if (coordinates.length < 2) {
      return null;
    }

    return {
      start: coordinates[0],

      end:
        coordinates[
          coordinates.length - 1
        ]
    };
  }

  // MultiLineString
  if (
    geometry.type ===
    "MultiLineString"
  ) {
    const lines =
      geometry.coordinates.filter(
        line =>
          Array.isArray(line) &&
          line.length > 0
      );

    if (!lines.length) {
      return null;
    }

    const firstLine =
      lines[0];

    const lastLine =
      lines[lines.length - 1];

    return {
      start: firstLine[0],

      end:
        lastLine[
          lastLine.length - 1
        ]
    };
  }

  return null;
}


// =====================================================
// RENDER NON-FLIGHT ENDPOINTS
// =====================================================

function renderNonFlightEndpoints(routes) {
  const features = [];

  (routes || []).forEach(route => {
    const journeyType =
      String(
        route?.journey_type || ""
      ).toLowerCase();

    if (journeyType === "flight") {
      return;
    }

    const endpoints =
      getRouteEndpointCoordinates(
        route
      );

    if (!endpoints) {
      return;
    }

    const properties = {
      type:
        route.journey_type ||
        "Journey",

      from:
        route.origin || "",

      to:
        route.destination || "",

      date:
        route.journey_date || ""
    };

    features.push(
      {
        type: "Feature",

        geometry: {
          type: "Point",
          coordinates:
            endpoints.start
        },

        properties
      },
      {
        type: "Feature",

        geometry: {
          type: "Point",
          coordinates:
            endpoints.end
        },

        properties
      }
    );
  });

  const featureCollection = {
    type: "FeatureCollection",
    features
  };

  const existingSource =
    map.getSource(
      ENDPOINT_SOURCE_ID
    );

  if (existingSource) {
    existingSource.setData(
      featureCollection
    );
  } else {
    map.addSource(
      ENDPOINT_SOURCE_ID,
      {
        type: "geojson",
        data: featureCollection
      }
    );
  }

  if (
    !map.getLayer(
      ENDPOINT_CIRCLE_LAYER_ID
    )
  ) {
    map.addLayer({
      id:
        ENDPOINT_CIRCLE_LAYER_ID,

      type: "circle",
      source:
        ENDPOINT_SOURCE_ID,

      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-stroke-color":
          "#000000"
      }
    });
  }

  if (
    !map.getLayer(
      ENDPOINT_HIT_LAYER_ID
    )
  ) {
    map.addLayer({
      id:
        ENDPOINT_HIT_LAYER_ID,

      type: "circle",
      source:
        ENDPOINT_SOURCE_ID,

      paint: {
        "circle-radius": 18,
        "circle-color":
          "rgba(0, 0, 0, 0)"
      }
    });
  }

  if (
    map.getLayer(
      ENDPOINT_HIT_LAYER_ID
    )
  ) {
    map.moveLayer(
      ENDPOINT_HIT_LAYER_ID
    );
  }

  if (
    map.getLayer(
      ENDPOINT_CIRCLE_LAYER_ID
    )
  ) {
    map.moveLayer(
      ENDPOINT_CIRCLE_LAYER_ID
    );
  }

  const visibility =
    features.length > 0
      ? "visible"
      : "none";

  setLayerVisibility(
    ENDPOINT_CIRCLE_LAYER_ID,
    visibility
  );

  setLayerVisibility(
    ENDPOINT_HIT_LAYER_ID,
    visibility
  );

  bindNonFlightHover();
}


// =====================================================
// POPUPS
// =====================================================

const airportPopup =
  new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 10
  });

const nonFlightPopup =
  new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 10,
    className:
      "journey-tooltip"
  });


// =====================================================
// AIRPORT HOVER
// =====================================================

function bindAirportHover() {
  if (
    airportHandlerState
      .airportHoverBound
  ) {
    return;
  }

  airportHandlerState
    .airportHoverBound = true;

  map.on(
    "mouseenter",
    AIRPORT_HIT_LAYER_ID,
    event => {
      map.getCanvas().style.cursor =
        "pointer";

      const feature =
        event.features?.[0];

      if (!feature) {
        return;
      }

      const properties =
        feature.properties || {};

      const city =
        escapePopupHtml(
          properties.city
        );

      const country =
        escapePopupHtml(
          properties.country
        );

      const locationText =
        city && country
          ? `${city}, ${country}`
          : city || country;

      airportPopup
        .setLngLat(
          feature.geometry.coordinates
        )
        .setHTML(`
          <strong>
            ${escapePopupHtml(
              properties.airport_code
            )}
          </strong>
          ${
            locationText
              ? `<br>${locationText}`
              : ""
          }
        `)
        .addTo(map);
    }
  );

  map.on(
    "mouseleave",
    AIRPORT_HIT_LAYER_ID,
    () => {
      map.getCanvas().style.cursor = "";
      airportPopup.remove();
    }
  );
}


// =====================================================
// NON-FLIGHT HOVER
// =====================================================

function bindNonFlightHover() {
  if (
    airportHandlerState
      .nonFlightHoverBound
  ) {
    return;
  }

  airportHandlerState
    .nonFlightHoverBound = true;

  map.on(
    "mouseenter",
    ENDPOINT_HIT_LAYER_ID,
    event => {
      map.getCanvas().style.cursor =
        "pointer";

      const feature =
        event.features?.[0];

      if (!feature) {
        return;
      }

      const properties =
        feature.properties || {};

      nonFlightPopup
        .setLngLat(
          feature.geometry.coordinates
        )
        .setHTML(`
          <div class="journey-tooltip-content">
            <strong>
              ${escapePopupHtml(
                properties.type ||
                "Journey"
              )}
            </strong>

            <br>

            ${escapePopupHtml(
              properties.from
            )}
            →
            ${escapePopupHtml(
              properties.to
            )}

            ${
              properties.date
                ? `
                  <br>
                  ${escapePopupHtml(
                    properties.date
                  )}
                `
                : ""
            }
          </div>
        `)
        .addTo(map);
    }
  );

  map.on(
    "mouseleave",
    ENDPOINT_HIT_LAYER_ID,
    () => {
      map.getCanvas().style.cursor = "";
      nonFlightPopup.remove();
    }
  );
}


// =====================================================
// MAP CLICK CONTROLLER
// Select an airport or clear the current airport filter
// =====================================================

function bindAirportMapClick() {
  if (
    airportHandlerState
      .mapClickBound
  ) {
    return;
  }

  airportHandlerState
    .mapClickBound = true;

  map.on("click", event => {
    if (
      getCurrentMapMode() !==
      "routes"
    ) {
      return;
    }

    // -------------------------------------------------
    // DETECT AIRPORT MARKER
    // -------------------------------------------------

    let airportFeatures = [];

    if (
      map.getLayer(
        AIRPORT_HIT_LAYER_ID
      )
    ) {
      airportFeatures =
        map.queryRenderedFeatures(
          event.point,
          {
            layers: [
              AIRPORT_HIT_LAYER_ID
            ]
          }
        );
    }

    const airportFeature =
      airportFeatures[0] || null;

    // -------------------------------------------------
    // AIRPORT MARKER CLICKED
    // -------------------------------------------------

    if (airportFeature) {
      const airportCode =
        airportFeature.properties
          ?.airport_code;

      if (!airportCode) {
        return;
      }

      const selectionResult =
        filterRoutesByAirport(
          airportCode
        );

      if (
        selectionResult ===
          "selected" &&
        typeof window.onAirportSelected ===
          "function"
      ) {
        window.onAirportSelected({
          code: airportCode,

          city:
            airportFeature.properties
              ?.city || ""
        });
      }

      return;
    }

    // -------------------------------------------------
    // EMPTY MAP AREA CLICKED
    // -------------------------------------------------

    if (
      getActiveAirportFilter()
    ) {
      clearAirportSelection();
    }
  });
}


// =====================================================
// CLEAR AIRPORT SELECTION
// =====================================================

function clearAirportSelection() {
  setActiveAirportFilter(null);
  clearIsolatedRoute();

  /*
   * Restore the exact route collection that was visible
   * before the airport marker was selected.
   */
  const restoredRoutes =
    Array.isArray(
      routesBeforeAirportFilter
    )
      ? routesBeforeAirportFilter.slice()

      : Array.isArray(window.allRoutes)
        ? window.allRoutes.slice()

        : [];

  if (
    typeof renderRoutes ===
    "function"
  ) {
    /*
     * Restore:
     * - route source
     * - counters
     * - sidebar entries
     * - airport markers
     *
     * Map fitting is performed explicitly afterwards.
     */
    renderRoutes(restoredRoutes, {
      updateBaseRoutes: false,
      fitMap: false
    });
  }

  const refocusMap = () => {
    if (
      typeof fitToBoundsFromLineGeoms !==
      "function"
    ) {
      return;
    }

    const geometries =
      restoredRoutes
        .map(route => route?.geom)
        .filter(Boolean);

    if (!geometries.length) {
      return;
    }

    fitToBoundsFromLineGeoms(
      geometries
    );
  };

  /*
   * Wait for two animation frames so Mapbox has time to
   * process the restored GeoJSON source before fitting.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      refocusMap();
    });
  });

  if (
    typeof window.onAirportCleared ===
    "function"
  ) {
    window.onAirportCleared();
  }

  routesBeforeAirportFilter = null;
}

window.clearAirportSelection =
  clearAirportSelection;


// =====================================================
// FILTER ROUTES BY AIRPORT
// =====================================================

function filterRoutesByAirport(
  airportCode
) {
  if (!airportCode) {
    return "unchanged";
  }

  const currentAirport =
    getActiveAirportFilter();

  /*
   * Clicking the currently selected airport again clears
   * the filter and restores the previous route collection.
   */
  if (
    currentAirport === airportCode
  ) {
    clearAirportSelection();
    return "cleared";
  }

  /*
   * Save the route collection currently shown before
   * applying the first airport filter.
   *
   * Do not overwrite it when switching directly between
   * selected airports.
   */
  if (
    !currentAirport ||
    !Array.isArray(
      routesBeforeAirportFilter
    )
  ) {
    routesBeforeAirportFilter =
      Array.isArray(
        window.currentRoutes
      )
        ? window.currentRoutes.slice()
        : [];
  }

  const baseRoutes =
    Array.isArray(
      routesBeforeAirportFilter
    )
      ? routesBeforeAirportFilter
      : [];

  if (!baseRoutes.length) {
    return "unchanged";
  }

  setActiveAirportFilter(
    airportCode
  );

  clearIsolatedRoute();

  const filteredRoutes =
    baseRoutes.filter(route =>
      route?.journey_type ===
        "Flight" &&
      (
        route.origin ===
          airportCode ||

        route.destination ===
          airportCode
      )
    );

  if (
    typeof renderRoutes ===
    "function"
  ) {
    renderRoutes(
      filteredRoutes,
      {
        updateBaseRoutes: false,
        fitMap: true
      }
    );
  }

  return "selected";
}

window.filterRoutesByAirport =
  filterRoutesByAirport;


// =====================================================
// HIDE AIRPORT AND ENDPOINT LAYERS
// =====================================================

function hideAirportLayers() {
  clearGeoJsonSource(
    AIRPORT_SOURCE_ID
  );

  clearGeoJsonSource(
    ENDPOINT_SOURCE_ID
  );

  [
    AIRPORT_CIRCLE_LAYER_ID,
    AIRPORT_HIT_LAYER_ID,
    ENDPOINT_CIRCLE_LAYER_ID,
    ENDPOINT_HIT_LAYER_ID
  ].forEach(layerId => {
    setLayerVisibility(
      layerId,
      "none"
    );
  });

  airportPopup.remove();
  nonFlightPopup.remove();

  if (
    typeof map !== "undefined" &&
    map
  ) {
    map.getCanvas().style.cursor =
      "";
  }
}

window.hideAirportLayers =
  hideAirportLayers;

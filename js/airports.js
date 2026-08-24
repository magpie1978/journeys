/* global map, mapboxgl, sb, mapMode, isolatedUid */
/* global clearSource, renderRoutes, fitToBoundsFromLineGeoms */

// =====================================================
// AIRPORTS
// =====================================================
//
// Handles airport markers, non-flight endpoint markers,
// airport interaction and airport-based route filtering.
//
// Main responsibilities:
//   • Load and cache airport metadata from journey_locations.
//   • Draw airport markers for flight routes.
//   • Draw start/end markers for non-flight journeys.
//   • Provide hover tooltips for both marker types.
//   • Filter visible flight routes when an airport is selected.
//   • Restore the previous route collection when cleared.
//
// Public API:
//   window.loadAirports(routes)
//   window.updateAirportFilterBaseRoutes(routes)
//   window.filterRoutesByAirport(airportCode)
//   window.clearAirportSelection()
//   window.hideAirportLayers()
//
// =====================================================


// =====================================================
// STATE
// =====================================================

// Retained for compatibility with code that still reads
// the airport filter directly from window.
window.activeAirportFilter =
  window.activeAirportFilter || null;

// loadAirports() can run repeatedly. These flags prevent
// duplicate Mapbox event handlers from being registered.
const airportHandlerState = {
  airportHoverBound: false,
  mapClickBound: false,
  nonFlightHoverBound: false
};

// Complete route collection visible immediately before
// the first airport filter in the current interaction.
let routesBeforeAirportFilter = null;

// Airport metadata rarely changes during a page session,
// so cache records after their first database lookup.
const airportLocationCache = new Map();


// =====================================================
// MAP SOURCE AND LAYER IDS
// =====================================================

const AIRPORT_SOURCE_ID = "airports";
const AIRPORT_CIRCLE_LAYER_ID = "airports-circle";

const ENDPOINT_SOURCE_ID = "journey-endpoints";
const ENDPOINT_CIRCLE_LAYER_ID =
  "journey-endpoints-circle";


// =====================================================
// BASIC HELPERS
// =====================================================

/**
 * Returns an empty GeoJSON FeatureCollection.
 *
 * @returns {Object}
 */
function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: []
  };
}


/**
 * Returns a route's journey type in normalized lowercase form.
 *
 * @param {Object} route
 * @returns {string}
 */
function getJourneyType(route) {
  return String(
    route?.journey_type || ""
  ).toLowerCase();
}


/**
 * Returns the application's current map mode.
 *
 * appState is preferred. The standalone mapMode variable
 * remains as a compatibility fallback while older modules
 * are still being audited.
 *
 * @returns {string}
 */
function getCurrentMapMode() {
  if (window.appState?.mode) {
    return window.appState.mode;
  }

  if (typeof mapMode !== "undefined") {
    return mapMode;
  }

  return "routes";
}


/**
 * Returns the currently selected airport code, if any.
 *
 * @returns {string|null}
 */
function getActiveAirportFilter() {
  return (
    window.appState?.activeAirport ||
    window.activeAirportFilter ||
    null
  );
}


/**
 * Updates the active airport in both current and legacy
 * application state.
 *
 * @param {string|null} airportCode
 */
function setActiveAirportFilter(airportCode) {
  const nextAirport = airportCode || null;

  window.activeAirportFilter = nextAirport;

  if (window.appState) {
    window.appState.activeAirport = nextAirport;
  }
}


/**
 * Clears any individually isolated route.
 */
function clearIsolatedRoute() {
  if (window.appState) {
    window.appState.isolatedUid = null;
  }

  // Compatibility with older modules that still use the
  // standalone isolatedUid variable.
  if (typeof isolatedUid !== "undefined") {
    isolatedUid = null;
  }
}


/**
 * Escapes text before inserting it into popup HTML.
 *
 * @param {*} value
 * @returns {string}
 */
function escapePopupHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// AIRPORT FILTER BASE ROUTES
// =====================================================

/**
 * Stores the route collection to restore when an airport
 * filter is subsequently cleared.
 *
 * @param {Array} routes
 */
function updateAirportFilterBaseRoutes(routes) {
  routesBeforeAirportFilter =
    Array.isArray(routes)
      ? routes.slice()
      : [];
}

window.updateAirportFilterBaseRoutes =
  updateAirportFilterBaseRoutes;


// =====================================================
// MAP SOURCE AND LAYER HELPERS
// =====================================================

/**
 * Clears a GeoJSON source if it exists.
 *
 * Uses the application's shared clearSource() helper when
 * available, otherwise clears the source directly.
 *
 * @param {string} sourceId
 */
function clearGeoJsonSource(sourceId) {
  if (typeof map === "undefined" || !map) {
    return;
  }

  if (typeof clearSource === "function") {
    clearSource(sourceId);
    return;
  }

  const source = map.getSource(sourceId);

  if (source && typeof source.setData === "function") {
    source.setData(emptyFeatureCollection());
  }
}


/**
 * Sets the visibility of an existing Mapbox layer.
 *
 * @param {string} layerId
 * @param {"visible"|"none"} visibility
 */
function setLayerVisibility(layerId, visibility) {
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
// AIRPORT LOCATION LOADING
// =====================================================

/**
 * Returns metadata for the requested airport codes.
 *
 * Previously loaded airport records are served from the
 * in-memory cache; only missing codes are queried from
 * journey_locations.
 *
 * @param {Array<string>} airportCodes
 * @returns {Promise<Array>}
 */
async function getAirportLocations(airportCodes) {
  const codes = [
    ...new Set(
      (airportCodes || []).filter(Boolean)
    )
  ];

  if (!codes.length) {
    return [];
  }

  const missingCodes = codes.filter(
    code => !airportLocationCache.has(code)
  );

  if (missingCodes.length) {
    const { data, error } = await sb
      .from("journey_locations")
      .select(`
        airport_code,
        airport,
        city,
        country,
        longitude,
        latitude
      `)
      .in("airport_code", missingCodes);

    if (error) {
      console.error(
        "[airports] Airport lookup failed:",
        error
      );
    } else {
      (data || []).forEach(airport => {
        if (!airport?.airport_code) {
          return;
        }

        airportLocationCache.set(
          airport.airport_code,
          airport
        );
      });
    }
  }

  return codes
    .map(code => airportLocationCache.get(code))
    .filter(Boolean);
}


// =====================================================
// LOAD AIRPORTS AND ENDPOINTS
// =====================================================

/**
 * Updates airport and non-flight endpoint markers for the
 * supplied route collection.
 *
 * Markers are shown only while the map is in Routes mode.
 *
 * @param {Array} routes
 */
async function loadAirports(routes) {
  if (typeof map === "undefined" || !map) {
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

  // Collect every origin/destination airport used by
  // currently visible flight routes.
  const flightCodes = new Set();

  safeRoutes.forEach(route => {
    if (getJourneyType(route) !== "flight") {
      return;
    }

    if (route.origin) {
      flightCodes.add(route.origin);
    }

    if (route.destination) {
      flightCodes.add(route.destination);
    }
  });

  if (flightCodes.size) {
    const airportLocations =
      await getAirportLocations([...flightCodes]);

    renderAirportMarkers(airportLocations);
  } else {
    clearGeoJsonSource(AIRPORT_SOURCE_ID);

    setLayerVisibility(
      AIRPORT_CIRCLE_LAYER_ID,
      "none"
    );
  }

  renderNonFlightEndpoints(safeRoutes);

  // Ensure the single map-wide airport click controller
  // has been registered.
  bindAirportMapClick();
}

window.loadAirports = loadAirports;


// =====================================================
// FLIGHT AIRPORT MARKERS
// =====================================================

/**
 * Creates or updates the GeoJSON source and Mapbox layer
 * containing flight airport markers.
 *
 * @param {Array} airports
 */
function renderAirportMarkers(airports) {
  const featureCollection = {
    type: "FeatureCollection",

    features: (airports || [])
      .filter(airport =>
        Number.isFinite(Number(airport?.longitude)) &&
        Number.isFinite(Number(airport?.latitude))
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
          airport_code: airport.airport_code || "",
          airport: airport.airport || "",
          city: airport.city || "",
          country: airport.country || ""
        }
      }))
  };

  const existingSource =
    map.getSource(AIRPORT_SOURCE_ID);

  if (existingSource) {
    existingSource.setData(featureCollection);
  } else {
    map.addSource(AIRPORT_SOURCE_ID, {
      type: "geojson",
      data: featureCollection
    });
  }

  // Create the marker layer only once. Later calls simply
  // replace the GeoJSON source data.
  if (!map.getLayer(AIRPORT_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: AIRPORT_CIRCLE_LAYER_ID,
      type: "circle",
      source: AIRPORT_SOURCE_ID,

      paint: {
        "circle-radius": 6,
        "circle-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#000000"
      }
    });

    map.moveLayer(AIRPORT_CIRCLE_LAYER_ID);
  }

  setLayerVisibility(
    AIRPORT_CIRCLE_LAYER_ID,
    featureCollection.features.length
      ? "visible"
      : "none"
  );

  bindAirportHover();
}


// =====================================================
// ROUTE ENDPOINT EXTRACTION
// =====================================================

/**
 * Returns the first and last coordinates of a route.
 *
 * Supports both LineString and MultiLineString geometry.
 *
 * @param {Object} route
 * @returns {{start: Array, end: Array}|null}
 */
function getRouteEndpointCoordinates(route) {
  const geometry = route?.geom;

  if (
    !geometry ||
    !Array.isArray(geometry.coordinates)
  ) {
    return null;
  }

  if (geometry.type === "LineString") {
    const coordinates = geometry.coordinates;

    if (coordinates.length < 2) {
      return null;
    }

    return {
      start: coordinates[0],
      end: coordinates[coordinates.length - 1]
    };
  }

  if (geometry.type === "MultiLineString") {
    const lines = geometry.coordinates.filter(
      line =>
        Array.isArray(line) &&
        line.length > 0
    );

    if (!lines.length) {
      return null;
    }

    const firstLine = lines[0];
    const lastLine = lines[lines.length - 1];

    return {
      start: firstLine[0],
      end: lastLine[lastLine.length - 1]
    };
  }

  return null;
}


// =====================================================
// NON-FLIGHT ENDPOINT MARKERS
// =====================================================

/**
 * Creates or updates start/end markers for non-flight
 * journeys using the route geometry endpoints.
 *
 * @param {Array} routes
 */
function renderNonFlightEndpoints(routes) {
  const features = [];

  (routes || []).forEach(route => {
    if (getJourneyType(route) === "flight") {
      return;
    }

    const endpoints =
      getRouteEndpointCoordinates(route);

    if (!endpoints) {
      return;
    }

    const commonProperties = {
      type: route.journey_type || "Journey",
      from: route.origin || "",
      to: route.destination || "",
      date: route.journey_date || ""
    };

    features.push(
      {
        type: "Feature",

        geometry: {
          type: "Point",
          coordinates: endpoints.start
        },

        properties: {
          ...commonProperties,
          endpoint: "origin",

          label:
            route.display_origin ||
            route.origin ||
            ""
        }
      },

      {
        type: "Feature",

        geometry: {
          type: "Point",
          coordinates: endpoints.end
        },

        properties: {
          ...commonProperties,
          endpoint: "destination",

          label:
            route.display_destination ||
            route.destination ||
            ""
        }
      }
    );
  });

  // Avoid creating an unused source/layer when the
  // current route collection contains flights only.
  if (!features.length) {
    clearGeoJsonSource(ENDPOINT_SOURCE_ID);

    setLayerVisibility(
      ENDPOINT_CIRCLE_LAYER_ID,
      "none"
    );

    return;
  }

  const featureCollection = {
    type: "FeatureCollection",
    features
  };

  const existingSource =
    map.getSource(ENDPOINT_SOURCE_ID);

  if (existingSource) {
    existingSource.setData(featureCollection);
  } else {
    map.addSource(ENDPOINT_SOURCE_ID, {
      type: "geojson",
      data: featureCollection
    });
  }

  if (!map.getLayer(ENDPOINT_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: ENDPOINT_CIRCLE_LAYER_ID,
      type: "circle",
      source: ENDPOINT_SOURCE_ID,

      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#000000"
      }
    });

    map.moveLayer(ENDPOINT_CIRCLE_LAYER_ID);
  }

  setLayerVisibility(
    ENDPOINT_CIRCLE_LAYER_ID,
    "visible"
  );

  bindNonFlightHover();
}


// =====================================================
// POPUPS
// =====================================================

const airportPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 10
});

const nonFlightPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 10,
  className: "journey-tooltip"
});


// =====================================================
// AIRPORT HOVER
// =====================================================

/**
 * Registers airport marker hover handlers once.
 */
function bindAirportHover() {
  if (airportHandlerState.airportHoverBound) {
    return;
  }

  airportHandlerState.airportHoverBound = true;

  map.on(
    "mouseenter",
    AIRPORT_CIRCLE_LAYER_ID,
    event => {
      map.getCanvas().style.cursor = "pointer";

      const feature = event.features?.[0];

      if (!feature) {
        return;
      }

      const properties = feature.properties || {};

      const airportName =
        escapePopupHtml(properties.airport);

      airportPopup
        .setLngLat(feature.geometry.coordinates)
        .setHTML(`
          <div class="journey-tooltip-content">
            ${airportName}
          </div>
        `)
        .addTo(map);
    }
  );

  map.on(
    "mouseleave",
    AIRPORT_CIRCLE_LAYER_ID,
    () => {
      map.getCanvas().style.cursor = "";
      airportPopup.remove();
    }
  );
}


// =====================================================
// NON-FLIGHT ENDPOINT HOVER
// =====================================================

/**
 * Registers non-flight endpoint hover handlers once.
 */
function bindNonFlightHover() {
  if (airportHandlerState.nonFlightHoverBound) {
    return;
  }

  airportHandlerState.nonFlightHoverBound = true;

  map.on(
    "mouseenter",
    ENDPOINT_CIRCLE_LAYER_ID,
    event => {
      map.getCanvas().style.cursor = "pointer";

      const feature = event.features?.[0];

      if (!feature) {
        return;
      }

      const properties = feature.properties || {};

      nonFlightPopup
        .setLngLat(feature.geometry.coordinates)
        .setHTML(`
          <div class="journey-tooltip-content">
            ${escapePopupHtml(properties.label || "")}
          </div>
        `)
        .addTo(map);
    }
  );

  map.on(
    "mouseleave",
    ENDPOINT_CIRCLE_LAYER_ID,
    () => {
      map.getCanvas().style.cursor = "";
      nonFlightPopup.remove();
    }
  );
}


// =====================================================
// MAP CLICK CONTROLLER
// =====================================================

/**
 * Registers the map-wide click handler once.
 *
 * Clicking an airport selects/filters it. Clicking elsewhere
 * on the map clears an existing airport selection.
 */
function bindAirportMapClick() {
  if (airportHandlerState.mapClickBound) {
    return;
  }

  airportHandlerState.mapClickBound = true;

  map.on("click", event => {
    if (getCurrentMapMode() !== "routes") {
      return;
    }

    let airportFeatures = [];

    if (map.getLayer(AIRPORT_CIRCLE_LAYER_ID)) {
      airportFeatures =
        map.queryRenderedFeatures(
          event.point,
          {
            layers: [AIRPORT_CIRCLE_LAYER_ID]
          }
        );
    }

    const airportFeature =
      airportFeatures[0] || null;

    if (airportFeature) {
      const airportCode =
        airportFeature.properties?.airport_code;

      if (!airportCode) {
        console.warn(
          "[airports] Clicked airport feature has no airport_code",
          airportFeature
        );
        return;
      }

      const selectionResult =
        filterRoutesByAirport(airportCode);

      if (
        selectionResult === "selected" &&
        typeof window.onAirportSelected === "function"
      ) {
        window.onAirportSelected({
          code: airportCode,

          airport:
            airportFeature.properties?.airport || "",

          city:
            airportFeature.properties?.city || ""
        });
      }

      return;
    }

    if (getActiveAirportFilter()) {
      clearAirportSelection();
    }
  });
}


// =====================================================
// CLEAR AIRPORT SELECTION
// =====================================================

/**
 * Clears the active airport filter and restores the exact
 * route collection visible before airport filtering began.
 */
function clearAirportSelection() {
  setActiveAirportFilter(null);
  clearIsolatedRoute();

  const restoredRoutes =
    Array.isArray(routesBeforeAirportFilter)
      ? routesBeforeAirportFilter.slice()
      : Array.isArray(window.allRoutes)
        ? window.allRoutes.slice()
        : [];

  if (typeof renderRoutes === "function") {
    renderRoutes(restoredRoutes, {
      updateBaseRoutes: false,
      fitMap: false
    });
  }

  const refocusMap = () => {
    if (
      typeof fitToBoundsFromLineGeoms !== "function"
    ) {
      return;
    }

    const geometries = restoredRoutes
      .map(route => route?.geom)
      .filter(Boolean);

    if (!geometries.length) {
      return;
    }

    fitToBoundsFromLineGeoms(geometries);
  };

  // Allow Mapbox and the surrounding layout two frames
  // to process restored sources and UI dimensions before
  // recalculating the map bounds.
  requestAnimationFrame(() => {
    requestAnimationFrame(refocusMap);
  });

  if (
    typeof window.onAirportCleared === "function"
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

/**
 * Filters the currently visible route collection to flights
 * arriving at or departing from the supplied airport.
 *
 * Clicking the currently selected airport clears the filter.
 *
 * @param {string} airportCode
 * @returns {"selected"|"cleared"|"unchanged"}
 */
function filterRoutesByAirport(airportCode) {
  if (!airportCode) {
    return "unchanged";
  }

  const currentAirport =
    getActiveAirportFilter();

  if (currentAirport === airportCode) {
    clearAirportSelection();
    return "cleared";
  }

  // Capture the complete visible collection before the
  // first airport filter. Do not overwrite it when moving
  // directly from one selected airport to another.
  if (
    !currentAirport ||
    !Array.isArray(routesBeforeAirportFilter)
  ) {
    routesBeforeAirportFilter =
      Array.isArray(window.currentRoutes)
        ? window.currentRoutes.slice()
        : Array.isArray(window.allRoutes)
          ? window.allRoutes.slice()
          : [];
  }

  const baseRoutes =
    Array.isArray(routesBeforeAirportFilter)
      ? routesBeforeAirportFilter
      : [];

  if (!baseRoutes.length) {
    console.warn(
      "[airports] Cannot filter because no base routes are available"
    );
    return "unchanged";
  }

  setActiveAirportFilter(airportCode);
  clearIsolatedRoute();

  const filteredRoutes = baseRoutes.filter(
    route =>
      getJourneyType(route) === "flight" &&
      (
        route.origin === airportCode ||
        route.destination === airportCode
      )
  );

  if (!filteredRoutes.length) {
    console.warn(
      `[airports] No routes found for ${airportCode}`
    );
  }

  if (typeof renderRoutes !== "function") {
    console.error(
      "[airports] renderRoutes() is unavailable"
    );
    return "unchanged";
  }

  renderRoutes(filteredRoutes, {
    updateBaseRoutes: false,
    fitMap: true
  });

  return "selected";
}

window.filterRoutesByAirport =
  filterRoutesByAirport;


// =====================================================
// HIDE AIRPORT AND ENDPOINT LAYERS
// =====================================================

/**
 * Clears and hides airport/non-flight endpoint layers and
 * removes their active popups.
 */
function hideAirportLayers() {
  clearGeoJsonSource(AIRPORT_SOURCE_ID);
  clearGeoJsonSource(ENDPOINT_SOURCE_ID);

  [
    AIRPORT_CIRCLE_LAYER_ID,
    ENDPOINT_CIRCLE_LAYER_ID
  ].forEach(layerId => {
    setLayerVisibility(layerId, "none");
  });

  airportPopup.remove();
  nonFlightPopup.remove();

  if (typeof map !== "undefined" && map) {
    map.getCanvas().style.cursor = "";
  }
}

window.hideAirportLayers =
  hideAirportLayers;

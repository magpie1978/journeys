// =====================================================
// AIRPORTS.JS — FINAL UNIFIED BUILD

// This file has four main responsibilities:
//     Load airport metadata for the currently displayed flight routes.
//     Draw airport and non-flight endpoint markers.
//     Add hover and click interactions.
//     Filter the displayed routes when an airport is selected.
// =====================================================



// =====================================================
// STATE
// =====================================================

window.activeAirportFilter =
  window.activeAirportFilter || null;

/*
 * loadAirports() may run many times.
 *
 * These flags ensure each Mapbox event handler is
 * registered only once.
 */
const airportHandlerState = {
  airportHoverBound: false,
  airportClickBound: false,
  airportClearBound: false,
  nonFlightHoverBound: false
};


// =====================================================
// MAP IDS
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
// EMPTY FEATURE COLLECTION
// =====================================================

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: []
  };
}


// =====================================================
// CURRENT MAP MODE
// =====================================================

function getCurrentMapMode() {
  if (window.appState?.mode) {
    return window.appState.mode;
  }

  if (typeof mapMode !== "undefined") {
    return mapMode;
  }

  return "routes";
}


// =====================================================
// AIRPORT FILTER STATE
// =====================================================

function getActiveAirportFilter() {
  return (
    window.appState?.activeAirport ||
    window.activeAirportFilter ||
    null
  );
}


function setActiveAirportFilter(airportCode) {
  window.activeAirportFilter =
    airportCode || null;

  if (window.appState) {
    window.appState.activeAirport =
      airportCode || null;
  }
}


// =====================================================
// CLEAR ISOLATED ROUTE
// =====================================================

function clearIsolatedRoute() {
  if (window.appState) {
    window.appState.isolatedUid = null;
  }

  /*
   * Compatibility with files that still use the
   * older standalone isolatedUid variable.
   */
  if (typeof isolatedUid !== "undefined") {
    isolatedUid = null;
  }
}


// =====================================================
// ESCAPE POPUP HTML
// =====================================================

function escapePopupHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// SOURCE HELPERS
// =====================================================

function clearGeoJsonSource(sourceId) {
  if (
    typeof map === "undefined" ||
    !map
  ) {
    return;
  }

  /*
   * Use the existing shared helper when it is
   * available.
   */
  if (typeof clearSource === "function") {
    clearSource(sourceId);
    return;
  }

  const source = map.getSource(sourceId);

  if (
    source &&
    typeof source.setData === "function"
  ) {
    source.setData(emptyFeatureCollection());
  }
}


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
  // FLIGHT AIRPORT CODES
  // -------------------------------------------------

  const flightCodes = new Set();

  safeRoutes.forEach(route => {
    if (
      String(route.journey_type)
        .toLowerCase() !== "flight"
    ) {
      return;
    }

    if (route.origin) {
      flightCodes.add(route.origin);
    }

    if (route.destination) {
      flightCodes.add(route.destination);
    }
  });

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
    } else {
      renderAirportMarkers(data || []);
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

  renderNonFlightEndpoints(safeRoutes);

  // -------------------------------------------------
  // CLICK-AWAY HANDLER
  // -------------------------------------------------

  bindAirportClearOnMapClick();
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
    map.getSource(AIRPORT_SOURCE_ID);

  if (existingSource) {
    existingSource.setData(featureCollection);
  } else {
    map.addSource(AIRPORT_SOURCE_ID, {
      type: "geojson",
      data: featureCollection
    });
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
        "circle-stroke-color": "#000000"
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
   * Keep the visible marker above the larger
   * invisible interaction layer.
   */
  if (
    map.getLayer(AIRPORT_HIT_LAYER_ID)
  ) {
    map.moveLayer(AIRPORT_HIT_LAYER_ID);
  }

  if (
    map.getLayer(AIRPORT_CIRCLE_LAYER_ID)
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
  bindAirportClick();
}


// =====================================================
// NON-FLIGHT GEOMETRY ENDPOINTS
// =====================================================

function getRouteEndpointCoordinates(route) {
  const geometry = route?.geom;

  if (
    !geometry ||
    !Array.isArray(geometry.coordinates)
  ) {
    return null;
  }

  // Standard LineString
  if (geometry.type === "LineString") {
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

    const firstLine = lines[0];
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
    if (
      String(route?.journey_type)
        .toLowerCase() === "flight"
    ) {
      return;
    }

    const endpoints =
      getRouteEndpointCoordinates(route);

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
          coordinates: endpoints.start
        },

        properties
      },
      {
        type: "Feature",

        geometry: {
          type: "Point",
          coordinates: endpoints.end
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
    map.getSource(ENDPOINT_SOURCE_ID);

  if (existingSource) {
    existingSource.setData(featureCollection);
  } else {
    map.addSource(ENDPOINT_SOURCE_ID, {
      type: "geojson",
      data: featureCollection
    });
  }

  if (
    !map.getLayer(
      ENDPOINT_CIRCLE_LAYER_ID
    )
  ) {
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
  }

  if (
    !map.getLayer(
      ENDPOINT_HIT_LAYER_ID
    )
  ) {
    map.addLayer({
      id: ENDPOINT_HIT_LAYER_ID,
      type: "circle",
      source: ENDPOINT_SOURCE_ID,

      paint: {
        "circle-radius": 18,
        "circle-color":
          "rgba(0, 0, 0, 0)"
      }
    });
  }

  if (
    map.getLayer(ENDPOINT_HIT_LAYER_ID)
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
    features.length
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
// AIRPORT POPUP
// =====================================================

const airportPopup =
  new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 10
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
// NON-FLIGHT POPUP
// =====================================================

const nonFlightPopup =
  new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 10,
    className: "journey-tooltip"
  });


// =====================================================
// NON-FLIGHT ENDPOINT HOVER
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
// AIRPORT CLICK
// =====================================================

function bindAirportClick() {
  if (
    airportHandlerState
      .airportClickBound
  ) {
    return;
  }

  airportHandlerState
    .airportClickBound = true;

  map.on(
    "click",
    AIRPORT_HIT_LAYER_ID,
    event => {
      event.originalEvent
        ?.stopPropagation();

      const feature =
        event.features?.[0];

      if (!feature) {
        return;
      }

      const airportCode =
        feature.properties
          ?.airport_code;

      if (!airportCode) {
        return;
      }

      const selectionResult =
        filterRoutesByAirport(
          airportCode
        );

      /*
       * Only show the airport bar when the
       * click selected the airport rather than
       * clearing an existing selection.
       */
      if (
        selectionResult === "selected" &&
        typeof window.onAirportSelected ===
          "function"
      ) {
        window.onAirportSelected({
          code: airportCode,
          city:
            feature.properties?.city ||
            ""
        });
      }
    }
  );
}


// =====================================================
// FILTER ROUTES BY AIRPORT
// =====================================================

function filterRoutesByAirport(airportCode) {
  if (!airportCode) {
    return "unchanged";
  }

  const baseRoutes =
    Array.isArray(window.allRoutes)
      ? window.allRoutes
      : [];

  if (!baseRoutes.length) {
    return "unchanged";
  }

  const currentAirport =
    getActiveAirportFilter();

  // Clicking the selected airport again clears it.
  if (currentAirport === airportCode) {
    setActiveAirportFilter(null);
    clearIsolatedRoute();

    renderRoutes(baseRoutes, {
      updateBaseRoutes: false,
      fitMap: true
    });

    if (
      typeof window.onAirportCleared ===
      "function"
    ) {
      window.onAirportCleared();
    }

    return "cleared";
  }

  setActiveAirportFilter(airportCode);
  clearIsolatedRoute();

  const filteredRoutes =
    baseRoutes.filter(route =>
      route?.journey_type === "Flight" &&
      (
        route.origin === airportCode ||
        route.destination === airportCode
      )
    );

  renderRoutes(filteredRoutes, {
    updateBaseRoutes: false,
    fitMap: true
  });

  return "selected";
}

window.filterRoutesByAirport =
  filterRoutesByAirport;


// =====================================================
// CLEAR AIRPORT ON MAP CLICK
// =====================================================

function bindAirportClearOnMapClick() {
  if (
    airportHandlerState
      .airportClearBound
  ) {
    return;
  }

  airportHandlerState
    .airportClearBound = true;

  map.on("click", event => {
    if (!getActiveAirportFilter()) {
      return;
    }

    if (getCurrentMapMode() !== "routes") {
      return;
    }

    let airportHits = [];

    if (
      map.getLayer(
        AIRPORT_HIT_LAYER_ID
      )
    ) {
      airportHits =
        map.queryRenderedFeatures(
          event.point,
          {
            layers: [
              AIRPORT_HIT_LAYER_ID
            ]
          }
        );
    }

    if (airportHits.length) {
      return;
    }

    setActiveAirportFilter(null);
    clearIsolatedRoute();

    const baseRoutes =
      Array.isArray(window.allRoutes)
        ? window.allRoutes
        : [];

    renderRoutes(baseRoutes, {
      updateBaseRoutes: false,
      fitMap: true
    });

    if (
      typeof window.onAirportCleared ===
      "function"
    ) {
      window.onAirportCleared();
    }
  });
}


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
    map.getCanvas().style.cursor = "";
  }
}

window.hideAirportLayers =
  hideAirportLayers;

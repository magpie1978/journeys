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
  nonFlightHoverBound: false,
  journeyStopHoverBound: false
};

/*
 * Stores the complete route collection that was visible
 * immediately before an airport filter was applied.
 */
let routesBeforeAirportFilter = null;

/*
 * Airport metadata does not normally change during a page
 * session, so retain records that have already been loaded.
 */
const airportLocationCache = new Map();


// =====================================================
// MAP SOURCE AND LAYER IDS
// =====================================================

const AIRPORT_SOURCE_ID =
  "airports";

const AIRPORT_CIRCLE_LAYER_ID =
  "airports-circle";

const ENDPOINT_SOURCE_ID =
  "journey-endpoints";

const ENDPOINT_CIRCLE_LAYER_ID =
  "journey-endpoints-circle";

const STOP_SOURCE_ID =
  "journey-stops";

const STOP_CIRCLE_LAYER_ID =
  "journey-stops-circle";


// =====================================================
// BASIC HELPERS
// =====================================================

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: []
  };
}


function getJourneyType(route) {
  return String(
    route?.journey_type || ""
  ).toLowerCase();
}


function getCurrentMapMode() {
  if (window.appState?.mode) {
    return window.appState.mode;
  }

  /*
   * Compatibility with older files that still use
   * the standalone mapMode variable.
   */
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

  /*
   * Retain both state forms until the rest of the
   * application consistently uses appState.
   */
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
// UPDATE AIRPORT FILTER BASE ROUTES
// =====================================================

function updateAirportFilterBaseRoutes(routes) {
  routesBeforeAirportFilter =
    Array.isArray(routes)
      ? routes.slice()
      : [];
}

window.updateAirportFilterBaseRoutes =
  updateAirportFilterBaseRoutes;


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

  /*
   * Use the shared helper when available.
   */
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
// AIRPORT LOCATION LOADING
// =====================================================

async function getAirportLocations(
  airportCodes
) {
  const codes =
    [...new Set(
      (airportCodes || [])
        .filter(Boolean)
    )];

  if (!codes.length) {
    return [];
  }

  /*
   * Only request airport records that have not already
   * been loaded during this page session.
   */
  const missingCodes =
    codes.filter(
      code =>
        !airportLocationCache.has(code)
    );

  if (missingCodes.length) {
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
        missingCodes
      );

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

  /*
   * Return only records corresponding to the current
   * collection of visible flight routes.
   */
  return codes
    .map(code =>
      airportLocationCache.get(code)
    )
    .filter(Boolean);
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
    if (getJourneyType(route) !== "flight") {
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

  if (flightCodes.size) {
    const airportLocations =
      await getAirportLocations(
        [...flightCodes]
      );

    renderAirportMarkers(
      airportLocations
    );
  } else {
    clearGeoJsonSource(
      AIRPORT_SOURCE_ID
    );

    setLayerVisibility(
      AIRPORT_CIRCLE_LAYER_ID,
      "none"
    );
  }

  // -------------------------------------------------
  // NON-FLIGHT ENDPOINTS
  // -------------------------------------------------

  renderNonFlightEndpoints(
    safeRoutes
  );



  // =====================================================
  // JOURNEY STOPS
  // Intermediate stops stored in public.journey_stops
  // =====================================================
  
  async function loadJourneyStops(routes) {
  
    if (
      typeof map === "undefined" ||
      !map
    ) {
      return;
    }
  
    if (
      getCurrentMapMode() !== "routes"
    ) {
      clearJourneyStops();
      return;
    }
  
  
    // -------------------------------------------------
    // COLLECT CURRENTLY VISIBLE JOURNEY UIDS
    // -------------------------------------------------
  
    const routeUids =
      [
        ...new Set(
          (routes || [])
            .map(route =>
              route?.uid
            )
            .filter(Boolean)
        )
      ];
  
  
    if (!routeUids.length) {
  
      clearJourneyStops();
  
      return;
    }
  
  
    // -------------------------------------------------
    // LOAD STOPS FROM SUPABASE
    // -------------------------------------------------
  
    const {
      data,
      error
    } = await sb
      .from("journey_stops")
      .select(`
        uid,
        stop_order,
        stop_name,
        latitude,
        longitude
      `)
      .in(
        "uid",
        routeUids
      )
      .order(
        "stop_order",
        {
          ascending: true
        }
      );
  
  
    if (error) {
  
      console.error(
        "[airports] Journey stop lookup failed:",
        error
      );
  
      clearJourneyStops();
  
      return;
    }
  
  
    renderJourneyStops(
      data || []
    );
  }
  
  
  // =====================================================
  // RENDER JOURNEY STOPS
  // =====================================================
  
  function renderJourneyStops(stops) {
  
    const featureCollection = {
  
      type: "FeatureCollection",
  
      features:
        (stops || [])
  
          .filter(stop =>
  
            Number.isFinite(
              Number(stop?.longitude)
            )
  
            &&
  
            Number.isFinite(
              Number(stop?.latitude)
            )
  
          )
  
          .map(stop => ({
  
            type: "Feature",
  
            geometry: {
  
              type: "Point",
  
              coordinates: [
                Number(stop.longitude),
                Number(stop.latitude)
              ]
  
            },
  
            properties: {
  
              uid:
                stop.uid || "",
  
              stop_order:
                stop.stop_order ?? "",
  
              stop_name:
                stop.stop_name || ""
  
            }
  
          }))
  
    };
  
  
    // -------------------------------------------------
    // SOURCE
    // -------------------------------------------------
  
    const existingSource =
      map.getSource(
        STOP_SOURCE_ID
      );
  
  
    if (existingSource) {
  
      existingSource.setData(
        featureCollection
      );
  
    } else {
  
      map.addSource(
        STOP_SOURCE_ID,
        {
  
          type: "geojson",
  
          data:
            featureCollection
  
        }
      );
  
    }
  
  
    // -------------------------------------------------
    // LAYER
    // -------------------------------------------------
  
    if (
      !map.getLayer(
        STOP_CIRCLE_LAYER_ID
      )
    ) {
  
      map.addLayer({
  
        id:
          STOP_CIRCLE_LAYER_ID,
  
        type:
          "circle",
  
        source:
          STOP_SOURCE_ID,
  
        paint: {
        
          "circle-radius": 3.5,
        
          "circle-color":
            "#FFFFFF",
        
          "circle-stroke-width":
            1.25,
        
          "circle-stroke-color":
            "#000000"
        
        }  
      });
  
  
      /*
       * Keep intermediate stops above the route
       * lines so they remain visible.
       */
  
      map.moveLayer(
        STOP_CIRCLE_LAYER_ID
      );
  
    }
  
  
    // -------------------------------------------------
    // VISIBILITY
    // -------------------------------------------------
  
    setLayerVisibility(
  
      STOP_CIRCLE_LAYER_ID,
  
      featureCollection.features.length
        ? "visible"
        : "none"
  
    );
  
  
    bindJourneyStopHover();
  
  }
  
  
  // =====================================================
  // CLEAR JOURNEY STOPS
  // =====================================================
  
  function clearJourneyStops() {
  
    clearGeoJsonSource(
      STOP_SOURCE_ID
    );
  
  
    setLayerVisibility(
      STOP_CIRCLE_LAYER_ID,
      "none"
    );
  
  
    if (
      typeof journeyStopPopup !==
      "undefined"
    ) {
  
      journeyStopPopup.remove();
  
    }
  
  }
  
    
// -------------------------------------------------
// INTERMEDIATE JOURNEY STOPS
// -------------------------------------------------

await loadJourneyStops(
  safeRoutes
);
  // -------------------------------------------------
  // MAIN MAP CLICK CONTROLLER
  // -------------------------------------------------

  bindAirportMapClick();
}

window.loadAirports =
  loadAirports;


// =====================================================
// RENDER FLIGHT AIRPORT MARKERS
// =====================================================

function renderAirportMarkers(airports) {
  const featureCollection = {
    type: "FeatureCollection",

    features: (airports || [])
      .filter(airport =>
        Number.isFinite(
          Number(airport?.longitude)
        ) &&
        Number.isFinite(
          Number(airport?.latitude)
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

  /*
   * Create the visible marker layer once.
   * Later calls only update its source data.
   */
  if (
    !map.getLayer(
      AIRPORT_CIRCLE_LAYER_ID
    )
  ) {
    map.addLayer({
      id:
        AIRPORT_CIRCLE_LAYER_ID,

      type: "circle",

      source:
        AIRPORT_SOURCE_ID,

      paint: {
        "circle-radius": 6,
        "circle-color": "#CCFF00",
        "circle-stroke-width": 1.5,
        "circle-stroke-color":
          "#000000"
      }
    });

    /*
     * Move it to the top only when it is first created.
     */
    map.moveLayer(
      AIRPORT_CIRCLE_LAYER_ID
    );
  }

  const visibility =
    featureCollection.features.length
      ? "visible"
      : "none";

  setLayerVisibility(
    AIRPORT_CIRCLE_LAYER_ID,
    visibility
  );

  bindAirportHover();
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

    const firstLine =
      lines[0];

    const lastLine =
      lines[lines.length - 1];

    return {
      start:
        firstLine[0],

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
    if (getJourneyType(route) === "flight") {
      return;
    }

    const endpoints =
      getRouteEndpointCoordinates(
        route
      );

    if (!endpoints) {
      return;
    }

features.push(
  {
    type: "Feature",

    geometry: {
      type: "Point",

      coordinates:
        endpoints.start
    },

    properties: {
      location:
        route.origin || ""
    }
  },

  {
    type: "Feature",

    geometry: {
      type: "Point",

      coordinates:
        endpoints.end
    },

    properties: {
      location:
        route.destination || ""
    }
  }
);
  
  });

  /*
   * Most initial views may contain flights only.
   * Do not create an unused source and layer unless
   * non-flight endpoints actually exist.
   */
  if (!features.length) {
    clearGeoJsonSource(
      ENDPOINT_SOURCE_ID
    );

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

  /*
   * Create the visible endpoint layer only when there
   * are endpoint features to display.
   */
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
        "circle-color": "#CCFF00",
        "circle-stroke-width": 1.5,
        "circle-stroke-color":
          "#000000"
      }
    });

    map.moveLayer(
      ENDPOINT_CIRCLE_LAYER_ID
    );
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


const journeyStopPopup =
  new mapboxgl.Popup({

    closeButton:
      false,

    closeOnClick:
      false,

    offset:
      10,

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
    AIRPORT_CIRCLE_LAYER_ID,
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
    ENDPOINT_CIRCLE_LAYER_ID,
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
                properties.location
              )}
            </strong>
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
// JOURNEY STOP HOVER
// =====================================================

function bindJourneyStopHover() {

  if (
    airportHandlerState
      .journeyStopHoverBound
  ) {
    return;
  }


  airportHandlerState
    .journeyStopHoverBound = true;


  map.on(
    "mouseenter",
    STOP_CIRCLE_LAYER_ID,
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


      const stopName =
        escapePopupHtml(
          properties.stop_name ||
          "Intermediate stop"
        );

journeyStopPopup

  .setLngLat(
    feature.geometry.coordinates
  )

  .setHTML(`

    <div class="journey-tooltip-content">

      <strong>
        ${stopName}
      </strong>

    </div>

  `)

  .addTo(
    map
  );
    }
  );


  map.on(
    "mouseleave",
    STOP_CIRCLE_LAYER_ID,
    () => {

      map.getCanvas().style.cursor =
        "";

      journeyStopPopup.remove();

    }
  );

}


// =====================================================
// MAP CLICK CONTROLLER
// Select an airport or clear the active airport filter
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
      getCurrentMapMode() !== "routes"
    ) {
      return;
    }

    // -------------------------------------------------
    // DETECT AN AIRPORT MARKER
    // -------------------------------------------------

    let airportFeatures = [];

    if (
      map.getLayer(
        AIRPORT_CIRCLE_LAYER_ID
      )
    ) {
      airportFeatures =
        map.queryRenderedFeatures(
          event.point,
          {
            layers: [
              AIRPORT_CIRCLE_LAYER_ID
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
        console.warn(
          "[airports] Clicked airport feature has no airport_code",
          airportFeature
        );

        return;
      }

      const selectionResult =
        filterRoutesByAirport(
          airportCode
        );

      if (
        selectionResult === "selected" &&
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
    // NON-AIRPORT MAP AREA CLICKED
    // -------------------------------------------------

    if (getActiveAirportFilter()) {
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
   * Restore the exact collection that was visible before
   * the first airport selection in this interaction.
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
    typeof renderRoutes === "function"
  ) {
    /*
     * Restore routes, counters, sidebar and markers.
     * Camera fitting is performed explicitly afterwards.
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
   * Allow Mapbox and the surrounding layout two frames
   * to process the restored sources and UI dimensions.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(
      refocusMap
    );
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
   * the filter and restores the previous collection.
   */
  if (currentAirport === airportCode) {
    clearAirportSelection();
    return "cleared";
  }

  /*
   * Capture the complete visible route set before applying
   * the first airport filter.
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

        : Array.isArray(window.allRoutes)
          ? window.allRoutes.slice()

          : [];
  }

  const baseRoutes =
    Array.isArray(
      routesBeforeAirportFilter
    )
      ? routesBeforeAirportFilter
      : [];

  if (!baseRoutes.length) {
    console.warn(
      "[airports] Cannot filter because no base routes are available"
    );

    return "unchanged";
  }

  setActiveAirportFilter(
    airportCode
  );

  clearIsolatedRoute();

  const filteredRoutes =
    baseRoutes.filter(route =>
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

  if (
    typeof renderRoutes !== "function"
  ) {
    console.error(
      "[airports] renderRoutes() is unavailable"
    );

    return "unchanged";
  }

  renderRoutes(
    filteredRoutes,
    {
      updateBaseRoutes: false,
      fitMap: true
    }
  );

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

  clearGeoJsonSource(
    STOP_SOURCE_ID
  );

  [
    AIRPORT_CIRCLE_LAYER_ID,
    ENDPOINT_CIRCLE_LAYER_ID,
    STOP_CIRCLE_LAYER_ID
  ].forEach(layerId => {    
    setLayerVisibility(
      layerId,
      "none"
    );
  });

  airportPopup.remove();
  nonFlightPopup.remove();
  journeyStopPopup.remove();

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

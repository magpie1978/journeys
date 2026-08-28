/* global window */

// =====================================================
// FLIGHT / JOURNEY SUMMARY BAR
// =====================================================
//
// Controls the detailed summary bar shown when an
// individual journey is selected.
//
// Despite the historical "flight" naming of its DOM IDs,
// the bar supports all journey types.
//
// Display rules:
//   • Flight: 7 columns.
//   • Walk:   3 columns.
//   • Other:  5 columns.
//
// Flights additionally show:
//   • Airline.
//   • Equipment.
//   • Aircraft registration.
//
// Walks hide:
//   • Journey identifier.
//   • Duration.
//
// Public API:
//   window.showFlightSummary(route)
//   window.hideFlightSummary()
//
// =====================================================


// =====================================================
// DOM REFERENCES
// =====================================================

const flightSummaryElements = {
  glassBar:
    document.getElementById("glassBar"),

  airportBar:
    document.getElementById(
      "airportSummaryBar"
    ),

  flightBar:
    document.getElementById(
      "flightSummaryBar"
    ),

  date:
    document.getElementById("flightDate"),

  origin:
    document.getElementById(
      "flightOrigin"
    ),

  routeArrow:
    document.getElementById(
      "flightRouteArrow"
    ),

  destination:
    document.getElementById(
      "flightDestination"
    ),

  originCountry:
    document.getElementById(
      "originCountry"
    ),

  destinationCountry:
    document.getElementById(
      "destinationCountry"
    ),

  equipment:
    document.getElementById(
      "flightEquipment"
    ),

  registration:
    document.getElementById(
      "flightRegistration"
    ),

  flightNumber:
    document.getElementById(
      "flightNumber"
    ),

  airline:
    document.getElementById(
      "flightAirline"
    ),

  duration:
    document.getElementById(
      "flightDuration"
    ),

  distance:
    document.getElementById(
      "flightDistance"
    ),

  journeyTypeLabel:
    document.getElementById(
      "journeyTypeLabel"
    ),

  operatorLabel:
    document.getElementById(
      "operatorLabel"
    ),

  journeyTypeMetric:
    document.getElementById(
      "journeyTypeMetric"
    ),

  operatorMetric:
    document.getElementById(
      "operatorMetric"
    ),

  equipmentMetric:
    document.getElementById(
      "equipmentMetric"
    ),

  durationMetric:
    document.getElementById(
      "journeyDurationMetric"
    )
};


// =====================================================
// DOM HELPERS
// =====================================================

/**
 * Sets an element's text, displaying an em dash when the
 * supplied value is null, undefined or empty.
 *
 * @param {HTMLElement|null} element
 * @param {*} value
 */
function setElementText(element, value) {
  if (!element) {
    return;
  }

  element.textContent =
    value == null || value === ""
      ? "—"
      : String(value);
}


/**
 * Shows or hides an element by toggling its hidden class.
 *
 * @param {HTMLElement|null} element
 * @param {boolean} visible
 */
function setElementVisible(
  element,
  visible
) {
  if (!element) {
    return;
  }

  element.classList.toggle(
    "hidden",
    !visible
  );
}


/**
 * Shows or hides a summary metric that participates in
 * the flight-bar grid.
 *
 * This uses display rather than the hidden class because
 * hidden metrics must be removed from the grid layout.
 *
 * @param {HTMLElement|null} element
 * @param {boolean} visible
 */
function setMetricVisible(
  element,
  visible
) {
  if (!element) {
    return;
  }

  element.style.display =
    visible ? "" : "none";
}


// =====================================================
// SHOW JOURNEY SUMMARY
// =====================================================

/**
 * Displays the detailed summary for a selected journey.
 *
 * @param {Object} route
 */
function showFlightSummary(route) {
  if (!route) {
    console.warn(
      "[flight-bar] Cannot show summary because no route was supplied"
    );

    return;
  }

  const {
    glassBar,
    airportBar,
    flightBar
  } = flightSummaryElements;

  setElementVisible(glassBar, false);
  setElementVisible(airportBar, false);

  if (!flightBar) {
    return;
  }

  populateFlightSummary(route);

  setElementVisible(flightBar, true);
}


// =====================================================
// HIDE JOURNEY SUMMARY
// =====================================================

/**
 * Hides the journey summary and restores whichever
 * summary bar should be visible underneath it.
 *
 * If an airport remains selected, the Airport Summary
 * Bar is restored. Otherwise the standard statistics
 * bar is shown.
 */
function hideFlightSummary() {
  const {
    glassBar,
    airportBar,
    flightBar
  } = flightSummaryElements;

  setElementVisible(flightBar, false);

  const activeAirport =
    window.appState?.activeAirport || null;

  if (activeAirport) {
    setElementVisible(glassBar, false);
    setElementVisible(airportBar, true);

    return;
  }

  setElementVisible(airportBar, false);
  setElementVisible(glassBar, true);
}


// =====================================================
// POPULATE JOURNEY SUMMARY
// =====================================================

/**
 * Populates the summary bar using a route record.
 *
 * @param {Object} route
 */
function populateFlightSummary(route) {
  const journeyType =
    String(
      route?.journey_type || ""
    ).trim();

  const journeyTypeLower =
    journeyType.toLowerCase();

  const isFlight =
    journeyTypeLower === "flight";

  const isWalk =
    journeyTypeLower === "walk";


  // ---------------------------------------------------
  // COLUMN COUNT
  // ---------------------------------------------------

  /*
   * The CSS grid uses this custom property to determine
   * how many summary cards should be displayed.
   */
  const summaryColumnCount =
    isFlight
      ? 7
      : isWalk
        ? 3
        : 5;

  flightSummaryElements.flightBar
    ?.style.setProperty(
      "--summary-columns",
      summaryColumnCount
    );


  // ---------------------------------------------------
  // DYNAMIC LABELS
  // ---------------------------------------------------

  setElementText(
    flightSummaryElements.journeyTypeLabel,
    journeyType || "Journey"
  );

  setElementText(
    flightSummaryElements.operatorLabel,
    isFlight
      ? "Airline"
      : "Operator"
  );


  // ---------------------------------------------------
  // DATE
  // ---------------------------------------------------

  setElementText(
    flightSummaryElements.date,
    formatJourneyDate(
      route.journey_date
    )
  );


  // ---------------------------------------------------
  // ROUTE
  // ---------------------------------------------------

  /*
   * display_origin/display_destination allow manually
   * supplied journey labels to override the underlying
   * route endpoints where appropriate.
   */
  const displayOrigin =
    String(
      route.display_origin ||
      route.origin ||
      ""
    ).trim();

  const displayDestination =
    String(
      route.display_destination ||
      route.destination ||
      ""
    ).trim();

  const samePlace =
    displayOrigin &&
    displayOrigin === displayDestination;

  const noDestination =
    !displayDestination;

  /*
   * A Walk may represent a circular or single-location
   * journey. In that case only the origin is displayed.
   */
  const showDestination =
    !(
      isWalk &&
      (
        samePlace ||
        noDestination
      )
    );

  setElementText(
    flightSummaryElements.origin,
    displayOrigin
  );

  if (showDestination) {
    setElementText(
      flightSummaryElements.destination,
      displayDestination
    );
  }

  if (flightSummaryElements.routeArrow) {
    flightSummaryElements.routeArrow.style.display =
      showDestination ? "" : "none";
  }

  if (flightSummaryElements.destination) {
    flightSummaryElements.destination.style.display =
      showDestination ? "" : "none";
  }


  // ---------------------------------------------------
  // JOURNEY IDENTIFIER
  // ---------------------------------------------------

  /*
   * Flights normally display their flight number/callsign.
   * Other non-Walk journey types may use the same field
   * for their journey identifier.
   */
  setMetricVisible(
    flightSummaryElements.journeyTypeMetric,
    !isWalk
  );

  if (!isWalk) {
    setElementText(
      flightSummaryElements.flightNumber,
      journeyTypeLower === "boat"
        ? route.airline
        : getFlightNumber(route)
    );
  }


  // ---------------------------------------------------
  // AIRLINE
  // Flight only
  // ---------------------------------------------------

  setMetricVisible(
    flightSummaryElements.operatorMetric,
    isFlight
  );

  if (isFlight) {
    setElementText(
      flightSummaryElements.airline,
      route.airline
    );
  }


  // ---------------------------------------------------
  // EQUIPMENT / REGISTRATION
  // Flight only
  // ---------------------------------------------------

  setMetricVisible(
    flightSummaryElements.equipmentMetric,
    isFlight
  );

  if (isFlight) {
    setElementText(
      flightSummaryElements.equipment,
      route.equipment
    );

    setElementText(
      flightSummaryElements.registration,
      route.registration
    );
  }


  // ---------------------------------------------------
  // DURATION
  // Walks deliberately do not display duration.
  // ---------------------------------------------------

  setMetricVisible(
    flightSummaryElements.durationMetric,
    !isWalk
  );

  if (!isWalk) {
    setElementText(
      flightSummaryElements.duration,
      formatDurationFromSeconds(
        route.journey_duration_seconds
      )
    );
  }


  // ---------------------------------------------------
  // DISTANCE
  // ---------------------------------------------------

  /*
   * Walking distances are displayed to three decimal
   * places; other journey types use whole miles.
   */
  setElementText(
    flightSummaryElements.distance,
    formatJourneyDistance(
      route.journey_distance,
      isWalk ? 3 : 0
    )
  );
}


// =====================================================
// DATE FORMATTER
// =====================================================

/**
 * Formats a journey date for display, for example:
 *
 *   24 Aug 2026
 *
 * @param {*} dateValue
 * @returns {string}
 */
function formatJourneyDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  const date =
    new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue)
      .slice(0, 10);
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );
}


// =====================================================
// DURATION FORMATTER
// =====================================================

/**
 * Converts journey duration from seconds to the summary
 * bar's hours/minutes display.
 *
 * @param {*} seconds
 * @returns {string}
 */
function formatDurationFromSeconds(
  seconds
) {
  const totalSeconds =
    Number(seconds);

  if (
    !Number.isFinite(totalSeconds) ||
    totalSeconds <= 0
  ) {
    return "—";
  }

  const totalMinutes =
    Math.round(totalSeconds / 60);

  const hours =
    Math.floor(totalMinutes / 60);

  const minutes =
    totalMinutes % 60;

  return (
    `${hours}h ` +
    `${String(minutes).padStart(2, "0")}min`
  );
}


// =====================================================
// DISTANCE FORMATTER
// =====================================================

/**
 * Formats a distance in miles.
 *
 * @param {*} distance
 * @param {number} decimalPlaces
 * @returns {string}
 */
function formatJourneyDistance(
  distance,
  decimalPlaces = 0
) {
  const numericDistance =
    Number(distance);

  if (
    !Number.isFinite(numericDistance) ||
    numericDistance < 0
  ) {
    return "—";
  }

  return (
    numericDistance.toLocaleString(
      "en-GB",
      {
        minimumFractionDigits:
          decimalPlaces,

        maximumFractionDigits:
          decimalPlaces
      }
    ) +
    " mi"
  );
}


// =====================================================
// JOURNEY IDENTIFIER
// =====================================================

/**
 * Returns the best available identifier for a journey.
 *
 * The current route feed normally supplies callsign, but
 * the flight-number variants are retained for compatibility
 * with route objects that contain those fields.
 *
 * @param {Object} route
 * @returns {string}
 */
function getFlightNumber(route) {
  return (
    route?.flight_number ||
    route?.flightNumber ||
    route?.callsign ||
    "—"
  );
}


// =====================================================
// PUBLIC API
// =====================================================

window.showFlightSummary =
  showFlightSummary;

window.hideFlightSummary =
  hideFlightSummary;

// =====================================================
// FLIGHT SUMMARY BAR
// =====================================================


// =====================================================
// DOM REFERENCES
// =====================================================

const flightSummaryElements = {
  glassBar:
    document.getElementById("glassBar"),

  airportBar:
    document.getElementById("airportSummaryBar"),

  flightBar:
    document.getElementById("flightSummaryBar"),

  date:
    document.getElementById("flightDate"),

  origin:
    document.getElementById("flightOrigin"),

  routeArrow:
  document.getElementById("flightRouteArrow"),

  destination:
    document.getElementById("flightDestination"),

  originCountry:
    document.getElementById("originCountry"),

  destinationCountry:
    document.getElementById("destinationCountry"),

  flightNumber:
    document.getElementById("flightNumber"),

  airline:
    document.getElementById("flightAirline"),

  duration:
    document.getElementById("flightDuration"),

  distance:
    document.getElementById("flightDistance"),

  journeyLabel:
  document.getElementById("journeySummaryLabel"),
};


// =====================================================
// BASIC DOM HELPER
// =====================================================

function setElementText(element, value) {
  if (!element) return;

  element.textContent =
    value == null || value === ""
      ? "—"
      : String(value);
}


// =====================================================
// SHOW FLIGHT SUMMARY
// =====================================================

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

  if (glassBar) {
    glassBar.classList.add("hidden");
  }

  if (airportBar) {
    airportBar.classList.add("hidden");
  }

  if (!flightBar) {
    return;
  }

  populateFlightSummary(route);

  flightBar.classList.remove("hidden");
}


// =====================================================
// HIDE FLIGHT SUMMARY
// =====================================================

function hideFlightSummary() {
  const {
    glassBar,
    airportBar,
    flightBar
  } = flightSummaryElements;

  if (flightBar) {
    flightBar.classList.add("hidden");
  }

  /*
   * Restore the normal glass bar only when the airport
   * summary bar is not currently active.
   */
  const airportBarIsVisible =
    airportBar &&
    !airportBar.classList.contains("hidden");

  if (
    glassBar &&
    !airportBarIsVisible
  ) {
    glassBar.classList.remove("hidden");
  }
}


// =====================================================
// POPULATE FLIGHT SUMMARY
// =====================================================

function populateFlightSummary(route) {

  const journeyType =
    String(
      route?.journey_type || ""
    ).toLowerCase();

  const isWalk =
    journeyType === "walk";

  if (flightSummaryElements.journeyLabel) {

  flightSummaryElements.journeyLabel
    .classList.toggle(
      "hidden",
      !isWalk
    );

  if (isWalk) {
    flightSummaryElements.journeyLabel
      .textContent = "WALK";
  }
}


  // -------------------------------------------------
  // DATE
  // -------------------------------------------------

  setElementText(
    flightSummaryElements.date,
    formatJourneyDate(
      route.journey_date
    )
  );


  // -------------------------------------------------
  // ROUTE / JOURNEY NAME
  // -------------------------------------------------

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


if (isWalk) {

  const samePlace =
    displayOrigin === displayDestination;

  const noDestination =
    !displayDestination;

  if (
    samePlace ||
    noDestination
  ) {

    // Circular walk or named walk:
    // show the origin/name only.
    setElementText(
      flightSummaryElements.origin,
      displayOrigin
    );

    if (flightSummaryElements.routeArrow) {
      flightSummaryElements.routeArrow.style.display =
        "none";
    }

    if (flightSummaryElements.destination) {
      flightSummaryElements.destination.style.display =
        "none";
    }

  } else {

    // Point-to-point walk:
    // show origin → destination.
    setElementText(
      flightSummaryElements.origin,
      displayOrigin
    );

    setElementText(
      flightSummaryElements.destination,
      displayDestination
    );

    if (flightSummaryElements.routeArrow) {
      flightSummaryElements.routeArrow.style.display =
        "";
    }

    if (flightSummaryElements.destination) {
      flightSummaryElements.destination.style.display =
        "";
    }
  }

} else {

  // Normal behaviour for other journey types.
  setElementText(
    flightSummaryElements.origin,
    displayOrigin
  );

  setElementText(
    flightSummaryElements.destination,
    displayDestination
  );

  if (flightSummaryElements.routeArrow) {
    flightSummaryElements.routeArrow.style.display =
      "";
  }

  if (flightSummaryElements.destination) {
    flightSummaryElements.destination.style.display =
      "";
  }
}


  // -------------------------------------------------
  // FLIGHT / AIRLINE / DURATION
  // -------------------------------------------------

  const flightMetric =
    flightSummaryElements.flightNumber
      ?.closest(".flight-metric");

  const airlineMetric =
    flightSummaryElements.airline
      ?.closest(".flight-metric");

  const durationMetric =
    flightSummaryElements.duration
      ?.closest(".flight-metric");


  if (isWalk) {

    /*
     * These fields are not relevant to a walk,
     * so remove the complete metric blocks.
     */
    if (flightMetric) {
      flightMetric.style.display = "none";
    }

    if (airlineMetric) {
      airlineMetric.style.display = "none";
    }

    if (durationMetric) {
      durationMetric.style.display = "none";
    }

  } else {

    /*
     * Important: restore these fields when another
     * journey type is subsequently selected.
     */
    if (flightMetric) {
      flightMetric.style.display = "";
    }

    if (airlineMetric) {
      airlineMetric.style.display = "";
    }

    if (durationMetric) {
      durationMetric.style.display = "";
    }

    setElementText(
      flightSummaryElements.flightNumber,
      getFlightNumber(route)
    );

    setElementText(
      flightSummaryElements.airline,
      route.airline
    );

    setElementText(
      flightSummaryElements.duration,
      formatDurationFromSeconds(
        route.journey_duration_seconds
      )
    );
  }


  // -------------------------------------------------
  // DISTANCE
  // -------------------------------------------------

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

function formatJourneyDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(date.getTime())
  ) {
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
// FLIGHT IDENTIFIER
// =====================================================

function getFlightNumber(route) {
  return (
    route?.flight_number ||
    route?.flightNumber ||
    route?.callsign ||
    "—"
  );
}


// =====================================================
// GLOBAL API
// =====================================================

window.showFlightSummary =
  showFlightSummary;

window.hideFlightSummary =
  hideFlightSummary;

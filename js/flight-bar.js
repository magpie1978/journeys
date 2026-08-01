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
    document.getElementById("flightDistance")
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
  setElementText(
    flightSummaryElements.date,
    formatJourneyDate(
      route.journey_date
    )
  );

  setElementText(
    flightSummaryElements.origin,
    route.origin
  );

  setElementText(
    flightSummaryElements.destination,
    route.destination
  );

  setElementText(
    flightSummaryElements.originCountry,
    route.origin_country
  );

  setElementText(
    flightSummaryElements.destinationCountry,
    route.destination_country
  );

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

  setElementText(
    flightSummaryElements.distance,
    formatJourneyDistance(
      route.journey_distance
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
  distance
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
    `${Math.round(numericDistance)
      .toLocaleString()} mi`
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

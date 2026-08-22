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

  equipment:
  document.getElementById("flightEquipment"),

  registration:
  document.getElementById("flightRegistration"),
  
  flightNumber:
    document.getElementById("flightNumber"),

  airline:
    document.getElementById("flightAirline"),

  duration:
    document.getElementById("flightDuration"),

  distance:
    document.getElementById("flightDistance"),

  journeyTypeLabel:
  document.getElementById("journeyTypeLabel"),

  operatorLabel:
    document.getElementById("operatorLabel"),
  
  journeyTypeMetric:
    document.getElementById("journeyTypeMetric"),
  
  operatorMetric:
    document.getElementById("operatorMetric"),

  equipmentMetric:
  document.getElementById("equipmentMetric"),
  
  durationMetric:
    document.getElementById("journeyDurationMetric"),

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

  const activeAirport =
    window.appState?.activeAirport ||
    window.activeAirportFilter ||
    null;
  
  console.log(
    "[flight-bar] active airport:",
    activeAirport,
    window.appState?.activeAirport,
    window.activeAirportFilter
  ); 
  
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

  const activeAirport =
    window.appState?.activeAirport ||
    window.activeAirportFilter ||
    null;

  /*
   * If we arrived here from an airport view,
   * restore the airport summary bar.
   */
  if (activeAirport) {

    if (glassBar) {
      glassBar.classList.add("hidden");
    }

    if (airportBar) {
      airportBar.classList.remove("hidden");
    }

    return;
  }

  /*
   * Otherwise return to the standard summary bar.
   */
  if (airportBar) {
    airportBar.classList.add("hidden");
  }

  if (glassBar) {
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
    ).trim();

  const journeyTypeLower =
    journeyType.toLowerCase();

  const isFlight =
    journeyTypeLower === "flight";

  const isWalk =
    journeyTypeLower === "walk";


  
  // -------------------------------------------------
  // SUMMARY BAR COLUMN COUNT
  // -------------------------------------------------
  
  const summaryColumnCount =
    isFlight
      ? 7
      : isWalk
        ? 3
        : 5;
  
  if (flightSummaryElements.flightBar) {
    flightSummaryElements.flightBar.style.setProperty(
      "--summary-columns",
      summaryColumnCount
    );
  }


  
  // -------------------------------------------------
  // DYNAMIC LABELS
  // -------------------------------------------------

  if (flightSummaryElements.journeyTypeLabel) {
    flightSummaryElements.journeyTypeLabel.textContent =
      journeyType || "Journey";
  }

  if (flightSummaryElements.operatorLabel) {
    flightSummaryElements.operatorLabel.textContent =
      isFlight
        ? "Airline"
        : "Operator";
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
  // ROUTE
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


  const samePlace =
    displayOrigin &&
    displayOrigin === displayDestination;

  const noDestination =
    !displayDestination;


  if (
    isWalk &&
    (
      samePlace ||
      noDestination
    )
  ) {

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
// JOURNEY IDENTIFIER
// -------------------------------------------------

if (flightSummaryElements.journeyTypeMetric) {
  flightSummaryElements.journeyTypeMetric.style.display =
    isWalk
      ? "none"
      : "";
}

if (!isWalk) {
  setElementText(
    flightSummaryElements.flightNumber,
    getFlightNumber(route)
  );
}


  // -------------------------------------------------
  // AIRLINE / OPERATOR
  // Flight only
  // -------------------------------------------------
  
  if (flightSummaryElements.operatorMetric) {
    flightSummaryElements.operatorMetric.style.display =
      isFlight
        ? ""
        : "none";
  }
  
  if (isFlight) {
    setElementText(
      flightSummaryElements.airline,
      route.airline
    );
  }

  
  // -------------------------------------------------
  // EQUIPMENT / REGISTRATION
  // Flight only
  // -------------------------------------------------
  
  if (flightSummaryElements.equipmentMetric) {
    flightSummaryElements.equipmentMetric.style.display =
      isFlight
        ? ""
        : "none";
  }
  
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

  

  // -------------------------------------------------
  // DURATION
  //
  // Preserve your existing Walk-specific rule:
  // do not show Duration for Walks.
  // -------------------------------------------------

  if (flightSummaryElements.durationMetric) {
    flightSummaryElements.durationMetric.style.display =
      isWalk
        ? "none"
        : "";
  }

  if (!isWalk) {
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

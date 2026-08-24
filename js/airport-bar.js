// =====================================================
// OVERALL PURPOSE
// =====================================================

// This file is responsible for the Airport Summary Bar.

// When a user clicks on an airport marker, it:
   // Hides the normal journey summary.
   // Calculates statistics for that airport.
   // Updates the Airport Summary Bar.
   // Displays the Airport Summary Bar.
// When the user deselects the airport, it hides the Airport Summary Bar and restores the normal UI.



// =====================================================
// WORKFLOW
//
/// Airport selected
//        ↓
// Hide route summary
//        ↓
// Read all routes
//        ↓
// Find departures
//        ↓
// Find arrivals
//        ↓
// Calculate totals
//        ↓
// Update HTML
//        ↓
// Show airport bar
// =====================================================




// =====================================================
// HELPERS
// =====================================================

function getRouteDurationMinutes(route) {
  const seconds = Number(route?.journey_duration_seconds);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }

  return Math.round(seconds / 60);
}



// =====================================================
// SHOW AIRPORT SUMMARY BAR
// =====================================================

function showAirportSummary(airport) {
  if (!airport?.code) {
    console.warn(
      "[airport-bar] Cannot show summary: airport code is missing"
    );

    return;
  }

  // Prevent the flight summary and airport summary
  // from being displayed at the same time.
  if (typeof hideFlightSummary === "function") {
    hideFlightSummary();
  }

  const airportCode = airport.code;

  const routes =
    Array.isArray(window.allRoutes)
      ? window.allRoutes
      : [];

  // Only flight journeys are relevant to airport statistics.
  const flightRoutes = routes.filter(
    route => route?.journey_type === "Flight"
  );

  // Journeys leaving the selected airport.
  const departures = flightRoutes.filter(
    route => route.origin === airportCode
  );

  // Journeys arriving at the selected airport.
  const arrivals = flightRoutes.filter(
    route => route.destination === airportCode
  );

  // Combine both directions once for shared calculations.
  const airportRoutes = [
    ...departures,
    ...arrivals
  ];

  // Count unique airlines operating to or from the airport.
  const airlines = new Set(
    airportRoutes
      .map(route => route.airline)
      .filter(Boolean)
  );

  // Calculate the combined duration of all airport routes.
  const totalMinutes = airportRoutes.reduce(
    (total, route) =>
      total + getRouteDurationMinutes(route),
    0
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // -------------------------------------------------
  // UPDATE SUMMARY CONTENT
  // -------------------------------------------------

  const airportCodeEl =
    document.getElementById("airportCode");

  const airportNameEl =
    document.getElementById("airportName");

   const airportDeparturesEl =
     document.getElementById("airportDepartures");
   
   const airportArrivalsEl =
     document.getElementById("airportArrivals");

  const airportAirlinesEl =
    document.getElementById("airportAirlines");

  const airportDurationEl =
    document.getElementById("airportDuration");

  if (airportCodeEl) {
    airportCodeEl.textContent = airportCode;
  }

  if (airportNameEl) {
     const airportName =
       airport.airport ||
       airport.name ||
       airport.city ||
       "";

  airportNameEl.textContent = airportName;
}

if (airportDeparturesEl) {
  airportDeparturesEl.textContent =
    departures.length.toLocaleString();
}

if (airportArrivalsEl) {
  airportArrivalsEl.textContent =
    arrivals.length.toLocaleString();
}

  if (airportAirlinesEl) {
    airportAirlinesEl.textContent =
      String(airlines.size);
  }

  if (airportDurationEl) {
    airportDurationEl.textContent =
      `${hours}h ${minutes}m`;
  }

  // -------------------------------------------------
  // SHOW AIRPORT BAR
  // -------------------------------------------------

  const glassBar =
    document.getElementById("glassBar");

  const airportBar =
    document.getElementById(
      "airportSummaryBar"
    );

if (glassBar) {
  glassBar.classList.add("hidden");
}

if (airportBar) {
  airportBar.classList.remove("hidden");
}
}


// =====================================================
// HIDE AIRPORT SUMMARY BAR
// =====================================================

function hideAirportSummary() {

  const glassBar =
    document.getElementById("glassBar");

  const airportBar =
    document.getElementById(
      "airportSummaryBar"
    );

  const flightBar =
    document.getElementById(
      "flightSummaryBar"
    );

  if (airportBar) {
    airportBar.classList.add("hidden");
  }

  /*
   * Restore the normal counter bar only if a
   * specific journey summary is not currently open.
   */
  const flightBarVisible =
    flightBar &&
    !flightBar.classList.contains("hidden");

  if (
    glassBar &&
    !flightBarVisible
  ) {
    glassBar.classList.remove("hidden");
  }
}

// =====================================================
// EXPOSE GLOBAL API
// =====================================================

window.showAirportSummary =
  showAirportSummary;

window.hideAirportSummary =
  hideAirportSummary;

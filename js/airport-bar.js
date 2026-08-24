/* global hideFlightSummary */

// =====================================================
// AIRPORT SUMMARY BAR
// =====================================================
//
// Displays statistics for a selected airport.
//
// When an airport is selected:
//   • hides the normal journey/counter bars;
//   • finds all flights departing from or arriving there;
//   • calculates departures, arrivals, airlines and duration;
//   • populates and displays the Airport Summary Bar.
//
// When the airport is deselected, the Airport Summary Bar
// is hidden and the normal counter bar is restored where
// appropriate.
//
// Public API:
//   window.showAirportSummary(airport)
//   window.hideAirportSummary()
//
// =====================================================


// =====================================================
// HELPERS
// =====================================================

/**
 * Returns a route's duration in whole minutes.
 *
 * Invalid, missing or non-positive durations are treated as zero.
 *
 * @param {Object} route
 * @returns {number}
 */
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

/**
 * Calculates statistics for an airport and displays them
 * in the Airport Summary Bar.
 *
 * @param {Object} airport
 */
function showAirportSummary(airport) {
  if (!airport?.code) {
    console.warn(
      "[airport-bar] Cannot show summary: airport code is missing"
    );
    return;
  }

  // A journey summary and airport summary should never
  // be visible at the same time.
  if (typeof hideFlightSummary === "function") {
    hideFlightSummary();
  }

  const airportCode = airport.code;

  const routes = Array.isArray(window.allRoutes)
    ? window.allRoutes
    : [];

  // Airport statistics apply only to flights.
  const flightRoutes = routes.filter(
    route => route?.journey_type === "Flight"
  );

  const departures = flightRoutes.filter(
    route => route.origin === airportCode
  );

  const arrivals = flightRoutes.filter(
    route => route.destination === airportCode
  );

  // Combine departures and arrivals for statistics that
  // apply to every journey involving the selected airport.
  const airportRoutes = [
    ...departures,
    ...arrivals
  ];

  const airlines = new Set(
    airportRoutes
      .map(route => route.airline)
      .filter(Boolean)
  );

  const totalMinutes = airportRoutes.reduce(
    (total, route) =>
      total + getRouteDurationMinutes(route),
    0
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;


  // ---------------------------------------------------
  // UPDATE SUMMARY CONTENT
  // ---------------------------------------------------

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


  // ---------------------------------------------------
  // DISPLAY AIRPORT BAR
  // ---------------------------------------------------

  const glassBar =
    document.getElementById("glassBar");

  const airportBar =
    document.getElementById("airportSummaryBar");

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

/**
 * Hides the Airport Summary Bar and restores the normal
 * counter bar when no individual journey summary is open.
 */
function hideAirportSummary() {
  const glassBar =
    document.getElementById("glassBar");

  const airportBar =
    document.getElementById("airportSummaryBar");

  const flightBar =
    document.getElementById("flightSummaryBar");

  if (airportBar) {
    airportBar.classList.add("hidden");
  }

  // Do not restore the counter bar if an individual
  // journey summary is currently being displayed.
  const flightBarVisible =
    flightBar &&
    !flightBar.classList.contains("hidden");

  if (glassBar && !flightBarVisible) {
    glassBar.classList.remove("hidden");
  }
}


// =====================================================
// PUBLIC API
// =====================================================

window.showAirportSummary =
  showAirportSummary;

window.hideAirportSummary =
  hideAirportSummary;

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


function formatCount(count, singularWord) {
  const word =
    count === 1
      ? singularWord
      : `${singularWord}S`;

  return `${count} ${word}`;
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

  const outboundFlightsEl =
    document.getElementById("outboundFlights");

  const inboundFlightsEl =
    document.getElementById("inboundFlights");

  const airportAirlinesEl =
    document.getElementById("airportAirlines");

  const airportDurationEl =
    document.getElementById("airportDuration");

  if (airportCodeEl) {
    airportCodeEl.textContent = airportCode;
  }

  if (airportNameEl) {
    airportNameEl.textContent =
      airport.city || "";
  }

  if (outboundFlightsEl) {
    outboundFlightsEl.textContent =
      formatCount(
        departures.length,
        "DEPARTURE"
      );
  }

  if (inboundFlightsEl) {
    inboundFlightsEl.textContent =
      formatCount(
        arrivals.length,
        "ARRIVAL"
      );
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
    glassBar.style.display = "none";
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

  if (airportBar) {
    airportBar.classList.add("hidden");
  }

  if (glassBar) {
    glassBar.style.display = "";
  }
}


// =====================================================
// EXPOSE GLOBAL API
// =====================================================

window.showAirportSummary =
  showAirportSummary;

window.hideAirportSummary =
  hideAirportSummary;

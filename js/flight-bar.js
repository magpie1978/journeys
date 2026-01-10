// =====================================================
// FLIGHT SUMMARY BAR
// =====================================================

function showFlightSummary(r) {
  // Hide other bars
  document.getElementById("glassBar")?.classList.add("hidden");
  document.getElementById("airportSummaryBar")?.classList.add("hidden");

  // Show flight bar
  const bar = document.getElementById("flightSummaryBar");
  if (!bar) return;
  bar.classList.remove("hidden");

  populateFlightSummary(r);
}

function hideFlightSummary() {
  document.getElementById("flightSummaryBar")?.classList.add("hidden");
  document.getElementById("glassBar")?.classList.remove("hidden");
}

// =====================================================
// POPULATION HELPERS
// =====================================================

function populateFlightSummary(r) {
  document.getElementById("flightDate").textContent =
    formatJourneyDate(r.journey_date);

  document.getElementById("flightOrigin").textContent =
    r.origin || "—";

  document.getElementById("flightDestination").textContent =
    r.destination || "—";

  document.getElementById("originCountry").textContent =
    r.origin_country || "";

  document.getElementById("destinationCountry").textContent =
    r.destination_country || "";

  document.getElementById("flightNumber").textContent =
    getFlightNumber(r);

  document.getElementById("flightAirline").textContent =
    r.airline || "—";

  document.getElementById("flightDuration").textContent =
    formatDuration(r.journey_duration_seconds);

  document.getElementById("flightDistance").textContent =
    r.journey_distance
      ? `${Math.round(r.journey_distance)} mi`
      : "—";
}

// =====================================================
// FORMATTERS
// =====================================================

function formatJourneyDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if

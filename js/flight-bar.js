// =====================================================
// FLIGHT SUMMARY BAR
// =====================================================

function showFlightSummary(r) {
  // Hide other bars
  const glassBar = document.getElementById("glassBar");
  const airportBar = document.getElementById("airportSummaryBar");
  const flightBar = document.getElementById("flightSummaryBar");

  if (glassBar) glassBar.classList.add("hidden");
  if (airportBar) airportBar.classList.add("hidden");

  if (!flightBar) return;
  flightBar.classList.remove("hidden");

  populateFlightSummary(r);
}

function hideFlightSummary() {
  const glassBar = document.getElementById("glassBar");
  const flightBar = document.getElementById("flightSummaryBar");

  if (flightBar) flightBar.classList.add("hidden");
  if (glassBar) glassBar.classList.remove("hidden");
}

// =====================================================
// POPULATION
// =====================================================

function populateFlightSummary(r) {
  setText("flightDate", formatJourneyDate(r.journey_date));
  setText("flightOrigin", r.origin || "—");
  setText("flightDestination", r.destination || "—");

  setText("originCountry", r.origin_country || "");
  setText("destinationCountry", r.destination_country || "");

  setText("flightNumber", getFlightNumber(r));
  setText("flightAirline", r.airline || "—");

  // Prefer journey_duration_seconds (matches your airport bar)
  setText("flightDuration", formatDurationFromSeconds(r.journey_duration_seconds));

  setText(
    "flightDistance",
    r.journey_distance != null ? `${Math.round(Number(r.journey_distance))} mi` : "—"
  );
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// =====================================================
// FORMATTERS
// =====================================================

function formatJourneyDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDurationFromSeconds(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "—";
  const mins = Math.round(s / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}min`;
}

function getFlightNumber(r) {
  // Choose the best available identifier
  return r.flight_number || r.flightNumber || r.callsign || "—";
}

// =====================================================
// EXPOSE GLOBAL API (so sidebar.js can always call it)
// =====================================================

window.showFlightSummary = showFlightSummary;
window.hideFlightSummary = hideFlightSummary;

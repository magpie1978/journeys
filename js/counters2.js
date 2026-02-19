// =====================================================
// COUNTERS.JS — CLEAN REBUILD
// =====================================================
// Handles all glass bar counters:
// Journeys | Surface | Miles | Countries | Airlines | Duration
// =====================================================


// =====================================================
// DOM ELEMENT REFERENCES
// =====================================================
const journeyNumberEl =
  document.querySelector("#journeyCounter .glass-number");
const journeyLabelEl =
  document.querySelector("#journeyCounter .glass-label");

const transportNumberEl =
  document.querySelector("#transportCounter .glass-number");
const transportLabelEl =
  document.querySelector("#transportCounter .glass-label");

const milesNumberEl =
  document.querySelector("#milesCounter .glass-number");

const countriesNumberEl =
  document.querySelector("#countriesCounter .glass-number");

const airlinesNumberEl =
  document.querySelector("#airlinesCounter .glass-number");

const durationNumberEl =
  document.querySelector("#durationCounter .glass-number");


// =====================================================
// HELPERS
// =====================================================

function safeNumber(n) {
  return Number(n) || 0;
}

function formatSecondsToHM(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins.toString().padStart(2, "0")}min`;
}


// =====================================================
// JOURNEYS COUNTER
// =====================================================
function updateJourneyCounter(n) {
  if (!journeyNumberEl || !journeyLabelEl) return;

  journeyNumberEl.textContent = n.toLocaleString();
  journeyLabelEl.textContent =
    n === 1 ? "JOURNEY" : "JOURNEYS";
}


// =====================================================
// SURFACE TRANSPORT COUNTER
// =====================================================
function updateTransportCounter(routes) {
  if (!transportNumberEl || !transportLabelEl) return;

  const drives =
    routes.filter(r => r.journey_type === "Drive").length;

  const trains =
    routes.filter(r => r.journey_type === "Train").length;

  const boats =
    routes.filter(r => r.journey_type === "Boat").length;

  const buses =
    routes.filter(r => r.journey_type === "Bus").length;

  const totalSurface =
    drives + trains + boats + buses;

  transportNumberEl.textContent =
    totalSurface.toLocaleString();

  // Compact breakdown label
  transportLabelEl.textContent =
    `${drives}D • ${trains}T • ${boats}Bt • ${buses}Bs`;
}


// =====================================================
// MILES COUNTER
// =====================================================
function updateMilesCounter(routes) {
  if (!milesNumberEl) return;

  const totalMiles = routes.reduce(
    (sum, r) =>
      sum + safeNumber(r.journey_distance),
    0
  );

  milesNumberEl.textContent =
    Math.round(totalMiles).toLocaleString();
}


// =====================================================
// COUNTRIES COUNTER
// =====================================================
function updateCountriesCounter(routes) {
  if (!countriesNumberEl) return;

  const countrySet = new Set(
    routes
      .map(r => r.destination_country)
      .filter(Boolean)
  );

  countriesNumberEl.textContent =
    countrySet.size.toLocaleString();
}


// =====================================================
// AIRLINES COUNTER
// =====================================================
function updateAirlinesCounter(routes) {
  if (!airlinesNumberEl) return;

  const airlineSet = new Set(
    routes
      .map(r => r.airline)
      .filter(Boolean)
  );

  airlinesNumberEl.textContent =
    airlineSet.size.toLocaleString();
}


// =====================================================
// DURATION COUNTER
// =====================================================
function updateDurationCounter(routes) {
  if (!durationNumberEl) return;

  const totalSeconds = routes.reduce(
    (sum, r) =>
      sum + safeNumber(r.journey_duration_seconds),
    0
  );

  durationNumberEl.textContent =
    formatSecondsToHM(totalSeconds);
}


// =====================================================
// MASTER COUNTER UPDATE
// =====================================================
function updateAllCounters(routes = []) {

  if (!Array.isArray(routes)) {
    console.warn(
      "[counters] updateAllCounters received non-array:",
      routes
    );
    return;
  }

  console.log(
    `[counters] Updating with ${routes.length} routes`
  );

  updateJourneyCounter(routes.length);
  updateTransportCounter(routes);
  updateMilesCounter(routes);
  updateCountriesCounter(routes);
  updateAirlinesCounter(routes);
  updateDurationCounter(routes);
}


// =====================================================
// GLOBAL EXPORT
// =====================================================
window.updateAllCounters = updateAllCounters;

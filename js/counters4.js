// =====================================================
// COUNTERS3 — CLEAN SAFE BUILD
// =====================================================

// Prevent duplicate initialisation
if (!window.__COUNTERS3__) {
  window.__COUNTERS3__ = true;


// -----------------------------------------------------
// DOM REFS
// -----------------------------------------------------
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


// -----------------------------------------------------
// HELPERS
// -----------------------------------------------------
function formatSecondsToHM(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins.toString().padStart(2,"0")}min`;
}


// -----------------------------------------------------
// TRANSPORT COUNTER
// -----------------------------------------------------
function updateTransportCounter(routes) {

  const surfaceRoutes =
    routes.filter(r => r.journey_type !== "Flight");

  const drives =
    surfaceRoutes.filter(r => r.journey_type === "Drive").length;

  transportNumberEl.textContent =
    surfaceRoutes.length.toLocaleString();

  transportLabelEl.textContent =
    `${drives} Drives`;
}


// -----------------------------------------------------
// MASTER COUNTERS
// -----------------------------------------------------
function updateAllCounters(routes = []) {

  journeyNumberEl.textContent =
    routes.length.toLocaleString();

  journeyLabelEl.textContent =
    routes.length === 1 ? "JOURNEY" : "JOURNEYS";

  updateTransportCounter(routes);

  const miles = routes.reduce(
    (s,r) => s + (Number(r.journey_distance)||0), 0);

  milesNumberEl.textContent =
    Math.round(miles).toLocaleString();

  const countries = new Set(
    routes.map(r => r.destination_country).filter(Boolean)
  );

  countriesNumberEl.textContent =
    countries.size;

  const airlines = new Set(
    routes.map(r => r.airline).filter(Boolean)
  );

  airlinesNumberEl.textContent =
    airlines.size;

  const seconds = routes.reduce(
    (s,r)=> s+(Number(r.journey_duration_seconds)||0),0);

  durationNumberEl.textContent =
    formatSecondsToHM(seconds);
}


// -----------------------------------------------------
// GLOBAL EXPORT
// -----------------------------------------------------
window.updateAllCounters = updateAllCounters;

}

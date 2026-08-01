// =====================================================
// COUNTERS
//
// This file controls the six summary counters shown above the map:
//    total journeys;
//    land journeys;
//    total miles;
//    destination countries;
//    airlines;
//    total duration.
//
// Its overall flow is:
//    File loads
//   ↓
// Check whether it has already been initialised
//   ↓
// Find and store references to the counter elements
//   ↓
// Define formatting and calculation helpers
//   ↓
// Expose updateAllCounters() globally
//   ↓
// Other files call updateAllCounters(routes)
//   ↓
// The counters are recalculated from the supplied route array
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


function formatSecondsToHM(seconds) {

  const totalSeconds = Number(seconds) || 0;

  if (totalSeconds <= 0) {
    return "0h 00min";
  }

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor((totalSeconds % 3600) / 60);

  return `${hours}h ${String(minutes).padStart(2,"0")}min`;
}


function updateTransportCounter(routes) {

  // All non-flight journeys
  const surfaceRoutes =
    routes.filter(r =>
      (r.journey_type || "")
        .toLowerCase() !== "flight"
    );

  const landCount = surfaceRoutes.length;

  // Top number
  transportNumberEl.textContent =
    landCount.toLocaleString();

  // Bottom label (static)
  transportLabelEl.textContent =
    "LAND JOURNEYS";
}
  

// -----------------------------------------------------
// MASTER COUNTERS
// -----------------------------------------------------
function updateAllCounters(routes = []) {

//  journeyNumberEl.textContent =
//    routes.length.toLocaleString();

//  journeyLabelEl.textContent =
//    routes.length === 1 ? "FLIGHT" : "FLIGHTS";



  const flightCount = routes.filter(
  route =>
    String(route?.journey_type || "")
      .toLowerCase() === "flight"
  ).length;

  journeyNumberEl.textContent =
    flightCount.toLocaleString();

  journeyLabelEl.textContent =
    flightCount === 1
      ? "FLIGHT"
      : "FLIGHTS";





  
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

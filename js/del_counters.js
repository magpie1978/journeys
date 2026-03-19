// =====================================================
// GLASS COUNTER ELEMENTS
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
// JOURNEYS
// =====================================================
function updateJourneyCounter(n) {
  if (!journeyNumberEl || !journeyLabelEl) return;

  journeyNumberEl.textContent = n.toLocaleString();
  journeyLabelEl.textContent =
    n === 1 ? "JOURNEY" : "JOURNEYS";
}


// =====================================================
// SURFACE TRANSPORT
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

  transportLabelEl.textContent =
    `${drives}D • ${trains}T • ${boats}Bt • ${buses}Bs`;
}


// =====================================================
// MILES
// =====================================================
function updateMilesCounter(miles) {
  if (!milesNumberEl) return;

  milesNumberEl.textContent =
    Math.round(miles).toLocaleString();
}


// =====================================================
// COUNTRIES
// =====================================================
function updateCountriesCounter(n) {
  if (!countriesNumberEl) return;

  countriesNumberEl.textContent =
    n.toLocaleString();
}


// =====================================================
// AIRLINES
// =====================================================
function updateAirlinesCounter(n) {
  if (!airlinesNumberEl) return;

  airlinesNumberEl.textContent =
    n.toLocaleString();
}


// =====================================================
// DURATION
// =====================================================
function updateDurationCounter(seconds) {
  if (!durationNumberEl) return;

  durationNumberEl.textContent =
    formatSecondsToHM(seconds);
}


// =====================================================
// MASTER AGGREGATION
// =====================================================
function updateAllCounters(routes) {

  // Journeys
  updateJourneyCounter(routes.length);

  // Surface transport
  updateTransportCounter(routes);

  // Miles
  const totalMiles = routes.reduce(
    (sum, r) =>
      sum + (Number(r.journey_distance) || 0),
    0
  );
  updateMilesCounter(totalMiles);

  // Countries
  const countrySet = new Set(
    routes
      .map(r => r.destination_country)
      .filter(Boolean)
  );
  updateCountriesCounter(countrySet.size);

  // Airlines
  const airlineSet = new Set(
    routes
      .map(r => r.airline)
      .filter(Boolean)
  );
  updateAirlinesCounter(airlineSet.size);

  // Duration
  const totalSeconds = routes.reduce(
    (sum, r) =>
      sum + (Number(r.journey_duration_seconds) || 0),
    0
  );
  updateDurationCounter(totalSeconds);
}

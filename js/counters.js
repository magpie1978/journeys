// =====================================================
// GLASS COUNTER HELPERS
// =====================================================

// Journeys
function updateJourneyCounter(n) {
  if (!journeyNumberEl || !journeyLabelEl) return;
  journeyNumberEl.textContent = n.toLocaleString();
  journeyLabelEl.textContent = n === 1 ? "JOURNEY" : "JOURNEYS";
}


// =====================================================
// Surface Transport Counter
// =====================================================
function updateTransportCounter(routes) {
  if (!transportNumberEl || !transportLabelEl) return;

  const drives = routes.filter(r => r.journey_type === "Drive").length;
  const trains = routes.filter(r => r.journey_type === "Train").length;
  const boats  = routes.filter(r => r.journey_type === "Boat").length;
  const buses  = routes.filter(r => r.journey_type === "Bus").length;

  const totalSurface = drives + trains + boats + buses;

  transportNumberEl.textContent = totalSurface.toLocaleString();

  transportLabelEl.textContent =
    `${drives}D • ${trains}T • ${boats}B • ${buses}B`;
}


// Miles
function updateMilesCounter(miles) {
  if (!milesNumberEl) return;
  milesNumberEl.textContent = Math.round(miles).toLocaleString();
}

// Countries
function updateCountriesCounter(n) {
  if (!countriesNumberEl) return;
  countriesNumberEl.textContent = n.toLocaleString();
}

// Airlines
function updateAirlinesCounter(n) {
  if (!airlinesNumberEl) return;
  airlinesNumberEl.textContent = n.toLocaleString();
}

// Duration
function updateDurationCounter(seconds) {
  if (!durationNumberEl) return;
  durationNumberEl.textContent = formatSecondsToHM(seconds);
}


// Counter aggregation
// Calculates and updates stats derived from the currently visible routes.
function updateAllCounters(routes) {
  
function updateAllCounters(routes) {
  
  // Journeys
  updateJourneyCounter(routes.length);

  // NEW — Surface transport
  updateTransportCounter(routes);

  // Miles
  const totalMiles = routes.reduce(
    (sum, r) => sum + (Number(r.journey_distance) || 0),
    0
  );
  updateMilesCounter(totalMiles);

  // Countries
  const countrySet = new Set(
    routes.map(r => r.destination_country).filter(Boolean)
  );
  updateCountriesCounter(countrySet.size);

  // Airlines
  const airlineSet = new Set(
    routes.map(r => r.airline).filter(Boolean)
  );
  updateAirlinesCounter(airlineSet.size);

  // Duration
  const totalSeconds = routes.reduce(
    (sum, r) => sum + (Number(r.journey_duration_seconds) || 0),
    0
  );
  updateDurationCounter(totalSeconds);
}

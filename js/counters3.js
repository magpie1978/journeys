// =====================================================
// GLASS COUNTER HELPERS
// =====================================================

// Journeys
function updateJourneyCounter(n) {
  if (!journeyNumberEl || !journeyLabelEl) return;
  journeyNumberEl.textContent = n.toLocaleString();
  journeyLabelEl.textContent = n === 1 ? "JOURNEY" : "JOURNEYS";
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

//
// TRANSPORT COUNTER //
//
function updateTransportCounter(routes) {
  if (!transportNumberEl || !transportLabelEl) return;

  // Normalise type values
  const typeMap = {
    Drive: ["Drive", "Car", "Road"],
    Train: ["Train", "Rail"],
    Boat: ["Boat", "Ferry", "Ship"],
    Bus: ["Bus", "Coach"]
  };

  function countTypes(keys) {
    return routes.filter(r =>
      keys.includes(r.journey_type)
    ).length;
  }

  const drives = countTypes(typeMap.Drive);
  const trains = countTypes(typeMap.Train);
  const boats  = countTypes(typeMap.Boat);
  const buses  = countTypes(typeMap.Bus);

  const totalSurface =
    drives + trains + boats + buses;

  transportNumberEl.textContent =
    totalSurface.toLocaleString();

  transportLabelEl.textContent =
    `${drives}D • ${trains}T • ${boats}Bt • ${buses}Bs`;
}
////



// Counter aggregation
// Calculates and updates stats derived from the currently visible routes.
//function updateAllCounters(routes) {
  
  // Journeys
//  updateJourneyCounter(routes.length);

  // Miles
//  const totalMiles = routes.reduce(
//    (sum, r) => sum + (Number(r.journey_distance) || 0),
//    0
//  );
//  updateMilesCounter(totalMiles);

  // Countries
//  const countrySet = new Set(
//    routes.map(r => r.destination_country).filter(Boolean)
//  );
//  updateCountriesCounter(countrySet.size);

  // Airlines
//  const airlineSet = new Set(
//    routes.map(r => r.airline).filter(Boolean)
//  );
//  updateAirlinesCounter(airlineSet.size);

  // Duration
//  const totalSeconds = routes.reduce(
//    (sum, r) => sum + (Number(r.journey_duration_seconds) || 0),
//    0
//  );
//  updateDurationCounter(totalSeconds);
//}




function updateAllCounters(routes) {
  
  // Journeys
  updateJourneyCounter(routes.length);

  // ✅ Surface transport (YOU WERE MISSING THIS)
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

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
// Find and store references to the  elements
//   ↓
// Define formatting and calculation helpers
//   ↓
// Expose updateAlls() globally
//   ↓
// Other files call updateAlls(routes)
//   ↓
// The s are recalculated from the supplied route array
// =====================================================



// Prevent duplicate initialisation
if (!window.__S3__) {
  window.__S3__ = true;


// -----------------------------------------------------
// DOM REFS
// -----------------------------------------------------
const journeyNumberEl =
  document.querySelector("#journeyCounter .glass-number");
const journeyLabelEl =
  document.querySelector("#journeyCounter .glass-label");

const transportCounterEl =
  document.getElementById("transportCounter");

const transportNumberEl =
  document.querySelector(
    "#transportCounter .glass-number"
  );

const transportLabelEl =
  document.querySelector(
    "#transportCounter .glass-label"
  );

const trainCounterEl =
  document.getElementById("trainCounter");

const trainNumberEl =
  document.querySelector(
    "#trainCounter .glass-number"
  );

const trainLabelEl =
  document.querySelector(
    "#trainCounter .glass-label"
  );

  const boatCounterEl =
  document.getElementById("boatCounter");

const boatNumberEl =
  document.querySelector(
    "#boatCounter .glass-number"
  );

const boatLabelEl =
  document.querySelector(
    "#boatCounter .glass-label"
  );


const busCounterEl =
  document.getElementById("busCounter");

const busNumberEl =
  document.querySelector(
    "#busCounter .glass-number"
  );

const busLabelEl =
  document.querySelector(
    "#busCounter .glass-label"
  );


const walkCounterEl =
  document.getElementById("walkCounter");

const walkNumberEl =
  document.querySelector(
    "#walkCounter .glass-number"
  );

const walkLabelEl =
  document.querySelector(
    "#walkCounter .glass-label"
  );

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


function updateTransportCounter(routes = []) {

  // -----------------------------------------------------
  // SHOW ONLY WHEN "DRIVE" IS SELECTED
  // -----------------------------------------------------

  const driveSelected =
    typeof selected !== "undefined" &&
    selected.types instanceof Set &&
    [...selected.types].some(
      type =>
        String(type).toLowerCase() === "drive"
    );


  // Hide the complete glass container if Drive
  // has not been explicitly selected.
  if (transportCounterEl) {
    transportCounterEl.classList.toggle(
      "hidden",
      !driveSelected
    );
  }


  // Nothing else needs updating while hidden.
  if (!driveSelected) {
    return;
  }


  // -----------------------------------------------------
  // COUNT DRIVE JOURNEYS ONLY
  // -----------------------------------------------------

  const drives =
    routes.filter(
      route =>
        String(
          route?.journey_type || ""
        ).toLowerCase() === "drive"
    );

  const driveCount =
    drives.length;


  // -----------------------------------------------------
  // UPDATE GLASS CONTAINER
  // -----------------------------------------------------

  if (transportNumberEl) {
    transportNumberEl.textContent =
      driveCount.toLocaleString();
  }

  if (transportLabelEl) {
    transportLabelEl.textContent =
      driveCount === 1
        ? "DRIVE"
        : "DRIVES";
  }
}


function updateTrainCounter(routes = []) {

  // -----------------------------------------------------
  // SHOW ONLY WHEN "TRAIN" IS SELECTED
  // -----------------------------------------------------

  const trainSelected =
    typeof selected !== "undefined" &&
    selected.types instanceof Set &&
    [...selected.types].some(
      type =>
        String(type).toLowerCase() === "train"
    );


  if (trainCounterEl) {
    trainCounterEl.classList.toggle(
      "hidden",
      !trainSelected
    );
  }


  if (!trainSelected) {
    return;
  }


  // -----------------------------------------------------
  // COUNT TRAIN JOURNEYS ONLY
  // -----------------------------------------------------

  const trains =
    routes.filter(
      route =>
        String(
          route?.journey_type || ""
        ).toLowerCase() === "train"
    );

  const trainCount =
    trains.length;


  // -----------------------------------------------------
  // UPDATE GLASS CONTAINER
  // -----------------------------------------------------

  if (trainNumberEl) {
    trainNumberEl.textContent =
      trainCount.toLocaleString();
  }

  if (trainLabelEl) {
    trainLabelEl.textContent =
      trainCount === 1
        ? "TRAIN"
        : "TRAINS";
  }
}


function updateBoatCounter(routes = []) {

  const boatSelected =
    typeof selected !== "undefined" &&
    selected.types instanceof Set &&
    [...selected.types].some(
      type =>
        String(type).toLowerCase() === "boat"
    );

  if (boatCounterEl) {
    boatCounterEl.classList.toggle(
      "hidden",
      !boatSelected
    );
  }

  if (!boatSelected) {
    return;
  }

  const boats =
    routes.filter(
      route =>
        String(
          route?.journey_type || ""
        ).toLowerCase() === "boat"
    );

  const boatCount =
    boats.length;

  if (boatNumberEl) {
    boatNumberEl.textContent =
      boatCount.toLocaleString();
  }

  if (boatLabelEl) {
    boatLabelEl.textContent =
      boatCount === 1
        ? "BOAT"
        : "BOATS";
  }
}


function updateBusCounter(routes = []) {

  const busSelected =
    typeof selected !== "undefined" &&
    selected.types instanceof Set &&
    [...selected.types].some(
      type =>
        String(type).toLowerCase() === "bus"
    );

  if (busCounterEl) {
    busCounterEl.classList.toggle(
      "hidden",
      !busSelected
    );
  }

  if (!busSelected) {
    return;
  }

  const buses =
    routes.filter(
      route =>
        String(
          route?.journey_type || ""
        ).toLowerCase() === "bus"
    );

  const busCount =
    buses.length;

  if (busNumberEl) {
    busNumberEl.textContent =
      busCount.toLocaleString();
  }

  if (busLabelEl) {
    busLabelEl.textContent =
      busCount === 1
        ? "BUS"
        : "BUSES";
  }
}


function updateWalkCounter(routes = []) {

  const walkSelected =
    typeof selected !== "undefined" &&
    selected.types instanceof Set &&
    [...selected.types].some(
      type =>
        String(type).toLowerCase() === "walk"
    );

  if (walkCounterEl) {
    walkCounterEl.classList.toggle(
      "hidden",
      !walkSelected
    );
  }

  if (!walkSelected) {
    return;
  }

  const walks =
    routes.filter(
      route =>
        String(
          route?.journey_type || ""
        ).toLowerCase() === "walk"
    );

  const walkCount =
    walks.length;

  if (walkNumberEl) {
    walkNumberEl.textContent =
      walkCount.toLocaleString();
  }

  if (walkLabelEl) {
    walkLabelEl.textContent =
      walkCount === 1
        ? "WALK"
        : "WALKS";
  }
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
  updateTrainCounter(routes);
  updateBoatCounter(routes);
  updateBusCounter(routes);
  updateWalkCounter(routes);

  
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

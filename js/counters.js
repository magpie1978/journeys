/* global sb, selected */

// =====================================================
// COUNTERS
// =====================================================
//
// Controls the summary statistic cards displayed above
// the map.
//
// Provides:
//   • Flight count.
//   • Conditional Drive/Train/Boat/Bus/Walk counts.
//   • Total distance.
//   • Countries visited.
//   • Airlines used.
//   • Total journey duration.
//
// Public API:
//   window.updateAllCounters(routes)
//
// =====================================================


// Prevent accidental duplicate initialisation if this
// script is loaded more than once.
if (!window.__S3__) {
  window.__S3__ = true;


// =====================================================
// DOM REFERENCES
// =====================================================

const journeyCounterEl =
  document.getElementById("journeyCounter");

const journeyNumberEl =
  document.querySelector(
    "#journeyCounter .glass-number"
  );

const journeyLabelEl =
  document.querySelector(
    "#journeyCounter .glass-label"
  );

const milesNumberEl =
  document.querySelector(
    "#milesCounter .glass-number"
  );

const countriesNumberEl =
  document.querySelector(
    "#countriesCounter .glass-number"
  );

const airlinesCounterEl =
  document.getElementById("airlinesCounter");

const airlinesNumberEl =
  document.querySelector(
    "#airlinesCounter .glass-number"
  );

const durationCounterEl =
  document.getElementById("durationCounter");

const durationNumberEl =
  document.querySelector(
    "#durationCounter .glass-number"
  );


// =====================================================
// TRANSPORT COUNTER CONFIGURATION
// =====================================================

/*
 * Drive, Train, Boat, Bus and Walk counters all behave
 * identically. Defining them here avoids maintaining five
 * separate copies of the same counter logic.
 */
const transportCounters = {
  drive: {
    container:
      document.getElementById("transportCounter"),

    number:
      document.querySelector(
        "#transportCounter .glass-number"
      ),

    label:
      document.querySelector(
        "#transportCounter .glass-label"
      ),

    singular: "DRIVE",
    plural: "DRIVES"
  },

  train: {
    container:
      document.getElementById("trainCounter"),

    number:
      document.querySelector(
        "#trainCounter .glass-number"
      ),

    label:
      document.querySelector(
        "#trainCounter .glass-label"
      ),

    singular: "TRAIN",
    plural: "TRAINS"
  },

  boat: {
    container:
      document.getElementById("boatCounter"),

    number:
      document.querySelector(
        "#boatCounter .glass-number"
      ),

    label:
      document.querySelector(
        "#boatCounter .glass-label"
      ),

    singular: "BOAT",
    plural: "BOATS"
  },

  bus: {
    container:
      document.getElementById("busCounter"),

    number:
      document.querySelector(
        "#busCounter .glass-number"
      ),

    label:
      document.querySelector(
        "#busCounter .glass-label"
      ),

    singular: "BUS",
    plural: "BUSES"
  },

  walk: {
    container:
      document.getElementById("walkCounter"),

    number:
      document.querySelector(
        "#walkCounter .glass-number"
      ),

    label:
      document.querySelector(
        "#walkCounter .glass-label"
      ),

    singular: "WALK",
    plural: "WALKS"
  }
};



// =====================================================
// GENERAL HELPERS
// =====================================================

/**
 * Returns a route's journey type in normalized lowercase
 * form.
 *
 * @param {Object} route
 * @returns {string}
 */
function getCounterJourneyType(route) {
  return String(
    route?.journey_type || ""
  ).toLowerCase();
}


/**
 * Returns the currently selected journey types in
 * normalized lowercase form.
 *
 * @returns {Array<string>}
 */
function getSelectedTypes() {
  if (
    typeof selected === "undefined" ||
    !(selected.types instanceof Set)
  ) {
    return [];
  }

  return [...selected.types].map(
    type => String(type).toLowerCase()
  );
}


/**
 * Converts a duration in seconds to an hours/minutes
 * display string.
 *
 * @param {*} seconds
 * @returns {string}
 */
function formatSecondsToHM(seconds) {
  const totalSeconds = Number(seconds) || 0;

  if (totalSeconds <= 0) {
    return "0h 00min";
  }

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  return (
    `${hours}h ` +
    `${String(minutes).padStart(2, "0")}min`
  );
}


// =====================================================
// TRANSPORT COUNTERS
// =====================================================

/**
 * Updates one of the conditional transport counters.
 *
 * The counter is shown only when that journey type is
 * explicitly selected in the Type filter.
 *
 * @param {string} type
 * @param {Array} routes
 * @param {Array<string>} selectedTypes
 */
function updateTransportCounter(
  type,
  routes,
  selectedTypes
) {
  const config = transportCounters[type];

  if (!config) {
    return;
  }

  const typeSelected =
    selectedTypes.includes(type);

  const count = routes.filter(
    route =>
      getCounterJourneyType(route) === type
  ).length;

  if (config.container) {
    config.container.classList.toggle(
      "hidden",
      !typeSelected || count === 0
    );
  }

  if (!typeSelected || count === 0) {
    return;
  }

  if (config.number) {
    config.number.textContent =
      count.toLocaleString();
  }

  if (config.label) {
    config.label.textContent =
      count === 1
        ? config.singular
        : config.plural;
  }
}


/**
 * Updates all conditional non-flight transport counters.
 *
 * @param {Array} routes
 * @param {Array<string>} selectedTypes
 */
function updateTransportCounters(
  routes,
  selectedTypes
) {
  Object.keys(transportCounters).forEach(
    type => {
      updateTransportCounter(
        type,
        routes,
        selectedTypes
      );
    }
  );
}

// =====================================================
// COUNTRY COUNTER
// =====================================================

/**
 * Updates the number of unique countries visited by the
 * currently displayed journeys.
 *
 * Country membership is resolved by the database function
 * get_countries_for_journeys(), which uses the canonical
 * journey-country mapping rather than route text fields.
 *
 * @param {Array} routes
 */
async function updateCountriesCounter(
  routes = []
) {
  if (!countriesNumberEl) {
    return;
  }

  const uids = [
    ...new Set(
      routes
        .map(route => route?.uid)
        .filter(Boolean)
        .map(String)
    )
  ];

  if (!uids.length) {
    countriesNumberEl.textContent = "0";
    return;
  }

  const { data, error } = await sb.rpc(
    "get_countries_for_journeys",
    {
      journey_uids: uids
    }
  );

  if (error) {
    console.error(
      "[counters] Country lookup failed:",
      error
    );

    countriesNumberEl.textContent = "0";
    return;
  }

  const countries = new Set(
    (data || [])
      .map(row => row.country)
      .filter(Boolean)
  );

  countriesNumberEl.textContent =
    countries.size.toLocaleString();
}


// =====================================================
// MASTER COUNTER UPDATE
// =====================================================

/**
 * Recalculates all summary counters from the supplied
 * route collection.
 *
 * @param {Array} routes
 */
function updateAllCounters(routes = []) {
  const safeRoutes =
    Array.isArray(routes)
      ? routes
      : [];

  const selectedTypes =
    getSelectedTypes();

  const flightSelected =
    selectedTypes.includes("flight");

  const walkOnly =
    selectedTypes.length === 1 &&
    selectedTypes.includes("walk");


  // ---------------------------------------------------
  // FLIGHTS
  // ---------------------------------------------------

  const flightRoutes = safeRoutes.filter(
    route =>
      getCounterJourneyType(route) === "flight"
  );

  const flightCount =
    flightRoutes.length;

  if (journeyCounterEl) {
    journeyCounterEl.classList.toggle(
      "hidden",
      !flightSelected || flightCount === 0
    );
  }

  if (journeyNumberEl) {
    journeyNumberEl.textContent =
      flightCount.toLocaleString();
  }

  if (journeyLabelEl) {
    journeyLabelEl.textContent =
      flightCount === 1
        ? "FLIGHT"
        : "FLIGHTS";
  }


  // ---------------------------------------------------
  // NON-FLIGHT TRANSPORT TYPES
  // ---------------------------------------------------

  updateTransportCounters(
    safeRoutes,
    selectedTypes
  );


  // ---------------------------------------------------
  // DISTANCE
  // ---------------------------------------------------

  const miles = safeRoutes.reduce(
    (sum, route) =>
      sum +
      (
        Number(route?.journey_distance) || 0
      ),
    0
  );

  if (milesNumberEl) {
    milesNumberEl.textContent =
      walkOnly
        ? miles.toFixed(3)
        : Math.round(miles).toLocaleString();
  }


  // ---------------------------------------------------
  // COUNTRIES
  // ---------------------------------------------------

  updateCountriesCounter(safeRoutes);


  // ---------------------------------------------------
  // AIRLINES
  // ---------------------------------------------------

  if (airlinesCounterEl) {
    airlinesCounterEl.classList.toggle(
      "hidden",
      !flightSelected
    );
  }

  if (
    flightSelected &&
    airlinesNumberEl
  ) {
    const airlines = new Set(
      flightRoutes
        .map(route => route.airline)
        .filter(Boolean)
    );

    airlinesNumberEl.textContent =
      airlines.size.toLocaleString();
  }


  // ---------------------------------------------------
  // DURATION
  // ---------------------------------------------------

  if (durationCounterEl) {
    durationCounterEl.classList.toggle(
      "hidden",
      walkOnly
    );
  }

  const seconds = safeRoutes.reduce(
    (sum, route) =>
      sum +
      (
        Number(
          route?.journey_duration_seconds
        ) || 0
      ),
    0
  );

  if (durationNumberEl) {
    durationNumberEl.textContent =
      formatSecondsToHM(seconds);
  }
}


// =====================================================
// PUBLIC API
// =====================================================

window.updateAllCounters =
  updateAllCounters;

}

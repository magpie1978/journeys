
/**
 * Airlines Manager Rotation Optimiser
 * engine.js v0.5
 *
 * Hub: BOM
 * Scenario A: Rebuild schedules from scratch
 *
 * Supported aircraft:
 * - A380-800:    852 Economy + 4 Cargo
 * - A350-900ULR: 430 Economy + 1 Cargo
 *
 * Each rotation group:
 * - Contains 7 identical aircraft
 * - Uses one fixed aircraft configuration
 * - Has a maximum base duration of 168 hours
 *
 * All groups share the same total daily demand.
 *
 * Selection method:
 * 1. Find best rotation for every supported model
 * 2. Compare weekly gross revenue
 * 3. Select highest-revenue candidate
 * 4. Deduct demand
 * 5. Repeat
 */

// ============================================================
// 1. CONSTANTS
// ============================================================

export const EXCLUDED = new Set([
  "BKK",
  "CGK",
  "DEL",
  "MPM"
]);

export const FIXED_AIRCRAFT = Object.freeze({
  "A380-800": Object.freeze({
    eco: 852,
    cargo: 4
  }),

  "A350-900ULR": Object.freeze({
    eco: 430,
    cargo: 1
  })
});

export const SCENARIO = "REBUILD_FROM_SCRATCH";

export const ROTATION_HOURS = 168;

export const AIRCRAFT_PER_GROUP = 7;

export const ECONOMY_PAYLOAD_TONNES = 0.1;

const QUARTERS = ROTATION_HOURS * 4;

const EPSILON = 1e-7;

// ============================================================
// 2. CSV PARSER
// ============================================================

export function csv(text) {
  const rows = [];

  let row = [];
  let cell = "";
  let quoted = false;

  text = String(text).replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const character = text[i];

    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }

    } else if (
      character === "," &&
      !quoted
    ) {
      row.push(cell);
      cell = "";

    } else if (
      (character === "\n" ||
       character === "\r") &&
      !quoted
    ) {
      if (
        character === "\r" &&
        text[i + 1] === "\n"
      ) {
        i++;
      }

      row.push(cell);

      if (row.some(value => value !== "")) {
        rows.push(row);
      }

      row = [];
      cell = "";

    } else {
      cell += character;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const [headers, ...data] = rows;

  return data.map(values => {
    const record = {};

    headers.forEach((header, index) => {
      record[header.trim()] = values[index] ?? "";
    });

    return record;
  });
}

// ============================================================
// 3. NUMERIC UTILITIES
// ============================================================

function numeric(value, fallback = 0) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  const number = Number(
    String(value)
      .replaceAll(",", "")
      .trim()
  );

  return Number.isFinite(number)
    ? number
    : fallback;
}

function category(value) {
  const number = numeric(value, NaN);

  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number > 10
  ) {
    return null;
  }

  return number;
}

function hasValidNumber(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return false;
  }

  return Number.isFinite(
    Number(
      String(value)
        .replaceAll(",", "")
        .trim()
    )
  );
}

// ============================================================
// 4. FLIGHT DURATION
// ============================================================

export function duration(distance, speed) {
  if (
    !(distance > 0) ||
    !(speed > 0)
  ) {
    return Infinity;
  }

  const roundTripHours =
    2 * (distance / speed + 1);

  return Math.ceil(
    roundTripHours * 4
  ) / 4;
}

// ============================================================
// 5. PREPARE DATA
// ============================================================

export function prepare(
  routes,
  pricing,
  aircraft
) {
  const pricingByRoute = new Map();

  // ----------------------------------------------------------
  // Pricing lookup
  // ----------------------------------------------------------

  for (const record of pricing) {
    const status = String(
      record.status ?? ""
    ).trim().toLowerCase();

    if (status !== "ok") {
      continue;
    }

    const routeId = String(
      record.route_id ?? ""
    ).trim();

    if (routeId) {
      pricingByRoute.set(routeId, record);
    }
  }

  // ----------------------------------------------------------
  // Owned routes
  // ----------------------------------------------------------

  const preparedRoutes = [];

  for (const record of routes) {
    const ownership = String(
      record.ownership_status ?? ""
    ).trim().toLowerCase();

    const airportCode = String(
      record.airport_code ?? ""
    ).trim().toUpperCase();

    if (ownership !== "owned") {
      continue;
    }

    if (EXCLUDED.has(airportCode)) {
      continue;
    }

    const routeId = String(
      record.route_id ?? ""
    ).trim();

    const price = pricingByRoute.get(routeId);

    // Scenario A: total demand, not remaining demand.

    const validEconomyDemand =
      price !== undefined &&
      hasValidNumber(
        price.current_demand_economy
      );

    const validCargoDemand =
      price !== undefined &&
      hasValidNumber(
        price.current_demand_cargo
      );

    const validPricing =
      validEconomyDemand &&
      validCargoDemand;

    preparedRoutes.push({
      id: routeId,

      code: airportCode,

      distance: numeric(
        record.distance_km
      ),

      category: category(
        record.category
      ),

      ecoDemand: validEconomyDemand
        ? Math.max(
            0,
            numeric(
              price.current_demand_economy
            )
          )
        : 0,

      cargoDemand: validCargoDemand
        ? Math.max(
            0,
            numeric(
              price.current_demand_cargo
            )
          )
        : 0,

      ecoFare: Math.max(
        0,
        numeric(
          price?.current_price_economy
        )
      ),

      cargoFare: Math.max(
        0,
        numeric(
          price?.current_price_cargo
        )
      ),

      pricingValid: validPricing,

      demandSource: "TOTAL_CURRENT_DEMAND"
    });
  }

  // ----------------------------------------------------------
  // Aircraft catalogue
  // ----------------------------------------------------------

  const preparedAircraft = [];

  for (const record of aircraft) {
    const item = {
      id: String(
        record.aircraft_id ?? ""
      ).trim(),

      model: String(
        record.model ?? ""
      ).trim(),

      category: category(
        record.category
      ),

      range: numeric(
        record.range_km
      ),

      speed: numeric(
        record.speed_kmh
      ),

      seats: Math.floor(
        numeric(
          record.max_seats
        )
      ),

      payload: numeric(
        record.payload_tonnes
      )
    };

    if (
      item.category === null ||
      item.range <= 0 ||
      item.speed <= 0 ||
      item.seats <= 0 ||
      item.payload <= 0
    ) {
      continue;
    }

    preparedAircraft.push(item);
  }

  return {
    routes: preparedRoutes,
    aircraft: preparedAircraft,
    scenario: SCENARIO
  };
}

// ============================================================
// 6. VALIDATION
// ============================================================

export function validateData(data) {
  if (
    !Array.isArray(data?.routes) ||
    data.routes.length === 0
  ) {
    throw new Error(
      "No eligible owned routes loaded."
    );
  }

  if (
    !Array.isArray(data?.aircraft) ||
    data.aircraft.length === 0
  ) {
    throw new Error(
      "No usable aircraft models loaded."
    );
  }

  const invalidCategories =
    data.routes.filter(route => (
      !Number.isInteger(route.category) ||
      route.category < 1 ||
      route.category > 10
    ));

  if (invalidCategories.length > 0) {
    throw new Error(
      `${invalidCategories.length} routes have ` +
      "missing or invalid airport categories."
    );
  }

  const missingTotalDemand =
    data.routes.filter(route => (
      route.pricingValid === false
    )).length;

  if (
    missingTotalDemand === data.routes.length
  ) {
    throw new Error(
      "No valid total-demand records. " +
      "Check current_demand_economy and " +
      "current_demand_cargo in pricing.csv."
    );
  }

  return {
    routeCount: data.routes.length,
    aircraftCount: data.aircraft.length,
    missingTotalDemand,
    validPricingRoutes:
      data.routes.length - missingTotalDemand,
    scenario: SCENARIO
  };
}

// ============================================================
// 7. AIRCRAFT CONFIGURATION
// ============================================================

function getSupportedAircraft(data) {
  const supported = [];

  for (
    const [model, config]
    of Object.entries(FIXED_AIRCRAFT)
  ) {
    const aircraft = data.aircraft.find(
      item => item.model === model
    );

    if (!aircraft) {
      throw new Error(
        `${model} is missing from aircraft.csv ` +
        "or has invalid catalogue data."
      );
    }

    const requiredPayload =
      config.eco * ECONOMY_PAYLOAD_TONNES +
      config.cargo;

    if (config.eco > aircraft.seats) {
      throw new Error(
        `${model}: ${config.eco} Economy seats ` +
        `exceeds the catalogue maximum of ${aircraft.seats}.`
      );
    }

    if (
      requiredPayload >
      aircraft.payload + EPSILON
    ) {
      throw new Error(
        `${model}: configuration requires ` +
        `${requiredPayload} tonnes but only ` +
        `${aircraft.payload} tonnes are available.`
      );
    }

    supported.push({
      ...aircraft,
      eco: config.eco,
      cargo: config.cargo,
      requiredPayload
    });
  }

  return supported;
}

// ============================================================
// 8. ROUTE ELIGIBILITY
// ============================================================

export function isEligible(aircraft, route) {
  return (
    Number.isInteger(route.category) &&
    Number.isInteger(aircraft.category) &&
    route.category >= aircraft.category &&
    route.distance > 0 &&
    route.distance <= aircraft.range &&
    aircraft.speed > 0
  );
}

// ============================================================
// 9. WEEKLY REVENUE
// ============================================================

export function calculateLegRevenue(
  route,
  eco,
  cargo
) {
  const economyRevenue =
    AIRCRAFT_PER_GROUP *
    2 *
    eco *
    route.ecoFare;

  const cargoRevenue =
    AIRCRAFT_PER_GROUP *
    2 *
    cargo *
    route.cargoFare;

  return {
    economyRevenue,
    cargoRevenue,
    totalRevenue:
      economyRevenue + cargoRevenue
  };
}

// ============================================================
// 10. DEMAND MANAGEMENT
// ============================================================

export function hasDemand(
  remaining,
  routeId,
  eco,
  cargo,
  services = 1
) {
  const available = remaining.get(routeId);

  if (!available) {
    return false;
  }

  return (
    available.eco + EPSILON >=
      services * 2 * eco &&

    available.cargo + EPSILON >=
      services * 2 * cargo
  );
}

function maximumServices(
  available,
  aircraft,
  quarters
) {
  if (
    !available ||
    quarters <= 0 ||
    quarters > QUARTERS
  ) {
    return 0;
  }

  const byEconomy = Math.floor(
    (available.eco + EPSILON) /
    (2 * aircraft.eco)
  );

  const byCargo = Math.floor(
    (available.cargo + EPSILON) /
    (2 * aircraft.cargo)
  );

  const byTime = Math.floor(
    QUARTERS / quarters
  );

  return Math.max(
    0,
    Math.min(
      byEconomy,
      byCargo,
      byTime
    )
  );
}

// ============================================================
// 11. PRECOMPUTE AIRCRAFT CANDIDATES
// ============================================================

function buildCandidates(
  routes,
  aircraft
) {
  const candidates = [];

  const stats = {
    categoryAndRangeEligible: 0,
    fareEligible: 0,
    demandEligible: 0
  };

  for (const route of routes) {
    if (!isEligible(aircraft, route)) {
      continue;
    }

    stats.categoryAndRangeEligible++;

    if (
      route.pricingValid === false ||
      route.ecoFare <= 0
    ) {
      continue;
    }

    stats.fareEligible++;

    const hours = duration(
      route.distance,
      aircraft.speed
    );

    if (
      !Number.isFinite(hours) ||
      hours > ROTATION_HOURS
    ) {
      continue;
    }

    const quarters = Math.round(hours * 4);

    if (
      quarters <= 0 ||
      quarters > QUARTERS
    ) {
      continue;
    }

    const revenue = calculateLegRevenue(
      route,
      aircraft.eco,
      aircraft.cargo
    ).totalRevenue;

    if (revenue <= 0) {
      continue;
    }

    candidates.push({
      route,
      hours,
      quarters,
      revenue
    });

    if (
      route.ecoDemand + EPSILON >=
        2 * aircraft.eco &&
      route.cargoDemand + EPSILON >=
        2 * aircraft.cargo
    ) {
      stats.demandEligible++;
    }
  }

  return {
    candidates,
    stats
  };
}

// ============================================================
// 12. BOUNDED-KNAPSACK CIRCUIT
// ============================================================

function bestCircuit(options, stop) {
  const bundles = [];

  // Convert service counts into binary bundles.

  for (const option of options) {
    let remainingCount = option.maxServices;

    for (
      let size = 1;
      remainingCount > 0;
      size *= 2
    ) {
      const take = Math.min(
        size,
        remainingCount
      );

      bundles.push({
        option,
        count: take,
        weight: option.quarters * take,
        value: option.revenue * take
      });

      remainingCount -= take;
    }
  }

  if (bundles.length === 0) {
    return null;
  }

  // Dynamic programming over 15-minute units.

  const dp = new Float64Array(
    QUARTERS + 1
  );

  dp.fill(-Infinity);
  dp[0] = 0;

  const paths = Array(
    QUARTERS + 1
  ).fill(null);

  for (const bundle of bundles) {
    if (stop()) {
      return null;
    }

    for (
      let time = QUARTERS;
      time >= bundle.weight;
      time--
    ) {
      const previousRevenue =
        dp[time - bundle.weight];

      if (!Number.isFinite(previousRevenue)) {
        continue;
      }

      const candidateRevenue =
        previousRevenue + bundle.value;

      if (
        candidateRevenue >
        dp[time] + EPSILON
      ) {
        dp[time] = candidateRevenue;

        paths[time] = {
          bundle,
          previous:
            paths[time - bundle.weight]
        };
      }
    }
  }

  // Find highest-revenue solution.

  let bestTime = 0;

  for (
    let time = 1;
    time <= QUARTERS;
    time++
  ) {
    if (!Number.isFinite(dp[time])) {
      continue;
    }

    if (
      dp[time] > dp[bestTime] + EPSILON ||
      (
        Math.abs(
          dp[time] - dp[bestTime]
        ) <= EPSILON &&
        time > bestTime
      )
    ) {
      bestTime = time;
    }
  }

  if (
    bestTime === 0 ||
    !(dp[bestTime] > 0)
  ) {
    return null;
  }

  // Reconstruct selected services.

  const selected = [];

  let node = paths[bestTime];

  while (node) {
    for (
      let i = 0;
      i < node.bundle.count;
      i++
    ) {
      selected.push(node.bundle.option);
    }

    node = node.previous;
  }

  selected.sort((a, b) => {
    const ratioA =
      a.revenue / a.hours;

    const ratioB =
      b.revenue / b.hours;

    return (
      ratioB - ratioA ||
      a.route.code.localeCompare(
        b.route.code
      )
    );
  });

  let hours = 0;

  const legs = [];

  for (const option of selected) {
    legs.push({
      code: option.route.code,
      routeId: option.route.id,
      start: hours,
      duration: option.hours,
      revenue: option.revenue
    });

    hours += option.hours;
  }

  return {
    hours,
    revenue: dp[bestTime],
    legs
  };
}

// ============================================================
// 13. BEST ROTATION FOR ONE AIRCRAFT MODEL
// ============================================================

function evaluateAircraft(
  aircraft,
  candidates,
  remaining,
  stop
) {
  const options = [];

  for (const candidate of candidates) {
    const available = remaining.get(
      candidate.route.id
    );

    const maxServices = maximumServices(
      available,
      aircraft,
      candidate.quarters
    );

    if (maxServices > 0) {
      options.push({
        ...candidate,
        maxServices
      });
    }
  }

  const circuit = bestCircuit(
    options,
    stop
  );

  if (!circuit) {
    return null;
  }

  return {
    aircraft,
    circuit,
    eligibleDestinations: options.length
  };
}

// ============================================================
// 14. MAIN MIXED-FLEET OPTIMISER
// ============================================================

export function optimise(
  data,
  {
    groups = 20,
    onProgress = () => {},
    stop = () => false
  } = {}
) {
  const validation = validateData(data);

  const supportedAircraft =
    getSupportedAircraft(data);

  // Null or blank means unlimited.
  const unlimited =
    groups === null ||
    groups === "";

  const requestedGroups = unlimited
    ? Infinity
    : Number(groups);

  if (
    !unlimited &&
    (
      !Number.isSafeInteger(requestedGroups) ||
      requestedGroups < 1
    )
  ) {
    throw new Error(
      "Group count must be a positive whole number."
    );
  }

  // ----------------------------------------------------------
  // Shared total-demand pool
  // ----------------------------------------------------------

  const remaining = new Map();

  for (const route of data.routes) {
    remaining.set(route.id, {
      eco: route.ecoDemand,
      cargo: route.cargoDemand
    });
  }

  // ----------------------------------------------------------
  // Precompute candidate routes for every model
  // ----------------------------------------------------------

  const fleetCandidates = new Map();

  const aircraftDiagnostics = {};

  for (const aircraft of supportedAircraft) {
    const prepared = buildCandidates(
      data.routes,
      aircraft
    );

    fleetCandidates.set(
      aircraft.model,
      prepared.candidates
    );

    aircraftDiagnostics[aircraft.model] = {
      configuration:
        `${aircraft.eco}E + ${aircraft.cargo}C`,

      category: aircraft.category,
      range: aircraft.range,
      speed: aircraft.speed,

      ...prepared.stats
    };
  }

  // ----------------------------------------------------------
  // Results
  // ----------------------------------------------------------

  const rotations = [];

  const fleetSummary = {};

  for (const aircraft of supportedAircraft) {
    fleetSummary[aircraft.model] = {
      model: aircraft.model,
      eco: aircraft.eco,
      cargo: aircraft.cargo,
      groups: 0,
      aircraftCount: 0,
      weeklyRevenue: 0,
      services: 0,
      scheduledHours: 0
    };
  }

  const diagnostics = {
    scenario: SCENARIO,

    demandSource:
      "current_demand_economy + current_demand_cargo",

    totalRoutes: data.routes.length,

    missingTotalDemand:
      validation.missingTotalDemand,

    aircraft: aircraftDiagnostics,

    groups: []
  };

  let total = 0;

  // ----------------------------------------------------------
  // Mixed-fleet allocation loop
  // ----------------------------------------------------------

  for (
    let groupIndex = 0;
    groupIndex < requestedGroups &&
      !stop();
    groupIndex++
  ) {
    let bestChoice = null;

    // Evaluate every supported model against
    // the same remaining demand.

    for (const aircraft of supportedAircraft) {
      if (stop()) {
        break;
      }

      const candidates =
        fleetCandidates.get(
          aircraft.model
        ) ?? [];

      const choice = evaluateAircraft(
        aircraft,
        candidates,
        remaining,
        stop
      );

      if (!choice) {
        continue;
      }

      if (
        bestChoice === null ||
        choice.circuit.revenue >
          bestChoice.circuit.revenue + EPSILON ||
        (
          Math.abs(
            choice.circuit.revenue -
            bestChoice.circuit.revenue
          ) <= EPSILON &&
          choice.circuit.hours >
            bestChoice.circuit.hours
        )
      ) {
        bestChoice = choice;
      }
    }

    if (stop()) {
      break;
    }

    // No model can build another rotation.
    if (!bestChoice) {
      break;
    }

    const {
      aircraft,
      circuit,
      eligibleDestinations
    } = bestChoice;

    const rotation = {
      id:
        `BOM-${String(
          groupIndex + 1
        ).padStart(3, "0")}`,

      model: aircraft.model,

      aircraftId: aircraft.id,

      eco: aircraft.eco,

      cargo: aircraft.cargo,

      ...circuit
    };

    // --------------------------------------------------------
    // Deduct this group's demand
    // --------------------------------------------------------

    for (const leg of rotation.legs) {
      const available = remaining.get(
        leg.routeId
      );

      available.eco -=
        2 * aircraft.eco;

      available.cargo -=
        2 * aircraft.cargo;

      // Avoid tiny floating-point negatives.
      available.eco = Math.max(
        0,
        available.eco
      );

      available.cargo = Math.max(
        0,
        available.cargo
      );
    }

    rotations.push(rotation);

    total += rotation.revenue;

    // --------------------------------------------------------
    // Update fleet summary
    // --------------------------------------------------------

    const summary =
      fleetSummary[aircraft.model];

    summary.groups++;

    summary.aircraftCount +=
      AIRCRAFT_PER_GROUP;

    summary.weeklyRevenue +=
      rotation.revenue;

    summary.services +=
      rotation.legs.length;

    summary.scheduledHours +=
      rotation.hours;

    // --------------------------------------------------------
    // Diagnostics
    // --------------------------------------------------------

    diagnostics.groups.push({
      id: rotation.id,

      model: aircraft.model,

      eligibleDestinations,

      services:
        rotation.legs.length,

      hours:
        rotation.hours,

      unusedHours:
        ROTATION_HOURS -
        rotation.hours,

      weeklyRevenue:
        rotation.revenue
    });

    onProgress({
      completed:
        rotations.length,

      total,

      rotation,

      fleetSummary
    });
  }

  // ----------------------------------------------------------
  // Network demand summary
  // ----------------------------------------------------------

  let startingEconomy = 0;
  let startingCargo = 0;

  let remainingEconomy = 0;
  let remainingCargo = 0;

  for (const route of data.routes) {
    startingEconomy += route.ecoDemand;
    startingCargo += route.cargoDemand;

    const available = remaining.get(route.id);

    remainingEconomy += available.eco;
    remainingCargo += available.cargo;
  }

  const demandSummary = {
    startingEconomy,
    startingCargo,

    remainingEconomy,
    remainingCargo,

    allocatedEconomy:
      startingEconomy - remainingEconomy,

    allocatedCargo:
      startingCargo - remainingCargo
  };

  // ----------------------------------------------------------
  // Final result
  // ----------------------------------------------------------

  return {
    rotations,

    total,

    remaining,

    validation,

    diagnostics,

    fleetSummary,

    demandSummary,

    scenario: SCENARIO,

    demandSource:
      "TOTAL_CURRENT_DEMAND",

    method:
      "mixed-fleet-greedy-bounded-knapsack",

    preflight:
      "NOT_RUN"
  };
}

// ============================================================
// 15. CSV EXPORT
// ============================================================

export function exportCSV(rows) {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return "";
  }

  const keys = Object.keys(rows[0]);

  function escapeCSV(value) {
    const text = String(value ?? "");

    return (
      '"' +
      text.replaceAll('"', '""') +
      '"'
    );
  }

  const header = keys
    .map(escapeCSV)
    .join(",");

  const lines = rows.map(row =>
    keys.map(key =>
      escapeCSV(row[key])
    ).join(",")
  );

  return [
    header,
    ...lines
  ].join("\r\n");
}

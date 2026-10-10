
/**
 * Airlines Manager BOM Rotation Optimiser
 * ======================================
 *
 * File: js/engine.js
 * Version: 0.3
 *
 * Fixed aircraft:
 *   Airbus A380-800
 *   852 Economy
 *   4 Cargo
 *
 * Each rotation group contains seven aircraft.
 *
 * Features:
 * - CSV parsing
 * - Airport category and range validation
 * - Fixed aircraft configuration
 * - Shared daily demand
 * - Multiple services to the same destination
 * - Bounded-knapsack route optimisation
 * - Maximum 168-hour rotations
 * - Weekly revenue estimation
 * - Optimisation diagnostics
 * - CSV export
 *
 * This is a read-only planning tool.
 * No game actions are performed.
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
  model: "A380-800",
  eco: 852,
  cargo: 4
});

export const ROTATION_HOURS = 168;

export const AIRCRAFT_PER_GROUP = 7;

export const ECONOMY_PAYLOAD_TONNES = 0.1;

// Each scheduling unit represents 15 minutes.
const QUARTERS = ROTATION_HOURS * 4;

// ============================================================
// 2. CSV PARSER
// ============================================================

export function csv(text) {
  const rows = [];

  let row = [];
  let cell = "";
  let quoted = false;

  // Remove UTF-8 BOM if present.
  text = String(text).replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const character = text[i];

    if (character === '"') {
      if (
        quoted &&
        text[i + 1] === '"'
      ) {
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

      if (
        row.some(value => value !== "")
      ) {
        rows.push(row);
      }

      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  // Handle final row.
  if (
    cell !== "" ||
    row.length > 0
  ) {
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
      record[header.trim()] =
        values[index] ?? "";
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

// ============================================================
// 4. FLIGHT DURATION
// ============================================================

/**
 * Calculate return flight duration.
 *
 * distance = one-way distance in kilometres
 * speed    = aircraft speed in km/h
 *
 * Formula:
 *
 * 2 * (distance / speed + 1)
 *
 * Round upwards to the nearest 15 minutes.
 */
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
// 5. PREPARE ROUTES AND AIRCRAFT
// ============================================================

export function prepare(
  routes,
  pricing,
  aircraft
) {
  // ----------------------------------------------------------
  // Build a lookup of successful pricing records.
  // ----------------------------------------------------------

  const pricingByRoute = new Map();

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

    pricingByRoute.set(
      routeId,
      record
    );
  }

  // ----------------------------------------------------------
  // Prepare eligible owned BOM routes.
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

    const price =
      pricingByRoute.get(routeId) ?? {};

    preparedRoutes.push({
      code: airportCode,

      id: routeId,

      distance: numeric(
        record.distance_km
      ),

      category: category(
        record.category
      ),

      ecoDemand: Math.max(
        0,
        numeric(
          price.remaining_demand_economy
        )
      ),

      cargoDemand: Math.max(
        0,
        numeric(
          price.remaining_demand_cargo
        )
      ),

      ecoFare: Math.max(
        0,
        numeric(
          price.current_price_economy
        )
      ),

      cargoFare: Math.max(
        0,
        numeric(
          price.current_price_cargo
        )
      )
    });
  }

  // ----------------------------------------------------------
  // Prepare aircraft catalogue.
  // ----------------------------------------------------------

  const preparedAircraft = [];

  for (const record of aircraft) {
    const aircraftRecord = {
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
        numeric(record.max_seats)
      ),

      payload: numeric(
        record.payload_tonnes
      )
    };

    if (
      aircraftRecord.category === null ||
      aircraftRecord.speed <= 0 ||
      aircraftRecord.payload <= 0 ||
      aircraftRecord.seats <= 0
    ) {
      continue;
    }

    preparedAircraft.push(
      aircraftRecord
    );
  }

  return {
    routes: preparedRoutes,
    aircraft: preparedAircraft
  };
}

// ============================================================
// 6. DATA VALIDATION
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
      `${invalidCategories.length} of ` +
      `${data.routes.length} routes have ` +
      "missing or invalid airport categories."
    );
  }

  return {
    routeCount: data.routes.length,

    aircraftCount: data.aircraft.length,

    invalidCategories: 0
  };
}

// ============================================================
// 7. AIRCRAFT / ROUTE ELIGIBILITY
// ============================================================

export function isEligible(
  aircraft,
  route
) {
  if (
    !Number.isInteger(
      route.category
    ) ||
    !Number.isInteger(
      aircraft.category
    )
  ) {
    return false;
  }

  if (
    route.category <
    aircraft.category
  ) {
    return false;
  }

  if (
    route.distance <= 0 ||
    route.distance > aircraft.range
  ) {
    return false;
  }

  if (aircraft.speed <= 0) {
    return false;
  }

  return true;
}

// ============================================================
// 8. REVENUE CALCULATION
// ============================================================

/**
 * Each seven-aircraft rotation group is staggered
 * by 24 hours.
 *
 * One base return flight therefore operates
 * seven times per week.
 *
 * Each return flight carries passengers and cargo
 * in both directions.
 */
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
      economyRevenue +
      cargoRevenue
  };
}

// ============================================================
// 9. DEMAND VALIDATION
// ============================================================

/**
 * Demand figures represent daily remaining demand.
 *
 * One base return flight in a seven-aircraft group
 * produces one daily return service.
 *
 * Daily demand consumed:
 *
 * Economy = 2 * economySeats
 * Cargo   = 2 * cargoUnits
 *
 * Multiple services multiply these requirements.
 */
export function hasDemand(
  remaining,
  routeId,
  eco,
  cargo,
  services = 1
) {
  const available =
    remaining.get(routeId);

  if (!available) {
    return false;
  }

  const economyRequired =
    services * 2 * eco;

  const cargoRequired =
    services * 2 * cargo;

  return (
    available.eco + 1e-8 >=
      economyRequired &&

    available.cargo + 1e-8 >=
      cargoRequired
  );
}

// ============================================================
// 10. BOUNDED KNAPSACK OPTIMISATION
// ============================================================

/**
 * Find the highest-revenue combination of return
 * flights that fits within 168 hours.
 *
 * Unlike the previous greedy algorithm:
 *
 * - A destination can appear multiple times.
 * - Each route has a maximum number of services.
 * - The maximum is determined by remaining demand.
 * - Flight durations use 15-minute increments.
 * - Revenue, not simply revenue/hour, is maximised.
 *
 * Binary splitting converts bounded quantities into
 * a manageable number of 0/1 knapsack items.
 *
 * Persistent predecessor nodes preserve the selected
 * combination during dynamic programming.
 */
function bestCircuit(
  options,
  stop
) {
  // ----------------------------------------------------------
  // Convert route capacities into bounded bundles.
  // ----------------------------------------------------------

  const bundles = [];

  for (const option of options) {
    let remainingCount =
      option.maxServices;

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

        weight:
          option.quarters * take,

        value:
          option.revenue * take
      });

      remainingCount -= take;
    }
  }

  // ----------------------------------------------------------
  // Initialise dynamic programming arrays.
  // ----------------------------------------------------------

  const dp = new Float64Array(
    QUARTERS + 1
  );

  dp.fill(-Infinity);

  dp[0] = 0;

  const paths = Array(
    QUARTERS + 1
  ).fill(null);

  // ----------------------------------------------------------
  // Process each bounded bundle.
  // ----------------------------------------------------------

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

      if (
        !Number.isFinite(
          previousRevenue
        )
      ) {
        continue;
      }

      const candidateRevenue =
        previousRevenue +
        bundle.value;

      if (
        candidateRevenue >
        dp[time] + 1e-7
      ) {
        dp[time] =
          candidateRevenue;

        paths[time] = {
          bundle,

          previous:
            paths[
              time - bundle.weight
            ]
        };
      }
    }
  }

  // ----------------------------------------------------------
  // Find the highest-revenue duration.
  // ----------------------------------------------------------

  let bestTime = 0;

  for (
    let time = 1;
    time <= QUARTERS;
    time++
  ) {
    const betterRevenue =
      dp[time] >
      dp[bestTime] + 1e-7;

    const equalRevenue =
      Math.abs(
        dp[time] -
        dp[bestTime]
      ) <= 1e-7;

    if (
      betterRevenue ||
      (
        equalRevenue &&
        time > bestTime
      )
    ) {
      bestTime = time;
    }
  }

  if (
    !(dp[bestTime] > 0)
  ) {
    return null;
  }

  // ----------------------------------------------------------
  // Reconstruct the selected return services.
  // ----------------------------------------------------------

  const selected = [];

  let node = paths[bestTime];

  while (node) {
    for (
      let i = 0;
      i < node.bundle.count;
      i++
    ) {
      selected.push(
        node.bundle.option
      );
    }

    node = node.previous;
  }

  // ----------------------------------------------------------
  // Sort the selected services for readable output.
  //
  // Ordering does not change total duration or revenue.
  // ----------------------------------------------------------

  selected.sort((a, b) => {
    const ratioA =
      a.revenue / a.quarters;

    const ratioB =
      b.revenue / b.quarters;

    return (
      ratioB - ratioA ||
      a.route.code.localeCompare(
        b.route.code
      )
    );
  });

  // ----------------------------------------------------------
  // Build the rotation's ordered flight sequence.
  // ----------------------------------------------------------

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
// 11. MAIN OPTIMISER
// ============================================================

export function optimise(
  data,
  {
    groups = 20,

    onProgress = () => {},

    stop = () => false
  } = {}
) {
  // ----------------------------------------------------------
  // Validate imported data.
  // ----------------------------------------------------------

  const validation =
    validateData(data);

  // ----------------------------------------------------------
  // Select the fixed A380-800 aircraft.
  // ----------------------------------------------------------

  const aircraft =
    data.aircraft.find(
      item =>
        item.model ===
        FIXED_AIRCRAFT.model
    );

  if (!aircraft) {
    throw new Error(
      "A380-800 is missing from usable aircraft.csv records."
    );
  }

  const {
    eco,
    cargo
  } = FIXED_AIRCRAFT;

  // ----------------------------------------------------------
  // Verify the aircraft configuration.
  // ----------------------------------------------------------

  const requiredPayload =
    eco *
    ECONOMY_PAYLOAD_TONNES +
    cargo;

  if (
    eco > aircraft.seats ||
    requiredPayload >
      aircraft.payload + 1e-7
  ) {
    throw new Error(
      "Fixed 852E + 4C exceeds the " +
      "A380-800 seat or payload limit."
    );
  }

  // ----------------------------------------------------------
  // Validate requested group count.
  // ----------------------------------------------------------

  const requestedGroups =
    Number(groups);

  if (
    !Number.isInteger(
      requestedGroups
    ) ||
    requestedGroups < 1
  ) {
    throw new Error(
      "Group count must be a positive integer."
    );
  }

  // ----------------------------------------------------------
  // Initialise remaining daily demand.
  // ----------------------------------------------------------

  const remaining = new Map();

  for (const route of data.routes) {
    remaining.set(
      route.id,
      {
        eco: route.ecoDemand,

        cargo: route.cargoDemand
      }
    );
  }

  // ----------------------------------------------------------
  // Initialise diagnostics.
  // ----------------------------------------------------------

  const diagnostics = {
    totalRoutes:
      data.routes.length,

    categoryAndRangeEligible: 0,

    fareEligible: 0,

    initialDemandEligible: 0,

    groups: []
  };

  // ----------------------------------------------------------
  // Prepare all potentially eligible routes.
  // ----------------------------------------------------------

  const candidates = [];

  for (const route of data.routes) {
    if (
      !isEligible(
        aircraft,
        route
      )
    ) {
      continue;
    }

    diagnostics
      .categoryAndRangeEligible++;

    if (
      route.ecoFare <= 0
    ) {
      continue;
    }

    diagnostics.fareEligible++;

    const hours = duration(
      route.distance,
      aircraft.speed
    );

    if (
      hours > ROTATION_HOURS
    ) {
      continue;
    }

    const revenue =
      calculateLegRevenue(
        route,
        eco,
        cargo
      ).totalRevenue;

    candidates.push({
      route,

      hours,

      quarters:
        Math.round(hours * 4),

      revenue
    });

    if (
      hasDemand(
        remaining,
        route.id,
        eco,
        cargo
      )
    ) {
      diagnostics
        .initialDemandEligible++;
    }
  }

  // ----------------------------------------------------------
  // Generate rotation groups.
  // ----------------------------------------------------------

  const rotations = [];

  let total = 0;

  for (
    let groupIndex = 0;
    groupIndex < requestedGroups &&
      !stop();
    groupIndex++
  ) {
    const options = [];

    // --------------------------------------------------------
    // Calculate how many services each destination supports.
    // --------------------------------------------------------

    for (const candidate of candidates) {
      const available =
        remaining.get(
          candidate.route.id
        );

      const maxEconomyServices =
        Math.floor(
          (
            available.eco +
            1e-8
          ) /
          (2 * eco)
        );

      const maxCargoServices =
        Math.floor(
          (
            available.cargo +
            1e-8
          ) /
          (2 * cargo)
        );

      const maxTimeServices =
        Math.floor(
          QUARTERS /
          candidate.quarters
        );

      const maxServices =
        Math.min(
          maxEconomyServices,
          maxCargoServices,
          maxTimeServices
        );

      if (
        maxServices > 0
      ) {
        options.push({
          ...candidate,

          maxServices
        });
      }
    }

    // --------------------------------------------------------
    // Find the highest-revenue feasible circuit.
    // --------------------------------------------------------

    const circuit =
      bestCircuit(
        options,
        stop
      );

    if (!circuit) {
      break;
    }

    // --------------------------------------------------------
    // Create the rotation group.
    // --------------------------------------------------------

    const rotation = {
      id:
        `BOM-${String(
          groupIndex + 1
        ).padStart(3, "0")}`,

      model:
        aircraft.model,

      aircraftId:
        aircraft.id,

      eco,

      cargo,

      ...circuit
    };

    // --------------------------------------------------------
    // Consume daily demand across all seven aircraft.
    // --------------------------------------------------------

    for (
      const leg of rotation.legs
    ) {
      const available =
        remaining.get(
          leg.routeId
        );

      available.eco -=
        2 * eco;

      available.cargo -=
        2 * cargo;
    }

    // --------------------------------------------------------
    // Save the rotation.
    // --------------------------------------------------------

    rotations.push(
      rotation
    );

    total +=
      rotation.revenue;

    // --------------------------------------------------------
    // Save diagnostic information.
    // --------------------------------------------------------

    diagnostics.groups.push({
      id:
        rotation.id,

      eligibleDestinations:
        options.length,

      services:
        rotation.legs.length,

      hours:
        rotation.hours,

      unusedHours:
        ROTATION_HOURS -
        rotation.hours
    });

    // --------------------------------------------------------
    // Notify the interface.
    // --------------------------------------------------------

    onProgress({
      completed:
        rotations.length,

      total,

      rotation
    });
  }

  // ----------------------------------------------------------
  // Return complete optimisation results.
  // ----------------------------------------------------------

  return {
    rotations,

    total,

    remaining,

    validation,

    diagnostics,

    method:
      "fixed-a380-bounded-knapsack",

    preflight:
      "NOT_RUN"
  };
}

// ============================================================
// 12. CSV EXPORT
// ============================================================

export function exportCSV(rows) {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return "";
  }

  const keys =
    Object.keys(rows[0]);

  function escapeCSV(value) {
    const text =
      String(value ?? "");

    return (
      '"' +
      text.replaceAll(
        '"',
        '""'
      ) +
      '"'
    );
  }

  const header =
    keys.map(
      escapeCSV
    ).join(",");

  const lines =
    rows.map(row =>
      keys.map(
        key =>
          escapeCSV(
            row[key]
          )
      ).join(",")
    );

  return [
    header,
    ...lines
  ].join("\r\n");
}

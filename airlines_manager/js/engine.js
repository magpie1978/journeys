
/**
 * BOM Rotation Optimiser — engine.js v0.7
 *
 * Objective: maximum weekly gross revenue.
 * No aircraft acquisition budget.
 * Seven aircraft per group.
 * Maximum rotation: 168 hours.
 *
 * Greedy baseline + conservative pairwise improvement.
 */

export const EXCLUDED = new Set([
  "BKK", "CGK", "DEL", "MPM"
]);

export const FIXED_AIRCRAFT = Object.freeze({
  "A380-800": { eco: 852, cargo: 4 },
  "A350-900ULR": { eco: 430, cargo: 1 }
});

export const SCENARIO = "REBUILD_FROM_SCRATCH";
export const ROTATION_HOURS = 168;
export const AIRCRAFT_PER_GROUP = 7;
export const ECONOMY_PAYLOAD_TONNES = 0.1;

const QUARTERS = ROTATION_HOURS * 4;
const EPSILON = 1e-7;

// ============================================================
// CSV
// ============================================================

export function csv(text) {
  text = String(text).replace(/^\uFEFF/, "");

  const rows = [];
  let current = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c === "," && !quoted) {
      current.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      current.push(value);

      if (current.some(x => x !== "")) rows.push(current);

      current = [];
      value = "";
    } else {
      value += c;
    }
  }

  if (value !== "" || current.length) {
    current.push(value);
    rows.push(current);
  }

  if (!rows.length) return [];

  const [headers, ...records] = rows;

  return records.map(values =>
    Object.fromEntries(
      headers.map((header, i) => [
        header.trim(),
        values[i] ?? ""
      ])
    )
  );
}

function numeric(value, fallback = 0) {
  if (value == null || String(value).trim() === "") {
    return fallback;
  }

  const result = Number(
    String(value).replaceAll(",", "").trim()
  );

  return Number.isFinite(result) ? result : fallback;
}

function validNumber(value) {
  return Number.isFinite(numeric(value, NaN));
}

function category(value) {
  const n = numeric(value, NaN);
  return Number.isInteger(n) && n >= 1 && n <= 10
    ? n
    : null;
}

// ============================================================
// PREPARE DATA
// ============================================================

export function prepare(routes, pricing, aircraft) {
  const pricingByRoute = new Map();

  for (const p of pricing) {
    if (String(p.status ?? "").trim().toLowerCase() !== "ok") {
      continue;
    }

    const id = String(p.route_id ?? "").trim();

    if (id) pricingByRoute.set(id, p);
  }

  const preparedRoutes = [];

  for (const r of routes) {
    const ownership = String(
      r.ownership_status ?? ""
    ).trim().toLowerCase();

    const code = String(
      r.airport_code ?? ""
    ).trim().toUpperCase();

    if (ownership !== "owned" || EXCLUDED.has(code)) {
      continue;
    }

    const id = String(r.route_id ?? "").trim();
    const p = pricingByRoute.get(id);

    const pricingValid =
      !!p &&
      validNumber(p.current_demand_economy) &&
      validNumber(p.current_demand_cargo);

    preparedRoutes.push({
      id,
      code,
      distance: numeric(r.distance_km),
      category: category(r.category),
      ecoDemand: pricingValid
        ? Math.max(0, numeric(p.current_demand_economy))
        : 0,
      cargoDemand: pricingValid
        ? Math.max(0, numeric(p.current_demand_cargo))
        : 0,
      ecoFare: Math.max(
        0, numeric(p?.current_price_economy)
      ),
      cargoFare: Math.max(
        0, numeric(p?.current_price_cargo)
      ),
      pricingValid
    });
  }

  const preparedAircraft = [];

  for (const a of aircraft) {
    const item = {
      id: String(a.aircraft_id ?? "").trim(),
      model: String(a.model ?? "").trim(),
      category: category(a.category),
      range: numeric(a.range_km),
      speed: numeric(a.speed_kmh),
      seats: Math.floor(numeric(a.max_seats)),
      payload: numeric(a.payload_tonnes)
    };

    if (
      !item.model ||
      item.category === null ||
      item.range <= 0 ||
      item.speed <= 0 ||
      item.seats < 0 ||
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
// AIRCRAFT CONFIGURATIONS
// ============================================================

export function configureAircraft(a) {
  const fixed = FIXED_AIRCRAFT[a.model];

  let eco;
  let cargo;
  let configurationMode;

  if (fixed) {
    eco = fixed.eco;
    cargo = fixed.cargo;
    configurationMode = "FIXED";
  } else if (a.seats === 0) {
    eco = 0;
    cargo = Math.floor(a.payload + EPSILON);
    configurationMode = "AUTO_CARGO_ONLY";
  } else {
    eco = Math.min(
      a.seats,
      Math.floor(
        (a.payload + EPSILON) / ECONOMY_PAYLOAD_TONNES
      )
    );

    cargo = Math.max(
      0,
      Math.floor(
        a.payload - eco * ECONOMY_PAYLOAD_TONNES + EPSILON
      )
    );

    configurationMode = "AUTO_ECONOMY_FIRST";
  }

  const requiredPayload =
    eco * ECONOMY_PAYLOAD_TONNES + cargo;

  if (
    eco < 0 ||
    eco > a.seats ||
    (a.seats > 0 && eco === 0) ||
    (eco === 0 && cargo === 0) ||
    cargo < 0 ||
    requiredPayload > a.payload + EPSILON
  ) {
    throw new Error(
      `Invalid aircraft configuration: ${a.model}`
    );
  }

  return {
    ...a,
    eco,
    cargo,
    requiredPayload,
    configurationMode
  };
}

export function getSupportedAircraft(data) {
  const models = new Map();

  for (const a of data.aircraft) {
    if (models.has(a.model)) {
      const old = models.get(a.model);

      for (const field of [
        "category", "range", "speed", "seats", "payload"
      ]) {
        if (old[field] !== a[field]) {
          throw new Error(
            `Conflicting aircraft specifications: ${a.model}`
          );
        }
      }
    } else {
      models.set(a.model, a);
    }
  }

  for (const model of Object.keys(FIXED_AIRCRAFT)) {
    if (!models.has(model)) {
      throw new Error(`Missing fixed aircraft: ${model}`);
    }
  }

  return [...models.values()].map(configureAircraft);
}

// ============================================================
// VALIDATION
// ============================================================

export function validateData(data) {
  if (!data?.routes?.length) {
    throw new Error("No eligible owned routes.");
  }

  if (!data?.aircraft?.length) {
    throw new Error("No usable aircraft.");
  }

  if (data.routes.some(r => r.category === null)) {
    throw new Error("Invalid route airport category.");
  }

  const missingTotalDemand =
    data.routes.filter(r => !r.pricingValid).length;

  if (missingTotalDemand === data.routes.length) {
    throw new Error("No valid pricing/demand records.");
  }

  const routeIds = new Set();

  for (const route of data.routes) {
    if (!route.id || routeIds.has(route.id)) {
      throw new Error(
        `Missing or duplicate route ID: ${route.id}`
      );
    }
    routeIds.add(route.id);
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
// ROUTE ELIGIBILITY AND REVENUE
// ============================================================

export function isEligible(a, r) {
  return (
    r.category !== null &&
    a.category !== null &&
    r.category >= a.category &&
    r.distance > 0 &&
    r.distance <= a.range &&
    a.speed > 0
  );
}

export function duration(distance, speed) {
  if (!(distance > 0) || !(speed > 0)) {
    return Infinity;
  }

  return Math.ceil(
    2 * (distance / speed + 1) * 4
  ) / 4;
}

export function calculateLegRevenue(r, eco, cargo) {
  const economyRevenue =
    AIRCRAFT_PER_GROUP * 2 * eco * r.ecoFare;

  const cargoRevenue =
    AIRCRAFT_PER_GROUP * 2 * cargo * r.cargoFare;

  return {
    economyRevenue,
    cargoRevenue,
    totalRevenue: economyRevenue + cargoRevenue
  };
}

export function hasDemand(
  remaining, routeId, eco, cargo, services = 1
) {
  const d = remaining.get(routeId);

  return !!d &&
    d.eco + EPSILON >= services * 2 * eco &&
    d.cargo + EPSILON >= services * 2 * cargo;
}

function maximumServices(d, a, quarters) {
  if (!d || quarters <= 0 || quarters > QUARTERS) {
    return 0;
  }

  const ecoLimit = a.eco > 0
    ? Math.floor((d.eco + EPSILON) / (2 * a.eco))
    : Infinity;

  const cargoLimit = a.cargo > 0
    ? Math.floor((d.cargo + EPSILON) / (2 * a.cargo))
    : Infinity;

  return Math.max(
    0,
    Math.min(
      ecoLimit,
      cargoLimit,
      Math.floor(QUARTERS / quarters)
    )
  );
}

// ============================================================
// CANDIDATES
// ============================================================

function buildCandidates(routes, aircraft) {
  const candidates = [];

  const stats = {
    categoryAndRangeEligible: 0,
    fareEligible: 0,
    demandEligible: 0
  };

  for (const route of routes) {
    if (!isEligible(aircraft, route)) continue;

    stats.categoryAndRangeEligible++;

    if (
      !route.pricingValid ||
      (aircraft.eco > 0 && route.ecoFare <= 0) ||
      (aircraft.cargo > 0 && route.cargoFare <= 0)
    ) {
      continue;
    }

    const hours = duration(
      route.distance, aircraft.speed
    );

    if (hours > ROTATION_HOURS) continue;

    stats.fareEligible++;

    const revenue = calculateLegRevenue(
      route, aircraft.eco, aircraft.cargo
    ).totalRevenue;

    if (!(revenue > 0)) continue;

    candidates.push({
      route,
      hours,
      quarters: Math.round(hours * 4),
      revenue
    });

    if (
      route.ecoDemand + EPSILON >= 2 * aircraft.eco &&
      route.cargoDemand + EPSILON >= 2 * aircraft.cargo
    ) {
      stats.demandEligible++;
    }
  }

  return { candidates, stats };
}

function buildOptions(candidates, aircraft, remaining) {
  const options = [];

  for (const candidate of candidates) {
    const maxServices = maximumServices(
      remaining.get(candidate.route.id),
      aircraft,
      candidate.quarters
    );

    if (maxServices > 0) {
      options.push({ ...candidate, maxServices });
    }
  }

  return options;
}

// ============================================================
// FRACTIONAL UPPER BOUND
// ============================================================

function revenueUpperBound(options) {
  const sorted = [...options].sort(
    (a, b) =>
      b.revenue / b.quarters -
      a.revenue / a.quarters
  );

  let capacity = QUARTERS;
  let revenue = 0;

  for (const option of sorted) {
    if (capacity <= 0) break;

    const weight = Math.min(
      capacity,
      option.quarters * option.maxServices
    );

    revenue +=
      weight / option.quarters * option.revenue;

    capacity -= weight;
  }

  return revenue;
}

// ============================================================
// BOUNDED KNAPSACK
// ============================================================

function bestCircuit(options, stop = () => false) {
  if (!options.length) return null;

  const bundles = [];

  for (const option of options) {
    let remainingCount = option.maxServices;

    for (
      let size = 1;
      remainingCount > 0;
      size *= 2
    ) {
      const take = Math.min(size, remainingCount);

      bundles.push({
        option,
        count: take,
        weight: option.quarters * take,
        value: option.revenue * take
      });

      remainingCount -= take;
    }
  }

  const dp = new Float64Array(QUARTERS + 1);
  dp.fill(-Infinity);
  dp[0] = 0;

  // Immutable path nodes preserve the correct
  // knapsack reconstruction as dp changes.
  const paths = Array(QUARTERS + 1).fill(null);

  for (const bundle of bundles) {
    if (stop()) return null;

    for (
      let t = QUARTERS;
      t >= bundle.weight;
      t--
    ) {
      const previous = dp[t - bundle.weight];

      if (!Number.isFinite(previous)) continue;

      const value = previous + bundle.value;

      if (value > dp[t] + EPSILON) {
        dp[t] = value;

        paths[t] = {
          bundle,
          previous: paths[t - bundle.weight]
        };
      }
    }
  }

  let bestTime = 0;

  for (let t = 1; t <= QUARTERS; t++) {
    if (
      dp[t] > dp[bestTime] + EPSILON ||
      (
        Math.abs(dp[t] - dp[bestTime]) <= EPSILON &&
        t > bestTime
      )
    ) {
      bestTime = t;
    }
  }

  if (!(dp[bestTime] > 0)) return null;

  const selected = [];
  let node = paths[bestTime];

  while (node) {
    for (let i = 0; i < node.bundle.count; i++) {
      selected.push(node.bundle.option);
    }

    node = node.previous;
  }

  selected.sort(
    (a, b) =>
      b.revenue / b.hours -
      a.revenue / a.hours ||
      a.route.code.localeCompare(b.route.code)
  );

  const legs = [];
  let hours = 0;

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
// DEMAND ALLOCATION
// ============================================================

function adjustDemand(remaining, rotation, direction) {
  for (const leg of rotation.legs) {
    const d = remaining.get(leg.routeId);

    if (!d) {
      throw new Error(
        `Unknown route in rotation: ${leg.routeId}`
      );
    }

    d.eco += direction * 2 * rotation.eco;
    d.cargo += direction * 2 * rotation.cargo;
  }
}

function canAllocate(remaining, rotation) {
  const required = new Map();

  for (const leg of rotation.legs) {
    const current = required.get(leg.routeId) ?? {
      eco: 0,
      cargo: 0
    };

    current.eco += 2 * rotation.eco;
    current.cargo += 2 * rotation.cargo;

    required.set(leg.routeId, current);
  }

  for (const [id, need] of required) {
    const available = remaining.get(id);

    if (
      !available ||
      available.eco + EPSILON < need.eco ||
      available.cargo + EPSILON < need.cargo
    ) {
      return false;
    }
  }

  return true;
}

// ============================================================
// v0.7 PAIRWISE IMPROVEMENT
// ============================================================

function improveRotations(
  rotations,
  remaining,
  aircraftList,
  fleetCandidates,
  stop = () => false,
  maxPasses = 3
) {
  const aircraftByModel = new Map(
    aircraftList.map(a => [a.model, a])
  );

  const baselineTotal = rotations.reduce(
    (sum, r) => sum + r.revenue, 0
  );

  let improvements = 0;
  let pairsTested = 0;

  function rebuild(original) {
    const aircraft = aircraftByModel.get(original.model);

    if (!aircraft) return null;

    const options = buildOptions(
      fleetCandidates.get(original.model) ?? [],
      aircraft,
      remaining
    );

    const circuit = bestCircuit(options, stop);

    return circuit
      ? { ...original, ...circuit }
      : null;
  }

  function tryPair(i, j) {
    const originalA = rotations[i];
    const originalB = rotations[j];

    const originalRevenue =
      originalA.revenue + originalB.revenue;

    // Release both rotations into available demand.
    adjustDemand(remaining, originalA, +1);
    adjustDemand(remaining, originalB, +1);

    let bestPair = null;
    let bestRevenue = originalRevenue;

    try {
      const orders = [
        [originalA, originalB],
        [originalB, originalA]
      ];

      for (const order of orders) {
        if (stop()) break;

        const first = rebuild(order[0]);

        if (
          !first ||
          !canAllocate(remaining, first)
        ) {
          continue;
        }

        adjustDemand(remaining, first, -1);

        let second;

        try {
          second = rebuild(order[1]);
        } finally {
          adjustDemand(remaining, first, +1);
        }

        if (!second) continue;

        // Check the pair together, not just each
        // rotation independently.
        adjustDemand(remaining, first, -1);

        const secondFits = canAllocate(
          remaining, second
        );

        adjustDemand(remaining, first, +1);

        if (!secondFits) continue;

        const candidateRevenue =
          first.revenue + second.revenue;

        if (candidateRevenue > bestRevenue + EPSILON) {
          bestRevenue = candidateRevenue;

          bestPair = order[0] === originalA
            ? [first, second]
            : [second, first];
        }
      }

      if (bestPair && !stop()) {
        adjustDemand(remaining, bestPair[0], -1);
        adjustDemand(remaining, bestPair[1], -1);

        rotations[i] = bestPair[0];
        rotations[j] = bestPair[1];

        improvements++;
        return true;
      }

      // No improvement: restore original demand.
      adjustDemand(remaining, originalA, -1);
      adjustDemand(remaining, originalB, -1);

      return false;
    } catch (error) {
      // Restore demand before propagating errors.
      adjustDemand(remaining, originalA, -1);
      adjustDemand(remaining, originalB, -1);
      throw error;
    }
  }

  const windowSize = Math.min(80, rotations.length);
  const firstIndex = rotations.length - windowSize;

  for (let pass = 0; pass < maxPasses; pass++) {
    if (stop()) break;

    let changed = false;

    for (
      let i = firstIndex;
      i < rotations.length - 1;
      i++
    ) {
      if (stop()) break;

      for (const offset of [1, 2, 5, 10]) {
        const j = i + offset;

        if (j >= rotations.length) continue;

        pairsTested++;

        if (tryPair(i, j)) changed = true;
      }
    }

    if (!changed) break;
  }

  const improvedTotal = rotations.reduce(
    (sum, r) => sum + r.revenue, 0
  );

  return {
    baselineTotal,
    improvedTotal,
    gain: improvedTotal - baselineTotal,
    improvements,
    pairsTested
  };
}

// ============================================================
// MAIN OPTIMISER
// ============================================================

export function optimise(
  data,
  {
    groups = null,
    onProgress = () => {},
    stop = () => false
  } = {}
) {
  const validation = validateData(data);
  const aircraftList = getSupportedAircraft(data);

  const unlimited = groups === null || groups === "";

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

  const remaining = new Map();

  for (const route of data.routes) {
    remaining.set(route.id, {
      eco: route.ecoDemand,
      cargo: route.cargoDemand
    });
  }

  const fleetCandidates = new Map();
  const fleetSummary = {};
  const aircraftDiagnostics = {};

  for (const aircraft of aircraftList) {
    const prepared = buildCandidates(
      data.routes, aircraft
    );

    fleetCandidates.set(
      aircraft.model,
      prepared.candidates
    );

    aircraftDiagnostics[aircraft.model] = {
      configuration:
        `${aircraft.eco}E + ${aircraft.cargo}C`,
      configurationMode: aircraft.configurationMode,
      category: aircraft.category,
      range: aircraft.range,
      speed: aircraft.speed,
      ...prepared.stats
    };

    fleetSummary[aircraft.model] = {
      model: aircraft.model,
      eco: aircraft.eco,
      cargo: aircraft.cargo,
      configurationMode: aircraft.configurationMode,
      groups: 0,
      aircraftCount: 0,
      weeklyRevenue: 0,
      services: 0,
      scheduledHours: 0
    };
  }

  const diagnostics = {
    scenario: SCENARIO,
    totalRoutes: data.routes.length,
    aircraftModels: aircraftList.length,
    missingTotalDemand: validation.missingTotalDemand,
    aircraft: aircraftDiagnostics,
    groups: []
  };

  const rotations = [];
  let total = 0;

  // ==========================================================
  // GREEDY BASELINE
  // ==========================================================

  for (
    let groupIndex = 0;
    groupIndex < requestedGroups && !stop();
    groupIndex++
  ) {
    const evaluations = [];

    for (const aircraft of aircraftList) {
      const candidates =
        fleetCandidates.get(aircraft.model) ?? [];

      const options = buildOptions(
        candidates,
        aircraft,
        remaining
      );

      if (!options.length) continue;

      evaluations.push({
        aircraft,
        options,
        upperBound: revenueUpperBound(options)
      });
    }

    evaluations.sort(
      (a, b) => b.upperBound - a.upperBound
    );

    let bestChoice = null;

    for (const evaluation of evaluations) {
      if (stop()) break;

      if (
        bestChoice &&
        evaluation.upperBound <=
          bestChoice.circuit.revenue + EPSILON
      ) {
        break;
      }

      const circuit = bestCircuit(
        evaluation.options, stop
      );

      if (!circuit) continue;

      if (
        !bestChoice ||
        circuit.revenue >
          bestChoice.circuit.revenue + EPSILON ||
        (
          Math.abs(
            circuit.revenue - bestChoice.circuit.revenue
          ) <= EPSILON &&
          circuit.hours > bestChoice.circuit.hours
        )
      ) {
        bestChoice = {
          aircraft: evaluation.aircraft,
          circuit,
          eligibleDestinations:
            evaluation.options.length
        };
      }
    }

    if (stop() || !bestChoice) break;

    const { aircraft, circuit } = bestChoice;

    const rotation = {
      id: `BOM-${String(
        groupIndex + 1
      ).padStart(3, "0")}`,
      model: aircraft.model,
      aircraftId: aircraft.id,
      eco: aircraft.eco,
      cargo: aircraft.cargo,
      configurationMode: aircraft.configurationMode,
      ...circuit
    };

    if (!canAllocate(remaining, rotation)) {
      throw new Error(
        `Demand exceeded by ${rotation.id}`
      );
    }

    adjustDemand(remaining, rotation, -1);

    rotations.push(rotation);
    total += rotation.revenue;

    onProgress({
      completed: rotations.length,
      total,
      rotation
    });
  }

  // ==========================================================
  // PAIRWISE NETWORK IMPROVEMENT
  // ==========================================================

  const improvement = improveRotations(
    rotations,
    remaining,
    aircraftList,
    fleetCandidates,
    stop,
    3
  );

  total = improvement.improvedTotal;

  // ==========================================================
  // REBUILD FLEET SUMMARY
  // ==========================================================

  for (const rotation of rotations) {
    const summary = fleetSummary[rotation.model];

    summary.groups++;
    summary.aircraftCount += AIRCRAFT_PER_GROUP;
    summary.weeklyRevenue += rotation.revenue;
    summary.services += rotation.legs.length;
    summary.scheduledHours += rotation.hours;
  }

  diagnostics.groups = rotations.map(rotation => ({
    id: rotation.id,
    model: rotation.model,
    services: rotation.legs.length,
    hours: rotation.hours,
    unusedHours: ROTATION_HOURS - rotation.hours,
    weeklyRevenue: rotation.revenue
  }));

  diagnostics.improvement = improvement;

  // ==========================================================
  // DEMAND SUMMARY
  // ==========================================================

  let startingEconomy = 0;
  let startingCargo = 0;
  let remainingEconomy = 0;
  let remainingCargo = 0;

  for (const route of data.routes) {
    startingEconomy += route.ecoDemand;
    startingCargo += route.cargoDemand;

    const available = remaining.get(route.id);

    if (
      available.eco < -EPSILON ||
      available.cargo < -EPSILON
    ) {
      throw new Error(
        `Negative demand remaining on ${route.code}`
      );
    }

    remainingEconomy += available.eco;
    remainingCargo += available.cargo;
  }

  // ==========================================================
  // FINAL RESULTS
  // ==========================================================

  return {
    rotations,
    total,
    improvement,
    remaining,
    validation,
    diagnostics,
    fleetSummary,

    demandSummary: {
      startingEconomy,
      startingCargo,
      remainingEconomy,
      remainingCargo,
      allocatedEconomy:
        startingEconomy - remainingEconomy,
      allocatedCargo:
        startingCargo - remainingCargo
    },

    scenario: SCENARIO,
    demandSource: "TOTAL_CURRENT_DEMAND",
    method: "greedy-knapsack-with-pairwise-improvement",
    preflight: "NOT_RUN"
  };
}

// ============================================================
// CSV EXPORT
// ============================================================

export function exportCSV(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";

  const keys = Object.keys(rows[0]);

  const escape = value =>
    '"' +
    String(value ?? "").replaceAll('"', '""') +
    '"';

  return [
    keys.map(escape).join(","),
    ...rows.map(row =>
      keys.map(key => escape(row[key])).join(",")
    )
  ].join("\r\n");
}

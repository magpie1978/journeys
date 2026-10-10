
/**
 * Airlines Manager Rotation Optimiser
 * ===================================
 *
 * Version: 0.1.1
 *
 * Browser-based, read-only optimisation engine.
 *
 * Features:
 * - CSV parsing
 * - BOM route exclusions
 * - Airport category and aircraft eligibility checks
 * - Economy/Cargo aircraft configurations
 * - Passenger-first payload allocation
 * - Seven-aircraft rotation groups
 * - Maximum 168-hour rotations
 * - Shared daily demand across all rotations
 * - Greedy revenue optimisation
 * - CSV export
 *
 * IMPORTANT:
 * This is a baseline heuristic, not a globally optimal solver.
 * Aircraft configurations are inferred from payload data.
 * Game preflight validation is still required.
 *
 * No game purchases, audits, schedules or fare changes occur.
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

export const ROTATION_HOURS = 168;
export const AIRCRAFT_PER_GROUP = 7;

export const MIN_AIRPORT_CATEGORY = 1;
export const MAX_AIRPORT_CATEGORY = 10;

export const MIN_CARGO_UNITS = 1;

// Economy passenger payload assumption: 0.1 tonnes per seat.
export const ECONOMY_PAYLOAD_TONNES = 0.1;

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
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (
      (character === "\n" || character === "\r") &&
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

function parseNumber(value, fallback = 0) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  const number = Number(
    String(value).replace(/,/g, "").trim()
  );

  return Number.isFinite(number)
    ? number
    : fallback;
}

function parseCategory(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const category = Number(value);

  if (
    !Number.isInteger(category) ||
    category < MIN_AIRPORT_CATEGORY ||
    category > MAX_AIRPORT_CATEGORY
  ) {
    return null;
  }

  return category;
}

// ============================================================
// 4. FLIGHT DURATION
// ============================================================

/**
 * Calculate the duration of a return flight.
 *
 * distance = one-way kilometres
 * speed    = aircraft speed in km/h
 *
 * Formula:
 *
 * 2 * (distance / speed + 1)
 *
 * Rounded upwards to the nearest 15 minutes.
 */
export function duration(distance, speed) {
  if (
    !Number.isFinite(distance) ||
    !Number.isFinite(speed) ||
    distance <= 0 ||
    speed <= 0
  ) {
    return Infinity;
  }

  const roundTripHours =
    2 * (distance / speed + 1);

  return Math.ceil(roundTripHours * 4) / 4;
}

// ============================================================
// 5. PREPARE DATA
// ============================================================

/**
 * Convert imported CSV records into optimiser data.
 *
 * The interface is deliberately unchanged:
 *
 * prepare(routes, pricing, aircraft)
 *
 * This maintains compatibility with the existing app.js.
 */
export function prepare(routes, pricing, aircraft) {
  const pricingMap = new Map();

  for (const record of pricing) {
    if (
      String(record.status).trim().toLowerCase() !== "ok"
    ) {
      continue;
    }

    const routeId = String(record.route_id).trim();

    if (routeId) {
      pricingMap.set(routeId, record);
    }
  }

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

    const pricingRecord =
      pricingMap.get(routeId) ?? {};

    preparedRoutes.push({
      code: airportCode,
      id: routeId,

      distance: parseNumber(record.distance_km),

      // Missing or invalid categories remain null.
      category: parseCategory(record.category),

      ecoDemand: Math.max(
        0,
        parseNumber(
          pricingRecord.remaining_demand_economy
        )
      ),

      cargoDemand: Math.max(
        0,
        parseNumber(
          pricingRecord.remaining_demand_cargo
        )
      ),

      ecoFare: Math.max(
        0,
        parseNumber(
          pricingRecord.current_price_economy
        )
      ),

      cargoFare: Math.max(
        0,
        parseNumber(
          pricingRecord.current_price_cargo
        )
      )
    });
  }

  const preparedAircraft = [];

  for (const record of aircraft) {
    const aircraftRecord = {
      id: String(record.aircraft_id ?? "").trim(),
      model: String(record.model ?? "").trim(),

      category: parseCategory(record.category),

      range: parseNumber(record.range_km),
      speed: parseNumber(record.speed_kmh),

      seats: Math.floor(
        parseNumber(record.max_seats)
      ),

      payload: parseNumber(record.payload_tonnes)
    };

    if (
      aircraftRecord.category === null ||
      aircraftRecord.range <= 0 ||
      aircraftRecord.speed <= 0 ||
      aircraftRecord.seats <= 0 ||
      aircraftRecord.payload <= 0
    ) {
      continue;
    }

    preparedAircraft.push(aircraftRecord);
  }

  return {
    routes: preparedRoutes,
    aircraft: preparedAircraft
  };
}

// ============================================================
// 6. VALIDATE INPUT DATA
// ============================================================

export function validateData(data) {
  if (!data || !Array.isArray(data.routes)) {
    throw new Error(
      "Route data is missing or invalid."
    );
  }

  if (!Array.isArray(data.aircraft)) {
    throw new Error(
      "Aircraft data is missing or invalid."
    );
  }

  if (data.routes.length === 0) {
    throw new Error(
      "No eligible owned routes were loaded."
    );
  }

  if (data.aircraft.length === 0) {
    throw new Error(
      "No usable aircraft models were loaded."
    );
  }

  const invalidCategories = data.routes.filter(
    route => (
      !Number.isInteger(route.category) ||
      route.category < MIN_AIRPORT_CATEGORY ||
      route.category > MAX_AIRPORT_CATEGORY
    )
  );

  if (invalidCategories.length > 0) {
    throw new Error(
      `${invalidCategories.length} of ` +
      `${data.routes.length} routes have missing or ` +
      `invalid airport categories. ` +
      `Repair the category column in routes.csv ` +
      `before running the optimiser.`
    );
  }

  const validRoutes = data.routes.filter(route => (
    route.distance > 0 &&
    route.ecoFare > 0 &&
    route.ecoDemand > 0
  ));

  if (validRoutes.length === 0) {
    throw new Error(
      "No routes have positive Economy fares, " +
      "Economy demand and valid distances."
    );
  }

  return {
    routeCount: data.routes.length,
    aircraftCount: data.aircraft.length,
    validPassengerRoutes: validRoutes.length,
    invalidCategories: invalidCategories.length
  };
}

// ============================================================
// 7. AIRCRAFT ELIGIBILITY
// ============================================================

export function isEligible(aircraft, route) {
  if (
    !Number.isInteger(aircraft.category) ||
    !Number.isInteger(route.category)
  ) {
    return false;
  }

  if (route.category < aircraft.category) {
    return false;
  }

  // Aircraft range is compared to one-way distance.
  if (route.distance > aircraft.range) {
    return false;
  }

  if (
    route.distance <= 0 ||
    aircraft.speed <= 0
  ) {
    return false;
  }

  return true;
}

// ============================================================
// 8. AIRCRAFT CONFIGURATION
// ============================================================

/**
 * Calculate Economy capacity for a given Cargo allocation.
 *
 * Payload assumptions:
 * Economy seat = 0.1 tonnes
 * Cargo unit   = 1 tonne
 *
 * These assumptions are supported by three manually
 * checked aircraft examples but are not yet verified
 * across the entire aircraft catalogue.
 */
export function getConfiguration(aircraft, cargo) {
  if (
    !Number.isInteger(cargo) ||
    cargo < MIN_CARGO_UNITS ||
    cargo > aircraft.payload
  ) {
    return null;
  }

  const remainingPayload =
    aircraft.payload - cargo;

  const economySeats = Math.min(
    aircraft.seats,
    Math.floor(
      remainingPayload /
      ECONOMY_PAYLOAD_TONNES + 1e-7
    )
  );

  if (economySeats <= 0) {
    return null;
  }

  const economyPayload =
    economySeats * ECONOMY_PAYLOAD_TONNES;

  const passengerPayloadPercent =
    (economyPayload / aircraft.payload) * 100;

  return {
    eco: economySeats,
    cargo,
    passengerPayloadPercent
  };
}

// ============================================================
// 9. REVENUE CALCULATION
// ============================================================

/**
 * Revenue from one return service in a seven-aircraft
 * rotation group.
 *
 * Each group operates the same base sequence on seven
 * aircraft, staggered by 24 hours.
 *
 * One base return service therefore produces seven
 * return services per week.
 */
export function calculateLegRevenue(
  route,
  economySeats,
  cargoUnits
) {
  const economyRevenue =
    7 * 2 * economySeats * route.ecoFare;

  const cargoRevenue =
    7 * 2 * cargoUnits * route.cargoFare;

  return {
    economyRevenue,
    cargoRevenue,
    totalRevenue: economyRevenue + cargoRevenue
  };
}

// ============================================================
// 10. DEMAND CHECKING
// ============================================================

/**
 * Remaining demand is daily.
 *
 * One base return service in a seven-aircraft group
 * produces one return service per day.
 *
 * Therefore daily consumption is:
 *
 * Economy = 2 * economySeats
 * Cargo   = 2 * cargoUnits
 *
 * The factor of seven belongs in weekly revenue,
 * not daily demand consumption.
 */
export function hasDemand(
  remaining,
  routeId,
  economySeats,
  cargoUnits,
  additionalServices = 1
) {
  const available = remaining.get(routeId);

  if (!available) {
    return false;
  }

  const economyRequired =
    additionalServices * 2 * economySeats;

  const cargoRequired =
    additionalServices * 2 * cargoUnits;

  return (
    available.eco >= economyRequired &&
    available.cargo >= cargoRequired
  );
}

// ============================================================
// 11. ROTATION OPTIMISER
// ============================================================

export function optimise(
  data,
  {
    groups = 20,
    passengerMin = 70,
    onProgress = () => {},
    stop = () => false
  } = {}
) {
  // Validate the complete input before searching.
  const validation = validateData(data);

  groups = Math.max(
    0,
    Math.floor(Number(groups) || 0)
  );

  passengerMin = Math.max(
    0,
    Math.min(100, Number(passengerMin) || 0)
  );

  const remaining = new Map();

  for (const route of data.routes) {
    remaining.set(route.id, {
      eco: route.ecoDemand,
      cargo: route.cargoDemand
    });
  }

  const rotations = [];

  let total = 0;

  // ----------------------------------------------------------
  // Search for the best available rotation group.
  // ----------------------------------------------------------

  for (
    let groupIndex = 0;
    groupIndex < groups && !stop();
    groupIndex++
  ) {
    let best = null;

    // Evaluate every usable aircraft model.
    for (const aircraft of data.aircraft) {
      if (stop()) {
        break;
      }

      // Cargo allocation candidates.
      const maximumCargo = Math.min(
        35,
        Math.floor(aircraft.payload)
      );

      for (
        let cargo = MIN_CARGO_UNITS;
        cargo <= maximumCargo;
        cargo++
      ) {
        const configuration = getConfiguration(
          aircraft,
          cargo
        );

        if (!configuration) {
          continue;
        }

        if (
          configuration.passengerPayloadPercent <
          passengerMin
        ) {
          continue;
        }

        const eco = configuration.eco;

        const options = [];

        // ----------------------------------------------------
        // Evaluate compatible routes.
        // ----------------------------------------------------

        for (const route of data.routes) {
          if (!isEligible(aircraft, route)) {
            continue;
          }

          if (
            route.ecoFare <= 0 ||
            route.ecoDemand <= 0
          ) {
            continue;
          }

          const flightHours = duration(
            route.distance,
            aircraft.speed
          );

          if (flightHours > ROTATION_HOURS) {
            continue;
          }

          if (
            !hasDemand(
              remaining,
              route.id,
              eco,
              cargo
            )
          ) {
            continue;
          }

          const revenue = calculateLegRevenue(
            route,
            eco,
            cargo
          );

          options.push({
            route,
            hours: flightHours,
            revenue: revenue.totalRevenue,
            economyRevenue: revenue.economyRevenue,
            cargoRevenue: revenue.cargoRevenue,
            ratio: revenue.totalRevenue / flightHours
          });
        }

        // ----------------------------------------------------
        // Sort candidate services by weekly revenue per hour.
        // ----------------------------------------------------

        options.sort(
          (a, b) => b.ratio - a.ratio
        );

        let hours = 0;
        let revenue = 0;

        const legs = [];
        const usage = new Map();

        // ----------------------------------------------------
        // Build one rotation sequence.
        // ----------------------------------------------------

        for (const option of options) {
          const route = option.route;

          const used =
            usage.get(route.id) || 0;

          if (
            hours + option.hours >
            ROTATION_HOURS + 1e-7
          ) {
            continue;
          }

          // Account for repeated destinations within
          // the same proposed rotation.
          if (
            !hasDemand(
              remaining,
              route.id,
              eco,
              cargo,
              used + 1
            )
          ) {
            continue;
          }

          legs.push({
            code: route.code,
            routeId: route.id,
            start: hours,
            duration: option.hours,
            revenue: option.revenue
          });

          hours += option.hours;
          revenue += option.revenue;

          usage.set(
            route.id,
            used + 1
          );
        }

        // ----------------------------------------------------
        // Keep the highest-revenue candidate.
        // ----------------------------------------------------

        if (
          legs.length > 0 &&
          (!best || revenue > best.revenue)
        ) {
          best = {
            model: aircraft.model,
            aircraftId: aircraft.id,

            eco,
            cargo,

            hours,
            revenue,
            legs
          };
        }
      }
    }

    // No further feasible candidate groups.
    if (!best) {
      break;
    }

    // --------------------------------------------------------
    // Commit the selected group's DAILY demand consumption.
    // --------------------------------------------------------

    for (const leg of best.legs) {
      const available = remaining.get(
        leg.routeId
      );

      available.eco -= 2 * best.eco;
      available.cargo -= 2 * best.cargo;
    }

    best.id =
      `BOM-${String(groupIndex + 1).padStart(3, "0")}`;

    rotations.push(best);

    total += best.revenue;

    onProgress({
      completed: groupIndex + 1,
      total,
      rotation: best
    });
  }

  return {
    rotations,
    total,
    remaining,
    validation,

    method: "greedy-passenger-first",
    preflight: "NOT_RUN"
  };
}

// ============================================================
// 12. CSV EXPORT
// ============================================================

export function exportCSV(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "";
  }

  const keys = Object.keys(rows[0]);

  function escapeCSV(value) {
    const text = String(value ?? "");

    return `"${text.replaceAll('"', '""')}"`;
  }

  const header = keys
    .map(escapeCSV)
    .join(",");

  const lines = rows.map(row =>
    keys
      .map(key => escapeCSV(row[key]))
      .join(",")
  );

  return [
    header,
    ...lines
  ].join("\r\n");
}

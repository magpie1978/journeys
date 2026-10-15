
/**
 * Airlines Manager Rotation Optimiser
 * app.js v1.0
 *
 * Automatic multi-hub mixed-fleet interface.
 *
 * All 149 catalogue models, including cargo-only freighters.
 *
 * Scenario A: Rebuild schedules from scratch.
 */

import {
  csv,
  prepare,
  getSupportedAircraft
} from "./engine.js";

let HUB = "BOM";
let rawRoutes = [];
let rawPricing = [];
let rawAircraft = [];
let availableHubs = [];
let loadGeneration = 0;
let activeDataSource = "CSV";
// In-memory reservation only; a page refresh clears it.
let confirmedX380Hub = null;
let resultHub = null;

function x380GroupsInResult() {
  return optimisationResult?.rotations?.filter(r => r.model === "X380Plus").length ?? 0;
}

function updateX380Controls() {
  const status = $("x380-status");
  if (status) status.textContent = confirmedX380Hub
    ? `7 of 10 X380Plus aircraft reserved for ${confirmedX380Hub}. The other 3 cannot form a group.`
    : "10 X380Plus aircraft available globally (one seven-aircraft group). No confirmed reservation.";
  const confirm = $("confirm-x380");
  if (confirm) confirm.disabled = isRunning || !optimisationResult || resultHub !== HUB ||
    x380GroupsInResult() !== 1 || (confirmedX380Hub !== null && confirmedX380Hub !== HUB);
  const release = $("release-x380");
  if (release) release.disabled = isRunning || confirmedX380Hub === null;
}

function confirmX380() {
  if (isRunning || !optimisationResult || resultHub !== HUB || x380GroupsInResult() !== 1) return;
  if (confirmedX380Hub && confirmedX380Hub !== HUB) return;
  confirmedX380Hub = HUB;
  updateX380Controls();
  setStatus(`Confirmed: one X380Plus group reserved for ${HUB} this session.`);
}

function releaseX380() {
  if (isRunning || !confirmedX380Hub) return;
  const previous = confirmedX380Hub;
  confirmedX380Hub = null;
  // Old proposed rotations must be rerun before they can be confirmed.
  optimisationResult = null;
  resultHub = null;
  clearResults();
  updateButtons();
  setStatus(`Released ${previous}'s X380Plus reservation. Run the optimiser again to create a new proposal.`);
}


function normaliseHub(value) {
  return String(value ?? "").trim().toUpperCase();
}

function updateHubHeading() {
  if ($("active-hub")) $("active-hub").textContent = HUB;
}

function discoverHubs(routes, pricing) {
  const routeHubs = new Set(routes.map(row => normaliseHub(row.hub)).filter(Boolean));
  const pricingHubs = new Set(pricing.map(row => normaliseHub(row.hub)).filter(Boolean));
  // A hub is usable only if it appears in both datasets.
  return [...routeHubs].filter(hub => pricingHubs.has(hub)).sort();
}

function renderHubOptions() {
  const select = $("hub-select");
  if (!select) return;
  select.replaceChildren();
  for (const hub of availableHubs) {
    const option = document.createElement("option");
    option.value = hub;
    option.textContent = hub;
    select.appendChild(option);
  }
  select.value = HUB;
  select.disabled = availableHubs.length < 2 || isRunning;
}

function activateHub(hub) {
  if (isRunning) return;
  const selected = normaliseHub(hub);
  if (!availableHubs.includes(selected)) return;
  HUB = selected;
  updateHubHeading();
  optimisationResult = null;
  resultHub = null;
  preparedData = null;
  clearResults();
  const routes = rawRoutes.filter(row => normaliseHub(row.hub) === HUB);
  const pricing = rawPricing.filter(row => normaliseHub(row.hub) === HUB);
  try {
    preparedData = prepare(routes, pricing, rawAircraft);
    if (!preparedData || !Array.isArray(preparedData.routes) || !Array.isArray(preparedData.aircraft)) {
      throw new Error("The optimisation engine returned invalid data.");
    }
    preparedData.hub = HUB;
    const fleet = getConfiguredFleet();
    $("routes").textContent = formatNumber(preparedData.routes.length);
    $("models").textContent = formatNumber(fleet.length);
    renderConfigurations(fleet);
    setStatus(`${HUB}: ${formatNumber(preparedData.routes.length)} owned routes loaded (${formatNumber(preparedData.routes.filter(r => r.pricingValid).length)} valid pricing); ${fleet.length} aircraft models ready.`);
    if (preparedData.routes.length === 0) {
      preparedData = null;
      setStatus(`${HUB}: no eligible owned routes found. Check the hub's routes.csv and pricing.csv records.`);
    }
  } catch (error) {
    console.error("[Rotation Optimiser] Hub preparation failed:", error);
    preparedData = null;
    $("routes").textContent = "—";
    $("models").textContent = "—";
    $("fleet-configurations")?.replaceChildren();
    setStatus(`Hub ${HUB}: ${error.message}`);
  }
  renderHubOptions();
  updateButtons();
}

const AIRCRAFT_PER_GROUP = 7;
const ECONOMY_PAYLOAD_TONNES = 0.1;

const DATA_FILES = [
  "./data/routes.csv",
  "./data/pricing.csv",
  "./data/aircraft.csv"
];

let preparedData = null;
let optimisationResult = null;
let worker = null;
let isRunning = false;

// ============================================================
// DOM AND FORMATTING
// ============================================================

function $(id) {
  return document.getElementById(id);
}

function setStatus(message) {
  const element = $("status");

  if (element) {
    element.textContent = message;
  }
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-US");
}

function formatMoney(value) {
  return formatNumber(Math.round(value));
}

function formatBillions(value) {
  return (value / 1_000_000_000).toFixed(3);
}

function percentage(part, total) {
  if (!(total > 0)) {
    return "0.0%";
  }

  return `${(100 * part / total).toFixed(1)}%`;
}

function appendRow(tbody, values) {
  const row = document.createElement("tr");

  for (const value of values) {
    const cell = document.createElement("td");
    cell.textContent = String(value);
    row.appendChild(cell);
  }

  tbody.appendChild(row);
}

function clearResults() {
  for (const id of [
    "results",
    "fleet-results",
    "demand-results"
  ]) {
    $(id)?.replaceChildren();
  }
}

// ============================================================
// BUTTON STATE
// ============================================================

function updateButtons() {
  const runButton = $("run");
  const stopButton = $("stop");
  const downloadButton = $("download");

  if ($("hub-select")) $("hub-select").disabled = isRunning || availableHubs.length < 2;

  if (runButton) {
    runButton.disabled =
      isRunning || preparedData === null;
  }

  if (stopButton) {
    stopButton.disabled = !isRunning;
  }

  updateX380Controls();

  if (downloadButton) {
    downloadButton.disabled =
      isRunning ||
      !optimisationResult ||
      optimisationResult.rotations.length === 0;
  }
}

// ============================================================
// LOAD DATA
// ============================================================

async function loadCSVFile(path) {
  const response = await fetch(path, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Could not load ${path}: HTTP ${response.status}`
    );
  }

  return csv(await response.text());
}

// Supabase publishable credentials. Never use a service-role key in browser code.
const SUPABASE_URL = "https://eukgodthgusongsbhdwg.supabase.co";
const SUPABASE_KEY = "sb_publishable_pBMWDgyFgIUGetg6NwkKkA_rMa1--kc";
const PAGE_SIZE = 1000;

async function fetchSupabaseView(view) {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${view}`);
    url.searchParams.set("select", "*");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, {
      cache: "no-store",
      headers: { apikey: SUPABASE_KEY, Accept: "application/json" }
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 240);
      throw new Error(`${view}: HTTP ${response.status}: ${detail}`);
    }
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error(`${view}: unexpected response`);
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return all;
}

async function loadSupabaseData() {
  const [routes, pricing, aircraft] = await Promise.all([

    url.searchParams.set("select", "*");

    const orderColumn =
      view === "am_optimizer_aircraft"
      ? "id"
      : "route_id";

    url.searchParams.set("order", `${orderColumn}.asc`);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
  ]);
  
  if (!routes.length || !pricing.length || !aircraft.length) {
    throw new Error("Supabase returned an empty optimiser dataset");
  }
  return {
    routes: routes.map(r => ({
      hub: r.hub_code,
      airport_code: r.destination_code,
      ownership_status: r.ownership_status,
      route_id: r.route_id,
      distance_km: r.distance_km,
      category: r.destination_category
    })),
    pricing: pricing.map(p => ({
      hub: p.hub_code,
      airport_code: String(p.route ?? "").split("/")[1] ?? "",
      route_id: p.route_id,
      status: p.status,
      current_price_economy: p.current_price_economy,
      current_price_cargo: p.current_price_cargo,
      current_demand_economy: p.current_demand_economy,
      current_demand_cargo: p.current_demand_cargo
    })),
    aircraft
  };
}

function verifyPreparedParity(candidate, baseline) {
  const hubs = discoverHubs(baseline.routes, baseline.pricing);
  const candidateHubs = discoverHubs(candidate.routes, candidate.pricing);
  if (JSON.stringify(candidateHubs) !== JSON.stringify(hubs)) {
    throw new Error(`Hub mismatch: Supabase ${candidateHubs.join(",")} vs CSV ${hubs.join(",")}`);
  }

  for (const hub of hubs) {
    const pick = dataset => prepare(
      dataset.routes.filter(r => normaliseHub(r.hub) === hub),
      dataset.pricing.filter(r => normaliseHub(r.hub) === hub),
      dataset.aircraft
    );
    const current = pick(candidate);
    const baselinePrepared = pick(baseline);

    // Scan-dependent fares and demand legitimately change over time.
    // Compare identity, geography and whether each route has usable pricing.
    const signature = data => new Map(data.routes.map(r => [String(r.id), JSON.stringify([
      r.code, r.distance, r.category, r.pricingValid
    ])]));
    const currentRoutes = signature(current);
    const oldRoutes = signature(baselinePrepared);
    const missingOrDifferent = [...oldRoutes].filter(
      ([id, value]) => currentRoutes.get(id) !== value
    ).length;
    const unexpected = [...currentRoutes.keys()].filter(id => !oldRoutes.has(id)).length;
    if (currentRoutes.size !== oldRoutes.size || missingOrDifferent || unexpected) {
      throw new Error(`${hub}: Supabase/CSV structural parity failed ` +
        `(${currentRoutes.size} vs ${oldRoutes.size}; ` +
        `${missingOrDifferent} missing/different, ${unexpected} unexpected)`);
    }

    // Validate all eligible priced routes in the new scan; do not compare
    // their numeric values with an older snapshot.
    for (const route of current.routes) {
      if (!route.pricingValid) continue;
      if (![route.ecoDemand, route.cargoDemand, route.ecoFare, route.cargoFare]
        .every(Number.isFinite) ||
          route.ecoDemand < 0 || route.cargoDemand < 0 ||
          route.ecoFare <= 0 || route.cargoFare <= 0) {
        throw new Error(`${hub}: invalid Supabase pricing for route ${route.id}`);
      }
    }

    const fleetSignature = data => JSON.stringify(getSupportedAircraft(data)
      .map(x => [x.id, x.model, x.category, x.range, x.speed, x.seats, x.payload, x.eco, x.cargo])
      .sort((x, y) => String(x[1]).localeCompare(String(y[1]))));
    if (fleetSignature(current) !== fleetSignature(baselinePrepared)) {
      throw new Error(`${hub}: Supabase/CSV aircraft parity failed`);
    }
    console.info(`[Rotation Optimiser] ${hub}: structural, pricing and aircraft validation passed ` +
      `(${currentRoutes.size} routes; ${current.routes.filter(r => r.pricingValid).length} priced).`);
  }
}

function getConfiguredFleet() {
  if (!preparedData) {
    return [];
  }

  return getSupportedAircraft(preparedData);
}

function renderConfigurations(fleet) {
  const tbody = $("fleet-configurations");

  if (!tbody) {
    return;
  }

  tbody.replaceChildren();

  for (const aircraft of fleet) {
    appendRow(tbody, [
      aircraft.model,
      formatNumber(aircraft.eco),
      formatNumber(aircraft.cargo),
      aircraft.category,
      formatNumber(aircraft.range),
      formatNumber(aircraft.speed)
    ]);
  }
}

async function loadData() {
  const generation = ++loadGeneration;
  preparedData = null;
  optimisationResult = null;
  clearResults();
  updateButtons();
  setStatus("Loading and validating Supabase data against CSV baseline…");
  try {
    // Keep the CSV baseline during migration; do not trust counts alone.
    const [csvRoutes, csvPricing, csvAircraft] = await Promise.all(DATA_FILES.map(loadCSVFile));
    const baseline = { routes: csvRoutes, pricing: csvPricing, aircraft: csvAircraft };
    let dataset = baseline;
    let sourceMessage = "CSV baseline";
    try {
      const candidate = await loadSupabaseData();
      verifyPreparedParity(candidate, baseline);
      dataset = candidate;
      activeDataSource = "Supabase";
      sourceMessage = "Supabase (CSV parity verified)";
    } catch (error) {
      activeDataSource = "CSV";
      sourceMessage = `CSV fallback — Supabase validation failed: ${error.message}`;
      console.warn("[Rotation Optimiser] Supabase not activated:", error);
    }
    if (generation !== loadGeneration) return;
    rawRoutes = dataset.routes;
    rawPricing = dataset.pricing;
    rawAircraft = dataset.aircraft;
    availableHubs = discoverHubs(rawRoutes, rawPricing);
    if (!availableHubs.length) throw new Error("No matching hubs in route and pricing data");
    HUB = availableHubs.includes(HUB) ? HUB : availableHubs[0];
    activateHub(HUB);
    const normalStatus = $("status")?.textContent ?? "";
    setStatus(`${sourceMessage}. ${normalStatus}`);
  } catch (error) {
    console.error("[Rotation Optimiser] Data loading failed:", error);
    preparedData = null;
    setStatus(`Data loading error: ${error.message}`);
    updateButtons();
  }
}

// ============================================================
// RENDER ROTATIONS
// ============================================================

function renderResults() {
  const tbody = $("results");

  if (!tbody) {
    return;
  }

  tbody.replaceChildren();

  if (!optimisationResult?.rotations) {
    return;
  }

  for (const rotation of optimisationResult.rotations) {
    appendRow(tbody, [
      rotation.id,
      rotation.model,
      `${rotation.eco}E + ${rotation.cargo}C`,
      Number(rotation.hours).toFixed(2),
      rotation.legs.map(leg => leg.code).join(", "),
      formatMoney(rotation.revenue)
    ]);
  }
}

// ============================================================
// RENDER FLEET SUMMARY
// ============================================================

function renderFleetSummary() {
  const tbody = $("fleet-results");

  if (!tbody) {
    return;
  }

  tbody.replaceChildren();

  const summary = optimisationResult?.fleetSummary;

  if (!summary) {
    return;
  }

  let totalGroups = 0;
  let totalAircraft = 0;
  let totalServices = 0;
  let totalRevenue = 0;

const allocatedFleet = Object.values(summary)
  .filter(item => item.groups > 0)
  .sort((a, b) => b.weeklyRevenue - a.weeklyRevenue);

for (const item of allocatedFleet) {
  appendRow(tbody, [
      item.model,
      `${item.eco}E + ${item.cargo}C`,
      formatNumber(item.groups),
      formatNumber(item.aircraftCount),
      formatNumber(item.services),
      formatMoney(item.weeklyRevenue)
    ]);

    totalGroups += item.groups;
    totalAircraft += item.aircraftCount;
    totalServices += item.services;
    totalRevenue += item.weeklyRevenue;
  }

  appendRow(tbody, [
    "TOTAL",
    "Mixed fleet",
    formatNumber(totalGroups),
    formatNumber(totalAircraft),
    formatNumber(totalServices),
    formatMoney(totalRevenue)
  ]);
}

// ============================================================
// RENDER DEMAND SUMMARY
// ============================================================

function renderDemandSummary() {
  const tbody = $("demand-results");

  if (!tbody) {
    return;
  }

  tbody.replaceChildren();

  const demand = optimisationResult?.demandSummary;

  if (!demand) {
    return;
  }

  appendRow(tbody, [
    "Economy",
    formatNumber(demand.startingEconomy),
    formatNumber(demand.allocatedEconomy),
    formatNumber(demand.remainingEconomy),
    percentage(
      demand.remainingEconomy,
      demand.startingEconomy
    )
  ]);

  appendRow(tbody, [
    "Cargo",
    formatNumber(demand.startingCargo),
    formatNumber(demand.allocatedCargo),
    formatNumber(demand.remainingCargo),
    percentage(
      demand.remainingCargo,
      demand.startingCargo
    )
  ]);
}

// ============================================================
// RUN OPTIMISER
// ============================================================

function runOptimiser() {
  if (isRunning || !preparedData) {
    return;
  }

  const groupText = $("groups")?.value.trim() ?? "";

  // Blank = unlimited.
  const groups = groupText === ""
    ? null
    : Number(groupText);

  if (
    groups !== null &&
    (
      !Number.isSafeInteger(groups) ||
      groups < 1
    )
  ) {
    setStatus(
      "Enter a positive whole number or leave blank for unlimited."
    );

    return;
  }

  optimisationResult = null;
  resultHub = null;
  clearResults();

  if (worker) {
    worker.terminate();
    worker = null;
  }

  isRunning = true;
  updateButtons();

  const groupDescription =
    groups === null
      ? "unlimited groups"
      : `up to ${groups} groups`;

  setStatus(
    `Optimising ${HUB}: ${groupDescription} across ` +
    `${getConfiguredFleet().length} aircraft models…`
  );

  try {
    const activeWorker = new Worker(
      "./js/worker.js",
      {
        type: "module"
      }
    );

    worker = activeWorker;

    activeWorker.onmessage = event => {
      if (worker !== activeWorker) {
        return;
      }

      const {
        type,
        data: payload,
        message
      } = event.data;

      if (type === "progress") {
        const countDescription =
          groups === null
            ? `${payload.completed} groups`
            : `${payload.completed} of ${groups} groups`;

        setStatus(
          `${HUB}: built ${countDescription} · ` +
          `provisional $${formatBillions(payload.total)}bn/week`
        );

        return;
      }

      if (type === "error") {
        console.error(
          "[Rotation Optimiser] Engine error:",
          message
        );

        isRunning = false;

        setStatus(
          `Optimisation error: ${message}`
        );

        activeWorker.terminate();
        worker = null;

        updateButtons();
        return;
      }

      if (type === "result") {
        optimisationResult = payload;
        resultHub = HUB;

        isRunning = false;

        activeWorker.terminate();
        worker = null;

        renderResults();
        renderFleetSummary();
        renderDemandSummary();

        const completed =
          optimisationResult.rotations.length;

        const allocatedFleet = Object.values(
          optimisationResult.fleetSummary ?? {}
        ).filter(item => item.groups > 0);
        
        const fleetText = allocatedFleet
          .sort((a, b) => b.weeklyRevenue - a.weeklyRevenue)
          .map(item => `${item.model}: ${item.groups} groups`)
          .join(" · ");
        
        setStatus(
          `${HUB}: completed ${completed} groups · ` +
          `${fleetText} · ` +
          `provisional $${formatBillions(
            optimisationResult.total
          )}bn/week · NOT game validated`
        );

        updateButtons();
      }
    };

    activeWorker.onerror = event => {
      if (worker !== activeWorker) {
        return;
      }

      console.error(
        "[Rotation Optimiser] Worker error:",
        event
      );

      isRunning = false;

      setStatus(
        "The optimisation worker failed. " +
        "Check the browser console for details."
      );

      activeWorker.terminate();
      worker = null;

      updateButtons();
    };

    activeWorker.postMessage({
      type: "run",
      data: preparedData,
      settings: {
        groups,
        x380PlusAvailableGroups: confirmedX380Hub && confirmedX380Hub !== HUB ? 0 : 1
      }
    });

  } catch (error) {
    console.error(
      "[Rotation Optimiser] Could not start:",
      error
    );

    isRunning = false;

    setStatus(
      `Could not start optimiser: ${error.message}`
    );

    updateButtons();
  }
}

// ============================================================
// STOP OPTIMISER
// ============================================================

function stopOptimiser() {
  if (!isRunning) {
    return;
  }

  if (worker) {
    worker.terminate();
    worker = null;
  }

  isRunning = false;
  optimisationResult = null;

  clearResults();

  setStatus(
    "Optimisation stopped. Run again to obtain a complete result."
  );

  updateButtons();
}


  // ============================================================
  // EXPORT CIRCUITS FOR TESTING
  // ============================================================

  function downloadRotations() {
    if (!optimisationResult?.rotations?.length) {
      return;
    }

    const lines = optimisationResult.rotations.map(
      (rotation, index) => {
        const circuitId = `${HUB}-C${1001 + index}`;

        const destinations = rotation.legs
          .map(leg => leg.code)
          .join(",");

        return (
          `${HUB} | ${rotation.model} | ` +
          `${circuitId} | ${destinations}`
        );
      }
    );

    const blob = new Blob(
      [lines.join("\n") + "\n"],
      { type: "text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${HUB}_Circuits_For_Testing.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

// ============================================================
// EVENTS AND INITIALISATION
// ============================================================

function initialiseEvents() {
  $("hub-select")?.addEventListener("change", event => activateHub(event.target.value));
  $("confirm-x380")?.addEventListener("click", confirmX380);
  $("release-x380")?.addEventListener("click", releaseX380);
  $("run")?.addEventListener(
    "click",
    runOptimiser
  );

  $("stop")?.addEventListener(
    "click",
    stopOptimiser
  );

  $("download")?.addEventListener(
    "click",
    downloadRotations
  );
}

async function initialise() {
  initialiseEvents();
  updateButtons();
  await loadData();
}

initialise();

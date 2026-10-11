
/**
 * Airlines Manager Rotation Optimiser
 * app.js v0.6
 *
 * BOM mixed-fleet interface.
 *
 * All 149 catalogue models, including cargo-only freighters.
 *
 * Scenario A: Rebuild schedules from scratch.
 */

import {
  csv,
  prepare,
  exportCSV,
  getSupportedAircraft
} from "./engine.js";

const HUB = "BOM";
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

  if (runButton) {
    runButton.disabled =
      isRunning || preparedData === null;
  }

  if (stopButton) {
    stopButton.disabled = !isRunning;
  }

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
  setStatus("Loading route, pricing and aircraft data…");

  try {
    const [routes, pricing, aircraft] =
      await Promise.all(
        DATA_FILES.map(loadCSVFile)
      );

    preparedData = prepare(
      routes,
      pricing,
      aircraft
    );

    if (
      !preparedData ||
      !Array.isArray(preparedData.routes) ||
      !Array.isArray(preparedData.aircraft)
    ) {
      throw new Error(
        "The optimisation engine returned invalid data."
      );
    }

    const fleet = getConfiguredFleet();

    $("routes").textContent =
      formatNumber(preparedData.routes.length);

    $("models").textContent =
      formatNumber(fleet.length);

    renderConfigurations(fleet);

    setStatus(
      `${HUB}: ${formatNumber(preparedData.routes.length)} ` +
      `eligible owned routes loaded. ` +
      `${fleet.map(item => item.model).join(" + ")} ready. ` +
      "Scenario A: total demand."
    );

  } catch (error) {
    console.error(
      "[Rotation Optimiser] Data loading failed:",
      error
    );

    preparedData = null;

    setStatus(
      `Data loading error: ${error.message}`
    );
  }

  updateButtons();
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
    `Optimising ${groupDescription} across ` +
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
          `Built ${countDescription} · ` +
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
          `Completed ${completed} groups · ` +
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
        groups
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
// EXPORT CSV
// ============================================================

function downloadRotations() {
  if (!optimisationResult?.rotations?.length) {
    return;
  }

  const rows = optimisationResult.rotations.map(
    rotation => ({
      hub: HUB,

      rotation: rotation.id,

      aircraft_model: rotation.model,
      aircraft_id: rotation.aircraftId,

      aircraft_count: AIRCRAFT_PER_GROUP,

      economy_one_way: rotation.eco,
      cargo_one_way: rotation.cargo,

      base_hours: rotation.hours,

      weekly_gross_revenue: rotation.revenue,

      route_sequence: rotation.legs
        .map(leg => leg.code)
        .join(","),

      configuration_mode: rotation.configurationMode,

      configuration_status:
        `${rotation.configurationMode}_${rotation.eco}E_${rotation.cargo}C`,

      scenario: "REBUILD_FROM_SCRATCH",

      preflight_status: "NOT_RUN"
    })
  );

  const csvText = exportCSV(rows);

  const blob = new Blob(
    [csvText],
    {
      type: "text/csv;charset=utf-8"
    }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${HUB}_Mixed_Fleet_Rotations.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ============================================================
// EVENTS AND INITIALISATION
// ============================================================

function initialiseEvents() {
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

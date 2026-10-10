
/**
 * Airlines Manager Rotation Optimiser
 * ===================================
 *
 * File: js/app.js
 * Version: 0.2
 *
 * BOM-only interface.
 *
 * Fixed aircraft:
 *   Airbus A380-800
 *   852 Economy seats
 *   4 Cargo units
 *   7 aircraft per rotation group
 *
 * Responsibilities:
 * - Load route, pricing and aircraft CSV files
 * - Prepare data for the optimisation engine
 * - Display route and aircraft information
 * - Start and stop the optimisation Web Worker
 * - Display optimisation progress
 * - Render proposed rotations
 * - Export results to CSV
 *
 * No game-changing actions are performed.
 */

import {
  csv,
  prepare,
  exportCSV
} from "./engine.js";

// ============================================================
// 1. CONSTANTS
// ============================================================

const HUB = "BOM";

const AIRCRAFT_MODEL = "A380-800";

const FIXED_ECONOMY = 852;
const FIXED_CARGO = 4;

const AIRCRAFT_PER_GROUP = 7;

const DATA_FILES = [
  "./data/routes.csv",
  "./data/pricing.csv",
  "./data/aircraft.csv"
];

// ============================================================
// 2. APPLICATION STATE
// ============================================================

let preparedData = null;
let optimisationResult = null;
let worker = null;
let isRunning = false;

// ============================================================
// 3. DOM HELPERS
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

// ============================================================
// 4. BUTTON STATE
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
// 5. LOAD CSV DATA
// ============================================================

async function loadCSVFile(path) {
  // Avoid stale CSV files after GitHub Pages deployments.
  const response = await fetch(path, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Could not load ${path}: HTTP ${response.status}`
    );
  }

  const text = await response.text();

  return csv(text);
}

async function loadData() {
  setStatus(
    "Loading route, pricing and aircraft data…"
  );

  try {
    const [
      routes,
      pricing,
      aircraft
    ] = await Promise.all(
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

    // --------------------------------------------------------
    // Display route count.
    // --------------------------------------------------------

    const routesElement = $("routes");

    if (routesElement) {
      routesElement.textContent = formatNumber(
        preparedData.routes.length
      );
    }

    // --------------------------------------------------------
    // Verify that the fixed A380-800 model exists.
    // --------------------------------------------------------

    const a380 = preparedData.aircraft.find(
      aircraft => aircraft.model === AIRCRAFT_MODEL
    );

    if (!a380) {
      throw new Error(
        `${AIRCRAFT_MODEL} is missing from the ` +
        "usable aircraft catalogue."
      );
    }

    // --------------------------------------------------------
    // Check the fixed aircraft configuration.
    // --------------------------------------------------------

    const requiredPayload =
      FIXED_ECONOMY * 0.1 + FIXED_CARGO;

    if (a380.seats < FIXED_ECONOMY) {
      throw new Error(
        `A380-800 seat capacity is ${a380.seats}, ` +
        `but ${FIXED_ECONOMY} seats are required.`
      );
    }

    if (requiredPayload > a380.payload + 1e-7) {
      throw new Error(
        `A380-800 payload is ${a380.payload} tonnes, ` +
        `but ${requiredPayload} tonnes are required.`
      );
    }

    // --------------------------------------------------------
    // Data successfully loaded.
    // --------------------------------------------------------

    setStatus(
      `${HUB}: ${formatNumber(preparedData.routes.length)} ` +
      `eligible owned routes loaded. ` +
      `${AIRCRAFT_MODEL} configured at ` +
      `${FIXED_ECONOMY}E + ${FIXED_CARGO}C. ` +
      "Ready to optimise."
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
// 6. RENDER ROTATION RESULTS
// ============================================================

function renderResults() {
  const tableBody = $("results");

  if (!tableBody) {
    return;
  }

  tableBody.replaceChildren();

  if (
    !optimisationResult ||
    !Array.isArray(optimisationResult.rotations)
  ) {
    return;
  }

  for (const rotation of optimisationResult.rotations) {
    const row = document.createElement("tr");

    const destinations = rotation.legs
      .map(leg => leg.code)
      .join(", ");

    const values = [
      rotation.id,
      rotation.model,
      `${rotation.eco}E + ${rotation.cargo}C`,
      Number(rotation.hours).toFixed(2),
      destinations,
      formatMoney(rotation.revenue)
    ];

    for (const value of values) {
      const cell = document.createElement("td");

      // textContent avoids inserting untrusted HTML.
      cell.textContent = String(value);

      row.appendChild(cell);
    }

    tableBody.appendChild(row);
  }
}

// ============================================================
// 7. START OPTIMISATION
// ============================================================

function runOptimiser() {
  if (isRunning || !preparedData) {
    return;
  }

  const groupsInput = $("groups");

  const groups = Number(groupsInput?.value);

  if (
    !Number.isInteger(groups) ||
    groups < 1 ||
    groups > 300
  ) {
    setStatus(
      "Please enter a group count between 1 and 300."
    );

    return;
  }

  // ----------------------------------------------------------
  // Clear previous results.
  // ----------------------------------------------------------

  optimisationResult = null;

  const tableBody = $("results");

  if (tableBody) {
    tableBody.replaceChildren();
  }

  // ----------------------------------------------------------
  // Terminate any previous worker.
  // ----------------------------------------------------------

  if (worker) {
    worker.terminate();
    worker = null;
  }

  // ----------------------------------------------------------
  // Create the optimisation worker.
  // ----------------------------------------------------------

  isRunning = true;

  updateButtons();

  setStatus(
    `Optimising ${groups} seven-aircraft groups ` +
    `using ${AIRCRAFT_MODEL} ` +
    `(${FIXED_ECONOMY}E + ${FIXED_CARGO}C)…`
  );

  try {
    const activeWorker = new Worker(
      "./js/worker.js",
      {
        type: "module"
      }
    );

    worker = activeWorker;

    // --------------------------------------------------------
    // Handle messages from the worker.
    // --------------------------------------------------------

    activeWorker.onmessage = event => {
      if (worker !== activeWorker) {
        return;
      }

      const {
        type,
        data: payload,
        message
      } = event.data;

      // ------------------------------------------------------
      // Progress update.
      // ------------------------------------------------------

      if (type === "progress") {
        setStatus(
          `Built ${payload.completed} of ${groups} groups · ` +
          `provisional $${formatBillions(payload.total)}` +
          "bn/week"
        );

        return;
      }

      // ------------------------------------------------------
      // Engine error.
      // ------------------------------------------------------

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

      // ------------------------------------------------------
      // Optimisation completed.
      // ------------------------------------------------------

      if (type === "result") {
        optimisationResult = payload;

        isRunning = false;

        activeWorker.terminate();
        worker = null;

        renderResults();

        const completed =
          optimisationResult.rotations.length;

        setStatus(
          `Completed ${completed} groups · ` +
          `provisional $${formatBillions(
            optimisationResult.total
          )}bn/week · ` +
          "NOT game validated"
        );

        updateButtons();
      }
    };

    // --------------------------------------------------------
    // Handle worker loading/runtime errors.
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Send data and settings to the worker.
    //
    // No passengerMin setting is passed.
    // The engine uses the fixed A380 configuration.
    // --------------------------------------------------------

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
// 8. STOP OPTIMISATION
// ============================================================

function stopOptimiser() {
  if (!isRunning) {
    return;
  }

  // Terminating the worker immediately stops its computation.
  if (worker) {
    worker.terminate();
    worker = null;
  }

  isRunning = false;

  optimisationResult = null;

  setStatus(
    "Optimisation stopped. Run again to obtain " +
    "a complete result."
  );

  updateButtons();
}

// ============================================================
// 9. EXPORT ROTATIONS CSV
// ============================================================

function downloadRotations() {
  if (
    !optimisationResult ||
    !optimisationResult.rotations.length
  ) {
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

      configuration_status: "FIXED_852E_4C",

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

  link.download =
    `${HUB}_A380_Fixed_Rotations.csv`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ============================================================
// 10. EVENT LISTENERS
// ============================================================

function initialiseEvents() {
  const runButton = $("run");
  const stopButton = $("stop");
  const downloadButton = $("download");

  if (runButton) {
    runButton.addEventListener(
      "click",
      runOptimiser
    );
  }

  if (stopButton) {
    stopButton.addEventListener(
      "click",
      stopOptimiser
    );
  }

  if (downloadButton) {
    downloadButton.addEventListener(
      "click",
      downloadRotations
    );
  }
}

// ============================================================
// 11. INITIALISATION
// ============================================================

async function initialise() {
  initialiseEvents();

  updateButtons();

  await loadData();
}

initialise();

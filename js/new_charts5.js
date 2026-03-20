/* global Chart, sb */

// ============================================================================
// GLOBAL CHART.JS DEFAULTS
// ============================================================================
Chart.defaults.font.family =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto";
Chart.defaults.font.size = 12;
Chart.defaults.font.weight = "400";
Chart.defaults.color = "#ccc";

// ============================================================================
// GLOBAL STATE
// ============================================================================
let baseStatsData = [];
let airlineByYearChart = null;

// ============================================================================
// VISUAL CONSTANTS
// ============================================================================
const YELLOW = "rgba(201,162,77,0.7)";
const YELLOW_BORDER = "rgba(201,162,77,0.9)";
const GRID = "rgba(255,255,255,0.08)";
const RIGHT_ROW_HEIGHT = 32;

// ============================================================================
// HELPERS
// ============================================================================
function year4(v) {
  if (v == null) return null;
  const y = String(v).slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

function numberFmt(n) {
  return Number(n || 0).toLocaleString();
}

// ============================================================================
// LABEL PLUGINS
// ============================================================================

// 👉 Vertical bars (Flights Over Time / Airlines per Year)
const barTopLabelPlugin = {
  id: "barTopLabels",
  afterDatasetsDraw(chart) {
    const { ctx, options } = chart;
    const isHorizontal = options.indexAxis === "y";

    ctx.save();
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#ccc";

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);

      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (!value) return;

        let x, y;

        if (isHorizontal) {
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          x = bar.x + 8;
          y = bar.y;
        } else {
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          x = bar.x;
          y = bar.y - 6;
        }

        ctx.fillText(numberFmt(value), x, y);
      });
    });

    ctx.restore();
  }
};

// 👉 Horizontal stacked bars (Flights/Miles)
const barEndLabelPlugin = {
  id: "barEndLabels",
  afterDatasetsDraw(chart) {
    const { ctx, scales } = chart;

    ctx.save();
    ctx.fillStyle = "#ccc";
    ctx.textBaseline = "middle";

    chart.data.labels.forEach((_, i) => {
      let total = 0;
      chart.data.datasets.forEach(ds => {
        total += ds.data[i] || 0;
      });

      if (!total) return;

      const x = scales.x.getPixelForValue(total) + 8;
      const y = scales.y.getPixelForTick(i);

      ctx.fillText(numberFmt(total), x, y);
    });

    ctx.restore();
  }
};

// ============================================================================
// DATA LOAD
// ============================================================================
async function loadStatsBaseData() {
  const { data } = await sb
    .from("journeys_routes_core_mv")
    .select("year, journey_type, journey_distance, airline");

  return data || [];
}

// ============================================================================
// AGGREGATORS
// ============================================================================

// 👉 DISTINCT airlines per year
function airlinesPerYear(data) {
  const map = {};

  data.forEach(r => {
    if (r.journey_type !== "Flight" || !r.airline) return;

    const y = year4(r.year);
    if (!y) return;

    map[y] ??= new Set();
    map[y].add(r.airline);
  });

  const years = Object.keys(map).sort();

  return {
    years,
    values: years.map(y => map[y].size)
  };
}

// 👉 Flights OR Miles per airline per year
function metricPerAirlineByYear(data, metric = "flights") {
  const map = {};
  const airlines = new Set();
  const years = new Set();

  data.forEach(r => {
    if (r.journey_type !== "Flight" || !r.airline) return;

    const y = year4(r.year);
    if (!y) return;

    airlines.add(r.airline);
    years.add(y);

    const val =
      metric === "miles"
        ? (Number(r.journey_distance) || 0)
        : 1;

    map[r.airline] ??= {};
    map[r.airline][y] = (map[r.airline][y] || 0) + val;
  });

  const yearList = Array.from(years).sort();
  const airlineList = Array.from(airlines);

  const datasets = yearList.map(y => ({
    label: y,
    data: airlineList.map(a => map[a]?.[y] || 0),
    backgroundColor: YELLOW,
    stack: "years"
  }));

  return { airlines: airlineList, datasets };
}

// ============================================================================
// RENDERERS
// ============================================================================

// 👉 Airlines (NEW chart)
function renderAirlinesPerYear({ years, values }) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  const container = canvas.parentElement;

  container.style.height = "400px";
  container.style.overflow = "hidden";

  canvas.height = 400;
  canvas.width = container.clientWidth || 800;

  if (airlineByYearChart) airlineByYearChart.destroy();

  airlineByYearChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: years,
      datasets: [{
        data: values,
        backgroundColor: YELLOW,
        borderColor: YELLOW_BORDER,
        borderWidth: 1
      }]
    },
    plugins: [barTopLabelPlugin],
    options: {
      responsive: false,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: GRID }, ticks: { precision: 0 } }
      }
    }
  });
}

// 👉 Flights / Miles (stacked horizontal)
function renderRight(data, metric) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  const container = canvas.parentElement;

  const totalHeight = data.airlines.length * RIGHT_ROW_HEIGHT;
  canvas.height = Math.max(totalHeight, 400);
  canvas.width = container.clientWidth || 800;

  if (airlineByYearChart) airlineByYearChart.destroy();

  airlineByYearChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data,
    options: {
      indexAxis: "y",
      responsive: false,
      scales: {
        x: { stacked: true, grid: { color: GRID } },
        y: { stacked: true, grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    },
    plugins: [barEndLabelPlugin]
  });
}

// ============================================================================
// ROUTER (CRITICAL FIX)
// ============================================================================
function renderAirlineView(metric) {
  if (metric === "airlines") {
    renderAirlinesPerYear(airlinesPerYear(baseStatsData));
  } else {
    renderRight(
      metricPerAirlineByYear(baseStatsData, metric),
      metric
    );
  }
}

// ============================================================================
// INIT
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  baseStatsData = await loadStatsBaseData();

  const select = document.getElementById("airlineMetricSelect");
  const metric = select?.value || "flights";

  renderAirlineView(metric);

  select?.addEventListener("change", e => {
    renderAirlineView(e.target.value);
  });
});

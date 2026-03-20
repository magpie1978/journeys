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

// Vertical bars: label above, centered
const barTopLabelPlugin = {
  id: "barTopLabels",
  afterDatasetsDraw(chart) {
    const { ctx, options } = chart;
    const isHorizontal = options.indexAxis === "y";

    ctx.save();
    ctx.font =
      "12px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto";
    ctx.fillStyle = "#ccc";

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);

      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value == null || value === 0) return;

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

        ctx.fillText(numberFmt(Math.round(value)), x, y);
      });
    });

    ctx.restore();
  }
};

// Horizontal stacked bars: total at end of bar
const barEndLabelPlugin = {
  id: "barEndLabels",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx, scales } = chart;
    const metric = pluginOptions?.metric || "flights";

    ctx.save();
    ctx.font =
      "12px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto";
    ctx.fillStyle = "#ccc";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    chart.data.labels.forEach((_, i) => {
      let total = 0;

      chart.data.datasets.forEach(ds => {
        const v = ds.data?.[i];
        if (typeof v === "number") total += v;
      });

      if (total <= 0) return;

      const x = scales.x.getPixelForValue(total) + 8;
      const y = scales.y.getPixelForTick(i);
      const text =
        metric === "miles"
          ? numberFmt(Math.round(total))
          : numberFmt(total);

      ctx.fillText(text, x, y);
    });

    ctx.restore();
  }
};

// ============================================================================
// DATA LOAD
// ============================================================================
async function loadStatsBaseData() {
  const { data, error } = await sb
    .from("journeys_routes_core_mv")
    .select("year, journey_type, journey_distance, airline");

  if (error) {
    console.error("[stats-airlines-year] load failed", error);
    return [];
  }

  return data || [];
}

// ============================================================================
// AGGREGATORS
// ============================================================================

// Distinct airlines per year
function airlinesPerYear(data) {
  const byYear = new Map();

  (data || []).forEach(r => {
    if (r.journey_type !== "Flight") return;
    if (!r.airline) return;

    const y = year4(r.year);
    if (!y) return;

    if (!byYear.has(y)) byYear.set(y, new Set());
    byYear.get(y).add(r.airline);
  });

  const years = Array.from(byYear.keys()).sort();

  return {
    years,
    values: years.map(y => byYear.get(y).size)
  };
}

// Flights or miles per airline by year (horizontal stacked chart)
function metricPerAirlineByYear(data, metric = "flights") {
  const map = {};
  const airlineTotals = {};
  const yearsSet = new Set();

  (data || []).forEach(r => {
    if (r.journey_type !== "Flight") return;
    if (!r.airline) return;

    const y = year4(r.year);
    if (!y) return;

    yearsSet.add(y);

    const val =
      metric === "miles"
        ? (Number(r.journey_distance) || 0)
        : 1;

    map[r.airline] ??= {};
    map[r.airline][y] = (map[r.airline][y] || 0) + val;

    airlineTotals[r.airline] = (airlineTotals[r.airline] || 0) + val;
  });

  const years = Array.from(yearsSet).sort();

  const airlines = Object.entries(airlineTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([airline]) => airline);

  const datasets = years.map(y => ({
    label: y,
    data: airlines.map(a => map[a]?.[y] || 0),
    backgroundColor: YELLOW,
    borderColor: YELLOW_BORDER,
    borderWidth: 1,
    borderSkipped: false,
    stack: "years"
  }));

  return { airlines, datasets };
}

// ============================================================================
// RENDERERS
// ============================================================================

// Airlines = vertical chart by year
function renderAirlinesPerYear({ years, values }) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  container.style.height = "400px";
  container.style.maxHeight = "400px";
  container.style.overflowY = "hidden";
  container.style.overflowX = "hidden";

  canvas.height = 400;
  canvas.width = container.clientWidth || 800;
  canvas.style.width = "100%";

  if (airlineByYearChart) airlineByYearChart.destroy();

  airlineByYearChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: years,
      datasets: [
        {
          data: values,
          backgroundColor: YELLOW,
          borderColor: YELLOW_BORDER,
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    plugins: [barTopLabelPlugin],
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: "easeOutQuart" },
      layout: { padding: { top: 20, right: 12, bottom: 24, left: 12 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw} airlines`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 11 },
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: GRID },
          ticks: {
            precision: 0,
            stepSize: 1,
            font: { size: 11 }
          }
        }
      }
    }
  });
}

// Flights / Miles = horizontal stacked chart
function renderRight({ airlines, datasets }, metric) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  const totalHeight = Math.max((airlines?.length || 0) * RIGHT_ROW_HEIGHT, 220);
  const visibleHeight = Math.min(Math.max(totalHeight + 24, 260), 560);

  container.style.height = `${visibleHeight}px`;
  container.style.maxHeight = `${visibleHeight}px`;
  container.style.overflowY = "auto";
  container.style.overflowX = "hidden";

  canvas.height = totalHeight;
  canvas.width = container.clientWidth || 800;
  canvas.style.width = "100%";

  if (airlineByYearChart) airlineByYearChart.destroy();

  airlineByYearChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: airlines,
      datasets
    },
    options: {
      indexAxis: "y",
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { top: 12, right: 80, bottom: 30, left: 12 } },
      scales: {
        x: {
          stacked: true,
          grid: {
            color: GRID,
            lineWidth: 1,
            drawBorder: false
          },
          ticks: {
            font: { size: 11 },
            callback: v =>
              metric === "miles"
                ? numberFmt(Math.round(v))
                : v
          }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: {
            autoSkip: false,
            font: { size: 11 },
            padding: 8
          }
        }
      },
      datasets: {
        bar: {
          categoryPercentage: 0.92,
          barPercentage: 0.85
        }
      },
      plugins: {
        legend: { display: false },
        barEndLabels: { metric },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              return metric === "miles"
                ? `${ctx.dataset.label}: ${numberFmt(Math.round(v))} miles`
                : `${ctx.dataset.label}: ${numberFmt(v)} flights`;
            }
          }
        }
      }
    },
    plugins: [barEndLabelPlugin]
  });

  container.scrollTop = 0;
}

// ============================================================================
// ROUTER
// ============================================================================
function renderAirlineView(metric) {
  if (metric === "airlines") {
    renderAirlinesPerYear(airlinesPerYear(baseStatsData));
  } else {
    renderRight(metricPerAirlineByYear(baseStatsData, metric), metric);
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

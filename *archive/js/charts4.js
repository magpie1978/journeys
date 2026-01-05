/* global Chart, sb */

// =====================================================
// GLOBAL STATE
// =====================================================
let yearChart = null;
let airlineChart = null;
let baseStatsData = [];

// -----------------------------------------------------
// GLOBAL FONT LOCK (matches left chart exactly)
// -----------------------------------------------------
Chart.defaults.font.family =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto";
Chart.defaults.font.size = 11;
Chart.defaults.font.weight = "400";
Chart.defaults.color = "#ccc";

// =====================================================
// LOAD BASE DATA
// =====================================================
async function loadStatsBaseData() {
  const { data, error } = await sb
    .from("journeys_routes_cache")
    .select("year, journey_type, journey_distance, airline");

  if (error) {
    console.error("[stats] load failed", error);
    return [];
  }
  return data || [];
}

// =====================================================
// AGGREGATORS — LEFT CHART
// =====================================================
function flightsPerYear(data) {
  const out = {};
  data
    .filter(r => r.journey_type === "Flight")
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      out[y] = (out[y] || 0) + 1;
    });
  return out;
}

function milesPerYear(data) {
  const out = {};
  data
    .filter(r => r.journey_type === "Flight")
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      out[y] = (out[y] || 0) + (r.journey_distance || 0);
    });
  return out;
}

// =====================================================
// AGGREGATORS — RIGHT CHART (BY YEAR, STACKED)
// =====================================================
function aggregateByAirlineAndYear(data, metric) {
  const map = {};
  const years = new Set();

  data
    .filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      years.add(y);

      map[r.airline] ??= {};
      map[r.airline][y] ??= 0;

      map[r.airline][y] +=
        metric === "miles" ? (r.journey_distance || 0) : 1;
    });

  const sortedYears = [...years].sort();

  const airlines = Object.entries(map)
    .map(([airline, values]) => ({
      airline,
      values,
      total: Object.values(values).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return { airlines, years: sortedYears };
}

// =====================================================
// LEFT CHART RENDERER
// =====================================================
function renderYearChart(values) {
  const canvas = document.getElementById("flightsByYearChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = Object.keys(values).sort();
  const data = labels.map(y => Math.round(values[y]));

  if (yearChart) yearChart.destroy();

  yearChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 11 } }, grid: { display: false } },
        y: {
          ticks: { font: { size: 11 } },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });
}

// =====================================================
// RIGHT CHART RENDERER (STACKED, SCROLLABLE, STABLE)
// =====================================================
function renderAirlineChart(metric) {
  const canvas = document.getElementById("airlineYearChart");
  if (!canvas) return;

  if (airlineChart) airlineChart.destroy();

  const { airlines, years } =
    aggregateByAirlineAndYear(baseStatsData, metric);

  const ROW_HEIGHT = 38;
  const cssHeight = airlines.length * ROW_HEIGHT;

  // CSS sizing ONLY (no DPR hacks)
  canvas.style.width = "100%";
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");

  const datasets = years.map((year, idx) => ({
    label: year,
    data: airlines.map(a => Math.round(a.values[year] || 0)),
    backgroundColor: "rgba(201,162,77,0.7)",
    borderColor: "rgba(201,162,77,0.35)",
    borderWidth: 0.6,
    borderSkipped: false,
    borderRadius: ctx =>
      ctx.dataIndex === years.length - 1
        ? { topRight: 6, bottomRight: 6 }
        : 0,
    stack: "stack1",
  }));

  airlineChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: airlines.map(a => a.airline),
      datasets,
    },
    options: {
      indexAxis: "y",
      responsive: false,
      maintainAspectRatio: false,
      animation: { duration: 400 },

      plugins: {
        legend: { display: false },

        tooltip: {
          mode: "nearest",
          intersect: true,
          callbacks: {
            title: items => items[0].dataset.label,
            label: item =>
              metric === "miles"
                ? `${item.raw.toLocaleString()} miles`
                : `${item.raw} flights`,
          },
        },

        // Totals at end of bar
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          ctx.save();
          ctx.font = "22px system-ui";
          ctx.fillStyle = "#ddd";
          ctx.textBaseline = "middle";

          chart.getDatasetMeta(0).data.forEach((bar, i) => {
            const total = airlines[i].total;
            ctx.fillText(
              Math.round(total).toLocaleString(),
              bar.x + 10,
              bar.y
            );
          });

          ctx.restore();
        },
      },

      scales: {
        x: {
          stacked: true,
          ticks: { font: { size: 11 } },
          grid: { color: "rgba(255,255,255,0.08)" },
        },

        y: {
          stacked: true,
          offset: true,
          ticks: {
            autoSkip: false,
            padding: 16,
            font: { size: 22 },
          },
          grid: { display: false },
        },
      },
    },
  });
}

// =====================================================
// INIT + DROPDOWNS
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  baseStatsData = await loadStatsBaseData();

  renderYearChart(flightsPerYear(baseStatsData));
  renderAirlineChart("flights");

  document
    .getElementById("metricSelector")
    .addEventListener("change", e => {
      renderYearChart(
        e.target.value === "miles"
          ? milesPerYear(baseStatsData)
          : flightsPerYear(baseStatsData)
      );
    });

  document
    .getElementById("airlineMetricSelector")
    .addEventListener("change", e => {
      renderAirlineChart(e.target.value);
    });
});

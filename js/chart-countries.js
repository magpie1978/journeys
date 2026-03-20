/* global Chart, sb */

let chart;

async function loadData() {
  const { data } = await sb
    .from("journeys_routes_core_mv")
    .select("journey_type, origin_country, destination_country");

  return data || [];
}

function visitsPerCountry(data) {
  const map = {};

  data.forEach(r => {
    if (!["Flight", "Drive"].includes(r.journey_type)) return;
    if (!r.destination_country) return;
    if (r.destination_country === r.origin_country) return;

    map[r.destination_country] =
      (map[r.destination_country] || 0) + 1;
  });

  const countries = Object.keys(map).sort((a, b) => map[b] - map[a]);

  return {
    labels: countries,
    values: countries.map(c => map[c])
  };
}

function render({ labels, values }) {
  const ctx = document.getElementById("countriesChart");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const data = await loadData();
  render(visitsPerCountry(data));
});

// =====================================================
// FILTER UI (checkbox dropdowns)
// =====================================================
function buildFilterMenu(containerId, values, targetSet) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const list = container.querySelector(".filter-options");
  const toggle = container.querySelector(".filter-toggle");
  const menu = container.querySelector(".filter-menu");
  const selectAll = container.querySelector(".select-all");
  const clear = container.querySelector(".clear");

  if (!list || !toggle || !menu || !selectAll || !clear) return;

  list.innerHTML = "";

  values.forEach(v => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${v}"> ${v}`;
    const cb = label.querySelector("input");
    cb.checked = targetSet.has(v);

    cb.addEventListener("change", () => {
      cb.checked ? targetSet.add(v) : targetSet.delete(v);
      loadRoutes();
    });

    list.appendChild(label);
  });

  selectAll.onclick = () => {
    targetSet.clear();
    values.forEach(v => targetSet.add(v));
    list.querySelectorAll("input").forEach(cb => (cb.checked = true));
    loadRoutes();
  };

  clear.onclick = () => {
    targetSet.clear();
    list.querySelectorAll("input").forEach(cb => (cb.checked = false));
    loadRoutes();
  };

  toggle.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    menu.classList.toggle("open");
  };
}

document.addEventListener("click", e => {
  if (e.target.closest(".filter")) return;
  document.querySelectorAll(".filter-menu.open").forEach(m => m.classList.remove("open"));
});


// =====================================================
// LOAD FILTERS (defaults: current year + Flight)
// =====================================================
async function loadFilters() {
  const { data, error } = await sb
    .from("journeys_routes_cache")
    .select("year, airline, journey_type");

  if (error) {
    console.error("[filters] failed:", error);
    return;
  }

  // Years come back as dates or numbers – normalise to YYYY strings
  const years = [...new Set(
    (data || [])
      .map(d => d.year && String(d.year).slice(0, 4))
      .filter(Boolean)
  )].sort((a, b) => b.localeCompare(a));

  const airlines = [...new Set(
    (data || []).map(d => d.airline).filter(Boolean)
  )].sort();

  const types = [...new Set(
    (data || []).map(d => d.journey_type).filter(Boolean)
  )].sort();

  // Reset selections
  selected.years.clear();
  selected.types.clear();

  // -----------------------------
  // DEFAULTS
  // -----------------------------
  const currentYear = String(new Date().getFullYear());

  if (years.includes(currentYear)) {
    selected.years.add(currentYear);
  } else if (years.length) {
    // fallback: latest available year
    selected.years.add(years[0]);
  }

  if (types.includes("Flight")) {
    selected.types.add("Flight");
  }

  // -----------------------------
  // BUILD MENUS
  // -----------------------------
  buildFilterMenu("filter-year", years, selected.years);
  buildFilterMenu("filter-airline", airlines, selected.airlines);
  buildFilterMenu("filter-type", types, selected.types);
}

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

    const value = typeof v === "object" ? v.value : v;
    const labelText = typeof v === "object" ? v.label : v;

    const label = document.createElement("label");

    label.innerHTML =
      `<input type="checkbox" value="${value}"> ${labelText}`;

    const cb = label.querySelector("input");
    cb.checked = targetSet.has(value);

    cb.addEventListener("change", () => {
      cb.checked
        ? targetSet.add(value)
        : targetSet.delete(value);

      loadRoutes();
    });

    list.appendChild(label);
  });

  // Select all
  selectAll.onclick = () => {
    targetSet.clear();
    values.forEach(v => {
    
      // Divider row
      if (v.divider) {
        const hr = document.createElement("div");
        hr.className = "filter-divider";
        list.appendChild(hr);
        return;
      }
    
      const value = typeof v === "object" ? v.value : v;
      const labelText = typeof v === "object" ? v.label : v;
    
      const label = document.createElement("label");
    
      label.innerHTML =
        `<input type="checkbox" value="${value}"> ${labelText}`;
    
      const cb = label.querySelector("input");
      cb.checked = targetSet.has(value);
    
      cb.addEventListener("change", () => {
        cb.checked
          ? targetSet.add(value)
          : targetSet.delete(value);
    
        loadRoutes();
      });
    
      list.appendChild(label);
    });

  // Clear
  clear.onclick = () => {
    targetSet.clear();

    list.querySelectorAll("input")
      .forEach(cb => (cb.checked = false));

    loadRoutes();
  };

  // Toggle dropdown
  toggle.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    menu.classList.toggle("open");
  };
}



// Close dropdowns on outside click
document.addEventListener("click", e => {
  if (e.target.closest(".filter")) return;

  document
    .querySelectorAll(".filter-menu.open")
    .forEach(m => m.classList.remove("open"));
});



// =====================================================
// LOAD FILTERS (defaults: current year + Flight)
// =====================================================
async function loadFilters() {

  const { data, error } = await sb
    .from("journeys_routes_core_mv")
    .select(
      "year, airline, journey_type, origin, destination"
    );

  if (error) {
    console.error("[filters] failed:", error);
    return;
  }

  // =====================================================
  // YEARS
  // =====================================================
  const years = [...new Set(
    (data || [])
      .map(d => d.year && String(d.year).slice(0,4))
      .filter(Boolean)
  )].sort((a,b) => b.localeCompare(a));

  // =====================================================
  // AIRLINES
  // =====================================================
  const airlines = [...new Set(
    (data || [])
      .map(d => d.airline)
      .filter(Boolean)
  )].sort();

  // =====================================================
  // TYPES
  // =====================================================
  const types = [...new Set(
    (data || [])
      .map(d => d.journey_type)
      .filter(Boolean)
  )].sort();

  // =====================================================
  // AIRPORTS (REAL CODES)
  // =====================================================
  const airportSet = new Set();

  (data || []).forEach(d => {
    if (d.journey_type === "Flight") {
      if (d.origin) airportSet.add(d.origin);
      if (d.destination) airportSet.add(d.destination);
    }
  });

  let airports = [...airportSet].sort();

  // =====================================================
  // FETCH AIRPORT DISPLAY NAMES
  // =====================================================
  let airportMap = {};

  if (airports.length) {

    const { data: airportData, error: airportError } =
      await sb
        .from("journey_locations")
        .select("airport_code, airport")
        .in("airport_code", airports);

    if (airportError) {
      console.error("[filters] airport lookup failed:", airportError);
    } else {
      airportData.forEach(a => {
        airportMap[a.airport_code] =
          `${a.airport} (${a.airport_code})`;
      });
    }
  }

  // =====================================================
  // VIRTUAL CITY GROUPS
  // =====================================================
  const AIRPORT_GROUPS = {
    LON: ["LHR","LGW","LCY","SEN","LTN","STN"],
    BLN: ["BER","SXF","TXL"],
    MIL: ["MXP","LIN","BGY"],
    BAN: ["BKK","DMK"],
    NYC: ["JFK","EWR","LGA"],
    WDC: ["DCA","BWI","IAD"],
    ROM: ["FCO","CIA"],
    PAR: ["CDG","BVA","ORY"]
  };

  Object.entries(AIRPORT_GROUPS).forEach(([group, members]) => {
    if (airports.some(a => members.includes(a))) {
      airports.unshift(group);
    }
  });

  // =====================================================
  // CONVERT TO DISPLAY OBJECTS
  // =====================================================
  
  // Separate groups and individuals
  const groupItems = [];
  const airportItems = [];
  
  airports.forEach(code => {
  
    if (AIRPORT_GROUPS[code]) {
      groupItems.push({
        value: code,
        label: `${code} (All Airports)`,
        isGroup: true
      });
    } else {
      airportItems.push({
        value: code,
        label: airportMap[code] || code
      });
    }
  });
  
  // Add divider if both exist
  if (groupItems.length && airportItems.length) {
    airports = [
      ...groupItems,
      { divider: true },
      ...airportItems
    ];
  } else {
    airports = [...groupItems, ...airportItems];
  }



  // =====================================================
  // RESET SELECTIONS
  // =====================================================
  selected.years.clear();
  selected.airlines.clear();
  selected.types.clear();
  selected.airports.clear();



  // =====================================================
  // DEFAULTS
  // =====================================================
  const currentYear = String(new Date().getFullYear());

  if (years.includes(currentYear)) {
    selected.years.add(currentYear);
  } else if (years.length) {
    selected.years.add(years[0]);
  }

  if (types.includes("Flight")) {
    selected.types.add("Flight");
  }

  airports.forEach(a => selected.airports.add(a.value));

 

  // =====================================================
  // BUILD MENUS
  // =====================================================
  buildFilterMenu("filter-year", years, selected.years);
  buildFilterMenu("filter-airline", airlines, selected.airlines);
  buildFilterMenu("filter-type", types, selected.types);
  buildFilterMenu("filter-airport", airports, selected.airports);



  // =====================================================
  // INITIAL LOAD
  // =====================================================
  loadRoutes();
}

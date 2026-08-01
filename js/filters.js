// =====================================================
// FILTER UI (checkbox dropdowns)
//
// This file has two responsibilities:
//    Build and control the four checkbox dropdowns:
//    Year
//    Airline
//    Journey type
//    Airport
//    Load the available filter values from Supabase and establish the initial selections.
//
// Its overall sequence is:
//    loadFilters()
//    ↓
//    Read available route metadata from Supabase
//    ↓
//    Create unique lists of years, airlines, journey types and airports
//    ↓
//    Look up airport display names
//    ↓
//    Add virtual city groups such as London and Paris
//    ↓
//    Set default selections
//    ↓
//    Build the four dropdown menus
//    ↓
//    Call loadRoutes()
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

  // -------------------------------------------------
  // SELECT ALL
  // -------------------------------------------------
  selectAll.onclick = () => {
    targetSet.clear();

    values.forEach(v => {
      if (v.divider) return;
      const value = typeof v === "object" ? v.value : v;
      targetSet.add(value);
    });

    list.querySelectorAll("input")
      .forEach(cb => (cb.checked = true));

    loadRoutes();
  };

  // -------------------------------------------------
  // CLEAR
  // -------------------------------------------------
  clear.onclick = () => {
    targetSet.clear();

    list.querySelectorAll("input")
      .forEach(cb => (cb.checked = false));

    loadRoutes();
  };

// -------------------------------------------------
// TOGGLE DROPDOWN
// Only one filter menu can be open at a time
// -------------------------------------------------
toggle.onclick = e => {
  e.preventDefault();
  e.stopPropagation();

  const wasOpen =
    menu.classList.contains("open");

  // Close every other open filter menu
  document
    .querySelectorAll(".filter-menu.open")
    .forEach(openMenu => {
      if (openMenu !== menu) {
        openMenu.classList.remove("open");
      }
    });

  // Toggle the menu that was clicked
  menu.classList.toggle(
    "open",
    !wasOpen
  );
};


// =====================================================
// CLOSE DROPDOWNS ON OUTSIDE CLICK
// =====================================================
document.addEventListener("click", e => {
  if (e.target.closest(".filter")) return;

  document
    .querySelectorAll(".filter-menu.open")
    .forEach(m => m.classList.remove("open"));
});



// =====================================================
// LOAD FILTERS
// =====================================================
async function loadFilters() {

  const { data, error } = await sb
    .from("journeys_routes_core_mv")
    .select("year, airline, journey_type, origin, destination");

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
  // AIRPORT CODES USED IN ROUTES
  // =====================================================
  const airportSet = new Set();

  (data || []).forEach(d => {
    if (d.journey_type === "Flight") {
      if (d.origin) airportSet.add(d.origin);
      if (d.destination) airportSet.add(d.destination);
    }
  });

  //let airportCodes = [...airportSet].sort();
  const airportCodes = [...airportSet].sort();

  // =====================================================
  // FETCH DISPLAY NAMES
  // =====================================================
  let airportMap = {};

  if (airportCodes.length) {
    const { data: airportData, error: airportError } =
      await sb
        .from("journey_locations")
        .select("airport_code, airport")
        .in("airport_code", airportCodes);

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
  //const AIRPORT_GROUPS = {
  //  London: ["LHR","LGW","LCY","SEN","LTN","STN"],
  //  Berlin: ["BER","SXF","TXL"],
  //  Milan: ["MXP","LIN","BGY"],
  //  Bangkok: ["BKK","DMK"],
  //  'New York': ["JFK","EWR","LGA"],
  //  Washington: ["DCA","BWI","IAD"],
  //  Rome: ["FCO","CIA"],
  //  Paris: ["CDG","BVA","ORY"]
  //};

  const groupItems = [];
  const airportItems = [];

  Object.entries(AIRPORT_GROUPS).forEach(([group, members]) => {
    if (airportCodes.some(code => members.includes(code))) {
      groupItems.push({
        value: group,
        label: `${group} (All Airports)`
      });
    }
  });

  airportCodes.forEach(code => {
    airportItems.push({
      value: code,
      label: airportMap[code] || code
    });
  });

  // ✅ Sort alphabetically by airport name (label)
  airportItems.sort((a, b) =>
    a.label.localeCompare(b.label)
  );
  
  // Divider between groups + singles
  let airports;
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
  selected.airports = selected.airports || new Set();
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

  airports.forEach(a => {
    if (a.value) selected.airports.add(a.value);
  });

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

/* global sb, selected, AIRPORT_GROUPS, loadRoutes */

// =====================================================
// FILTERS
// =====================================================
//
// Builds and manages the application's five checkbox
// dropdown filters:
//
//   • Year
//   • Airline
//   • Journey type
//   • Airport
//   • Cabin / class
//
// Airline and Airport filters also provide text search.
//
// Filter values are derived from the available journey
// data in Supabase. Existing valid selections are
// preserved whenever the menus are rebuilt.
//
// Airport groups such as London and Paris are defined
// centrally in config.js.
//
// Public API:
//   loadFilters()
//
// =====================================================


// =====================================================
// FILTER MENU
// =====================================================

/**
 * Builds one checkbox dropdown filter.
 *
 * Values may be strings or objects in the form:
 *
 *   {
 *     value: "LHR",
 *     label: "London Heathrow (LHR)"
 *   }
 *
 * Divider objects use:
 *
 *   {
 *     divider: true
 *   }
 *
 * @param {string} containerId
 * @param {Array} values
 * @param {Set} targetSet
 */
function buildFilterMenu(
  containerId,
  values,
  targetSet
) {
  const container =
    document.getElementById(containerId);

  if (!container) {
    return;
  }

  const list =
    container.querySelector(".filter-options");

  const toggle =
    container.querySelector(".filter-toggle");

  const menu =
    container.querySelector(".filter-menu");

  const selectAll =
    container.querySelector(".select-all");

  const clear =
    container.querySelector(".clear");

  if (
    !list ||
    !toggle ||
    !menu ||
    !selectAll ||
    !clear
  ) {
    return;
  }

  list.innerHTML = "";


  // ---------------------------------------------------
  // SEARCH
  // ---------------------------------------------------

  /*
   * Airline and Airport contain potentially long option
   * lists, so these two filters include text search.
   */
  const searchable =
    containerId === "filter-airline" ||
    containerId === "filter-airport";

  let searchInput = null;

  if (searchable) {
    const searchWrapper =
      document.createElement("div");

    searchWrapper.className =
      "filter-search-wrapper";

    searchInput =
      document.createElement("input");

    searchInput.type = "search";
    searchInput.className = "filter-search";
    searchInput.autocomplete = "off";

    if (containerId === "filter-airport") {
      searchInput.placeholder =
        "Search airports...";

      searchInput.setAttribute(
        "aria-label",
        "Search airports"
      );
    } else {
      searchInput.placeholder =
        "Search airlines...";

      searchInput.setAttribute(
        "aria-label",
        "Search airlines"
      );
    }

    searchWrapper.appendChild(searchInput);
    list.appendChild(searchWrapper);
  }


  // ---------------------------------------------------
  // OPTIONS
  // ---------------------------------------------------

  values.forEach(item => {
    if (item?.divider) {
      const divider =
        document.createElement("div");

      divider.className = "filter-divider";

      /*
       * Search uses this attribute to temporarily hide
       * dividers while displaying matching results.
       */
      divider.dataset.filterDivider = "true";

      list.appendChild(divider);

      return;
    }

    const value =
      typeof item === "object"
        ? item.value
        : item;

    const labelText =
      typeof item === "object"
        ? item.label
        : item;

    const label =
      document.createElement("label");

    const checkbox =
      document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.value = value;
    checkbox.checked = targetSet.has(value);

    /*
     * Store normalized search text on the option row so
     * searches do not need to reconstruct it repeatedly.
     */
    label.dataset.searchText =
      `${value} ${labelText}`.toLowerCase();

    label.appendChild(checkbox);
    label.append(
      document.createTextNode(` ${labelText}`)
    );

    checkbox.addEventListener(
      "change",
      () => {
        if (checkbox.checked) {
          targetSet.add(value);
        } else {
          targetSet.delete(value);
        }

        loadRoutes();
      }
    );

    list.appendChild(label);
  });


  // ---------------------------------------------------
  // SEARCH FILTERING
  // ---------------------------------------------------

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      () => {
        const query =
          searchInput.value
            .trim()
            .toLowerCase();

        const optionLabels =
          list.querySelectorAll(
            "label[data-search-text]"
          );

        optionLabels.forEach(label => {
          const searchText =
            label.dataset.searchText || "";

          const matches =
            !query ||
            searchText.includes(query);

          label.style.display =
            matches ? "" : "none";
        });

        /*
         * Dividers are useful in the complete Airport
         * list but unnecessary in filtered search results.
         */
        list
          .querySelectorAll(
            '[data-filter-divider="true"]'
          )
          .forEach(divider => {
            divider.style.display =
              query ? "none" : "";
          });
      }
    );

    /*
     * Keep clicks inside the search field from affecting
     * the surrounding dropdown controls.
     */
    searchInput.addEventListener(
      "click",
      event => {
        event.stopPropagation();
      }
    );
  }


  // ---------------------------------------------------
  // SELECT ALL
  // ---------------------------------------------------

  selectAll.onclick = () => {
    targetSet.clear();

    values.forEach(item => {
      if (item?.divider) {
        return;
      }

      const value =
        typeof item === "object"
          ? item.value
          : item;

      targetSet.add(value);
    });

    list
      .querySelectorAll(
        'input[type="checkbox"]'
      )
      .forEach(checkbox => {
        checkbox.checked = true;
      });

    loadRoutes();
  };


  // ---------------------------------------------------
  // CLEAR
  // ---------------------------------------------------

  clear.onclick = () => {
    targetSet.clear();

    list
      .querySelectorAll(
        'input[type="checkbox"]'
      )
      .forEach(checkbox => {
        checkbox.checked = false;
      });

    loadRoutes();
  };


  // ---------------------------------------------------
  // OPEN / CLOSE DROPDOWN
  // ---------------------------------------------------

  toggle.onclick = event => {
    event.preventDefault();
    event.stopPropagation();

    const wasOpen =
      menu.classList.contains("open");

    /*
     * Only one filter dropdown should be open at a time.
     */
    document
      .querySelectorAll(".filter-menu.open")
      .forEach(openMenu => {
        if (openMenu !== menu) {
          openMenu.classList.remove("open");
        }
      });

    menu.classList.toggle(
      "open",
      !wasOpen
    );

    /*
     * When a searchable dropdown opens, place the cursor
     * directly in its search field.
     */
    if (!wasOpen && searchInput) {
      requestAnimationFrame(() => {
        searchInput.focus();
      });
    }
  };
}


// =====================================================
// CLOSE DROPDOWNS ON OUTSIDE CLICK
// =====================================================

document.addEventListener(
  "click",
  event => {
    if (event.target.closest(".filter")) {
      return;
    }

    document
      .querySelectorAll(".filter-menu.open")
      .forEach(menu => {
        menu.classList.remove("open");
      });
  }
);


// =====================================================
// SELECTION HELPERS
// =====================================================

/**
 * Restores values from a previous Set when those values
 * still exist in the newly available filter options.
 *
 * @param {Set} previousValues
 * @param {Array|Set} validValues
 * @param {Set} targetSet
 */
function restoreValidSelections(
  previousValues,
  validValues,
  targetSet
) {
  const validSet =
    validValues instanceof Set
      ? validValues
      : new Set(validValues);

  previousValues.forEach(value => {
    if (validSet.has(value)) {
      targetSet.add(value);
    }
  });
}


// =====================================================
// LOAD FILTER VALUES
// =====================================================

/**
 * Loads available filter metadata from Supabase, rebuilds
 * the five filter menus and performs the initial route load.
 *
 * Existing selections are retained where they remain valid.
 */
async function loadFilters() {
  // Preserve current selections before rebuilding menus.
  const previousSelections = {
    years: new Set(selected.years),
    airlines: new Set(selected.airlines),
    types: new Set(selected.types),
    airports: new Set(selected.airports),
    cabins: new Set(selected.cabins)
  };

  const { data, error } = await sb
    .from("journeys_routes_core_3_mv")
    .select(`
      year,
      airline,
      journey_type,
      origin,
      destination,
      cabin
    `);

  if (error) {
    console.error(
      "[filters] Filter metadata load failed:",
      error
    );

    return;
  }

  const rows = data || [];


  // ---------------------------------------------------
  // YEARS
  // ---------------------------------------------------

  const years = [
    ...new Set(
      rows
        .map(row =>
          row.year
            ? String(row.year).slice(0, 4)
            : null
        )
        .filter(Boolean)
    )
  ].sort(
    (yearA, yearB) =>
      yearB.localeCompare(yearA)
  );


  // ---------------------------------------------------
  // AIRLINES
  // ---------------------------------------------------

  const airlines = [
    ...new Set(
      rows
        .map(row => row.airline)
        .filter(Boolean)
    )
  ].sort(
    (airlineA, airlineB) =>
      airlineA.localeCompare(airlineB)
  );


  // ---------------------------------------------------
  // JOURNEY TYPES
  // ---------------------------------------------------

  const types = [
    ...new Set(
      rows
        .map(row => row.journey_type)
        .filter(Boolean)
    )
  ].sort(
    (typeA, typeB) =>
      typeA.localeCompare(typeB)
  );


  // ---------------------------------------------------
  // CABIN / CLASS
  // ---------------------------------------------------

  /*
   * Cabin options use a fixed display order rather than
   * alphabetical ordering.
   */
  const cabinOrder = [
    "First",
    "Business",
    "Premium Economy",
    "Economy"
  ];

  const availableCabins = new Set(
    rows
      .map(row => row.cabin)
      .filter(Boolean)
  );

  const cabins = cabinOrder.filter(
    cabin => availableCabins.has(cabin)
  );


  // ---------------------------------------------------
  // AIRPORT CODES USED BY FLIGHTS
  // ---------------------------------------------------

  const airportSet = new Set();

  rows.forEach(row => {
    if (row.journey_type !== "Flight") {
      return;
    }

    if (row.origin) {
      airportSet.add(row.origin);
    }

    if (row.destination) {
      airportSet.add(row.destination);
    }
  });

  const airportCodes = [
    ...airportSet
  ].sort();


  // ---------------------------------------------------
  // AIRPORT DISPLAY NAMES
  // ---------------------------------------------------

  const airportMap = {};

  if (airportCodes.length) {
    const {
      data: airportData,
      error: airportError
    } = await sb
      .from("journey_locations")
      .select("airport_code, airport")
      .in("airport_code", airportCodes);

    if (airportError) {
      console.error(
        "[filters] Airport lookup failed:",
        airportError
      );
    } else {
      (airportData || []).forEach(airport => {
        airportMap[airport.airport_code] =
          `${airport.airport} ` +
          `(${airport.airport_code})`;
      });
    }
  }


  // ---------------------------------------------------
  // AIRPORT GROUPS
  // ---------------------------------------------------

  /*
   * AIRPORT_GROUPS is defined in config.js.
   *
   * A group is offered only when at least one of its
   * member airports occurs in the available flight data.
   */
  const groupItems = [];

  Object.entries(AIRPORT_GROUPS).forEach(
    ([group, members]) => {
      const groupUsed =
        airportCodes.some(
          code => members.includes(code)
        );

      if (!groupUsed) {
        return;
      }

      groupItems.push({
        value: group,
        label: `${group} (All Airports)`
      });
    }
  );


  // ---------------------------------------------------
  // INDIVIDUAL AIRPORTS
  // ---------------------------------------------------

  const airportItems =
    airportCodes.map(code => ({
      value: code,
      label: airportMap[code] || code
    }));

  /*
   * Individual airports are sorted by their display name,
   * not by IATA code.
   */
  airportItems.sort(
    (airportA, airportB) =>
      airportA.label.localeCompare(
        airportB.label
      )
  );


  // ---------------------------------------------------
  // COMPLETE AIRPORT MENU
  // ---------------------------------------------------

  const airports =
    groupItems.length && airportItems.length
      ? [
          ...groupItems,
          { divider: true },
          ...airportItems
        ]
      : [
          ...groupItems,
          ...airportItems
        ];


  // ---------------------------------------------------
  // RESET AND RESTORE VALID SELECTIONS
  // ---------------------------------------------------

  selected.years.clear();
  selected.airlines.clear();
  selected.types.clear();
  selected.airports.clear();
  selected.cabins.clear();

  restoreValidSelections(
    previousSelections.years,
    years,
    selected.years
  );

  restoreValidSelections(
    previousSelections.airlines,
    airlines,
    selected.airlines
  );

  restoreValidSelections(
    previousSelections.types,
    types,
    selected.types
  );

  /*
   * Airport options contain both objects and a divider,
   * so first construct the set of actual selectable values.
   */
  const validAirportValues = new Set(
    airports
      .filter(item => !item.divider)
      .map(item =>
        typeof item === "object"
          ? item.value
          : item
      )
  );

  restoreValidSelections(
    previousSelections.airports,
    validAirportValues,
    selected.airports
  );

  restoreValidSelections(
    previousSelections.cabins,
    cabins,
    selected.cabins
  );


  // ---------------------------------------------------
  // DEFAULT SELECTIONS
  // ---------------------------------------------------

  /*
   * Defaults are applied only when no valid previous
   * selection remains.
   */

  const currentYear =
    String(new Date().getFullYear());

  if (selected.years.size === 0) {
    if (years.includes(currentYear)) {
      selected.years.add(currentYear);
    } else if (years.length) {
      selected.years.add(years[0]);
    }
  }

  if (
    selected.types.size === 0 &&
    types.includes("Flight")
  ) {
    selected.types.add("Flight");
  }

  /*
   * Empty Airline and Airport Sets deliberately mean
   * "do not restrict by this filter".
   */


  // ---------------------------------------------------
  // BUILD FILTER MENUS
  // ---------------------------------------------------

  buildFilterMenu(
    "filter-year",
    years,
    selected.years
  );

  buildFilterMenu(
    "filter-airline",
    airlines,
    selected.airlines
  );

  buildFilterMenu(
    "filter-type",
    types,
    selected.types
  );

  buildFilterMenu(
    "filter-airport",
    airports,
    selected.airports
  );

  buildFilterMenu(
    "filter-cabin",
    cabins,
    selected.cabins
  );


  // ---------------------------------------------------
  // INITIAL ROUTE LOAD
  // ---------------------------------------------------

  await loadRoutes();
}

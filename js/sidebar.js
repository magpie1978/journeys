/* global
  AIRPORT_GROUPS,
  applyMapMode,
  fitToCurrentRouteView,
  fitToVisibleCountries,
  getAirlineLogo,
  map,
  placeholderIcons,
  setIsolatedRoute,
  setMapMode
*/

// =====================================================
// SIDEBAR
// =====================================================
//
// Controls the application's left-hand sidebar.
//
// Responsibilities:
//   • Builds the journey list.
//   • Chooses an operator logo or journey-type icon.
//   • Opens and closes the Airlines slide-out panel.
//   • Collapses and expands the sidebar.
//   • Switches between Routes and Countries map modes.
//
// Journey-list flow:
//
//   renderRoutes(routes)
//       ↓
//   renderSidebar(routes)
//       ↓
//   Create one <li> for each journey
//       ↓
//   Show logo, route and date
//       ↓
//   Click → setIsolatedRoute(uid)
//
// Public API:
//   window.getJourneyIcon(route)
//   window.renderSidebar(routes)
//   window.getSidebarLeftPad()
//   window.renderAirlinesPanel(routes)
//
// =====================================================


// =====================================================
// DOM REFERENCES
// =====================================================

const sidebarElement =
  document.getElementById("sidebar");

const sidebarToggleElement =
  document.getElementById("sidebarToggle");

const flightListElement =
  document.getElementById("flightList");

const airlinesBoxElement =
  document.getElementById("airlinesBox");

const airlinesPanelElement =
  document.getElementById("airlinesPanel");

const airlinesListElement =
  document.getElementById("airlinesList");

/*
 * The Countries statistic card also acts as the
 * Routes/Countries mode toggle.
 */
const countriesBoxElement =
  document.getElementById("countriesCounter");


// =====================================================
// BASIC HELPERS
// =====================================================

/**
 * Escapes text before inserting it into an HTML string.
 *
 * @param {*} value
 * @returns {string}
 */
function escapeSidebarHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/**
 * Returns the journey type in normalized lowercase form.
 *
 * @param {Object} route
 * @returns {string}
 */
function getJourneyType(route) {
  return String(
    route?.journey_type || ""
  ).toLowerCase();
}


/**
 * Formats a journey date for the compact sidebar display.
 *
 * @param {*} dateValue
 * @returns {string}
 */
function formatSidebarDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  return String(dateValue).slice(0, 10);
}


// =====================================================
// JOURNEY ICON
// =====================================================

/**
 * Returns the most appropriate icon for a journey.
 *
 * Flights, buses and trains first try to use a specific
 * operator logo. If no operator logo exists, the generic
 * icon for the journey type is used instead.
 *
 * @param {Object} route
 * @returns {string|null}
 */
function getJourneyIcon(route) {
  if (!route) {
    return null;
  }

  const journeyType =
    getJourneyType(route);

  const supportsOperatorLogo =
    journeyType === "flight" ||
    journeyType === "bus" ||
    journeyType === "train";

  if (
    supportsOperatorLogo &&
    typeof getAirlineLogo === "function"
  ) {
    const operatorLogo =
      getAirlineLogo(route.airline);

    if (operatorLogo) {
      return operatorLogo;
    }
  }

  return placeholderIcons?.[journeyType] || null;
}


// =====================================================
// RENDER SIDEBAR
// =====================================================

/**
 * Rebuilds the sidebar journey list.
 *
 * The active journey receives the "active" class.
 * Cmd-click on macOS or Ctrl-click elsewhere adds/removes
 * journeys from the current multi-route selection.
 *
 * @param {Array} routes
 */
function renderSidebar(routes) {
  if (!flightListElement) {
    return;
  }

  flightListElement.innerHTML = "";

  const safeRoutes =
    Array.isArray(routes)
      ? routes
          .filter(Boolean)
          .sort((a, b) => {
            const timeA =
              new Date(a.journey_date).getTime() || 0;
  
            const timeB =
              new Date(b.journey_date).getTime() || 0;
  
            return timeB - timeA;
          })
      : [];  
  
  const isolatedUid =
    window.appState?.isolatedUid;

  safeRoutes.forEach(route => {
    const listItem =
      document.createElement("li");

    const routeUid =
      route.uid != null
        ? String(route.uid)
        : "";

    listItem.dataset.uid =
      routeUid;

    listItem.classList.toggle(
      "active",
      isolatedUid != null &&
      String(isolatedUid) === routeUid
    );


    // -------------------------------------------------
    // ICON / LOGO
    // -------------------------------------------------

    const logoUrl =
      getJourneyIcon(route);

    const logoClass =
      getJourneyType(route) === "flight"
        ? "airline-logo"
        : "journey-logo";

    const airlineOrType =
      route.airline ||
      route.journey_type ||
      "";


    // -------------------------------------------------
    // ROUTE DISPLAY
    // -------------------------------------------------

    /*
     * Prefer the display endpoints supplied by
     * journeys_routes_2. These allow journey_details
     * overrides to be shown where applicable.
     */
    const displayOrigin =
      String(
        route.display_origin ||
        route.origin ||
        ""
      ).trim();

    const displayDestination =
      String(
        route.display_destination ||
        route.destination ||
        ""
      ).trim();

    let routeDisplay;

    /*
     * Circular or single-location journeys display only
     * one location rather than "Location → Location".
     */
    if (
      displayOrigin &&
      (
        !displayDestination ||
        displayOrigin === displayDestination
      )
    ) {
      routeDisplay =
        escapeSidebarHtml(displayOrigin);
    } else {
      routeDisplay = `
        ${escapeSidebarHtml(displayOrigin)}
        →
        ${escapeSidebarHtml(displayDestination)}
      `;
    }


    // -------------------------------------------------
    // LIST ITEM
    // -------------------------------------------------

    listItem.innerHTML = `
      <div class="sidebar-row">

        <div class="sidebar-logo">
          ${
            logoUrl
              ? `
                <img
                  class="${logoClass}"
                  src="${escapeSidebarHtml(logoUrl)}"
                  alt="${escapeSidebarHtml(airlineOrType)}"
                  onerror="this.style.display='none'"
                >
              `
              : ""
          }
        </div>

        <div class="sidebar-text">

          <div class="sidebar-route">
            <strong>
              ${routeDisplay}
            </strong>
          </div>

          <div class="sidebar-date">
            ${escapeSidebarHtml(
              formatSidebarDate(
                route.journey_date
              )
            )}
          </div>

        </div>

      </div>
    `;


    // -------------------------------------------------
    // ROUTE SELECTION
    // -------------------------------------------------

    listItem.addEventListener(
      "click",
      event => {
        const additiveSelection =
          event.ctrlKey ||
          event.metaKey;

        if (
          typeof setIsolatedRoute ===
          "function"
        ) {
          setIsolatedRoute(
            route.uid,
            additiveSelection
          );
        }
      }
    );

    flightListElement.appendChild(
      listItem
    );
  });
}

window.renderSidebar =
  renderSidebar;


// =====================================================
// SIDEBAR-AWARE MAP PADDING
// =====================================================

/**
 * Returns the left-hand map padding required to prevent
 * routes from being obscured by the sidebar.
 *
 * @returns {number}
 */
function getSidebarLeftPad() {
  if (!sidebarElement) {
    return 100;
  }

  if (
    sidebarElement.classList.contains(
      "collapsed"
    )
  ) {
    return 80;
  }

  return (
    sidebarElement.offsetWidth || 260
  ) + 80;
}

window.getSidebarLeftPad =
  getSidebarLeftPad;


// =====================================================
// AIRLINES PANEL
// =====================================================

/**
 * Rebuilds the Airlines slide-out panel from the supplied
 * routes.
 *
 * Duplicate airline names are removed and the resulting
 * list is sorted alphabetically.
 *
 * @param {Array} routes
 */
function renderAirlinesPanel(routes) {
  if (!airlinesListElement) {
    return;
  }

  const safeRoutes =
    Array.isArray(routes)
      ? routes
      : [];

  const airlines = [
    ...new Set(
      safeRoutes
        .map(route => route?.airline)
        .filter(Boolean)
    )
  ].sort(
    (airlineA, airlineB) =>
      String(airlineA).localeCompare(
        String(airlineB)
      )
  );

  airlinesListElement.innerHTML = "";

  airlines.forEach(name => {
    const listItem =
      document.createElement("li");

    const logoUrl =
      typeof getAirlineLogo === "function"
        ? getAirlineLogo(name)
        : null;

    listItem.innerHTML = `
      ${
        logoUrl
          ? `
            <img
              src="${escapeSidebarHtml(logoUrl)}"
              alt="${escapeSidebarHtml(name)}"
              onerror="this.style.display='none'"
            >
          `
          : ""
      }

      <span>
        ${escapeSidebarHtml(name)}
      </span>
    `;

    airlinesListElement.appendChild(
      listItem
    );
  });
}



// =====================================================
// AIRLINES SLIDE-OUT PANEL
// =====================================================

if (
  airlinesBoxElement &&
  airlinesPanelElement
) {
  airlinesBoxElement.addEventListener(
    "click",
    () => {
      const isOpen =
        airlinesPanelElement
          .classList
          .contains("visible");

      if (isOpen) {
        airlinesPanelElement
          .classList
          .remove("visible");

        airlinesPanelElement
          .classList
          .add("hidden");

        return;
      }

      /*
       * Build the panel from the routes currently shown
       * on the map rather than the complete route set.
       */
      renderAirlinesPanel(
        Array.isArray(
          window.currentRoutes
        )
          ? window.currentRoutes
          : []
      );

      airlinesPanelElement
        .classList
        .remove("hidden");

      airlinesPanelElement
        .classList
        .add("visible");
    }
  );
}


// =====================================================
// SIDEBAR COLLAPSE / EXPAND
// =====================================================

if (
  sidebarToggleElement &&
  sidebarElement
) {
  sidebarToggleElement.addEventListener(
    "click",
    () => {
      const collapsed =
        sidebarElement.classList.toggle(
          "collapsed"
        );

      if (flightListElement) {
        flightListElement.style.display =
          collapsed ? "none" : "";
      }

      /*
       * Wait for the CSS width transition before resizing
       * the Mapbox canvas and recalculating its camera.
       */
      setTimeout(() => {
        if (
          typeof map !== "undefined" &&
          map
        ) {
          map.resize();
        }

        const currentMode =
          window.appState?.mode ||
          "routes";

        if (currentMode === "countries") {
          if (
            typeof fitToVisibleCountries ===
            "function"
          ) {
            fitToVisibleCountries();
          }

          return;
        }

        if (
          typeof fitToCurrentRouteView ===
          "function"
        ) {
          fitToCurrentRouteView();
        }
      }, 250);
    }
  );
}


// =====================================================
// COUNTRIES / ROUTES MODE TOGGLE
// =====================================================

if (countriesBoxElement) {
  countriesBoxElement.addEventListener(
    "click",
    () => {
      const currentMode =
        window.appState?.mode ||
        "routes";

      const nextMode =
        currentMode === "routes"
          ? "countries"
          : "routes";

      /*
       * setMapMode() is the authoritative mode-switching
       * API. It updates application state and applies the
       * corresponding Mapbox layer/camera changes.
       */
      if (
        typeof setMapMode === "function"
      ) {
        setMapMode(nextMode);
      }
    }
  );
}

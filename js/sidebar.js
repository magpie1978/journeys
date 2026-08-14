// =====================================================
// SIDEBAR.JS
// 
// This file has five responsibilities:
//    Builds the journey list shown in the left sidebar.
//    Chooses an airline or operator logo for each journey.
//    Opens and closes the Airlines slide-out panel.
//    Collapses and expands the sidebar.
//    Switches between Routes and Countries map modes.
// 
// The overall flow is:
//    renderRoutes(routes)
//        ↓
//    renderSidebar(routes)
//        ↓
//    Create one <li> for each journey
//        ↓
//    Show logo, journey type, route and date
//        ↓
//    Clicking an item calls setIsolatedRoute(uid)

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

const countriesBoxElement =
  //document.getElementById("countriesBox");
  document.getElementById("countriesCounter");


// =====================================================
// BASIC HELPERS
// =====================================================

function escapeSidebarHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function getJourneyType(route) {
  return String(
    route?.journey_type || ""
  ).toLowerCase();
}


function formatSidebarDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  return String(dateValue).slice(0, 10);
}


// =====================================================
// JOURNEY ICON
// =====================================================

function getJourneyIcon(route) {

  if (!route) {
    return null;
  }

  const journeyType =
    getJourneyType(route);

  /*
   * First try to use a specific operator logo
   * where one exists.
   */
  if (
    journeyType === "flight" ||
    journeyType === "bus" ||
    journeyType === "train"
  ) {

    if (
      typeof getAirlineLogo === "function"
    ) {

      const operatorLogo =
        getAirlineLogo(route.airline);

      if (operatorLogo) {
        return operatorLogo;
      }
    }
  }

  return placeholderIcons[journeyType] || null;
}

window.getJourneyIcon =
  getJourneyIcon;


// =====================================================
// RENDER SIDEBAR
// =====================================================

function renderSidebar(routes) {
  if (!flightListElement) {
    return;
  }

  flightListElement.innerHTML = "";

  const safeRoutes =
    Array.isArray(routes)
      ? routes.filter(Boolean)
      : [];

  safeRoutes.forEach(route => {
    const listItem =
      document.createElement("li");

    const routeUid =
      route.uid != null
        ? String(route.uid)
        : "";

    listItem.dataset.uid =
      routeUid;

    const isolatedUid =
      window.appState?.isolatedUid;

    listItem.classList.toggle(
      "active",
      isolatedUid != null &&
      String(isolatedUid) === routeUid
    );

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

          <div class="sidebar-journey-type">
            ${escapeSidebarHtml(route.journey_type)}
          </div>

          <div class="sidebar-route">
            <strong>
              ${
                (
                  (route.display_origin || route.origin) ===
                  (route.display_destination || route.destination)
                )
                  ? escapeSidebarHtml(
                      route.display_origin || route.origin
                    )
                  : `
                      ${escapeSidebarHtml(
                        route.display_origin || route.origin
                      )}
                      →
                      ${escapeSidebarHtml(
                        route.display_destination || route.destination
                      )}
                    `
              }
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

    listItem.addEventListener(
      "click",
      () => {
        /*
         * setIsolatedRoute() now handles:
         * - selected-row styling;
         * - route opacity and width;
         * - flight summary display;
         * - camera fitting.
         */
        if (
          typeof setIsolatedRoute ===
          "function"
        ) {
          setIsolatedRoute(
            route.uid
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
    sidebarElement.offsetWidth ||
    260
  ) + 80;
}

window.getSidebarLeftPad =
  getSidebarLeftPad;


// =====================================================
// AIRLINES PANEL
// =====================================================

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
        .map(route =>
          route?.airline
        )
        .filter(Boolean)
    )
  ].sort((airlineA, airlineB) =>
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

window.renderAirlinesPanel =
  renderAirlinesPanel;


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
      sidebarElement.classList.toggle(
        "collapsed"
      );

      if (flightListElement) {
        flightListElement.style.display =
          sidebarElement.classList.contains(
            "collapsed"
          )
            ? "none"
            : "";
      }

      /*
       * Wait for the CSS width transition before resizing
       * and refitting the Mapbox canvas.
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
          (
            typeof mapMode !== "undefined"
              ? mapMode
              : "routes"
          );

        if (
          currentMode === "countries"
        ) {
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
        (
          typeof mapMode !== "undefined"
            ? mapMode
            : "routes"
        );

      const nextMode =
        currentMode === "routes"
          ? "countries"
          : "routes";

      if (
        typeof setMapMode === "function"
      ) {
        setMapMode(nextMode);
        return;
      }

      /*
       * Compatibility fallback for older route code.
       */
      if (window.appState) {
        window.appState.mode =
          nextMode;
      }

      if (
        typeof mapMode !== "undefined"
      ) {
        mapMode =
          nextMode;
      }

      if (
        typeof applyMapMode ===
        "function"
      ) {
        applyMapMode();
      }
    }
  );
}

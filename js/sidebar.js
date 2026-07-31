// =====================================================
// SIDEBAR
// =====================================================


// =====================================================
// JOURNEY ICON
// =====================================================

function getJourneyIcon(route) {
  if (!route) return null;

  // Flights → airline tailfin
  if (route.journey_type === "Flight") {
    return getAirlineLogo(route.airline);
  }

  // Bus / Train → operator logo if available
  if (
    route.journey_type === "Bus" ||
    route.journey_type === "Train"
  ) {
    return getAirlineLogo(route.airline);
  }

  return null;
}


// =====================================================
// RENDER SIDEBAR
// =====================================================

function renderSidebar(routes) {
  if (
    typeof flightListEl === "undefined" ||
    !flightListEl
  ) {
    return;
  }

  flightListEl.innerHTML = "";

  (routes || []).forEach(route => {
    if (!route) return;

    const li = document.createElement("li");

    li.dataset.uid =
      route.uid != null
        ? String(route.uid)
        : "";

    li.classList.toggle(
      "active",
      Boolean(appState?.isolatedUid) &&
      String(route.uid) ===
        String(appState.isolatedUid)
    );

    const logoUrl =
      getJourneyIcon(route);

    const logoClass =
      route.journey_type === "Flight"
        ? "airline-logo"
        : "journey-logo";

    li.innerHTML = `
      <div class="sidebar-row">

        <div class="sidebar-logo">
          ${
            logoUrl
              ? `
                <img
                  class="${logoClass}"
                  src="${logoUrl}"
                  alt="${route.airline || route.journey_type || ""}"
                  onerror="this.style.display='none'"
                />
              `
              : ""
          }
        </div>

        <div class="sidebar-text">

          <div class="sidebar-journey-type">
            ${route.journey_type || ""}
          </div>

          <div class="sidebar-route">
            <strong>
              ${route.origin || ""} → ${route.destination || ""}
            </strong>
          </div>

          <div class="sidebar-date">
            ${route.journey_date?.slice(0, 10) || ""}
          </div>

        </div>
      </div>
    `;

    li.addEventListener("click", () => {
      if (
        typeof setIsolatedRoute === "function"
      ) {
        setIsolatedRoute(route.uid);
      }
    });

    flightListEl.appendChild(li);
  });
}

window.renderSidebar = renderSidebar;


// =====================================================
// SIDEBAR-AWARE MAP PADDING
// =====================================================

function getSidebarLeftPad() {
  const sidebarElement =
    typeof sidebar !== "undefined"
      ? sidebar
      : document.getElementById("sidebar");

  if (!sidebarElement) {
    return 100;
  }

  return sidebarElement.classList.contains("collapsed")
    ? 80
    : (sidebarElement.offsetWidth || 280) + 80;
}

window.getSidebarLeftPad = getSidebarLeftPad;


// =====================================================
// AIRLINES PANEL
// =====================================================

function renderAirlinesPanel(routes) {
  if (
    typeof airlinesListEl === "undefined" ||
    !airlinesListEl
  ) {
    return;
  }

  const airlines = [
    ...new Set(
      (routes || [])
        .map(route => route?.airline)
        .filter(Boolean)
    )
  ].sort((a, b) =>
    String(a).localeCompare(String(b))
  );

  airlinesListEl.innerHTML = "";

  airlines.forEach(name => {
    const li = document.createElement("li");

    const logoUrl =
      typeof getAirlineLogo === "function"
        ? getAirlineLogo(name)
        : "";

    li.innerHTML = `
      ${
        logoUrl
          ? `
            <img
              src="${logoUrl}"
              alt="${name}"
              onerror="this.style.display='none'"
            />
          `
          : ""
      }
      <span>${name}</span>
    `;

    airlinesListEl.appendChild(li);
  });
}

window.renderAirlinesPanel =
  renderAirlinesPanel;


// =====================================================
// AIRLINES SLIDE-OUT CONTAINER
// =====================================================

if (
  typeof airlinesBox !== "undefined" &&
  airlinesBox
) {
  airlinesBox.addEventListener("click", () => {
    if (
      typeof airlinesPanel === "undefined" ||
      !airlinesPanel
    ) {
      return;
    }

    const isOpen =
      airlinesPanel.classList.contains("visible");

    if (isOpen) {
      airlinesPanel.classList.remove("visible");
      airlinesPanel.classList.add("hidden");
      return;
    }

    renderAirlinesPanel(
      Array.isArray(window.currentRoutes)
        ? window.currentRoutes
        : []
    );

    airlinesPanel.classList.remove("hidden");
    airlinesPanel.classList.add("visible");
  });
}


// =====================================================
// SIDEBAR TOGGLE
// =====================================================

if (
  typeof sidebarToggle !== "undefined" &&
  sidebarToggle
) {
  sidebarToggle.addEventListener("click", () => {
    const sidebarElement =
      typeof sidebar !== "undefined"
        ? sidebar
        : document.getElementById("sidebar");

    if (!sidebarElement) return;

    sidebarElement.classList.toggle(
      "collapsed"
    );

    if (
      typeof flightListEl !== "undefined" &&
      flightListEl
    ) {
      flightListEl.style.display =
        sidebarElement.classList.contains(
          "collapsed"
        )
          ? "none"
          : "";
    }

    /*
     * Allow the sidebar CSS transition to complete
     * before resizing and refitting the map.
     */
    setTimeout(() => {
      if (
        typeof map !== "undefined" &&
        map
      ) {
        map.resize();
      }

      if (
        window.appState?.mode === "countries"
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
        return;
      }

      /*
       * Compatibility fallback for the older map code.
       */
      if (
        typeof applyIsolation === "function"
      ) {
        applyIsolation();
      }
    }, 250);
  });
}


// =====================================================
// COUNTRIES / ROUTES MODE TOGGLE
// =====================================================

if (
  typeof countriesBox !== "undefined" &&
  countriesBox
) {
  countriesBox.addEventListener("click", () => {
    const currentMode =
      window.appState?.mode || "routes";

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
     * Compatibility fallback for the older map code.
     */
    if (typeof mapMode !== "undefined") {
      mapMode = nextMode;
    }

    if (
      window.appState
    ) {
      window.appState.mode = nextMode;
    }

    if (
      typeof applyMapMode === "function"
    ) {
      applyMapMode();
    }
  });
}

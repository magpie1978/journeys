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
  if (!flightListEl) return;

  flightListEl.innerHTML = "";

  (routes || []).forEach(route => {
    const li = document.createElement("li");

    li.dataset.uid = route.uid;

    li.classList.toggle(
      "active",
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
      setIsolatedRoute(route.uid);
    });

    flightListEl.appendChild(li);
  });
}

window.renderSidebar = renderSidebar;


// =====================================================
// AIRLINES SLIDE-OUT CONTAINER
// =====================================================

airlinesBox?.addEventListener("click", () => {
  if (!airlinesPanel) return;

  const isOpen =
    airlinesPanel.classList.contains("visible");

  if (isOpen) {
    airlinesPanel.classList.remove("visible");
    airlinesPanel.classList.add("hidden");
  } else {
    renderAirlinesPanel(
      window.currentRoutes || []
    );

    airlinesPanel.classList.remove("hidden");
    airlinesPanel.classList.add("visible");
  }
});


// =====================================================
// SIDEBAR-AWARE MAP PADDING
// =====================================================

function getSidebarLeftPad() {
  return sidebar?.classList.contains("collapsed")
    ? 80
    : (sidebar?.offsetWidth || 260) + 80;
}

window.getSidebarLeftPad = getSidebarLeftPad;


// =====================================================
// AIRLINES PANEL
// =====================================================

function renderAirlinesPanel(routes) {
  if (!airlinesListEl) return;

  const airlines = [
    ...new Set(
      (routes || [])
        .map(route => route.airline)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b));

  airlinesListEl.innerHTML = "";

  airlines.forEach(name => {
    const li = document.createElement("li");

    li.innerHTML = `
      <img
        src="${getAirlineLogo(name)}"
        alt="${name}"
        onerror="this.style.display='none'"
      />
      <span>${name}</span>
    `;

    airlinesListEl.appendChild(li);
  });
}


// =====================================================
// SIDEBAR TOGGLE
// =====================================================

sidebarToggle?.addEventListener("click", () => {
  sidebar?.classList.toggle("collapsed");

  if (flightListEl) {
    flightListEl.style.display =
      sidebar?.classList.contains("collapsed")
        ? "none"
        : "";
  }

  setTimeout(() => {
    if (typeof map !== "undefined") {
      map.resize();
    }

    if (appState.mode === "countries") {
      if (
        typeof fitToVisibleCountries ===
        "function"
      ) {
        fitToVisibleCountries();
      }
    } else if (
      typeof fitToCurrentRouteView ===
      "function"
    ) {
      fitToCurrentRouteView();
    }
  }, 250);
});


// =====================================================
// COUNTRIES / ROUTES MODE TOGGLE
// =====================================================

countriesBox?.addEventListener("click", () => {
  const nextMode =
    appState.mode === "routes"
      ? "countries"
      : "routes";

  setMapMode(nextMode);
});

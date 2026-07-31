// =====================================================
// SIDEBAR
// =====================================================

// Resolve correct icon for sidebar
//function getJourneyIcon(route) {
  // Flights → airline tailfin
  //if (route.journey_type === "Flight") {
  //  return getAirlineLogo(route.airline);
  //}
//}


function getJourneyIcon(route) {
  if (!route) return null;

  // Flights → airline tailfin
  if (route.journey_type === "Flight") {
    return getAirlineLogo(route.airline);
  }

  // Bus / Train → operator logo if available
  if (route.journey_type === "Bus" || route.journey_type === "Train") {
    return getAirlineLogo(route.airline);
  }

  return null;
}



function renderSidebar(routes) {
  if (!flightListEl) return;
  flightListEl.innerHTML = "";

  (routes || []).forEach(r => {
    const li = document.createElement("li");
    li.dataset.uid = r.uid;
    
    li.classList.toggle("active", r.uid === appState.isolatedUid);

const logoUrl = getJourneyIcon(r);

const logoClass =
  r.journey_type === "Flight"
    ? "airline-logo"
    : "journey-logo";

li.innerHTML = `
  <div class="sidebar-row">

    <!-- LEFT: LOGO -->
    <div class="sidebar-logo">
      ${logoUrl ? `
        <img
          class="${logoClass}"
          src="${logoUrl}"
          alt="${r.airline || r.journey_type}"
          onerror="this.style.display='none'"
        />
      ` : ""}
    </div>

    <!-- RIGHT: TEXT -->
    <div class="sidebar-text">

      <!-- Journey type -->
      <div class="sidebar-journey-type">
        ${r.journey_type || ""}
      </div>

      <div class="sidebar-route">
        <strong>${r.origin || ""} → ${r.destination || ""}</strong>
      </div>

      <div class="sidebar-date">
        ${r.journey_date?.slice(0, 10) || ""}
      </div>
    </div>
  </div>
`;
    

li.addEventListener("click", () => {
  setIsolatedRoute(r.uid);
});

flightListEl.appendChild(li);

  }); // End of routes.forEach()

} 


// =====================================================
// AIRLINES SLIDE-OUT CONTAINER
// =====================================================
airlinesBox?.addEventListener("click", () => {
  if (!airlinesPanel) return;

  const isOpen = airlinesPanel.classList.contains("visible");
  if (isOpen) {
    airlinesPanel.classList.remove("visible");
    airlinesPanel.classList.add("hidden");
  } else {
    renderAirlinesPanel(currentRoutes);
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


// =====================================================
// AIRLINES PANEL
// =====================================================
function renderAirlinesPanel(routes) {
  if (!airlinesListEl) return;

  const airlines = [...new Set(
    routes.map(r => r.airline).filter(Boolean)
  )].sort();

  airlinesListEl.innerHTML = "";

  airlines.forEach(name => {
    const li = document.createElement("li");
    li.innerHTML = `
      <img src="${getAirlineLogo(name)}" alt="${name}" />
      <span>${name}</span>
    `;
    airlinesListEl.appendChild(li);
  });
}


// =====================================================
// SIDEBAR TOGGLE (SHOW / HIDE)
// =====================================================
sidebarToggle?.addEventListener("click", () => {
  sidebar?.classList.toggle("collapsed");

  if (sidebar?.classList.contains("collapsed")) {
    if (flightListEl) flightListEl.style.display = "none";
  } else {
    if (flightListEl) flightListEl.style.display = "";
  }

  // Allow CSS transition to complete before resizing map
  setTimeout(() => {
    if (typeof map !== "undefined") {
      map.resize();
    }

    if (mapMode === "countries") {
      fitToVisibleCountries();
    } else {
      applyIsolation();
    }
  }, 250);
});


// =====================================================
// COUNTRIES GLASS BOX TOGGLE
// =====================================================
countriesBox?.addEventListener("click", () => {
  mapMode = mapMode === "routes" ? "countries" : "routes";
  applyMapMode();
});

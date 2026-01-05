function renderSidebar(routes) {
  if (!flightListEl) return;
  flightListEl.innerHTML = "";

  (routes || []).forEach(r => {
    const li = document.createElement("li");
    li.dataset.uid = r.uid;
    li.classList.toggle("active", r.uid === isolatedUid);

    const logoUrl = getJourneyIcon(r);

    li.innerHTML = `
      <div class="sidebar-row">

        <!-- LEFT: LOGO -->
        <div class="sidebar-logo">
          ${logoUrl ? `
            <img
              class="airline-logo"
              src="${logoUrl}"
              alt="${r.airline || r.journey_type}"
              width="100"
              height="100"
              onerror="this.style.display='none'"
            />
          ` : ""}
        </div>

        <!-- RIGHT: TEXT -->
        <div class="sidebar-text">

          <div class="sidebar-type">
            ${r.journey_type?.slice(0, 10) || ""}
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

    li.addEventListener("click", () => toggleIsolation(r.uid));
    flightListEl.appendChild(li);
  });
}



// Airlines Slide Out Container
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



// Sidebar-aware padding
// Calculates map padding based on whether the sidebar is collapsed.
// Critical for correct fitBounds() behaviour.
function getSidebarLeftPad() {
  return sidebar?.classList.contains("collapsed")
    ? 80
    : (sidebar?.offsetWidth || 260) + 80;
}



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

  // Hide flight list when collapsed
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

    // Re-fit map padding depending on mode
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


(() => {
  "use strict";

  const SUPABASE_URL = "https://jxmyetsjqkrluxqtevxy.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bXlldHNqcWtybHV4cXRldnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzI2NjYsImV4cCI6MjA4MDYwODY2Nn0.YoXEtsY_Zh1Eeuj0kl11AOaj01VrZzGGKoPhJyQP-iU";
  const OWNER_ID = "2ff88374-a5de-4329-8d29-eb41fac39b23";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const $ = id => document.getElementById(id);
  const state = { user: null, places: [], reviews: new Map(), matches: new Map(), journeys: new Map(), selectedId: null, draftStatus: null, dirty: false };

  const statusLabels = {
    visited: "Visited",
    transit_only: "Transit only",
    not_visited: "Not visited",
    review_later: "Review later"
  };

  function setMessage(id, message, kind = "") {
    const el = $(id);
    if (!el) return;
    el.textContent = message;
    el.className = `message ${kind}`.trim();
  }

  function escapeText(value) {
    return String(value ?? "");
  }

  async function fetchAll(table, columns = "*", configure = null) {
    const all = [];
    const pageSize = 1000;
    for (let start = 0; ; start += pageSize) {
      let query = db.from(table).select(columns);
      if (configure) query = configure(query);
      const { data, error } = await query.range(start, start + pageSize - 1);
      if (error) throw error;
      all.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return all;
  }

  async function checkSession() {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    const user = data.session?.user || null;
    if (!user) {
      state.user = null;
      showLoggedOut();
      return;
    }
    if (user.id !== OWNER_ID) {
      await db.auth.signOut();
      state.user = null;
      showLoggedOut("This account is not authorised to access settlement reviews.");
      return;
    }
    state.user = user;
    $("account-label").textContent = user.email || "Signed in";
    $("sign-out").classList.remove("hidden");
    $("login-panel").classList.add("hidden");
    $("review-app").classList.remove("hidden");
    await loadData();
  }

  function showLoggedOut(message = "") {
    $("account-label").textContent = "";
    $("sign-out").classList.add("hidden");
    $("login-panel").classList.remove("hidden");
    $("review-app").classList.add("hidden");
    if (message) setMessage("login-message", message, "error");
  }

  async function loadData() {
    $("settlement-list").innerHTML = '<div class="loading-state">Loading settlements and journey evidence…</div>';
    try {
      const [places, reviews, matches] = await Promise.all([
        fetchAll("journey_places", "id,name,country_code,settlement_type"),
        fetchAll("journey_city_reviews", "id,place_id,review_status,review_notes,reviewed_at,updated_at"),
        fetchAll("journey_place_matches", "*")
      ]);

      state.places = places || [];
      state.reviews = new Map((reviews || []).map(row => [Number(row.place_id), row]));
      state.matches = new Map();
      (matches || []).forEach(match => {
        const id = Number(match.place_id);
        if (!state.matches.has(id)) state.matches.set(id, []);
        state.matches.get(id).push(match);
      });

      const uids = [...new Set((matches || []).map(m => m.journey_uid).filter(Boolean))];
      state.journeys = new Map();
      // Journey details are public journey-history data; if unavailable, evidence still displays its match details.
      for (let i = 0; i < uids.length; i += 100) {
        const batch = uids.slice(i, i + 100);
        const { data, error } = await db.from("journey_details")
          .select('uid,journey_date,type,"from","to"')
          .in("uid", batch);
        if (!error && data) data.forEach(j => state.journeys.set(j.uid, j));
      }

      state.places.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      $("total-count").textContent = state.places.length;
      renderStats();
      renderList();
      if (state.places.length) {
        const initial = orderedPlaces()[0];
        selectPlace(initial.id);
      } else {
        $("settlement-list").innerHTML = '<div class="loading-state">No settlements were returned.</div>';
      }
    } catch (error) {
      console.error("Settlement review load failed:", error);
      $("settlement-list").innerHTML = "";
      showGlobal(`Unable to load review data: ${error.message || error}`);
    }
  }

  function getStatus(place) {
    return state.reviews.get(Number(place.id))?.review_status || "review_later";
  }

  function getMatches(place) {
    return state.matches.get(Number(place.id)) || [];
  }

  function confidenceFor(place) {
    const matches = getMatches(place);
    if (matches.some(m => String(m.confidence || "").toLowerCase() === "high")) return "high";
    if (matches.some(m => String(m.confidence || "").toLowerCase() === "medium")) return "medium";
    return matches.length ? "other" : "none";
  }

  function orderedPlaces() {
    const places = [...state.places];
    places.sort((a, b) => {
      const rank = { high: 0, medium: 1, other: 2, none: 3 };
      const diff = rank[confidenceFor(a)] - rank[confidenceFor(b)];
      if (diff) return diff;
      return String(a.name).localeCompare(String(b.name));
    });
    return places;
  }

  function renderStats() {
    const counts = { visited: 0, transit_only: 0, not_visited: 0, review_later: 0 };
    state.places.forEach(place => counts[getStatus(place)] = (counts[getStatus(place)] || 0) + 1);
    $("count-visited").textContent = counts.visited;
    $("count-transit").textContent = counts.transit_only;
    $("count-not-visited").textContent = counts.not_visited;
    $("count-pending").textContent = counts.review_later;
    const done = counts.visited + counts.transit_only + counts.not_visited;
    const total = state.places.length;
    const pct = total ? Math.round(done / total * 100) : 0;
    $("progress-caption").textContent = `${done} of ${total} decisions completed`;
    $("progress-percent").textContent = `${pct}%`;
    $("progress-fill").style.width = `${pct}%`;
  }

  function renderList() {
    const search = $("search-input").value.trim().toLowerCase();
    const status = $("status-filter").value;
    const evidence = $("evidence-filter").value;
    const sort = $("sort-filter").value;

    let list = state.places.filter(place => {
      const matchesSearch = !search || `${place.name} ${place.country_code} ${place.settlement_type || ""}`.toLowerCase().includes(search);
      const matchesStatus = status === "all" || getStatus(place) === status;
      const conf = confidenceFor(place);
      const matchesEvidence = evidence === "all" || (evidence === "high" && conf === "high") || (evidence === "medium" && conf === "medium") || (evidence === "none" && conf === "none");
      return matchesSearch && matchesStatus && matchesEvidence;
    });

    if (sort === "name") list.sort((a,b) => String(a.name).localeCompare(String(b.name)));
    if (sort === "country") list.sort((a,b) => String(a.country_code).localeCompare(String(b.country_code)) || String(a.name).localeCompare(String(b.name)));
    if (sort === "journeys") list.sort((a,b) => getMatches(b).length - getMatches(a).length || String(a.name).localeCompare(String(b.name)));
    if (sort === "priority") list.sort((a,b) => {
      const rank = { high: 0, medium: 1, other: 2, none: 3 };
      return rank[confidenceFor(a)] - rank[confidenceFor(b)] || String(a.name).localeCompare(String(b.name));
    });

    $("visible-count").textContent = `${list.length} shown`;
    const container = $("settlement-list");
    container.innerHTML = "";
    if (!list.length) {
      container.innerHTML = '<div class="loading-state">No settlements match these filters.</div>';
      return;
    }

    list.forEach(place => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "settlement-item" + (Number(state.selectedId) === Number(place.id) ? " active" : "");
      const conf = confidenceFor(place);
      const statusNow = getStatus(place);
      const statusClass = statusNow === "review_later" ? "pending" : statusNow;
      item.innerHTML = `
        <span class="item-main"><strong></strong><small></small></span>
        <span class="item-side"><span class="item-count"></span><span class="status-dot ${statusClass}"></span></span>`;
      item.querySelector("strong").textContent = place.name || "Unnamed settlement";
      item.querySelector("small").textContent = `${place.country_code || "—"} · ${place.settlement_type || "Settlement"} · ${conf === "none" ? "No evidence" : `${conf} confidence`}`;
      item.querySelector(".item-count").textContent = getMatches(place).length;
      item.addEventListener("click", () => selectPlace(place.id));
      container.appendChild(item);
    });
  }

  function selectPlace(id) {
    const place = state.places.find(p => Number(p.id) === Number(id));
    if (!place) return;
    state.selectedId = Number(id);
    const review = state.reviews.get(Number(id));
    state.draftStatus = review?.review_status || "review_later";
    state.dirty = false;

    $("empty-detail").classList.add("hidden");
    $("settlement-detail").classList.remove("hidden");
    $("detail-name").textContent = place.name || "Unnamed settlement";
    $("detail-country-code").textContent = `${place.country_code || "—"} · ${place.settlement_type || "Settlement"}`;
    const conf = confidenceFor(place);
    const badge = $("detail-evidence-badge");
    badge.textContent = conf === "none" ? "No journey evidence" : `${conf[0].toUpperCase()}${conf.slice(1)} confidence`;
    badge.className = `evidence-badge ${conf}`;
    const matches = getMatches(place);
    $("detail-meta").textContent = `${matches.length} evidence references · Settlement ID ${place.id}`;
    $("evidence-count").textContent = `${matches.length} references`;
    $("review-notes").value = review?.review_notes || "";
    document.querySelectorAll(".decision-option").forEach(button => button.classList.toggle("selected", button.dataset.status === state.draftStatus));
    $("save-button").disabled = true;
    setMessage("save-message", review?.updated_at ? `Last updated ${new Date(review.updated_at).toLocaleString()}` : "No review record found.", "");
    renderEvidence(matches);
    renderList();
    updateNavigation();
  }

  function renderEvidence(matches) {
    const container = $("evidence-list");
    container.innerHTML = "";
    if (!matches.length) {
      container.innerHTML = '<div class="no-evidence">No matched journeys are currently linked to this settlement. It can still be reviewed manually.</div>';
      return;
    }
    matches.sort((a,b) => {
      const ja = state.journeys.get(a.journey_uid) || {};
      const jb = state.journeys.get(b.journey_uid) || {};
      return String(ja.journey_date || "").localeCompare(String(jb.journey_date || ""));
    });
    matches.forEach(match => {
      const journey = state.journeys.get(match.journey_uid) || {};
      const row = document.createElement("div");
      row.className = "evidence-row";
      const date = journey.journey_date || match.journey_date || "";
      const type = journey.type || match.journey_type || "Journey";
      const from = journey.from || (match.evidence_type === "origin" ? match.evidence_value : "");
      const to = journey.to || (match.evidence_type === "destination" ? match.evidence_value : "");
      const route = from && to ? `${from} → ${to}` : match.evidence_value || match.journey_uid || "Journey evidence";
      const confidence = String(match.confidence || "unclassified").toLowerCase();
      row.innerHTML = `<div class="evidence-date"></div><div class="evidence-content"><strong></strong><small></small></div><span class="confidence-pill"></span>`;
      row.querySelector(".evidence-date").textContent = date ? new Date(`${String(date).slice(0,10)}T12:00:00`).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}) : "Date unknown";
      row.querySelector(".evidence-content strong").textContent = route;
      row.querySelector(".evidence-content small").textContent = `${type} · ${match.evidence_type || "endpoint"}${match.match_method ? ` · ${match.match_method}` : ""}`;
      row.querySelector(".confidence-pill").textContent = confidence;
      container.appendChild(row);
    });
  }

  function markDirty() {
    state.dirty = true;
    $("save-button").disabled = false;
    setMessage("save-message", "Unsaved changes", "warning");
  }

  async function saveDecision() {
    if (!state.user || state.user.id !== OWNER_ID || !state.selectedId) return;
    const button = $("save-button");
    button.disabled = true;
    button.textContent = "Saving…";
    const now = new Date().toISOString();
    const payload = {
      review_status: state.draftStatus,
      review_notes: $("review-notes").value.trim() || null,
      reviewed_at: state.draftStatus === "review_later" ? null : now,
      updated_at: now
    };
    try {
      const { data, error } = await db.from("journey_city_reviews")
        .update(payload)
        .eq("place_id", state.selectedId)
        .select("id,place_id,review_status,review_notes,reviewed_at,updated_at")
        .single();
      if (error) throw error;
      state.reviews.set(Number(data.place_id), data);
      state.dirty = false;
      renderStats();
      renderList();
      setMessage("save-message", "Decision saved successfully.", "success");
    } catch (error) {
      console.error("Could not save settlement review:", error);
      setMessage("save-message", `Save failed: ${error.message || error}`, "error");
      button.disabled = false;
    } finally {
      button.textContent = "Save decision";
    }
  }

  function updateNavigation() {
    const ordered = filteredPlacesForNavigation();
    const index = ordered.findIndex(p => Number(p.id) === Number(state.selectedId));
    $("previous-button").disabled = index <= 0;
    $("next-button").disabled = index < 0 || index >= ordered.length - 1;
  }

  function filteredPlacesForNavigation() {
    const search = $("search-input").value.trim().toLowerCase();
    const status = $("status-filter").value;
    const evidence = $("evidence-filter").value;
    return state.places.filter(place => {
      const conf = confidenceFor(place);
      return (!search || `${place.name} ${place.country_code} ${place.settlement_type || ""}`.toLowerCase().includes(search))
        && (status === "all" || getStatus(place) === status)
        && (evidence === "all" || (evidence === "high" && conf === "high") || (evidence === "medium" && conf === "medium") || (evidence === "none" && conf === "none"));
    });
  }

  function navigate(delta) {
    if (state.dirty && !window.confirm("You have unsaved changes. Discard them and continue?")) return;
    const ordered = filteredPlacesForNavigation();
    const index = ordered.findIndex(p => Number(p.id) === Number(state.selectedId));
    const next = ordered[index + delta];
    if (next) selectPlace(next.id);
  }

  function showGlobal(message) {
    $("global-message").textContent = message;
    $("global-message").classList.add("visible");
  }

  $("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    setMessage("login-message", "Signing in…");
    const { error } = await db.auth.signInWithPassword({
      email: $("login-email").value.trim(),
      password: $("login-password").value
    });
    if (error) {
      setMessage("login-message", error.message, "error");
      return;
    }
    $("login-password").value = "";
    try { await checkSession(); }
    catch (err) { setMessage("login-message", err.message || String(err), "error"); }
  });

  $("sign-out").addEventListener("click", async () => {
    await db.auth.signOut();
    state.places = [];
    state.reviews.clear();
    state.matches.clear();
    showLoggedOut();
  });

  $("search-input").addEventListener("input", () => { renderList(); updateNavigation(); });
  ["status-filter", "evidence-filter", "sort-filter"].forEach(id => $(id).addEventListener("change", () => { renderList(); updateNavigation(); }));
  $("refresh-button").addEventListener("click", loadData);
  $("review-notes").addEventListener("input", markDirty);
  document.querySelectorAll(".decision-option").forEach(button => button.addEventListener("click", () => {
    state.draftStatus = button.dataset.status;
    document.querySelectorAll(".decision-option").forEach(b => b.classList.toggle("selected", b === button));
    markDirty();
  }));
  $("save-button").addEventListener("click", saveDecision);
  $("previous-button").addEventListener("click", () => navigate(-1));
  $("next-button").addEventListener("click", () => navigate(1));

  db.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      state.user = null;
      showLoggedOut();
    }
  });

  checkSession().catch(error => {
    console.error(error);
    showLoggedOut(error.message || "Unable to check your sign-in session.");
  });
})();

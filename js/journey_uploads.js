/* global sb */

// ============================================================================
// STATE
// ============================================================================
let uploadedJourneyUID = null;

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const addJourneyBtn = document.getElementById("addJourneyBtn");
const csvUploadModal = document.getElementById("csvUploadModal");
const journeyDetailsModal = document.getElementById("journeyDetailsModal");
const csvFileInput = document.getElementById("csvFileInput");
const csvUploadCancel = document.getElementById("csvUploadCancel");

const journeyDetailsForm = document.getElementById("journeyDetailsForm");
const journeyDetailsCancel = document.getElementById("journeyDetailsCancel");

// ============================================================================
// MODAL HELPERS
// ============================================================================
function openModal(el) {
  el.classList.remove("hidden");
}

function closeModal(el) {
  el.classList.add("hidden");
}

// ============================================================================
// CSV PARSER (simple + robust for clean exports)
// ============================================================================
function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/);
  const headers = rows.shift().split(",");

  return rows.map(row => {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let char of row) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);

    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = values[i]?.replace(/^"|"$/g, "") ?? null;
    });

    return obj;
  });
}

// ============================================================================
// EVENTS
// ============================================================================
addJourneyBtn.addEventListener("click", () => {
  csvFileInput.value = "";
  openModal(csvUploadModal);
});

csvUploadCancel.addEventListener("click", () => {
  closeModal(csvUploadModal);
});

journeyDetailsCancel.addEventListener("click", () => {
  closeModal(journeyDetailsModal);
});

// ============================================================================
// HANDLE CSV FILE SELECTION + UPLOAD
// ============================================================================
csvFileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rawRows = parseCSV(text);

    if (!rawRows.length) {
      alert("CSV file contains no data.");
      return;
    }

    // -----------------------------------------
    // MAP CSV → journey_tracks rows
    // -----------------------------------------
    const rows = rawRows.map(r => ({
      timestamp: r.Timestamp,
      utc: r.UTC,
      callsign: r.Callsign,
      altitude: r.Altitude ? Number(r.Altitude) : null,
      speed: r.Speed ? Number(r.Speed) : null,
      direction: r.Direction ? Number(r.Direction) : null,
      position: r.Position
    }));

    // -----------------------------------------
    // CALCULATE UID (same logic as journeys view)
    // -----------------------------------------
    const validUTCs = rows
      .map(r => r.utc)
      .filter(Boolean)
      .map(u => new Date(u))
      .filter(d => !isNaN(d));

    if (!validUTCs.length) {
      alert("Could not determine journey start time (UTC missing).");
      return;
    }

    const earliestUTC = new Date(Math.min(...validUTCs));
    const flightDate = earliestUTC.toISOString().slice(0, 10);
    const callsign = rows[0].callsign;

    uploadedJourneyUID = `${callsign}-${flightDate}`;

    // -----------------------------------------
    // INSERT TRACK DATA
    // -----------------------------------------
    const { error } = await sb
      .from("journey_tracks")
      .insert(rows);

    if (error) {
      console.error("[journey upload]", error);
      alert("Upload failed – see console.");
      return;
    }

    // -----------------------------------------
    // SUCCESS → OPEN DETAILS FORM
    // -----------------------------------------
    closeModal(csvUploadModal);

    const uidInput = journeyDetailsForm.querySelector('input[name="uid"]');
    if (uidInput && uploadedJourneyUID) {
      uidInput.value = uploadedJourneyUID;
      uidInput.readOnly = true;
    }

    openModal(journeyDetailsModal);

  } catch (err) {
    console.error("[journey upload]", err);
    alert("Error reading CSV file.");
  }
});

// ============================================================================
// JOURNEY DETAILS FORM SUBMIT
// ============================================================================
journeyDetailsForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(journeyDetailsForm);

  const payload = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [
      k,
      v === "" ? null : v
    ])
  );

  try {
    // -----------------------------------------
    // SAVE JOURNEY DETAILS
    // -----------------------------------------
    const { error } = await sb
      .from("journey_details_copy")
      .insert([payload]);

    if (error) {
      console.error("[journey details]", error);
      alert("Failed to save journey details.");
      return;
    }

    // -----------------------------------------
    // REFRESH MATERIALISED VIEW (SERVER-SIDE)
    // -----------------------------------------
    await fetch(
      "https://jxmyetsjqkrluxqtevxy.supabase.co/functions/v1/refresh_journeys_routes",
      { method: "POST" }
    );

    // -----------------------------------------
    // SUCCESS
    // -----------------------------------------
    closeModal(journeyDetailsModal);
    alert("Journey details saved and stats refreshed.");

  } catch (err) {
    console.error("[journey details]", err);
    alert("Unexpected error saving journey details.");
  }
});

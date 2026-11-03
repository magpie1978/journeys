/* global sb */

let uploadedJourneyUID = null;

const addJourneyBtn = document.getElementById("addJourneyBtn");
const csvUploadModal = document.getElementById("csvUploadModal");
const journeyDetailsModal = document.getElementById("journeyDetailsModal");
const csvFileInput = document.getElementById("csvFileInput");
const csvUploadCancel = document.getElementById("csvUploadCancel");

// -----------------------------------------------------
// MODAL HELPERS
// -----------------------------------------------------
function openModal(el) {
  el.classList.remove("hidden");
}

function closeModal(el) {
  el.classList.add("hidden");
}

// -----------------------------------------------------
// CSV PARSER
// -----------------------------------------------------
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

// -----------------------------------------------------
// EVENTS
// -----------------------------------------------------
addJourneyBtn.addEventListener("click", () => {
  csvFileInput.value = "";
  openModal(csvUploadModal);
});

csvUploadCancel.addEventListener("click", () => {
  closeModal(csvUploadModal);
});

// -----------------------------------------------------
// HANDLE FILE SELECTION
// -----------------------------------------------------
csvFileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rawRows = parseCSV(text);

    const rows = rawRows.map(r => ({
      timestamp: r.Timestamp,
      utc: r.UTC,
      callsign: r.Callsign,
      altitude: r.Altitude ? Number(r.Altitude) : null,
      speed: r.Speed ? Number(r.Speed) : null,
      direction: r.Direction ? Number(r.Direction) : null,
      position: r.Position
    }));

    const validUTCs = rows
      .map(r => r.utc)
      .filter(Boolean)
      .map(u => new Date(u))
      .filter(d => !isNaN(d));

    if (!validUTCs.length) {
      alert("Could not determine journey start time.");
      return;
    }

    const earliestUTC = new Date(Math.min(...validUTCs));
    const flightDate = earliestUTC.toISOString().slice(0, 10);
    const callsign = rows[0].callsign;

    uploadedJourneyUID = `${callsign}-${flightDate}`;

    
    const { error } = await sb
      .from("journey_tracks")
      .insert(rows);
    
    
    if (error) {
      console.error("[journey upload]", error);
      alert("Upload failed.");
      return;
    }

    closeModal(csvUploadModal);

    const uidInput = journeyDetailsForm.querySelector('input[name="uid"]');
    if (uidInput) {
      uidInput.value = uploadedJourneyUID;
      uidInput.readOnly = true;
    }

    // Each newly uploaded journey defaults to a Visit.
    const arrivalClassification = journeyDetailsForm.elements.namedItem("arrival_classification");
    if (arrivalClassification) arrivalClassification.value = "visit";

    openModal(journeyDetailsModal);

  } catch (err) {
    console.error("[journey upload]", err);
    alert("Error reading CSV file.");
  }
});

// -----------------------------------------------------
// JOURNEY DETAILS FORM
// -----------------------------------------------------
const journeyDetailsForm = document.getElementById("journeyDetailsForm");
const journeyDetailsCancel = document.getElementById("journeyDetailsCancel");

journeyDetailsCancel.addEventListener("click", () => {
  closeModal(journeyDetailsModal);
});

journeyDetailsForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = Object.fromEntries(
    [...new FormData(journeyDetailsForm).entries()]
      .map(([k, v]) => [k, v === "" ? null : v])
  );

  // Ensure the new classification is always sent with journey details.
  payload.arrival_classification = ["visit", "transit", "layover"].includes(
    payload.arrival_classification
  ) ? payload.arrival_classification : "visit";

  try {
    const { error } = await sb
      .from("journey_details")
      .insert([payload]);

    if (error) {
      console.error("[journey details]", error);
      alert("Failed to save journey details.");
      return;
    }

    closeModal(journeyDetailsModal);
    alert("Journey details saved.  The website will be updated within 5 minutes");

  } catch (err) {
    console.error("[journey details]", err);
    alert("Unexpected error.");
  }
});

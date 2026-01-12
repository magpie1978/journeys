/* global supabase */


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
// CSV PARSER (simple, robust enough for clean exports)
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


    if (!rows.length) {
      alert("CSV file contains no data.");
      return;
    }

    const { error } = await sb
      .from("journey_tracks")
      .insert(rows);

    if (error) {
      console.error("[journey upload]", error);
      alert("Upload failed – see console.");
      return;
    }

    // Success
    closeModal(csvUploadModal);
    openModal(journeyDetailsModal);

  } catch (err) {
    console.error("[journey upload]", err);
    alert("Error reading CSV file.");
  }
});

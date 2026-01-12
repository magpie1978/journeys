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
  const [headerLine, ...lines] = text.trim().split("\n");
  const headers = headerLine.split(",").map(h => h.trim());

  return lines.map(line => {
    const values = line.split(",").map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? null;
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
    const rows = parseCSV(text);

    if (!rows.length) {
      alert("CSV file contains no data.");
      return;
    }

    const { error } = await supabase
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

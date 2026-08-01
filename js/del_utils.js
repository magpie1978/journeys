// =====================================================
// GENERAL UTILITIES
// =====================================================
function formatSecondsToHM(seconds) {
  const s = Number(seconds) || 0;
  if (s <= 0) return "0h 00min";

  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);

  return `${hrs}h ${String(mins).padStart(2, "0")}min`;
}

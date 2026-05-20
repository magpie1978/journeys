// =====================================================
// AIRLINE LOGOS (GLOBAL)
// =====================================================
function getAirlineLogo(airline) {
  if (!airline) return null;

  const filename = airlineLogoMap[airline];
  if (!filename) return null;

  return AIRLINE_LOGO_BASE + filename;
}

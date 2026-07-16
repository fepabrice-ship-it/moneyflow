// Normalise les noms de ville pour le regroupement et le filtrage.
// On reste tolérant : casse + accents ignorés, et fautes de frappe connues
// rattachées à une ville de référence.

// Clés = forme normalisée (minuscule, sans accents). Valeurs = libellé de référence.
const CITY_ALIASES = {
  yaounde: 'Yaounde',   // yaounde / Yaounde / Yaoundé
  bertoua: 'Bertoua',   // bertoua / Bertoua
  bertua: 'Bertoua',    // faute fréquente
  betoua: 'Bertoua',    // faute fréquente
};

// Réduit une chaîne à sa forme comparable : trim, minuscule, sans accents.
const toKey = (raw) =>
  raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // supprime les accents combinants

export const normalizeCity = (raw) => {
  if (!raw || !raw.trim()) return 'Inconnu';
  const key = toKey(raw);
  if (!key) return 'Inconnu';
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];
  // Ville inconnue : on uniformise quand même la casse pour fusionner les variantes.
  return key.charAt(0).toUpperCase() + key.slice(1);
};

export default normalizeCity;

export const EVENT_TYPES = [
  "Music",
  "Art",
  "Tech",
  "Business",
  "Family",
  "Sports",
  "Nightlife",
  "Community",
  "Food & Drink",
  "Education",
  "Wellness"
];

export const PRICE_TYPES = [
  "Free",
  "Paid",
  "Donation"
];

function sortUnique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "sq", { sensitivity: "base", numeric: true }));
}

export const TIRANA_AREAS = sortUnique([
  "21 Dhjetori",
  "Ali Demi",
  "Allias",
  "Astir",
  "Baldushk",
  "Bërzhitë",
  "Blloku (The Block)",
  "Brraka",
  "Brryli",
  "Dajti",
  "Don Bosko",
  "Dry Lake (Liqeni i Thatë)",
  "Farkë",
  "Fresku",
  "Kamëz",
  "Kashar",
  "Kinostudio",
  "Kodër e Kuqe",
  "Kombinat",
  "Komuna e Parisit",
  "Krrabë",
  "Lapraka",
  "Liqeni Artificial i Tiranës",
  "Mount Dajti",
  "Mujos",
  "Ndroq",
  "Njësia Bashkiake 1",
  "Njësia Bashkiake 2",
  "Njësia Bashkiake 3",
  "Njësia Bashkiake 4",
  "Njësia Bashkiake 5",
  "Njësia Bashkiake 6",
  "Njësia Bashkiake 7",
  "Njësia Bashkiake 8",
  "Njësia Bashkiake 9",
  "Njësia Bashkiake 10",
  "Njësia Bashkiake 11",
  "Oxhaku",
  "Paskuqan",
  "Pazari i Ri (New Bazaar)",
  "Petrela",
  "Pezë",
  "Pyramida",
  "QTU",
  "Qyteti i Studentit",
  "Ring Center",
  "Rruga e Elbasanit",
  "Sauk",
  "Selita",
  "Skanderbeg Square",
  "Stacioni i Trenit",
  "TEG",
  "Tirana e Re (New Tirana)",
  "Tregu Çam",
  "Vaqarr",
  "Varri i Bamit",
  "Vorë",
  "Xhamlliku",
  "Yzberisht",
  "Zall-Bastar",
  "Zall-Herr",
  "Zoo"
]);

export const OTHER_CITIES = sortUnique([
  "Bajram Curri",
  "Belsh",
  "Berat",
  "Bulqizë",
  "Cërrik",
  "Dhermi",
  "Delvinë",
  "Dibër",
  "Divjakë",
  "Durrës",
  "Fier",
  "Fushë-Arrëz",
  "Gjirokastër",
  "Himarë",
  "Kavajë",
  "Konispol",
  "Korçë",
  "Krujë",
  "Ksamil",
  "Kukës",
  "Lezhë",
  "Librazhd",
  "Lushnjë",
  "Mirditë",
  "Peqin",
  "Pogradec",
  "Poliçan",
  "Pukë",
  "Përmet",
  "Rrogozhinë",
  "Sarandë",
  "Shkodër",
  "Tepelenë",
  "Tropojë",
  "Vau i Dejës",
  "Vlorë"
]);

export const AREA_GROUPS = [
  {
    label: "TIRANA (ALL AREAS LISTED BELOW)",
    options: TIRANA_AREAS.map((value) => ({ value, label: value }))
  },
  {
    label: "OTHER CITIES, MAY NOT GET FEATURED",
    options: OTHER_CITIES.map((value) => ({ value, label: value }))
  }
];

export const AREAS = [...TIRANA_AREAS, ...OTHER_CITIES];

export function isFeaturedEligibleArea(area) {
  const normalized = String(area || "").trim();
  return TIRANA_AREAS.includes(normalized);
}

export const UI_LANGS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "sq", label: "Shqip" }
];

function normalizeLanguageSort(value) {
  return String(value || "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function sortEventLanguageOptions(values) {
  return [...values].sort((a, b) => {
    const priorityDiff = Number(a.priority || 99) - Number(b.priority || 99);
    if (priorityDiff !== 0) return priorityDiff;
    return normalizeLanguageSort(a.sortLabel || a.label).localeCompare(
      normalizeLanguageSort(b.sortLabel || b.label),
      "en",
      { sensitivity: "base", numeric: true }
    );
  });
}

export const DEFAULT_EVENT_LANGUAGE_OPTIONS = sortEventLanguageOptions([
  { code: "en", label: "English (Anglisht)", sortLabel: "English", priority: 0 },
  { code: "sq", label: "Shqip (Albanian)", sortLabel: "Albanian", priority: 1 },
  {
    code: "asl",
    label: "Gjuha Shqipe e Shenjave (Albanian Sign Language / Gjuha Shqipe e Shenjave)",
    sortLabel: "Albanian Sign Language"
  },
  { code: "aromanian", label: "Armãneashce (Aromanian / Arumunisht)", sortLabel: "Aromanian" },
  { code: "arberesh", label: "Arbërisht (Arbëresh / Arbërisht)", sortLabel: "Arberesh" },
  { code: "arvanitika", label: "Arvanitika (Arvanitika / Arvanitika)", sortLabel: "Arvanitika" },
  { code: "bg", label: "Български (Bulgarian / Bullgarisht)", sortLabel: "Bulgarian" },
  { code: "cham", label: "Çamërisht (Cham Albanian / Çamërisht)", sortLabel: "Cham Albanian" },
  { code: "hr", label: "Hrvatski (Croatian / Kroatisht)", sortLabel: "Croatian" },
  { code: "fr", label: "Français (French / Frëngjisht)", sortLabel: "French" },
  { code: "de", label: "Deutsch (German / Gjermanisht)", sortLabel: "German" },
  { code: "el", label: "Ελληνικά (Greek / Greqisht)", sortLabel: "Greek" },
  { code: "it", label: "Italiano (Italian / Italisht)", sortLabel: "Italian" },
  { code: "mk", label: "Македонски (Macedonian / Maqedonisht)", sortLabel: "Macedonian" },
  { code: "me", label: "Crnogorski (Montenegrin / Malazezisht)", sortLabel: "Montenegrin" },
  { code: "romani", label: "Romani (Romani / Romani)", sortLabel: "Romani" },
  { code: "ru", label: "Русский (Russian / Rusisht)", sortLabel: "Russian" },
  { code: "sr", label: "Српски (Serbian / Serbisht)", sortLabel: "Serbian" },
  { code: "es", label: "Español (Spanish / Spanjisht)", sortLabel: "Spanish" },
  { code: "tl", label: "Tagalog (Tagalog / Tagalog)", sortLabel: "Tagalog" },
  { code: "tr", label: "Türkçe (Turkish / Turqisht)", sortLabel: "Turkish" }
]);

export function buildEventLanguageMap(values = DEFAULT_EVENT_LANGUAGE_OPTIONS) {
  return new Map(values.map((option) => [option.code, option.label]));
}

export function formatEventLanguageValue(value, values = DEFAULT_EVENT_LANGUAGE_OPTIONS) {
  return buildEventLanguageMap(values).get(value) || String(value || "").trim();
}

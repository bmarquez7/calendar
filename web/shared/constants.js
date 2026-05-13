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
  "Health & Wellness"
];

const EVENT_TYPE_DEFAULT_IMAGE_SLUGS = {
  Music: "music",
  Art: "art",
  Tech: "tech",
  Business: "business",
  Family: "family",
  Sports: "sports",
  Nightlife: "nightlife",
  Community: "community",
  "Food & Drink": "food-and-drink",
  Education: "education",
  "Health & Wellness": "health-and-wellness"
};

export const DEFAULT_EVENT_IMAGE_OPTIONS = EVENT_TYPES.map((label) => ({
  value: label,
  label,
  path: `/shared/default-event-images/${EVENT_TYPE_DEFAULT_IMAGE_SLUGS[label]}.png`
}));

const EVENT_TYPE_ALIASES = new Map([
  ["wellness", "Health & Wellness"],
  ["health wellness", "Health & Wellness"],
  ["health and wellness", "Health & Wellness"],
  ["education", "Education"]
]);

function normalizeEventTypeKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEventTypeValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const alias = EVENT_TYPE_ALIASES.get(normalizeEventTypeKey(raw));
  if (alias) return alias;
  return EVENT_TYPES.find((option) => normalizeEventTypeKey(option) === normalizeEventTypeKey(raw)) || raw;
}

export function parseEventTypes(input, fallback = "") {
  const source = Array.isArray(input)
    ? input
    : String(input || "")
      .split(",");
  const values = [...source, ...(fallback ? [fallback] : [])]
    .map((value) => normalizeEventTypeValue(value))
    .filter(Boolean);
  return [...new Set(values)];
}

export function resolveEventTypes(eventTypes, eventType = "") {
  const parsed = parseEventTypes(eventTypes);
  if (parsed.length) return parsed;
  const fallback = normalizeEventTypeValue(eventType);
  if (!fallback) return [];
  if (fallback === "Education" || fallback === "Health & Wellness") {
    return ["Education", "Health & Wellness"];
  }
  return [fallback];
}

export function formatEventTypes(eventTypes, eventType = "") {
  return resolveEventTypes(eventTypes, eventType).join(", ");
}

export const PRICE_TYPES = [
  "Free",
  "Paid",
  "Donation"
];

function sortUnique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "sq", { sensitivity: "base", numeric: true }));
}

function normalizeAreaKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function humanizeAreaType(type) {
  return String(type || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAreaOptionLabel(english, albanian) {
  return `${english} / ${albanian}`;
}

const TBD_AREA_VALUE = "TBD";
const TBD_AREA_LABEL = "TBD / Për t'u përcaktuar";

const TIRANA_AREA_ENTRIES = [
  { albanian: "21 Dhjetori", english: "21 December", type: "neighborhood" },
  { albanian: "Air Albania", english: "Air Albania Stadium", type: "landmark" },
  { albanian: "Ali Demi", english: "Ali Demi", type: "neighborhood" },
  { albanian: "Allias", english: "Allias", type: "neighborhood" },
  { albanian: "Astir", english: "Astir", type: "neighborhood" },
  { albanian: "Aviacioni", english: "Aviation Area", type: "local_area" },
  { albanian: "Baldushk", english: "Baldushk", type: "administrative_unit" },
  { albanian: "Bërzhitë", english: "Berzhitë", type: "administrative_unit" },
  { albanian: "Blloku", english: "The Block", type: "neighborhood" },
  { albanian: "Brraka", english: "Brraka", type: "neighborhood" },
  { albanian: "Brryli", english: "Brryli", type: "local_area" },
  { albanian: "Bunk'Art 1", english: "Bunk'Art 1", type: "landmark" },
  { albanian: "Bunk'Art 2", english: "Bunk'Art 2", type: "landmark" },
  { albanian: "Casa Italia", english: "Casa Italia", type: "commercial_area" },
  { albanian: "Dajti", english: "Dajti", type: "administrative_unit" },
  { albanian: "Delijorgji", english: "Delijorgji", type: "local_area" },
  { albanian: "Don Bosko", english: "Don Bosko", type: "neighborhood" },
  { albanian: "Et'hem Bej Mosque", english: "Et'hem Bey Mosque", type: "landmark" },
  { albanian: "Farkë", english: "Farkë", type: "administrative_unit" },
  { albanian: "Fresku", english: "Fresku", type: "neighborhood" },
  { albanian: "Instituti", english: "Institute Area", type: "local_area" },
  { albanian: "Kalaja e Tiranës", english: "Tirana Castle", type: "landmark" },
  { albanian: "Kamëz", english: "Kamëz", type: "adjacent_municipality" },
  { albanian: "Kashar", english: "Kashar", type: "administrative_unit" },
  { albanian: "Katedralja Ngjallja e Krishtit", english: "Resurrection of Christ Cathedral", type: "landmark" },
  { albanian: "Kinostudio", english: "Kinostudio", type: "local_area" },
  { albanian: "Kodër e Kuqe", english: "Red Hill", type: "neighborhood" },
  { albanian: "Kombinat", english: "Kombinat", type: "neighborhood" },
  { albanian: "Komuna e Parisit", english: "Paris Commune", type: "neighborhood" },
  { albanian: "Kopshti Zoologjik", english: "Zoo", type: "landmark" },
  { albanian: "Krrabë", english: "Krrabë", type: "administrative_unit" },
  { albanian: "Kulla e Sahatit", english: "Clock Tower", type: "landmark" },
  { albanian: "Lagjja Nr. 12", english: "Neighborhood No. 12", type: "administrative_area" },
  { albanian: "Lagjja Nr. 13", english: "Neighborhood No. 13", type: "administrative_area" },
  { albanian: "Lagjja Nr. 14", english: "Neighborhood No. 14", type: "administrative_area" },
  { albanian: "Lapraka", english: "Lapraka", type: "neighborhood" },
  { albanian: "Libri Universitar", english: "University Bookstore", type: "meeting_point" },
  { albanian: "Liqeni Artificial i Tiranës", english: "Tirana Artificial Lake", type: "park_area" },
  { albanian: "Liqeni i Thatë", english: "Dry Lake", type: "local_area" },
  { albanian: "Mali i Dajtit", english: "Mount Dajti", type: "landmark" },
  { albanian: "Medreseja", english: "Medreseja", type: "local_area" },
  { albanian: "Mozaiku i Tiranës", english: "Tirana Mosaic", type: "landmark" },
  { albanian: "Mujos", english: "Mujos", type: "local_area" },
  { albanian: "Murat Toptani", english: "Murat Toptani", type: "pedestrian_area" },
  { albanian: "Muzeu Historik Kombëtar", english: "National Historical Museum", type: "landmark" },
  { albanian: "Myslym Shyri", english: "Myslym Shyri", type: "street_area" },
  { albanian: "Ndroq", english: "Ndroq", type: "administrative_unit" },
  { albanian: "Njësia Bashkiake 1", english: "Municipal Unit 1", type: "municipal_unit" },
  { albanian: "Njësia Bashkiake 2", english: "Municipal Unit 2", type: "municipal_unit" },
  { albanian: "Njësia Bashkiake 3", english: "Municipal Unit 3", type: "municipal_unit" },
  { albanian: "Njësia Bashkiake 4", english: "Municipal Unit 4", type: "municipal_unit" },
  { albanian: "Njësia Bashkiake 5", english: "Municipal Unit 5", type: "municipal_unit" },
  { albanian: "Njësia Bashkiake 6", english: "Municipal Unit 6", type: "municipal_unit" },
  { albanian: "Njësia Bashkiake 7", english: "Municipal Unit 7", type: "municipal_unit" },
  { albanian: "Njësia Bashkiake 8", english: "Municipal Unit 8", type: "municipal_unit" },
  { albanian: "Njësia Bashkiake 9", english: "Municipal Unit 9", type: "municipal_unit" },
  { albanian: "Njësia Bashkiake 10", english: "Municipal Unit 10", type: "municipal_unit" },
  { albanian: "Njësia Bashkiake 11", english: "Municipal Unit 11", type: "municipal_unit" },
  { albanian: "Oxhaku", english: "Oxhaku", type: "local_area" },
  { albanian: "Pallati i Brigadave", english: "Palace of Brigades", type: "landmark" },
  { albanian: "Pallati i Kongreseve", english: "Palace of Congresses", type: "landmark" },
  { albanian: "Pallati i Kulturës", english: "Palace of Culture", type: "landmark" },
  { albanian: "Parku Rinia", english: "Youth Park", type: "park" },
  { albanian: "Paskuqan", english: "Paskuqan", type: "outer_urban_area" },
  { albanian: "Pazari i Ri", english: "New Bazaar", type: "market_area" },
  { albanian: "Petrelë", english: "Petrelë", type: "administrative_unit" },
  { albanian: "Pezë", english: "Pezë", type: "administrative_unit" },
  { albanian: "Piramida", english: "Pyramid of Tirana", type: "landmark" },
  { albanian: "Porcelani", english: "Porcelani", type: "local_area" },
  { albanian: "PostBllok", english: "PostBllok", type: "landmark" },
  { albanian: "Qendra Kristal", english: "Kristal Center", type: "commercial_area" },
  { albanian: "QTU", english: "Univers Shopping Center", type: "commercial_area" },
  { albanian: "Qyteti i Studentit", english: "Student City", type: "district" },
  { albanian: "Reja", english: "The Cloud", type: "landmark" },
  { albanian: "Ring Center", english: "Ring Center", type: "commercial_area" },
  { albanian: "Rruga e Elbasanit", english: "Elbasan Road", type: "street_area" },
  { albanian: "RTSH", english: "Albanian Radio Television", type: "landmark" },
  { albanian: "Sauk", english: "Sauk", type: "neighborhood" },
  { albanian: "Selita", english: "Selita", type: "neighborhood" },
  { albanian: "Selvia", english: "Selvia", type: "local_area" },
  { albanian: "Shallvaret", english: "Shallvaret", type: "local_area" },
  { albanian: "Sharrë", english: "Sharrë", type: "outer_area" },
  { albanian: "Sheshi Avni Rustemi", english: "Avni Rustemi Square", type: "square" },
  { albanian: "Sheshi Italia", english: "Italy Square", type: "square" },
  { albanian: "Sheshi Nënë Tereza", english: "Mother Teresa Square", type: "square" },
  { albanian: "Sheshi Shqiponja", english: "Eagle Square", type: "square" },
  { albanian: "Sheshi Skënderbej", english: "Skanderbeg Square", type: "square" },
  { albanian: "Sheshi Wilson", english: "Wilson Square", type: "square" },
  { albanian: "Shëngjergj", english: "Shëngjergj", type: "administrative_unit" },
  { albanian: "Shtëpia e Gjetheve", english: "House of Leaves", type: "landmark" },
  { albanian: "Stacioni i Trenit", english: "Train Station", type: "transport_hub" },
  { albanian: "Taivani", english: "Taiwan Complex", type: "public_space" },
  { albanian: "TEG", english: "Tirana East Gate", type: "commercial_area" },
  { albanian: "Tirana e Re", english: "New Tirana", type: "neighborhood" },
  { albanian: "Tregu Çam", english: "Cham Market", type: "market_area" },
  { albanian: "Ura e Tabakëve", english: "Tanners' Bridge", type: "landmark" },
  { albanian: "Uzina Dinamo", english: "Dinamo Plant Area", type: "local_area" },
  { albanian: "Vaqarr", english: "Vaqarr", type: "administrative_unit" },
  { albanian: "Varri i Bamit", english: "Varri i Bamit", type: "local_area" },
  { albanian: "Vasil Shanto", english: "Vasil Shanto", type: "neighborhood" },
  { albanian: "Vorë", english: "Vorë", type: "adjacent_municipality" },
  { albanian: "Xhamlliku", english: "Xhamlliku", type: "neighborhood" },
  { albanian: "Yzberisht", english: "Yzberisht", type: "neighborhood" },
  { albanian: "Zall-Bastar", english: "Zall-Bastar", type: "administrative_unit" },
  { albanian: "Zall-Herr", english: "Zall-Herr", type: "administrative_unit" },
  { albanian: "Zogu i Zi", english: "Black Bird", type: "local_area" }
];

const LEGACY_TIRANA_AREA_ALIASES = {
  "Blloku (The Block)": "The Block",
  "Dry Lake (Liqeni i Thatë)": "Dry Lake",
  "Pazari i Ri (New Bazaar)": "New Bazaar",
  "Tirana e Re (New Tirana)": "New Tirana",
  Petrela: "Petrelë",
  "Pyramida": "Pyramid of Tirana",
  "QTU": "Univers Shopping Center",
  "TEG": "Tirana East Gate",
  "Zoo": "Zoo"
};

const TIRANA_AREA_LABELS = new Map(
  TIRANA_AREA_ENTRIES.map((entry) => [entry.english, formatAreaOptionLabel(entry.english, entry.albanian)])
);

const TIRANA_AREA_ALIAS_MAP = new Map();

function registerAreaAlias(alias, canonical) {
  const key = normalizeAreaKey(alias);
  if (!key) return;
  TIRANA_AREA_ALIAS_MAP.set(key, canonical);
}

TIRANA_AREA_ENTRIES.forEach((entry) => {
  const canonical = entry.english;
  registerAreaAlias(entry.english, canonical);
  registerAreaAlias(entry.albanian, canonical);
  registerAreaAlias(formatAreaOptionLabel(entry.english, entry.albanian), canonical);
  registerAreaAlias(formatAreaOptionLabel(entry.albanian, entry.english), canonical);
});

Object.entries(LEGACY_TIRANA_AREA_ALIASES).forEach(([alias, canonical]) => {
  registerAreaAlias(alias, canonical);
});

registerAreaAlias(TBD_AREA_VALUE, TBD_AREA_VALUE);
registerAreaAlias("To Be Decided", TBD_AREA_VALUE);
registerAreaAlias("Per t'u percaktuar", TBD_AREA_VALUE);
registerAreaAlias("Për t'u përcaktuar", TBD_AREA_VALUE);
registerAreaAlias(TBD_AREA_LABEL, TBD_AREA_VALUE);

export const TIRANA_AREAS = TIRANA_AREA_ENTRIES.map((entry) => entry.english);

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

const TIRANA_AREA_TYPES = [...new Set(TIRANA_AREA_ENTRIES.map((entry) => entry.type))]
  .sort((a, b) => humanizeAreaType(a).localeCompare(humanizeAreaType(b), "en", { sensitivity: "base", numeric: true }));

export const AREA_GROUPS = [
  ...TIRANA_AREA_TYPES.map((type) => ({
    label: `TIRANA — ${humanizeAreaType(type)}`,
    options: TIRANA_AREA_ENTRIES
      .filter((entry) => entry.type === type)
      .sort((a, b) => a.english.localeCompare(b.english, "en", { sensitivity: "base", numeric: true }))
      .map((entry) => ({ value: entry.english, label: formatAreaOptionLabel(entry.english, entry.albanian) }))
  })),
  {
    label: "LOCATION TBD",
    options: [{ value: TBD_AREA_VALUE, label: TBD_AREA_LABEL }]
  },
  {
    label: "OTHER CITIES, MAY NOT GET FEATURED",
    options: OTHER_CITIES.map((value) => ({ value, label: value }))
  }
];

export const AREAS = [...TIRANA_AREAS, TBD_AREA_VALUE, ...OTHER_CITIES];

export function normalizeAreaValue(area) {
  const raw = String(area || "").trim();
  if (!raw) return "";
  return TIRANA_AREA_ALIAS_MAP.get(normalizeAreaKey(raw)) || raw;
}

export function formatAreaLabel(area) {
  const normalized = normalizeAreaValue(area);
  return TIRANA_AREA_LABELS.get(normalized) || (normalized === TBD_AREA_VALUE ? TBD_AREA_LABEL : normalized);
}

export function isFeaturedEligibleArea(area) {
  const normalized = normalizeAreaValue(area);
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

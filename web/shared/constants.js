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

export const LANGS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "sq", label: "Shqip" }
];

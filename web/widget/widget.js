import { createClient } from "../shared/vendor.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEFAULT_UI_LANG } from "../shared/config.js";
import {
  EVENT_TYPES,
  AREA_GROUPS,
  UI_LANGS,
  DEFAULT_EVENT_LANGUAGE_OPTIONS,
  sortEventLanguageOptions,
  formatEventLanguageValue,
  formatAreaLabel,
  normalizeAreaValue,
  isFeaturedEligibleArea
} from "../shared/constants.js";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const FEATURED_FIXED_COUNT = 5;
const FEATURED_TOTAL_COUNT = 10;
const FEATURED_ROTATE_COUNT = FEATURED_TOTAL_COUNT - FEATURED_FIXED_COUNT;
const FEATURED_ROTATION_MS = 45_000;
const MOBILE_FEATURED_SCROLL_MS = 3_000;
const HOLIDAY_YEAR_LOOKBACK = 0;
const HOLIDAY_YEAR_LOOKAHEAD = 1;
const TIRANA_TIMEZONE = "Europe/Tirane";

const HOLIDAY_PALETTES = {
  civic: {
    cellBg: "rgba(109, 154, 216, 0.18)",
    cellBorder: "rgba(109, 154, 216, 0.42)",
    chipBg: "rgba(236, 245, 255, 0.96)",
    chipInk: "#295e97"
  },
  christian: {
    cellBg: "rgba(211, 116, 116, 0.18)",
    cellBorder: "rgba(211, 116, 116, 0.42)",
    chipBg: "rgba(255, 241, 241, 0.96)",
    chipInk: "#9b3434"
  },
  muslim: {
    cellBg: "rgba(122, 177, 116, 0.2)",
    cellBorder: "rgba(122, 177, 116, 0.4)",
    chipBg: "rgba(239, 248, 235, 0.96)",
    chipInk: "#3c7540"
  }
};

const INTERNATIONAL_HOLIDAYS = [
  {
    key: "valentines-day",
    month: 2,
    day: 14,
    title_en: "Valentine's Day",
    title_sq: "Dita e Shën Valentinit",
    description_en: "Widely celebrated international holiday.",
    description_sq: "Festë ndërkombëtare e njohur gjerësisht."
  },
  {
    key: "international-womens-day",
    month: 3,
    day: 8,
    title_en: "International Women's Day",
    title_sq: "Dita Ndërkombëtare e Gruas",
    description_en: "Major international observance.",
    description_sq: "Ditë e rëndësishme ndërkombëtare."
  },
  {
    key: "earth-day",
    month: 4,
    day: 22,
    title_en: "Earth Day",
    title_sq: "Dita e Tokës",
    description_en: "International day focused on environmental awareness.",
    description_sq: "Ditë ndërkombëtare e përkushtuar ndërgjegjësimit mjedisor."
  },
  {
    key: "international-childrens-day",
    month: 6,
    day: 1,
    title_en: "International Children's Day",
    title_sq: "Dita Ndërkombëtare e Fëmijëve",
    description_en: "International celebration of children and families.",
    description_sq: "Festë ndërkombëtare kushtuar fëmijëve dhe familjeve."
  },
  {
    key: "international-youth-day",
    month: 8,
    day: 12,
    title_en: "International Youth Day",
    title_sq: "Dita Ndërkombëtare e Rinisë",
    description_en: "International observance celebrating young people.",
    description_sq: "Ditë ndërkombëtare që feston të rinjtë."
  },
  {
    key: "international-day-of-peace",
    month: 9,
    day: 21,
    title_en: "International Day of Peace",
    title_sq: "Dita Ndërkombëtare e Paqes",
    description_en: "International observance promoting peace.",
    description_sq: "Ditë ndërkombëtare që promovon paqen."
  },
  {
    key: "halloween",
    month: 10,
    day: 31,
    title_en: "Halloween",
    title_sq: "Halloween",
    description_en: "Internationally recognized autumn celebration.",
    description_sq: "Festë vjeshte e njohur ndërkombëtarisht."
  },
  {
    key: "international-volunteer-day",
    month: 12,
    day: 5,
    title_en: "International Volunteer Day",
    title_sq: "Dita Ndërkombëtare e Vullnetarizmit",
    description_en: "International day recognizing volunteers and community work.",
    description_sq: "Ditë ndërkombëtare që vlerëson vullnetarët dhe punën komunitare."
  },
  {
    key: "human-rights-day",
    month: 12,
    day: 10,
    title_en: "Human Rights Day",
    title_sq: "Dita e të Drejtave të Njeriut",
    description_en: "International observance centered on human rights.",
    description_sq: "Ditë ndërkombëtare e përqendruar te të drejtat e njeriut."
  }
];

const BANK_HOLIDAY_DEFINITIONS = [
  {
    key: "new-years-day",
    month: 1,
    day: 1,
    title_en: "New Year's Day",
    title_sq: "Viti i Ri",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "civic"
  },
  {
    key: "new-year-holiday",
    month: 1,
    day: 2,
    title_en: "New Year Holiday",
    title_sq: "Pushimi i Vitit të Ri",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "civic"
  },
  {
    key: "summer-day",
    month: 3,
    day: 14,
    title_en: "Summer Day",
    title_sq: "Dita e Verës",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "civic"
  },
  {
    key: "nevruz-day",
    month: 3,
    day: 22,
    title_en: "Nevruz Day",
    title_sq: "Dita e Nevruzit",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "muslim"
  },
  {
    key: "labour-day",
    month: 5,
    day: 1,
    title_en: "Labour Day",
    title_sq: "Dita e Punëtorëve",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "civic"
  },
  {
    key: "saint-teresa-canonisation-day",
    month: 9,
    day: 5,
    title_en: "Saint Teresa Canonisation Day",
    title_sq: "Dita e Shenjtërimit të Nënë Terezës",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "christian"
  },
  {
    key: "alphabet-day",
    month: 11,
    day: 22,
    title_en: "Alphabet Day",
    title_sq: "Dita e Alfabetit",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "civic"
  },
  {
    key: "flag-and-independence-day",
    month: 11,
    day: 28,
    title_en: "Flag and Independence Day",
    title_sq: "Dita e Flamurit dhe e Pavarësisë",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "civic"
  },
  {
    key: "liberation-day",
    month: 11,
    day: 29,
    title_en: "Liberation Day",
    title_sq: "Dita e Çlirimit",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "civic"
  },
  {
    key: "national-youth-day",
    month: 12,
    day: 8,
    title_en: "National Youth Day",
    title_sq: "Dita Kombëtare e Rinisë",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "civic"
  },
  {
    key: "christmas-day",
    month: 12,
    day: 25,
    title_en: "Christmas Day",
    title_sq: "Krishtlindjet",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    palette: "christian"
  }
];

const holidayEventCache = new Map();

const state = {
  events: [],
  settings: null,
  eventLanguageOptions: [...DEFAULT_EVENT_LANGUAGE_OPTIONS],
  uiLang: DEFAULT_UI_LANG,
  viewMode: "month",
  calendarDate: new Date(),
  weekStart: null,
  selectedCalendarDayKey: "",
  expandedCalendarEventId: "",
  filters: {
    search: "",
    eventType: [],
    area: [],
    eventLanguage: [],
    dateFrom: "",
    dateTo: "",
    sort: "date_asc"
  }
};

const uiStrings = {
  en: {
    title: "Tirana Events Calendar",
    subtitle: "Discover culture, community, and nightlife across Tirana. Filter by area, type, language, date, and price.",
    submitTitle: "Submit an event",
    submitSubtitle: "Submissions are reviewed before going live.",
    filters: {
      search: "Search",
      eventType: "Event type",
      area: "Area",
      eventLanguage: "Event language",
      dateFrom: "From",
      dateTo: "To",
      sort: "Sort"
    },
    sortOptions: {
      date_asc: "Date (soonest)",
      date_desc: "Date (latest)",
      price_asc: "Price (lowest)",
      price_desc: "Price (highest)"
    },
    closeDay: "Close",
    noEventsForDay: "No events for this day.",
    eventSingular: "event",
    eventPlural: "events",
    reset: "Reset filters",
    results: "events"
  },
  es: {
    title: "Calendario de eventos de Tirana",
    subtitle: "Descubre cultura, comunidad y vida nocturna en Tirana. Filtra por zona, tipo, idioma, fecha y precio.",
    submitTitle: "Enviar un evento",
    submitSubtitle: "Las propuestas se revisan antes de publicarse.",
    filters: {
      search: "Buscar",
      eventType: "Tipo de evento",
      area: "Zona",
      eventLanguage: "Idioma del evento",
      dateFrom: "Desde",
      dateTo: "Hasta",
      sort: "Ordenar"
    },
    sortOptions: {
      date_asc: "Fecha (próxima)",
      date_desc: "Fecha (más tarde)",
      price_asc: "Precio (más bajo)",
      price_desc: "Precio (más alto)"
    },
    closeDay: "Cerrar",
    noEventsForDay: "No hay eventos para este día.",
    eventSingular: "evento",
    eventPlural: "eventos",
    reset: "Restablecer filtros",
    results: "eventos"
  },
  sq: {
    title: "Kalendari i eventeve në Tiranë",
    subtitle: "Zbuloni kulturë, komunitet dhe jetë nate në Tiranë. Filtroni sipas zonës, llojit, gjuhës, datës dhe çmimit.",
    submitTitle: "Dërgoni një event",
    submitSubtitle: "Propozimet shqyrtohen para publikimit.",
    filters: {
      search: "Kërko",
      eventType: "Lloji i eventit",
      area: "Zona",
      eventLanguage: "Gjuha e eventit",
      dateFrom: "Nga",
      dateTo: "Deri",
      sort: "Renditja"
    },
    sortOptions: {
      date_asc: "Data (më e afërt)",
      date_desc: "Data (më e vonshme)",
      price_asc: "Çmimi (më i ulët)",
      price_desc: "Çmimi (më i lartë)"
    },
    closeDay: "Mbylle",
    noEventsForDay: "Nuk ka evente për këtë ditë.",
    eventSingular: "event",
    eventPlural: "evente",
    reset: "Pastro filtrat",
    results: "evente"
  }
};

const filterControls = document.getElementById("filter-controls");
const searchSlot = document.getElementById("search-slot");
const mobileFiltersButton = document.getElementById("mobile-filters-button");
const mobileFilterPanel = document.getElementById("mobile-filter-panel");
const mobileFilterControls = document.getElementById("mobile-filter-controls");
const eventList = document.getElementById("event-list");
const featuredGrid = document.getElementById("featured-grid");
const featuredTitle = document.getElementById("featured-title");
const resultsCount = document.getElementById("results-count");
const resetFilters = document.getElementById("reset-filters");
const heroSection = document.querySelector(".hero");
const featuredBox = document.querySelector(".featured-box");
const languageButton = document.getElementById("language-button");
const languageMenu = document.getElementById("language-menu");
const viewControls = document.getElementById("view-controls");
const calendarView = document.getElementById("calendar-view");
const eventModal = document.getElementById("event-modal");
const modalBody = document.getElementById("modal-body");
const modalClose = document.getElementById("modal-close");
const modalContent = eventModal?.querySelector(".modal-content");
const featuredColorCache = new Map();
let filterInputRegistry = new Map();
let featuredRotationTimer = null;
let mobileFeaturedCarouselTimer = null;
let activeModalAnchor = null;
let activeModalAnchorRect = null;

state.weekStart = startOfWeek(new Date());

function pickText(row, base) {
  const key = `${base}_${state.uiLang}`;
  return row[key] || row[`${base}_en`] || row[base] || "";
}

function pickSetting(base, fallback) {
  if (!state.settings) return fallback;
  return state.settings[`${base}_${state.uiLang}`] || state.settings[`${base}_en`] || fallback;
}

function applyTheme() {
  const theme = state.settings?.widget_theme || {};
  const root = document.documentElement;
  if (theme.bg) root.style.setProperty("--bg", theme.bg);
  if (theme.surface) {
    root.style.setProperty("--surface", theme.surface);
    root.style.setProperty("--surface-2", theme.surface);
  }
  if (theme.text) root.style.setProperty("--ink", theme.text);
  if (theme.muted) root.style.setProperty("--muted", theme.muted);
  if (theme.brand) {
    root.style.setProperty("--brand", theme.brand);
    root.style.setProperty("--brand-dark", theme.brand);
  }
  if (theme.border) root.style.setProperty("--border", theme.border);
  if (theme.titleFont) root.style.setProperty("--font-title", theme.titleFont);
  if (theme.bodyFont) root.style.setProperty("--font-body", theme.bodyFont);
  if (theme.featuredColsDesktop) root.style.setProperty("--featured-cols-desktop", String(theme.featuredColsDesktop));
  if (theme.featuredColsMobile) root.style.setProperty("--featured-cols-mobile", String(theme.featuredColsMobile));

  heroSection.classList.toggle("align-left", theme.heroAlign === "left");
  heroSection.appendChild(featuredBox);
}

function formatDateRange(start, end, allDay = false) {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (!startDate) return "";
  if (allDay) {
    const startLabel = startDate.toLocaleDateString(state.uiLang, { dateStyle: "medium" });
    if (!endDate || toDateKey(startDate) === toDateKey(endDate)) return startLabel;
    const endLabel = endDate.toLocaleDateString(state.uiLang, { dateStyle: "medium" });
    return `${startLabel} → ${endLabel}`;
  }
  const datePart = startDate.toLocaleDateString(state.uiLang, { dateStyle: "medium" });
  const timePart = startDate.toLocaleTimeString(state.uiLang, { timeStyle: "short" });
  if (!endDate) return `${datePart} · ${timePart}`;
  const endPart = endDate.toLocaleTimeString(state.uiLang, { timeStyle: "short" });
  return `${datePart} · ${timePart} → ${endPart}`;
}

function formatPrice(row) {
  if (row.price_type === "Free") return "Free";
  const min = row.price_min ?? "";
  const max = row.price_max ?? "";
  if (!min && !max) return row.price_type || "Paid";
  if (min && max) return `${min}–${max} ${row.currency || "ALL"}`;
  return `${min || max} ${row.currency || "ALL"}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  if (input.startsWith("/")) return input;
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function slugifyHolidayKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function buildAllDayRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    dayKey: toDateKey(start)
  };
}

function easterSundayGregorian(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function orthodoxEasterSunday(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julianDate = new Date(Date.UTC(year, month - 1, day));
  julianDate.setUTCDate(julianDate.getUTCDate() + 13);
  return new Date(julianDate.getUTCFullYear(), julianDate.getUTCMonth(), julianDate.getUTCDate(), 0, 0, 0, 0);
}

function getIslamicCalendarFormatter() {
  const options = {
    timeZone: TIRANA_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric"
  };
  try {
    return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", options);
  } catch {
    return new Intl.DateTimeFormat("en-u-ca-islamic", options);
  }
}

function getIslamicDateParts(date, formatter = getIslamicCalendarFormatter()) {
  const parts = formatter.formatToParts(date);
  return {
    month: Number(parts.find((part) => part.type === "month")?.value || 0),
    day: Number(parts.find((part) => part.type === "day")?.value || 0)
  };
}

function findIslamicHolidayDate(year, month, day) {
  const formatter = getIslamicCalendarFormatter();
  const start = new Date(year, 0, 1, 12, 0, 0, 0);
  const cursor = new Date(start);
  for (let step = 0; step < 367; step += 1) {
    const dateParts = getIslamicDateParts(cursor, formatter);
    if (dateParts.month === month && dateParts.day === day) {
      const tiranaDateKey = dateKeyInTirana(cursor);
      return parseDateKey(tiranaDateKey);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

function createHolidayEvent({
  year,
  key,
  title_en,
  title_sq,
  description_en,
  description_sq,
  date,
  category,
  bankHoliday = false,
  observed = false,
  palette = "civic"
}) {
  const paletteValues = HOLIDAY_PALETTES[palette] || HOLIDAY_PALETTES.civic;
  const { start, end, dayKey } = buildAllDayRange(date);
  return {
    id: `system-holiday:${year}:${slugifyHolidayKey(key)}`,
    status: "approved",
    title_en,
    title_es: title_en,
    title_sq,
    description_en,
    description_es: description_en,
    description_sq,
    location_en: "Nationwide",
    location_es: "Todo el país",
    location_sq: "Mbarë Shqipërinë",
    event_type: "Holiday",
    area: "",
    event_language: ["en", "sq"],
    date_start: start,
    date_end: end,
    all_day: true,
    price_type: "Free",
    price_min: null,
    price_max: null,
    currency: "ALL",
    ticket_url: "",
    event_image_url: "",
    event_image_urls: [],
    source_url: "",
    created_at: start,
    updated_at: start,
    is_system_holiday: true,
    is_bank_holiday: bankHoliday,
    holiday_category: category,
    holiday_observed: observed,
    holiday_day_key: dayKey,
    holiday_cell_bg: paletteValues.cellBg,
    holiday_cell_border: paletteValues.cellBorder,
    holiday_chip_bg: paletteValues.chipBg,
    holiday_chip_ink: paletteValues.chipInk,
    feature_blocked: true
  };
}

function buildObservedBankHoliday(event, date) {
  const originalTitleSq = event.title_sq || event.title_en;
  return createHolidayEvent({
    year: date.getFullYear(),
    key: `${event.id}-observed-${toDateKey(date)}`,
    title_en: `Observed bank holiday for ${event.title_en}`,
    title_sq: `Pushim bankar i zhvendosur për ${originalTitleSq}`,
    description_en: `${event.title_en} falls on a weekend, so Albanian banks observe the closure on the next working day.`,
    description_sq: `${originalTitleSq} bie në fundjavë, ndaj bankat në Shqipëri e zbatojnë pushimin në ditën e ardhshme të punës.`,
    date,
    category: "bank",
    bankHoliday: true,
    observed: true,
    palette: event.holiday_category === "religious-muslim"
      ? "muslim"
      : event.holiday_category === "religious-christian"
        ? "christian"
        : "civic"
  });
}

function getObservedBankHolidays(events) {
  const actualBankHolidays = events
    .filter((event) => event.is_bank_holiday && !event.holiday_observed)
    .sort((a, b) => new Date(a.date_start || 0) - new Date(b.date_start || 0));
  const occupiedKeys = new Set(actualBankHolidays.map((event) => event.holiday_day_key));
  const observed = [];

  actualBankHolidays.forEach((event) => {
    const date = parseDateKey(event.holiday_day_key);
    if (!date) return;
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) return;

    let candidate = addDays(date, 1);
    while (candidate.getDay() === 0 || candidate.getDay() === 6 || occupiedKeys.has(toDateKey(candidate))) {
      candidate = addDays(candidate, 1);
    }
    const candidateKey = toDateKey(candidate);
    occupiedKeys.add(candidateKey);
    observed.push(buildObservedBankHoliday(event, candidate));
  });

  return observed;
}

function createFixedHolidayEvents(year, definitions, category, bankHoliday = false) {
  return definitions.map((definition) => createHolidayEvent({
    year,
    key: definition.key,
    title_en: definition.title_en,
    title_sq: definition.title_sq,
    description_en: definition.description_en,
    description_sq: definition.description_sq,
    date: new Date(year, definition.month - 1, definition.day, 0, 0, 0, 0),
    category,
    bankHoliday,
    palette: definition.palette || "civic"
  }));
}

function createFloatingHolidayEvents(year) {
  const events = [];
  const catholicEaster = easterSundayGregorian(year);
  const orthodoxEaster = orthodoxEasterSunday(year);
  const eidAlFitr = findIslamicHolidayDate(year, 10, 1);
  const eidAlAdha = findIslamicHolidayDate(year, 12, 10);

  events.push(createHolidayEvent({
    year,
    key: "orthodox-christmas",
    title_en: "Orthodox Christmas",
    title_sq: "Krishtlindjet Ortodokse",
    description_en: "Major religious holiday observed by Orthodox communities.",
    description_sq: "Festë e rëndësishme fetare e kremtuar nga komunitetet ortodokse.",
    date: new Date(year, 0, 7, 0, 0, 0, 0),
    category: "religious-christian",
    palette: "christian"
  }));

  events.push(createHolidayEvent({
    year,
    key: "catholic-easter",
    title_en: "Catholic Easter",
    title_sq: "Pashkët Katolike",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    date: catholicEaster,
    category: "religious-christian",
    bankHoliday: true,
    palette: "christian"
  }));

  events.push(createHolidayEvent({
    year,
    key: "orthodox-easter",
    title_en: "Orthodox Easter",
    title_sq: "Pashkët Ortodokse",
    description_en: "Official bank holiday in Albania.",
    description_sq: "Pushim zyrtar bankar në Shqipëri.",
    date: orthodoxEaster,
    category: "religious-christian",
    bankHoliday: true,
    palette: "christian"
  }));

  if (eidAlFitr) {
    events.push(createHolidayEvent({
      year,
      key: "eid-al-fitr",
      title_en: "Eid al-Fitr",
      title_sq: "Fitër Bajrami",
      description_en: "Official bank holiday in Albania.",
      description_sq: "Pushim zyrtar bankar në Shqipëri.",
      date: eidAlFitr,
      category: "religious-muslim",
      bankHoliday: true,
      palette: "muslim"
    }));
  }

  if (eidAlAdha) {
    events.push(createHolidayEvent({
      year,
      key: "eid-al-adha",
      title_en: "Eid al-Adha",
      title_sq: "Kurban Bajrami",
      description_en: "Official bank holiday in Albania.",
      description_sq: "Pushim zyrtar bankar në Shqipëri.",
      date: eidAlAdha,
      category: "religious-muslim",
      bankHoliday: true,
      palette: "muslim"
    }));
  }

  return events;
}

function getHolidayYearsForDisplay() {
  const years = new Set();
  const nowYear = new Date().getFullYear();
  for (let year = nowYear - HOLIDAY_YEAR_LOOKBACK; year <= nowYear + HOLIDAY_YEAR_LOOKAHEAD; year += 1) {
    years.add(year);
  }

  years.add(state.calendarDate.getFullYear());
  years.add(state.weekStart.getFullYear());
  years.add(addDays(state.weekStart, 6).getFullYear());

  [state.filters.dateFrom, state.filters.dateTo].forEach((value) => {
    if (!value) return;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) years.add(date.getFullYear());
  });

  return [...years].sort((a, b) => a - b);
}

function generateHolidayEventsForYear(year) {
  if (holidayEventCache.has(year)) {
    return holidayEventCache.get(year);
  }

  const bankHolidays = createFixedHolidayEvents(year, BANK_HOLIDAY_DEFINITIONS, "bank", true);
  const internationalHolidays = createFixedHolidayEvents(year, INTERNATIONAL_HOLIDAYS, "international", false);
  const floatingHolidays = createFloatingHolidayEvents(year);
  const observedBankHolidays = getObservedBankHolidays([...bankHolidays, ...floatingHolidays]);
  const events = [...bankHolidays, ...floatingHolidays, ...observedBankHolidays, ...internationalHolidays]
    .sort((a, b) => new Date(a.date_start || 0) - new Date(b.date_start || 0));

  holidayEventCache.set(year, events);
  return events;
}

function getSystemHolidayEvents() {
  return getHolidayYearsForDisplay().flatMap((year) => generateHolidayEventsForYear(year));
}

function getAllDisplayEvents() {
  const now = new Date();
  const holidays = getSystemHolidayEvents().filter((event) => isPublicEventActive(event, now));
  return dedupeEvents([...state.events, ...holidays]);
}

function getHolidayUiStrings() {
  return {
    en: {
      bank: "Bank Holiday",
      religious: "Religious Holiday",
      international: "International Holiday",
      observed: "Observed",
      allDay: "All day"
    },
    es: {
      bank: "Festivo bancario",
      religious: "Festividad religiosa",
      international: "Festividad internacional",
      observed: "Observado",
      allDay: "Todo el día"
    },
    sq: {
      bank: "Pushim bankar",
      religious: "Festë fetare",
      international: "Festë ndërkombëtare",
      observed: "I zhvendosur",
      allDay: "Gjatë gjithë ditës"
    }
  }[state.uiLang] || {
    bank: "Bank Holiday",
    religious: "Religious Holiday",
    international: "International Holiday",
    observed: "Observed",
    allDay: "All day"
  };
}

function getHolidayCategoryLabel(event) {
  const strings = getHolidayUiStrings();
  if (event.is_bank_holiday) return strings.bank;
  if (String(event.holiday_category || "").startsWith("religious")) return strings.religious;
  return strings.international;
}

function getHolidayBadgeLabels(event) {
  if (!event.is_system_holiday) return [];
  const strings = getHolidayUiStrings();
  const labels = [getHolidayCategoryLabel(event), strings.allDay];
  if (event.holiday_observed) labels.push(strings.observed);
  return labels;
}

function getHolidayPalette(event) {
  return {
    soft: event.holiday_cell_bg || HOLIDAY_PALETTES.civic.cellBg,
    border: event.holiday_cell_border || HOLIDAY_PALETTES.civic.cellBorder,
    pillBg: event.holiday_chip_bg || HOLIDAY_PALETTES.civic.chipBg,
    pillInk: event.holiday_chip_ink || HOLIDAY_PALETTES.civic.chipInk
  };
}

function applyHolidayPaletteStyles(element, event) {
  if (!element || !event?.is_system_holiday) return;
  const palette = getHolidayPalette(event);
  element.style.setProperty("--holiday-soft", palette.soft);
  element.style.setProperty("--holiday-border", palette.border);
  element.style.setProperty("--holiday-pill-bg", palette.pillBg);
  element.style.setProperty("--holiday-pill-ink", palette.pillInk);
}

function buildHolidayBadgeHtml(event, extraLabels = []) {
  const labels = [...getHolidayBadgeLabels(event), ...extraLabels];
  if (!labels.length) return "";
  return `<div class="holiday-pill-row">${labels.map((label) => `<span class="holiday-pill">${escapeHtml(label)}</span>`).join("")}</div>`;
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function rgbString({ r, g, b }) {
  return `rgb(${clampColorChannel(r)}, ${clampColorChannel(g)}, ${clampColorChannel(b)})`;
}

function fallbackAverageColor(data) {
  let totalWeight = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    if (alpha <= 0.05) continue;
    totalWeight += alpha;
    r += data[index] * alpha;
    g += data[index + 1] * alpha;
    b += data[index + 2] * alpha;
  }

  if (!totalWeight) {
    return "rgb(32, 39, 48)";
  }

  return rgbString({
    r: r / totalWeight,
    g: g / totalWeight,
    b: b / totalWeight
  });
}

function extractProminentColor(img) {
  const width = Math.max(12, Math.min(32, img.naturalWidth || 24));
  const height = Math.max(12, Math.min(32, img.naturalHeight || 24));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return "rgb(32, 39, 48)";

  context.drawImage(img, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const buckets = new Map();

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    if (alpha <= 0.08) continue;

    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const brightness = (red + green + blue) / 3;
    const quantizedRed = Math.round(red / 24) * 24;
    const quantizedGreen = Math.round(green / 24) * 24;
    const quantizedBlue = Math.round(blue / 24) * 24;
    const key = `${quantizedRed},${quantizedGreen},${quantizedBlue}`;
    const weight = alpha * (0.7 + saturation) * (brightness < 235 ? 1 : 0.55);
    const bucket = buckets.get(key) || { score: 0, r: 0, g: 0, b: 0, weight: 0 };
    bucket.score += weight;
    bucket.weight += alpha;
    bucket.r += red * alpha;
    bucket.g += green * alpha;
    bucket.b += blue * alpha;
    buckets.set(key, bucket);
  }

  const winner = [...buckets.values()].sort((a, b) => b.score - a.score)[0];
  if (!winner || !winner.weight) {
    return fallbackAverageColor(data);
  }

  return rgbString({
    r: winner.r / winner.weight,
    g: winner.g / winner.weight,
    b: winner.b / winner.weight
  });
}

function applyFeaturedPosterColor(box, imageUrl, image) {
  const cached = featuredColorCache.get(imageUrl);
  if (cached) {
    box.style.setProperty("--featured-poster-bg", cached);
    return;
  }

  const updateColor = () => {
    try {
      const color = extractProminentColor(image);
      featuredColorCache.set(imageUrl, color);
      box.style.setProperty("--featured-poster-bg", color);
    } catch {
      box.style.setProperty("--featured-poster-bg", "rgb(32, 39, 48)");
    }
  };

  if (image.complete && image.naturalWidth > 0) {
    updateColor();
    return;
  }

  image.addEventListener("load", updateColor, { once: true });
  image.addEventListener("error", () => {
    box.style.setProperty("--featured-poster-bg", "rgb(32, 39, 48)");
  }, { once: true });
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getEventImages(event) {
  const urls = [];
  [event?.event_image_url, ...toArray(event?.event_image_urls)].forEach((value) => {
    const safe = safeUrl(value);
    if (safe && !urls.includes(safe)) urls.push(safe);
  });
  return urls;
}

function googleMapsUrl(location, area = "") {
  const query = [String(location || "").trim(), String(area || "").trim(), "Albania"]
    .filter(Boolean)
    .join(", ");
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function linkifyText(value) {
  const input = String(value || "");
  const urlPattern = /(https?:\/\/[^\s<]+)/g;
  let lastIndex = 0;
  let html = "";
  input.replace(urlPattern, (match, _capture, offset) => {
    html += escapeHtml(input.slice(lastIndex, offset));
    const safe = safeUrl(match);
    html += safe
      ? `<a href="${safe}" target="_blank" rel="noreferrer">${escapeHtml(match)}</a>`
      : escapeHtml(match);
    lastIndex = offset + match.length;
    return match;
  });
  html += escapeHtml(input.slice(lastIndex));
  return html.replace(/\n/g, "<br />");
}

function syncModalPlacement() {
  if (eventModal.classList.contains("hidden")) return;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const mobileViewport = window.innerWidth <= 720;
  const topGap = mobileViewport ? 10 : 18;
  const sideGap = mobileViewport ? 8 : 16;
  const bottomGap = mobileViewport ? 14 : 26;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const defaultTop = mobileViewport ? 12 : Math.max(20, Math.round(viewportHeight * 0.08));
  let nextTop = defaultTop;
  let nextLeft = Math.round(viewportWidth / 2);
  let originX = 50;
  let originY = 0;

  const rect = activeModalAnchorRect || (activeModalAnchor ? activeModalAnchor.getBoundingClientRect() : null);
  if (rect) {
    const modalHeight = Math.max(220, Math.min(modalContent?.offsetHeight || (mobileViewport ? 360 : 480), viewportHeight - topGap - bottomGap));
    const modalWidth = Math.max(280, Math.min(modalContent?.offsetWidth || Math.min(760, viewportWidth - (sideGap * 2)), viewportWidth - (sideGap * 2)));
    const minLeft = sideGap + (modalWidth / 2);
    const maxLeft = viewportWidth - sideGap - (modalWidth / 2);
    const anchorCenter = rect.left + (rect.width / 2);
    const roomBelow = viewportHeight - rect.bottom - bottomGap;
    const roomAbove = rect.top - topGap;
    const openBelow = roomBelow >= Math.min(modalHeight * 0.55, 260) || roomBelow >= roomAbove;
    const preferredBelowTop = rect.bottom + (mobileViewport ? 6 : 10);
    const preferredAboveTop = rect.top - modalHeight - (mobileViewport ? 6 : 10);
    const minTop = topGap;
    const maxTop = Math.max(minTop, viewportHeight - modalHeight - bottomGap);

    nextTop = clamp(
      Math.round(openBelow ? preferredBelowTop : preferredAboveTop),
      minTop,
      maxTop
    );
    nextLeft = Math.round(clamp(anchorCenter, minLeft, maxLeft));

    const modalLeftEdge = nextLeft - (modalWidth / 2);
    const originXPx = clamp(anchorCenter - modalLeftEdge, 24, modalWidth - 24);
    originX = Math.round((originXPx / modalWidth) * 100);
    originY = openBelow ? 0 : 100;
  }

  eventModal.style.setProperty("--modal-anchor-top", `${nextTop}px`);
  eventModal.style.setProperty("--modal-anchor-left", `${nextLeft}px`);
  eventModal.style.setProperty("--modal-origin-x", `${originX}%`);
  eventModal.style.setProperty("--modal-origin-y", `${originY}%`);
}

function openModal(content, options = {}) {
  const html = typeof content === "string" ? content : content?.html || "";
  if (options.anchorEl) {
    activeModalAnchor = options.anchorEl;
    activeModalAnchorRect = null;
  } else if (options.anchorRect) {
    activeModalAnchor = null;
    activeModalAnchorRect = options.anchorRect;
  }
  modalBody.innerHTML = html;
  eventModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  syncModalPlacement();
  requestAnimationFrame(syncModalPlacement);
  requestAnimationFrame(() => {
    modalBody.querySelectorAll("img").forEach((image) => {
      if (image.complete) return;
      image.addEventListener("load", syncModalPlacement, { once: true });
      image.addEventListener("error", syncModalPlacement, { once: true });
    });
  });
  if (content && typeof content.onOpen === "function") {
    content.onOpen();
  }
}

function closeModal() {
  eventModal.classList.add("hidden");
  modalBody.innerHTML = "";
  activeModalAnchor = null;
  activeModalAnchorRect = null;
  eventModal.style.removeProperty("--modal-anchor-top");
  eventModal.style.removeProperty("--modal-anchor-left");
  eventModal.style.removeProperty("--modal-origin-x");
  eventModal.style.removeProperty("--modal-origin-y");
  document.body.classList.remove("modal-open");
}

function buildModalGallery(images, title) {
  if (!images.length) return "";
  const controls = images.length > 1
    ? `
      <button type="button" class="modal-gallery-arrow modal-gallery-arrow-prev" data-gallery-prev aria-label="Previous image">←</button>
      <button type="button" class="modal-gallery-arrow modal-gallery-arrow-next" data-gallery-next aria-label="Next image">→</button>
      <div class="modal-gallery-counter" data-gallery-counter>1 / ${images.length}</div>
    `
    : "";
  return `
    <div class="modal-gallery">
      <div class="modal-gallery-frame">
        <img class="modal-poster modal-gallery-image" data-gallery-image src="${images[0]}" alt="${title}" loading="lazy" />
        ${controls}
      </div>
    </div>
  `;
}

function mountGalleryIn(root, images, titleText) {
  if (images.length <= 1) return;
  const image = root.querySelector("[data-gallery-image]");
  const counter = root.querySelector("[data-gallery-counter]");
  const prev = root.querySelector("[data-gallery-prev]");
  const next = root.querySelector("[data-gallery-next]");
  if (!image || !counter || !prev || !next) return;

  let index = 0;
  const render = () => {
    image.src = images[index];
    image.alt = `${titleText} image ${index + 1} of ${images.length}`;
    counter.textContent = `${index + 1} / ${images.length}`;
  };

  prev.addEventListener("click", (event) => {
    event.stopPropagation();
    index = (index - 1 + images.length) % images.length;
    render();
  });

  next.addEventListener("click", (event) => {
    event.stopPropagation();
    index = (index + 1) % images.length;
    render();
  });

  render();
}

function mountModalGallery(images, titleText) {
  mountGalleryIn(modalBody, images, titleText);
}

function createEventDetailContent(event, options = {}) {
  const titleText = pickText(event, "title") || "Untitled";
  const title = escapeHtml(titleText);
  const rawLocation = pickText(event, "location") || formatAreaLabel(event.area) || "";
  const description = linkifyText(pickText(event, "description") || "");
  const location = escapeHtml(rawLocation);
  const date = formatDateRange(event.date_start, event.date_end, event.all_day);
  const languages = escapeHtml((event.event_language || []).map((value) => formatEventLanguageValue(value, state.eventLanguageOptions)).join(", "));
  const price = escapeHtml(formatPrice(event));
  const ticketUrl = safeUrl(event.ticket_url);
  const sourceUrl = safeUrl(event.source_url);
  const mapsUrl = event.is_system_holiday ? "" : safeUrl(googleMapsUrl(rawLocation, event.area));
  const links = [
    ticketUrl ? `<a href="${ticketUrl}" target="_blank" rel="noreferrer">Tickets / RSVP</a>` : "",
    sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noreferrer">Website</a>` : "",
    mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noreferrer">Google Maps</a>` : ""
  ].filter(Boolean).join(" · ");
  const images = getEventImages(event);
  const holidayClass = event.is_system_holiday ? " event-detail-holiday" : "";
  const holidayStyle = event.is_system_holiday
    ? ` style="--holiday-soft:${escapeHtml(event.holiday_cell_bg || HOLIDAY_PALETTES.civic.cellBg)};--holiday-border:${escapeHtml(event.holiday_cell_border || HOLIDAY_PALETTES.civic.cellBorder)};--holiday-pill-bg:${escapeHtml(event.holiday_chip_bg || HOLIDAY_PALETTES.civic.chipBg)};--holiday-pill-ink:${escapeHtml(event.holiday_chip_ink || HOLIDAY_PALETTES.civic.chipInk)};"`
    : "";
  const titleId = options.titleId ? ` id="${options.titleId}"` : "";
  return {
    html: `
      <div class="event-detail-shell${holidayClass}"${holidayStyle}>
      ${buildHolidayBadgeHtml(event)}
      <h3${titleId}>${title}</h3>
      ${buildModalGallery(images, title)}
      <p>${description}</p>
      <div class="meta">
        <span>Location: ${location}</span>
        <span>Date: ${escapeHtml(date)}</span>
        <span>Type: ${escapeHtml(event.event_type || "")}</span>
        <span>Languages: ${languages}</span>
        <span>Price: ${price}</span>
      </div>
      ${links ? `<p>${links}</p>` : ""}
      </div>
    `,
    mount(root) {
      mountGalleryIn(root, images, titleText);
    }
  };
}

function eventDetailHtml(event) {
  const detail = createEventDetailContent(event, { titleId: "modal-title" });
  return {
    html: detail.html,
    onOpen() {
      detail.mount(modalBody);
    }
  };
}

function getSortedDayEvents(events) {
  const groupMeta = buildDayModalGroupMeta(events);
  return [...events].sort((a, b) => {
    const aMeta = groupMeta.get(String(a.id)) || { bucketCount: 1, isRecurring: false };
    const bMeta = groupMeta.get(String(b.id)) || { bucketCount: 1, isRecurring: false };
    const aGrouped = aMeta.isRecurring || aMeta.bucketCount > 1;
    const bGrouped = bMeta.isRecurring || bMeta.bucketCount > 1;
    if (aGrouped !== bGrouped) return aGrouped ? 1 : -1;
    const dateDiff = new Date(a.date_start || 0) - new Date(b.date_start || 0);
    if (dateDiff !== 0) return dateDiff;
    return pickText(a, "title").localeCompare(pickText(b, "title"), state.uiLang);
  });
}

function openDayModal(date, events, anchorEl = null) {
  const dayLabel = date.toLocaleDateString(state.uiLang, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const calendarAnchor = anchorEl || activeModalAnchor || calendarView.querySelector(".calendar") || calendarView;
  if (!events.length) {
    openModal(`<h3 id="modal-title">${escapeHtml(dayLabel)}</h3><p>No events for this day.</p>`, { anchorEl: calendarAnchor });
    return;
  }

  const groupMeta = buildDayModalGroupMeta(events);
  const sortedEvents = getSortedDayEvents(events);

  const items = sortedEvents
    .map(
      (event) => {
        const meta = groupMeta.get(String(event.id)) || { bucketCount: 1, isRecurring: false };
        const badges = [];
        if (meta.isRecurring) badges.push("Recurring");
        if (meta.bucketCount > 1) badges.push(`Grouped x${meta.bucketCount}`);
        const holidayClass = event.is_system_holiday ? " modal-event-holiday" : "";
        const holidayStyle = event.is_system_holiday
          ? ` style="--holiday-soft:${escapeHtml(event.holiday_cell_bg || HOLIDAY_PALETTES.civic.cellBg)};--holiday-border:${escapeHtml(event.holiday_cell_border || HOLIDAY_PALETTES.civic.cellBorder)};--holiday-pill-bg:${escapeHtml(event.holiday_chip_bg || HOLIDAY_PALETTES.civic.chipBg)};--holiday-pill-ink:${escapeHtml(event.holiday_chip_ink || HOLIDAY_PALETTES.civic.chipInk)};"`
          : "";
        return `
      <div class="modal-event${holidayClass}" data-event-id="${event.id}"${holidayStyle}>
        <h4>${escapeHtml(pickText(event, "title") || "Untitled")}</h4>
        ${getEventImages(event)[0] ? `<img class="modal-poster" src="${getEventImages(event)[0]}" alt="${escapeHtml(pickText(event, "title") || "Event")}" loading="lazy" />` : ""}
        <p>${escapeHtml(formatDateRange(event.date_start, event.date_end, event.all_day))}</p>
        <p>${escapeHtml(pickText(event, "location") || formatAreaLabel(event.area) || "")}</p>
        ${(event.is_system_holiday || badges.length) ? `<div class="modal-event-badges">${[
          ...getHolidayBadgeLabels(event),
          ...badges
        ].map((badge) => `<span class="modal-event-badge">${escapeHtml(badge)}</span>`).join("")}</div>` : ""}
      </div>
    `;
      }
    )
    .join("");

  openModal(`<h3 id="modal-title">${escapeHtml(dayLabel)}</h3><div class="modal-day-list">${items}</div>`, { anchorEl: calendarAnchor });
  modalBody.querySelectorAll(".modal-event").forEach((el) => {
    el.addEventListener("click", () => {
      const target = sortedEvents.find((evt) => String(evt.id) === el.dataset.eventId);
      if (target) openModal(eventDetailHtml(target), { anchorRect: el.getBoundingClientRect() });
    });
  });
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDuplicateValue(value) {
  return String(value || "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateKeyInTirana(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tirane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function duplicateEventKey(event) {
  const dayKey = dateKeyInTirana(event.date_start);
  const titleKey = normalizeDuplicateValue(event.title_en || pickText(event, "title"));
  if (!dayKey || !titleKey) return "";
  const areaKey = normalizeDuplicateValue(normalizeAreaValue(event.area));
  const locationKey = normalizeDuplicateValue(event.location_en || event.location_es || event.location_sq || normalizeAreaValue(event.area));
  return [dayKey, titleKey, areaKey, locationKey].join("|");
}

function duplicateEventScore(event) {
  let score = 0;
  if (event.is_highlighted) score += 100;
  if (getEventImages(event).length) score += 10;
  if (event.ticket_url) score += 2;
  if (event.source_url) score += 1;
  if (String(event.description_en || "").trim()) score += 1;
  return score;
}

function preferDuplicateEvent(existingEvent, incomingEvent) {
  const scoreDiff = duplicateEventScore(incomingEvent) - duplicateEventScore(existingEvent);
  if (scoreDiff !== 0) return scoreDiff > 0 ? incomingEvent : existingEvent;
  const createdDiff = new Date(incomingEvent.created_at || 0) - new Date(existingEvent.created_at || 0);
  if (createdDiff !== 0) return createdDiff > 0 ? incomingEvent : existingEvent;
  return new Date(incomingEvent.date_start || 0) < new Date(existingEvent.date_start || 0) ? incomingEvent : existingEvent;
}

function dedupeEvents(events) {
  const deduped = [];
  const duplicateMap = new Map();

  events.forEach((event) => {
    const key = duplicateEventKey(event);
    if (!key) {
      deduped.push(event);
      return;
    }
    const existing = duplicateMap.get(key);
    if (!existing) {
      duplicateMap.set(key, event);
      return;
    }
    duplicateMap.set(key, preferDuplicateEvent(existing, event));
  });

  return [...deduped, ...duplicateMap.values()].sort((a, b) => {
    const startDiff = new Date(a.date_start || 0) - new Date(b.date_start || 0);
    if (startDiff !== 0) return startDiff;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function registerFilterElement(name, syncer) {
  if (!filterInputRegistry.has(name)) filterInputRegistry.set(name, []);
  filterInputRegistry.get(name).push(syncer);
}

function setFilterValue(name, value) {
  state.filters[name] = value;
  syncFilterInputs();
  render();
}

function activeMobileFilterCount() {
  let count = 0;
  if (state.filters.eventType.length) count += 1;
  if (state.filters.area.length) count += 1;
  if (state.filters.eventLanguage.length) count += 1;
  if (state.filters.dateFrom) count += 1;
  if (state.filters.dateTo) count += 1;
  if (state.filters.sort && state.filters.sort !== "date_asc") count += 1;
  return count;
}

function syncFilterInputs() {
  filterInputRegistry.forEach((syncers, name) => {
    syncers.forEach((syncer) => syncer(state.filters[name], name));
  });
  if (mobileFiltersButton) {
    const count = activeMobileFilterCount();
    mobileFiltersButton.textContent = count ? `Filters (${count})` : "Filters";
  }
}

function closeMobileFilterPanel() {
  if (!mobileFilterPanel) return;
  mobileFilterPanel.classList.add("hidden");
  mobileFiltersButton?.setAttribute("aria-expanded", "false");
  closeAllFilterPickers();
}

function toggleMobileFilterPanel() {
  if (!mobileFilterPanel) return;
  const nextOpen = mobileFilterPanel.classList.contains("hidden");
  mobileFilterPanel.classList.toggle("hidden", !nextOpen);
  mobileFiltersButton?.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  if (!nextOpen) closeAllFilterPickers();
}

function createSelect(name, labelText, options, includeAny = true, config = {}) {
  const wrap = document.createElement("div");
  wrap.className = `control control-${name}`;
  if (config.compact) wrap.classList.add("control-compact");
  if (config.multiple) wrap.classList.add("control-multi");
  const label = document.createElement("label");
  label.textContent = labelText;
  if (config.hideLabel) label.classList.add("visually-hidden");
  const select = document.createElement("select");
  select.name = name;
  if (config.multiple) {
    select.multiple = true;
    select.size = config.size || 6;
  }
  if (includeAny && !config.multiple) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "All";
    select.appendChild(opt);
  }
  options.forEach((option) => {
    if (option?.options) {
      const group = document.createElement("optgroup");
      group.label = option.label;
      option.options.forEach((groupOption) => {
        const opt = document.createElement("option");
        opt.value = groupOption.value ?? groupOption;
        opt.textContent = groupOption.label ?? groupOption;
        group.appendChild(opt);
      });
      select.appendChild(group);
      return;
    }
    const opt = document.createElement("option");
    opt.value = option.value ?? option;
    opt.textContent = option.label ?? option;
    select.appendChild(opt);
  });
  select.addEventListener("change", (event) => {
    if (select.multiple) {
      setFilterValue(name, [...event.target.selectedOptions].map((option) => option.value));
      return;
    }
    setFilterValue(name, event.target.value);
  });
  registerFilterElement(name, (value) => {
    if (select.multiple) {
      const selectedValues = Array.isArray(value) ? value : [];
      [...select.options].forEach((option) => {
        option.selected = selectedValues.includes(option.value);
      });
      return;
    }
    select.value = Array.isArray(value) ? "" : (value || "");
  });
  wrap.append(label, select);
  return wrap;
}

function createInput(name, labelText, type = "text", placeholder = "", config = {}) {
  const wrap = document.createElement("div");
  wrap.className = `control control-${name}`;
  if (config.compact) wrap.classList.add("control-compact");
  const label = document.createElement("label");
  label.textContent = labelText;
  if (config.hideLabel) label.classList.add("visually-hidden");
  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  input.placeholder = placeholder;
  input.addEventListener(type === "text" ? "input" : "change", (event) => {
    setFilterValue(name, event.target.value);
  });
  registerFilterElement(name, (value) => {
    input.value = Array.isArray(value) ? "" : (value || "");
  });
  wrap.append(label, input);
  return wrap;
}

function normalizePickerGroups(options) {
  return options
    .map((option) => {
      if (option?.options) {
        return {
          label: option.label,
          options: option.options.map((groupOption) => ({
            value: groupOption.value ?? groupOption,
            label: groupOption.label ?? groupOption
          }))
        };
      }
      return {
        label: "",
        options: [{
          value: option.value ?? option,
          label: option.label ?? option
        }]
      };
    })
    .filter((group) => group.options.length);
}

function closeAllFilterPickers(exceptControl = null) {
  document.querySelectorAll(".filter-picker-control.is-open").forEach((control) => {
    if (exceptControl && control === exceptControl) return;
    control.classList.remove("is-open");
    control.querySelector(".filter-picker-trigger")?.setAttribute("aria-expanded", "false");
  });
}

function getFilterPickerSummary(labelText, selectedValues, optionLookup) {
  if (!selectedValues.length) return `All ${labelText.toLowerCase()}`;
  const selectedLabels = selectedValues
    .map((value) => optionLookup.get(value))
    .filter(Boolean);
  if (!selectedLabels.length) return `All ${labelText.toLowerCase()}`;
  if (selectedLabels.length === 1) return selectedLabels[0];
  if (selectedLabels.length === 2) return `${selectedLabels[0]} · ${selectedLabels[1]}`;
  return `${selectedLabels[0]} +${selectedLabels.length - 1}`;
}

function createFilterPicker(name, labelText, options, config = {}) {
  const wrap = document.createElement("div");
  wrap.className = `control control-${name} filter-picker-control`;
  wrap.dataset.filterPickerName = name;
  if (config.compact) wrap.classList.add("control-compact");

  const label = document.createElement("label");
  label.textContent = labelText;
  if (config.hideLabel) label.classList.add("visually-hidden");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "filter-picker-trigger";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-haspopup", "dialog");

  const summary = document.createElement("span");
  summary.className = "filter-picker-summary";
  const chevron = document.createElement("span");
  chevron.className = "filter-picker-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "▾";
  trigger.append(summary, chevron);

  const panel = document.createElement("div");
  panel.className = "filter-picker-panel";

  const panelHeader = document.createElement("div");
  panelHeader.className = "filter-picker-panel-header";
  const panelTitle = document.createElement("strong");
  panelTitle.textContent = labelText;
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "filter-picker-clear";
  clear.textContent = "Clear";
  clear.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setFilterValue(name, []);
  });
  panelHeader.append(panelTitle, clear);
  panel.appendChild(panelHeader);

  const groupsWrap = document.createElement("div");
  groupsWrap.className = "filter-picker-groups";
  const groups = normalizePickerGroups(options);
  const optionLookup = new Map();
  const optionButtons = [];

  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "filter-picker-group";
    if (group.label) {
      const heading = document.createElement("h4");
      heading.textContent = group.label;
      section.appendChild(heading);
    }
    const optionsGrid = document.createElement("div");
    optionsGrid.className = "filter-picker-options";
    group.options.forEach((option) => {
      optionLookup.set(option.value, option.label);
      const optionButton = document.createElement("button");
      optionButton.type = "button";
      optionButton.className = "filter-picker-option";
      optionButton.dataset.value = option.value;
      optionButton.textContent = option.label;
      optionButton.setAttribute("aria-pressed", "false");
      optionButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = Array.isArray(state.filters[name]) ? state.filters[name] : [];
        const next = current.includes(option.value)
          ? current.filter((value) => value !== option.value)
          : [...current, option.value];
        setFilterValue(name, next);
      });
      optionsGrid.appendChild(optionButton);
      optionButtons.push(optionButton);
    });
    section.appendChild(optionsGrid);
    groupsWrap.appendChild(section);
  });

  panel.appendChild(groupsWrap);

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextOpen = !wrap.classList.contains("is-open");
    closeAllFilterPickers(nextOpen ? wrap : null);
    wrap.classList.toggle("is-open", nextOpen);
    trigger.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  });

  panel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  registerFilterElement(name, (value) => {
    const selectedValues = Array.isArray(value) ? value : [];
    summary.textContent = getFilterPickerSummary(labelText, selectedValues, optionLookup);
    summary.title = summary.textContent;
    clear.hidden = !selectedValues.length;
    optionButtons.forEach((button) => {
      const isSelected = selectedValues.includes(button.dataset.value);
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  });

  wrap.append(label, trigger, panel);
  return wrap;
}

function createFilterDescriptors(strings) {
  return [
    {
      name: "eventType",
      render(config = {}) {
        return createFilterPicker(
          "eventType",
          strings.filters.eventType,
          EVENT_TYPES.map((t) => ({ value: t, label: t })),
          config
        );
      }
    },
    {
      name: "area",
      render(config = {}) {
        return createFilterPicker("area", strings.filters.area, AREA_GROUPS, config);
      }
    },
    {
      name: "eventLanguage",
      render(config = {}) {
        return createFilterPicker(
          "eventLanguage",
          strings.filters.eventLanguage,
          state.eventLanguageOptions.map((language) => ({ value: language.code, label: language.label })),
          config
        );
      }
    },
    {
      name: "dateFrom",
      render(config = {}) {
        return createInput("dateFrom", strings.filters.dateFrom, "date", "", config);
      }
    },
    {
      name: "dateTo",
      render(config = {}) {
        return createInput("dateTo", strings.filters.dateTo, "date", "", config);
      }
    },
    {
      name: "sort",
      render(config = {}) {
        return createSelect("sort", strings.filters.sort, Object.entries(strings.sortOptions).map(([value, label]) => ({ value, label })), false, config);
      }
    }
  ];
}

function renderFilters() {
  filterInputRegistry = new Map();
  filterControls.innerHTML = "";
  if (searchSlot) searchSlot.innerHTML = "";
  if (mobileFilterControls) mobileFilterControls.innerHTML = "";
  const strings = uiStrings[state.uiLang];
  const searchPlaceholder = "Search titles and descriptions";
  const filterDescriptors = createFilterDescriptors(strings);

  filterControls.append(...filterDescriptors.map((descriptor) => descriptor.render()));

  if (searchSlot) {
    searchSlot.appendChild(createInput("search", strings.filters.search, "text", searchPlaceholder, { compact: true }));
  }

  if (mobileFilterControls) {
    filterDescriptors.forEach((descriptor) => {
      mobileFilterControls.appendChild(descriptor.render({ compact: true }));
    });
  }

  syncFilterInputs();
}

function filterEvents() {
  const { search, eventType, area, eventLanguage, dateFrom, dateTo } = state.filters;
  return getAllDisplayEvents()
    .filter((event) => {
      const searchText = `${pickText(event, "title")} ${pickText(event, "description")} ${pickText(event, "location")}`.toLowerCase();
      const matchesSearch = !search || searchText.includes(search.toLowerCase());
      const matchesType = !eventType.length || eventType.includes(event.event_type);
      const matchesArea = !area.length || area.includes(normalizeAreaValue(event.area));
      const matchesLanguage = !eventLanguage.length || (event.event_language || []).some((language) => eventLanguage.includes(language));
      const startDate = event.date_start ? new Date(event.date_start) : null;
      const matchesFrom = !dateFrom || (startDate && startDate >= new Date(dateFrom));
      const matchesTo = !dateTo || (startDate && startDate <= new Date(dateTo));
      return matchesSearch && matchesType && matchesArea && matchesLanguage && matchesFrom && matchesTo;
    })
    .sort((a, b) => {
      const sort = state.filters.sort;
      if (sort === "price_asc") return (a.price_min ?? 0) - (b.price_min ?? 0);
      if (sort === "price_desc") return (b.price_min ?? 0) - (a.price_min ?? 0);
      if (sort === "date_desc") return new Date(b.date_start || 0) - new Date(a.date_start || 0);
      return new Date(a.date_start || 0) - new Date(b.date_start || 0);
    });
}

function eventEndsAt(event) {
  const rawValue = event.date_end || event.date_start;
  if (!rawValue) return null;
  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPublicEventActive(event, reference = new Date()) {
  const endDate = eventEndsAt(event);
  return Boolean(endDate && endDate >= reference);
}

function featuredFallbackSort(a, b) {
  const createdDiff = new Date(b.created_at || 0) - new Date(a.created_at || 0);
  if (createdDiff !== 0) return createdDiff;
  return new Date(b.date_start || 0) - new Date(a.date_start || 0);
}

function getFeaturedCandidateEvents() {
  const selected = state.events
    .filter((event) => event.is_highlighted && !event.feature_blocked && (isFeaturedEligibleArea(event.area) || event.feature_override) && !event.recurrence_group_id)
    .sort((a, b) => new Date(a.date_start || 0) - new Date(b.date_start || 0));
  const fallback = state.events
    .filter((event) => !event.is_highlighted && !event.feature_blocked && isFeaturedEligibleArea(event.area) && !event.recurrence_group_id)
    .sort(featuredFallbackSort);
  return [...selected, ...fallback];
}

function pickRotatingFeaturedEvents(pool, count) {
  if (pool.length <= count) return pool.slice();
  const pageCount = Math.ceil(pool.length / count);
  const pageIndex = Math.floor(Date.now() / FEATURED_ROTATION_MS) % pageCount;
  const startIndex = pageIndex * count;
  const rotated = [];
  for (let step = 0; step < pool.length && rotated.length < count; step += 1) {
    const event = pool[(startIndex + step) % pool.length];
    if (event && !rotated.includes(event)) rotated.push(event);
  }
  return rotated;
}

function getHighlightedEvents() {
  const candidates = getFeaturedCandidateEvents();
  const fixedRow = candidates.slice(0, FEATURED_FIXED_COUNT);
  const rotatingPool = candidates.slice(FEATURED_FIXED_COUNT).filter((event) => !fixedRow.includes(event));
  const rotatingRow = pickRotatingFeaturedEvents(rotatingPool, FEATURED_ROTATE_COUNT);
  return [...fixedRow, ...rotatingRow];
}

function getMobileFeaturedEvents() {
  const monthStart = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), 1);
  const monthEnd = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 0, 23, 59, 59, 999);
  const candidates = getFeaturedCandidateEvents().filter((event) => {
    const start = event.date_start ? new Date(event.date_start) : null;
    const end = eventEndsAt(event) || start;
    if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return false;
    return start <= monthEnd && end >= monthStart;
  });
  return candidates.length ? candidates : getHighlightedEvents();
}

function ensureFeaturedRotation() {
  if (isMobileViewport()) {
    if (featuredRotationTimer) {
      clearInterval(featuredRotationTimer);
      featuredRotationTimer = null;
    }
    return;
  }
  const candidateCount = Math.max(0, getFeaturedCandidateEvents().length - FEATURED_FIXED_COUNT);
  if (candidateCount <= FEATURED_ROTATE_COUNT) {
    if (featuredRotationTimer) {
      clearInterval(featuredRotationTimer);
      featuredRotationTimer = null;
    }
    return;
  }
  if (!featuredRotationTimer) {
    featuredRotationTimer = window.setInterval(() => {
      renderFeatured();
    }, FEATURED_ROTATION_MS);
  }
}

function stopMobileFeaturedCarousel() {
  if (mobileFeaturedCarouselTimer) {
    clearInterval(mobileFeaturedCarouselTimer);
    mobileFeaturedCarouselTimer = null;
  }
  if (featuredGrid) {
    featuredGrid.onscroll = null;
  }
}

function syncMobileFeaturedCarousel() {
  stopMobileFeaturedCarousel();
  if (!featuredGrid || !isMobileViewport()) return;

  const items = Array.from(featuredGrid.querySelectorAll(".featured-item"));
  if (items.length <= 1) return;

  let index = Number(featuredGrid.dataset.mobileFeaturedIndex || 0);
  if (!Number.isFinite(index) || index < 0 || index >= items.length) {
    index = 0;
  }

  const updateIndexFromScroll = () => {
    const left = featuredGrid.scrollLeft;
    let nearestIndex = index;
    let nearestDistance = Number.POSITIVE_INFINITY;
    items.forEach((item, itemIndex) => {
      const distance = Math.abs(item.offsetLeft - left);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = itemIndex;
      }
    });
    index = nearestIndex;
    featuredGrid.dataset.mobileFeaturedIndex = String(nearestIndex);
  };

  const scrollToIndex = (nextIndex) => {
    const target = items[nextIndex];
    if (!target) return;
    featuredGrid.dataset.mobileFeaturedIndex = String(nextIndex);
    featuredGrid.scrollTo({
      left: target.offsetLeft,
      behavior: "smooth"
    });
  };

  featuredGrid.onscroll = updateIndexFromScroll;
  mobileFeaturedCarouselTimer = window.setInterval(() => {
    index = (index + 1) % items.length;
    scrollToIndex(index);
  }, MOBILE_FEATURED_SCROLL_MS);
}

function getListViewWindow(events) {
  if (!events.length) return [];
  const start = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), 1);
  const end = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 2, 0, 23, 59, 59, 999);
  return events.filter((event) => {
    const eventStart = event.date_start ? new Date(event.date_start) : null;
    const eventEnd = eventEndsAt(event) || eventStart;
    if (!eventStart || Number.isNaN(eventStart.getTime()) || !eventEnd || Number.isNaN(eventEnd.getTime())) return false;
    return eventStart <= end && eventEnd >= start;
  });
}

function buildListTile(event) {
  const tile = document.createElement("article");
  tile.className = "event-tile";
  if (event.is_system_holiday) {
    tile.classList.add("event-tile-holiday");
    if (event.is_bank_holiday) tile.classList.add("event-tile-bank-holiday");
    applyHolidayPaletteStyles(tile, event);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "event-tile-button";

  const titleText = pickText(event, "title") || "Untitled";
  const eventImageUrl = getEventImages(event)[0] || "";
  if (eventImageUrl) {
    const image = document.createElement("img");
    image.className = "event-tile-image";
    image.src = eventImageUrl;
    image.alt = titleText;
    image.loading = "lazy";
    button.appendChild(image);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "event-tile-fallback";
    fallback.textContent = titleText;
    button.appendChild(fallback);
  }

  const body = document.createElement("div");
  body.className = "event-tile-body";
  const title = document.createElement("h3");
  title.textContent = titleText;
  const date = document.createElement("p");
  date.className = "event-tile-date";
  date.textContent = formatDateRange(event.date_start, event.date_end, event.all_day);
  const location = document.createElement("p");
  location.className = "event-tile-location";
  location.textContent = pickText(event, "location") || formatAreaLabel(event.area) || "";
  body.append(title, date, location);

  const badges = [...getHolidayBadgeLabels(event)];
  if (event.recurrence_group_id) badges.push("Recurring");
  if (badges.length) {
    const badgeRow = document.createElement("div");
    badgeRow.className = "event-tile-badges";
    badges.forEach((badgeLabel) => {
      const badge = document.createElement("span");
      badge.className = "event-tile-badge";
      badge.textContent = badgeLabel;
      badgeRow.appendChild(badge);
    });
    body.appendChild(badgeRow);
  }

  button.appendChild(body);
  button.addEventListener("click", () => openModal(eventDetailHtml(event), { anchorEl: button }));
  tile.appendChild(button);
  return tile;
}

function renderEvents() {
  const events = filterEvents();
  const listEvents = state.viewMode === "list" ? getListViewWindow(events) : events;
  eventList.innerHTML = "";
  eventList.classList.toggle("event-tile-grid", state.viewMode === "list");
  resultsCount.textContent = `${listEvents.length} ${uiStrings[state.uiLang].results}`;
  if (!listEvents.length) {
    const empty = document.createElement("div");
    empty.className = "notice";
    empty.textContent = state.viewMode === "list"
      ? "No events match these filters in this two-month window yet."
      : "No events match these filters yet.";
    eventList.appendChild(empty);
    return;
  }

  if (state.viewMode === "list") {
    listEvents.forEach((event) => {
      eventList.appendChild(buildListTile(event));
    });
    return;
  }

  listEvents.forEach((event) => {
    const card = document.createElement("div");
    card.className = "card";
    if (event.is_system_holiday) {
      card.classList.add("card-holiday");
      if (event.is_bank_holiday) card.classList.add("card-bank-holiday");
      applyHolidayPaletteStyles(card, event);
    }
    const badgeRow = document.createElement("div");
    if (event.is_system_holiday) {
      badgeRow.className = "holiday-pill-row";
      getHolidayBadgeLabels(event).forEach((label) => {
        const badge = document.createElement("span");
        badge.className = "holiday-pill";
        badge.textContent = label;
        badgeRow.appendChild(badge);
      });
    }
    const title = document.createElement("h3");
    title.textContent = pickText(event, "title");
    const desc = document.createElement("p");
    desc.innerHTML = linkifyText(pickText(event, "description"));
    if (event.is_system_holiday) {
      desc.classList.add("card-holiday-description");
    }
    desc.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (eventObject) => eventObject.stopPropagation());
    });
    const image = document.createElement("img");
    const eventImageUrl = getEventImages(event)[0] || "";
    if (eventImageUrl) {
      image.className = "event-poster";
      image.src = eventImageUrl;
      image.alt = pickText(event, "title") || "Event";
      image.loading = "lazy";
    }
    const meta = document.createElement("div");
    meta.className = "meta";
    if (event.is_system_holiday) {
      meta.innerHTML = `
        <span>📍 ${escapeHtml(pickText(event, "location") || formatAreaLabel(event.area))}</span>
        <span>🗓️ ${escapeHtml(formatDateRange(event.date_start, event.date_end, event.all_day))}</span>
        <span>🏷️ ${escapeHtml(getHolidayCategoryLabel(event))}</span>
      `;
    } else {
      meta.innerHTML = `
        <span>📍 ${escapeHtml(pickText(event, "location") || formatAreaLabel(event.area))}</span>
        <span>🗓️ ${escapeHtml(formatDateRange(event.date_start, event.date_end, event.all_day))}</span>
        <span>🏷️ ${escapeHtml(event.event_type || "")}</span>
        <span>💬 ${escapeHtml((event.event_language || []).map((value) => formatEventLanguageValue(value, state.eventLanguageOptions)).join(", "))}</span>
        <span>💰 ${escapeHtml(formatPrice(event))}</span>
      `;
    }

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const ticketUrl = safeUrl(event.ticket_url);
    const sourceUrl = safeUrl(event.source_url);
    const mapsUrl = event.is_system_holiday ? "" : safeUrl(googleMapsUrl(pickText(event, "location") || formatAreaLabel(event.area), event.area));
    if (ticketUrl) {
      const link = document.createElement("a");
      link.href = ticketUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Tickets / RSVP";
      link.style.color = "var(--brand)";
      link.addEventListener("click", (eventObject) => eventObject.stopPropagation());
      actions.appendChild(link);
    }
    if (sourceUrl) {
      const link = document.createElement("a");
      link.href = sourceUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Website";
      link.style.color = "var(--brand)";
      link.addEventListener("click", (eventObject) => eventObject.stopPropagation());
      if (actions.childNodes.length) actions.append(" · ");
      actions.appendChild(link);
    }
    if (mapsUrl) {
      const link = document.createElement("a");
      link.href = mapsUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Map";
      link.style.color = "var(--brand)";
      link.addEventListener("click", (eventObject) => eventObject.stopPropagation());
      if (actions.childNodes.length) actions.append(" · ");
      actions.appendChild(link);
    }

    if (badgeRow.childNodes.length) {
      card.appendChild(badgeRow);
    }
    if (eventImageUrl) {
      card.append(title, image, desc, meta);
    } else {
      card.append(title, desc, meta);
    }
    if (actions.childNodes.length) {
      card.appendChild(actions);
    }
    card.addEventListener("click", () => openModal(eventDetailHtml(event), { anchorEl: card }));
    eventList.appendChild(card);
  });
}

function renderFeatured() {
  ensureFeaturedRotation();
  const items = isMobileViewport() ? getMobileFeaturedEvents() : getHighlightedEvents();
  const placeholderImage = state.settings?.featured_placeholder_image_url || "";

  featuredGrid.innerHTML = "";
  const list = [...items];
  if (!isMobileViewport()) {
    while (list.length < FEATURED_TOTAL_COUNT) {
      list.push(null);
    }
  } else if (!list.length) {
    list.push(null);
  }

  list.forEach((event) => {
    const box = document.createElement(event ? "button" : "div");
    box.className = "featured-item";
    if (!event) {
      box.classList.add("featured-item-empty");
      const placeholderImageUrl = safeUrl(placeholderImage);
      if (placeholderImageUrl) {
        box.classList.add("featured-item-empty-image");
        box.innerHTML = `<img class="featured-placeholder-image" src="${placeholderImageUrl}" alt="More events coming soon" loading="lazy" />`;
      } else {
        box.innerHTML = '<div class="featured-fallback"><span class="featured-fallback-title">Coming soon</span></div>';
      }
      featuredGrid.appendChild(box);
      return;
    }
    box.type = "button";
    box.classList.add("featured-item-poster");
    const eventTitle = pickText(event, "title") || "Untitled";
    const eventImageUrl = getEventImages(event)[0] || "";
    box.ariaLabel = `${eventTitle}. Open event details.`;
    box.title = eventTitle;
    if (eventImageUrl) {
      const image = document.createElement("img");
      image.className = "featured-poster-image";
      image.crossOrigin = "anonymous";
      image.src = eventImageUrl;
      image.alt = eventTitle;
      image.loading = "lazy";
      image.decoding = "async";
      box.appendChild(image);
      const caption = document.createElement("span");
      caption.className = "featured-item-caption";
      caption.textContent = eventTitle;
      box.appendChild(caption);
      applyFeaturedPosterColor(box, eventImageUrl, image);
    } else {
      box.classList.add("featured-item-no-image");
      box.innerHTML = `<div class="featured-fallback"><span class="featured-fallback-title">${escapeHtml(eventTitle)}</span></div>`;
    }
    box.addEventListener("click", () => openModal(eventDetailHtml(event), { anchorEl: box }));
    featuredGrid.appendChild(box);
  });

  syncMobileFeaturedCarousel();
}

function groupEventsByDate(events) {
  return events.reduce((acc, event) => {
    if (!event.date_start) return acc;
    const key = toDateKey(new Date(event.date_start));
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});
}

function dayModalGroupKey(event) {
  const titleKey = normalizeDuplicateValue(event.title_en || pickText(event, "title"));
  if (!titleKey) return "";
  const areaKey = normalizeDuplicateValue(normalizeAreaValue(event.area));
  const locationKey = normalizeDuplicateValue(event.location_en || event.location_es || event.location_sq || normalizeAreaValue(event.area));
  return [titleKey, areaKey, locationKey].join("|");
}

function buildDayModalGroupMeta(events) {
  const recurrenceBuckets = new Map();
  const titleBuckets = new Map();

  events.forEach((event) => {
    if (event.recurrence_group_id) {
      const key = String(event.recurrence_group_id);
      if (!recurrenceBuckets.has(key)) recurrenceBuckets.set(key, []);
      recurrenceBuckets.get(key).push(event);
    }
    const titleKey = dayModalGroupKey(event);
    if (!titleKey) return;
    if (!titleBuckets.has(titleKey)) titleBuckets.set(titleKey, []);
    titleBuckets.get(titleKey).push(event);
  });

  const meta = new Map();
  events.forEach((event) => {
    const recurrenceCount = event.recurrence_group_id ? (recurrenceBuckets.get(String(event.recurrence_group_id)) || []).length : 0;
    const titleCount = (titleBuckets.get(dayModalGroupKey(event)) || []).length;
    meta.set(String(event.id), {
      isRecurring: Boolean(event.recurrence_group_id),
      bucketCount: Math.max(recurrenceCount, titleCount, 1)
    });
  });
  return meta;
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function getCalendarCountLabel(count) {
  const strings = uiStrings[state.uiLang];
  const noun = count === 1 ? strings.eventSingular : strings.eventPlural;
  return `${count} ${noun}`;
}

function clearCalendarDayFocus() {
  state.selectedCalendarDayKey = "";
  state.expandedCalendarEventId = "";
}

function shiftCalendarMonth(monthOffset) {
  clearCalendarDayFocus();
  state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + monthOffset, 1);
  render();
}

function openCalendarDayAfterRender(date) {
  state.selectedCalendarDayKey = toDateKey(date);
  state.expandedCalendarEventId = "";
  render();
}

function attachMonthSwipeNavigation(target) {
  if (!target) return;
  let touchStart = null;

  target.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) {
      touchStart = null;
      return;
    }
    const touch = event.touches[0];
    touchStart = {
      x: touch.clientX,
      y: touch.clientY,
      at: Date.now()
    };
  }, { passive: true });

  target.addEventListener("touchend", (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches?.[0];
    if (!touch) {
      touchStart = null;
      return;
    }

    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const elapsed = Date.now() - touchStart.at;
    touchStart = null;

    if (elapsed > 900) return;
    if (Math.abs(deltaX) < 48) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

    event.preventDefault();
    shiftCalendarMonth(deltaX < 0 ? 1 : -1);
  }, { passive: false });

  target.addEventListener("touchcancel", () => {
    touchStart = null;
  }, { passive: true });
}

function getDayPanelBadges(event, meta) {
  const badges = [...getHolidayBadgeLabels(event)];
  if (meta?.isRecurring) badges.push("Recurring");
  if ((meta?.bucketCount || 1) > 1) badges.push(`Grouped x${meta.bucketCount}`);
  return badges;
}

function buildDayPanelEventCard(event, meta, isExpanded) {
  const card = document.createElement("article");
  card.className = "calendar-day-event-card";
  card.dataset.eventId = String(event.id);
  if (isExpanded) card.classList.add("is-expanded");
  if (event.is_system_holiday) {
    card.classList.add("calendar-day-event-card-holiday");
    applyHolidayPaletteStyles(card, event);
  }

  const summary = document.createElement("button");
  summary.type = "button";
  summary.className = "calendar-day-event-summary";

  const titleText = pickText(event, "title") || "Untitled";
  const eventImageUrl = getEventImages(event)[0] || "";
  const badges = getDayPanelBadges(event, meta);

  summary.innerHTML = `
    ${eventImageUrl ? `<img class="calendar-day-event-thumb" src="${eventImageUrl}" alt="${escapeHtml(titleText)}" loading="lazy" />` : ""}
    <div class="calendar-day-event-copy">
      <h4>${escapeHtml(titleText)}</h4>
      <div class="calendar-day-event-meta">
        <span>${escapeHtml(formatDateRange(event.date_start, event.date_end, event.all_day))}</span>
        <span>${escapeHtml(pickText(event, "location") || formatAreaLabel(event.area) || "")}</span>
      </div>
      ${badges.length ? `<div class="calendar-day-event-badges">${badges.map((badge) => `<span class="calendar-day-event-badge">${escapeHtml(badge)}</span>`).join("")}</div>` : ""}
    </div>
  `;
  summary.addEventListener("click", (eventObject) => {
    eventObject.stopPropagation();
    if (isExpanded) {
      openModal(eventDetailHtml(event), { anchorEl: summary });
      return;
    }
    state.expandedCalendarEventId = String(event.id);
    render();
  });
  card.appendChild(summary);

  if (isExpanded) {
    const detailWrap = document.createElement("div");
    detailWrap.className = "calendar-day-event-detail";
    const detail = createEventDetailContent(event);
    detailWrap.innerHTML = detail.html;
    detail.mount(detailWrap);
    detailWrap.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (eventObject) => eventObject.stopPropagation());
    });
    const detailActions = document.createElement("div");
    detailActions.className = "calendar-day-event-detail-actions";
    const openEventButton = document.createElement("button");
    openEventButton.type = "button";
    openEventButton.className = "secondary calendar-day-event-open-button";
    openEventButton.textContent = "Open full event";
    openEventButton.addEventListener("click", (eventObject) => {
      eventObject.stopPropagation();
      openModal(eventDetailHtml(event), { anchorEl: openEventButton });
    });
    detailActions.appendChild(openEventButton);
    detailWrap.appendChild(detailActions);
    card.appendChild(detailWrap);
  }

  card.addEventListener("click", (eventObject) => {
    eventObject.stopPropagation();
  });

  return card;
}

function buildCalendarDayFocusPanel(selectedDate, events) {
  const panel = document.createElement("section");
  panel.className = "calendar-day-focus";
  panel.dataset.dateKey = toDateKey(selectedDate);
  panel.addEventListener("click", (eventObject) => {
    eventObject.stopPropagation();
  });
  const strings = uiStrings[state.uiLang];
  const dayLabel = selectedDate.toLocaleDateString(state.uiLang, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const header = document.createElement("div");
  header.className = "calendar-day-focus-header";
  const headingWrap = document.createElement("div");
  headingWrap.className = "calendar-day-focus-copy";
  const kicker = document.createElement("span");
  kicker.className = "calendar-day-focus-kicker";
  kicker.textContent = selectedDate.toLocaleDateString(state.uiLang, { day: "numeric", month: "short" });
  const title = document.createElement("h3");
  title.textContent = dayLabel;
  const summary = document.createElement("p");
  summary.className = "calendar-day-focus-summary";
  summary.textContent = getCalendarCountLabel(events.length);
  headingWrap.append(kicker, title, summary);
  header.append(headingWrap);
  panel.appendChild(header);

  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "notice calendar-day-focus-empty";
    empty.textContent = strings.noEventsForDay;
    panel.appendChild(empty);
    return panel;
  }

  const groupMeta = buildDayModalGroupMeta(events);
  const sortedEvents = getSortedDayEvents(events);
  const grid = document.createElement("div");
  grid.className = "calendar-day-focus-grid";
  sortedEvents.forEach((event) => {
    const meta = groupMeta.get(String(event.id)) || { bucketCount: 1, isRecurring: false };
    const isExpanded = state.expandedCalendarEventId === String(event.id);
    grid.appendChild(buildDayPanelEventCard(event, meta, isExpanded));
  });
  panel.appendChild(grid);
  return panel;
}

function getMonthCalendarMetrics(days, grouped) {
  const maxEvents = days.reduce((max, date) => Math.max(max, (grouped[toDateKey(date)] || []).length), 0);
  if (isMobileViewport()) {
    const visibleChipLimit = 1;
    const cellHeight = Math.min(108, 72 + (maxEvents > 1 ? 14 : 0) + (maxEvents > 3 ? 10 : 0));
    return { visibleChipLimit, cellHeight };
  }
  const visibleChipLimit = Math.min(5, Math.max(3, maxEvents || 0));
  const cellHeight = Math.min(184, 96 + (visibleChipLimit - 3) * 26 + (maxEvents > visibleChipLimit ? 18 : 0));
  return {
    visibleChipLimit,
    cellHeight
  };
}

function renderCalendarMonth(events) {
  calendarView.innerHTML = "";
  const grouped = groupEventsByDate(events);
  const monthStart = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), 1);
  const monthEnd = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 0);
  const gridStart = startOfWeek(monthStart);
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(addDays(gridStart, i));
  }
  if (state.selectedCalendarDayKey && !days.some((date) => toDateKey(date) === state.selectedCalendarDayKey)) {
    clearCalendarDayFocus();
  }
  const { visibleChipLimit, cellHeight } = getMonthCalendarMetrics(days, grouped);

  const wrapper = document.createElement("div");
  wrapper.className = "calendar calendar-month-shell";
  wrapper.style.setProperty("--calendar-cell-height", `${cellHeight}px`);
  const header = document.createElement("div");
  header.className = "calendar-header";
  const title = document.createElement("h3");
  title.textContent = monthStart.toLocaleDateString(state.uiLang, { month: "long", year: "numeric" });
  const nav = document.createElement("div");
  nav.className = "admin-bar";
  const prev = document.createElement("button");
  prev.className = "secondary";
  prev.textContent = "←";
  prev.addEventListener("click", () => shiftCalendarMonth(-1));
  const next = document.createElement("button");
  next.className = "secondary";
  next.textContent = "→";
  next.addEventListener("click", () => shiftCalendarMonth(1));
  nav.append(prev, next);
  header.append(title, nav);

  const weekdays = document.createElement("div");
  weekdays.className = "calendar-grid calendar-month-weekdays";
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  dayNames.forEach((day) => {
    const el = document.createElement("div");
    el.className = "calendar-day";
    el.textContent = day;
    weekdays.appendChild(el);
  });

  const rowsWrap = document.createElement("div");
  rowsWrap.className = "calendar-month-rows";

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const row = document.createElement("div");
    row.className = "calendar-month-row";
    const weekDates = days.slice(weekIndex * 7, weekIndex * 7 + 7);
    let hasExpandedDay = false;

    weekDates.forEach((date) => {
      const key = toDateKey(date);
      const cell = document.createElement("div");
      cell.className = "calendar-cell";
      cell.dataset.dateKey = key;
      const isSelectedDay = state.selectedCalendarDayKey === key;
      if (isSelectedDay) {
        cell.classList.add("is-active", "is-expanded");
        hasExpandedDay = true;
      }
      const isOutsideCurrentMonth = date < monthStart || date > monthEnd;
      if (isOutsideCurrentMonth) cell.classList.add("inactive");
      const cellShell = document.createElement("div");
      cellShell.className = "calendar-cell-shell";
      const dateLabel = document.createElement("div");
      dateLabel.className = "calendar-date";
      dateLabel.textContent = date.getDate();
      const eventsWrap = document.createElement("div");
      eventsWrap.className = "calendar-events";
      const items = grouped[key] || [];
      const sortedItems = getSortedDayEvents(items);
      const bankHoliday = items.find((event) => event.is_bank_holiday);
      if (bankHoliday) {
        cell.classList.add("calendar-cell-bank-holiday");
        cell.style.setProperty("--calendar-bank-holiday-bg", bankHoliday.holiday_cell_bg || HOLIDAY_PALETTES.civic.cellBg);
        cell.style.setProperty("--calendar-bank-holiday-border", bankHoliday.holiday_cell_border || HOLIDAY_PALETTES.civic.cellBorder);
      }
      if (!isSelectedDay) {
        sortedItems.slice(0, visibleChipLimit).forEach((event) => {
          const chip = document.createElement("div");
          chip.className = "calendar-chip";
          if (event.is_bank_holiday) {
            chip.classList.add("calendar-chip-bank-holiday");
            chip.style.setProperty("--holiday-chip-bg", event.holiday_chip_bg || HOLIDAY_PALETTES.civic.chipBg);
            chip.style.setProperty("--holiday-chip-ink", event.holiday_chip_ink || HOLIDAY_PALETTES.civic.chipInk);
          } else if (event.is_system_holiday) {
            chip.classList.add("calendar-chip-holiday");
          }
          chip.title = pickText(event, "title");
          chip.textContent = pickText(event, "title");
          eventsWrap.appendChild(chip);
        });
        if (items.length > visibleChipLimit) {
          const more = document.createElement("div");
          more.className = "calendar-chip";
          more.textContent = `+${items.length - visibleChipLimit} more`;
          eventsWrap.appendChild(more);
        }
      } else {
        const summaryChip = document.createElement("div");
        summaryChip.className = "calendar-chip calendar-chip-active-summary";
        summaryChip.textContent = getCalendarCountLabel(items.length);
        eventsWrap.appendChild(summaryChip);
        cell.style.setProperty("--calendar-expanded-min-height", `${Math.max(cellHeight * (isMobileViewport() ? 2.85 : 3.1), 280)}px`);
        cell.style.setProperty("--calendar-expanded-flex", isMobileViewport() ? "7.5" : "14");
      }
      cell.addEventListener("click", () => {
        if (isOutsideCurrentMonth) {
          state.calendarDate = new Date(date.getFullYear(), date.getMonth(), 1);
          openCalendarDayAfterRender(date);
          return;
        }
        if (state.selectedCalendarDayKey === key) {
          clearCalendarDayFocus();
          render();
          return;
        }
        state.selectedCalendarDayKey = key;
        state.expandedCalendarEventId = "";
        render();
      });
      cellShell.append(dateLabel, eventsWrap);
      cell.appendChild(cellShell);
      if (isSelectedDay) {
        cell.appendChild(buildCalendarDayFocusPanel(date, sortedItems));
      }
      row.appendChild(cell);
    });

    if (hasExpandedDay) row.classList.add("has-expanded-day");
    rowsWrap.appendChild(row);
  }

  attachMonthSwipeNavigation(rowsWrap);
  wrapper.append(header, weekdays, rowsWrap);
  calendarView.appendChild(wrapper);
}

function renderCalendarWeek(events) {
  calendarView.innerHTML = "";
  const grouped = groupEventsByDate(events);
  const wrapper = document.createElement("div");
  wrapper.className = "calendar";
  const header = document.createElement("div");
  header.className = "calendar-header";
  const title = document.createElement("h3");
  const weekEnd = addDays(state.weekStart, 6);
  title.textContent = `${state.weekStart.toLocaleDateString(state.uiLang, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(state.uiLang, { month: "short", day: "numeric" })}`;
  const nav = document.createElement("div");
  nav.className = "admin-bar";
  const prev = document.createElement("button");
  prev.className = "secondary";
  prev.textContent = "←";
  prev.addEventListener("click", () => {
    state.weekStart = addDays(state.weekStart, -7);
    render();
  });
  const next = document.createElement("button");
  next.className = "secondary";
  next.textContent = "→";
  next.addEventListener("click", () => {
    state.weekStart = addDays(state.weekStart, 7);
    render();
  });
  nav.append(prev, next);
  header.append(title, nav);

  const scroll = document.createElement("div");
  scroll.className = "calendar-week-scroll";
  const grid = document.createElement("div");
  grid.className = "calendar-week";
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(state.weekStart, i);
    const key = toDateKey(date);
    const day = document.createElement("div");
    day.className = "calendar-week-day";
    const label = document.createElement("div");
    label.className = "calendar-date";
    label.textContent = date.toLocaleDateString(state.uiLang, { weekday: "short", day: "numeric" });
    const eventsWrap = document.createElement("div");
    eventsWrap.className = "calendar-events";
    const items = grouped[key] || [];
    const bankHoliday = items.find((event) => event.is_bank_holiday);
    if (bankHoliday) {
      day.classList.add("calendar-week-day-bank-holiday");
      day.style.setProperty("--calendar-bank-holiday-bg", bankHoliday.holiday_cell_bg || HOLIDAY_PALETTES.civic.cellBg);
      day.style.setProperty("--calendar-bank-holiday-border", bankHoliday.holiday_cell_border || HOLIDAY_PALETTES.civic.cellBorder);
    }
    items.forEach((event) => {
      const chip = document.createElement("div");
      chip.className = "calendar-chip";
      if (event.is_bank_holiday) {
        chip.classList.add("calendar-chip-bank-holiday");
        chip.style.setProperty("--holiday-chip-bg", event.holiday_chip_bg || HOLIDAY_PALETTES.civic.chipBg);
        chip.style.setProperty("--holiday-chip-ink", event.holiday_chip_ink || HOLIDAY_PALETTES.civic.chipInk);
      } else if (event.is_system_holiday) {
        chip.classList.add("calendar-chip-holiday");
      }
      chip.title = pickText(event, "title");
      chip.textContent = pickText(event, "title");
      eventsWrap.appendChild(chip);
    });
    day.addEventListener("click", () => openDayModal(date, items, day));
    day.append(label, eventsWrap);
    grid.appendChild(day);
  }

  scroll.appendChild(grid);
  wrapper.append(header, scroll);
  calendarView.appendChild(wrapper);
}

function render() {
  const events = filterEvents();
  renderEvents();
  renderFeatured();
  [...viewControls.querySelectorAll("button[data-view]")].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.viewMode);
  });
  const showCalendar = state.viewMode !== "list";
  calendarView.classList.toggle("hidden", !showCalendar);
  eventList.classList.toggle("hidden", showCalendar);
  if (state.viewMode === "month") {
    renderCalendarMonth(events);
  } else if (state.viewMode === "week") {
    renderCalendarWeek(events);
  }
}

function syncUiCopy() {
  const strings = uiStrings[state.uiLang];
  document.getElementById("hero-title").textContent = pickSetting("hero_title", strings.title);
  document.getElementById("hero-subtitle").textContent = pickSetting("hero_subtitle", strings.subtitle);
  featuredTitle.textContent = pickSetting("featured_title", "Highlighted Events");
  resetFilters.textContent = strings.reset;
  const currentLang = UI_LANGS.find((lang) => lang.code === state.uiLang);
  languageButton.textContent = `Language: ${currentLang ? currentLang.label : "English"}`;
}

async function loadEvents() {
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("status", "approved")
    .order("date_start", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }
  const now = new Date();
  state.events = dedupeEvents((data || [])
    .map((event) => ({ ...event, area: normalizeAreaValue(event.area) }))
    .filter((event) => isPublicEventActive(event, now)));
  render();
}

async function loadSettings() {
  const { data } = await client.from("site_settings").select("*").eq("id", 1).maybeSingle();
  state.settings = data || null;
  applyTheme();
  syncUiCopy();
  render();
}

resetFilters.addEventListener("click", () => {
  state.filters = {
    search: "",
    eventType: [],
    area: [],
    eventLanguage: [],
    dateFrom: "",
    dateTo: "",
    sort: "date_asc"
  };
  renderFilters();
  render();
});

mobileFiltersButton?.addEventListener("click", () => {
  toggleMobileFilterPanel();
});

viewControls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (!button) return;
  state.viewMode = button.dataset.view;
  if (state.viewMode !== "month") {
    clearCalendarDayFocus();
  }
  [...viewControls.querySelectorAll("button[data-view]")].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.viewMode);
  });
  render();
});

languageButton.addEventListener("click", () => {
  languageMenu.classList.toggle("hidden");
});
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target && !target.closest(".filter-picker-control")) {
    closeAllFilterPickers();
  }
  if (!languageButton.contains(event.target) && !languageMenu.contains(event.target)) {
    languageMenu.classList.add("hidden");
  }
  if (state.viewMode !== "month" || !state.selectedCalendarDayKey) return;
  const expandedCell = calendarView.querySelector(".calendar-cell.is-expanded");
  if (!expandedCell) return;
  if (!target) return;
  if (expandedCell.contains(target)) return;
  if (target.closest(".calendar-cell")) return;
  clearCalendarDayFocus();
  render();
});
UI_LANGS.forEach((lang) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = lang.label;
  button.addEventListener("click", () => {
    state.uiLang = lang.code;
    languageMenu.classList.add("hidden");
    syncUiCopy();
    renderFilters();
    render();
  });
  languageMenu.appendChild(button);
});

async function loadLanguageOptions() {
  try {
    const response = await fetch("/v1/language-options");
    if (!response.ok) return;
    const result = await response.json().catch(() => ({}));
    const custom = Array.isArray(result?.languages) ? result.languages : [];
    state.eventLanguageOptions = sortEventLanguageOptions([...DEFAULT_EVENT_LANGUAGE_OPTIONS, ...custom]);
    renderFilters();
    render();
  } catch (error) {
    console.warn("Language options load failed", error);
  }
}
modalClose.addEventListener("click", closeModal);
eventModal.addEventListener("click", (event) => {
  if (!modalContent) return;
  const clickedInsideContent = modalContent.contains(event.target);
  if (!clickedInsideContent || event.target.dataset.closeModal === "true") {
    closeModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !eventModal.classList.contains("hidden")) {
    closeModal();
  }
  if (event.key === "Escape") {
    closeAllFilterPickers();
  }
  if (event.key === "Escape" && mobileFilterPanel && !mobileFilterPanel.classList.contains("hidden")) {
    closeMobileFilterPanel();
  }
});
let resizeRaf = null;
window.addEventListener("resize", () => {
  syncModalPlacement();
  closeAllFilterPickers();
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    if (!isMobileViewport()) {
      closeMobileFilterPanel();
    }
    renderFilters();
    render();
  });
});
window.addEventListener("scroll", syncModalPlacement, { passive: true });

syncUiCopy();
renderFilters();
render();
loadEvents();
loadSettings();
loadLanguageOptions();

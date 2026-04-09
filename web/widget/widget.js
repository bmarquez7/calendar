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

const state = {
  events: [],
  settings: null,
  eventLanguageOptions: [...DEFAULT_EVENT_LANGUAGE_OPTIONS],
  uiLang: DEFAULT_UI_LANG,
  viewMode: "month",
  calendarDate: new Date(),
  weekStart: null,
  filters: {
    search: "",
    eventType: "",
    area: "",
    eventLanguage: "",
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
    reset: "Pastro filtrat",
    results: "evente"
  }
};

const filterControls = document.getElementById("filter-controls");
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
const featuredColorCache = new Map();

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
  if (theme.featuredPosition === "below_filters") {
    heroSection.appendChild(featuredBox);
  } else {
    const controls = document.getElementById("filter-controls");
    controls.insertAdjacentElement("afterend", featuredBox);
  }
}

function formatDateRange(start, end) {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (!startDate) return "";
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

function openModal(content) {
  const html = typeof content === "string" ? content : content?.html || "";
  modalBody.innerHTML = html;
  eventModal.classList.remove("hidden");
  if (content && typeof content.onOpen === "function") {
    content.onOpen();
  }
}

function closeModal() {
  eventModal.classList.add("hidden");
  modalBody.innerHTML = "";
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

function mountModalGallery(images, titleText) {
  if (images.length <= 1) return;
  const image = modalBody.querySelector("[data-gallery-image]");
  const counter = modalBody.querySelector("[data-gallery-counter]");
  const prev = modalBody.querySelector("[data-gallery-prev]");
  const next = modalBody.querySelector("[data-gallery-next]");
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

function eventDetailHtml(event) {
  const titleText = pickText(event, "title") || "Untitled";
  const title = escapeHtml(titleText);
  const rawLocation = pickText(event, "location") || formatAreaLabel(event.area) || "";
  const description = linkifyText(pickText(event, "description") || "");
  const location = escapeHtml(rawLocation);
  const date = formatDateRange(event.date_start, event.date_end);
  const languages = escapeHtml((event.event_language || []).map((value) => formatEventLanguageValue(value, state.eventLanguageOptions)).join(", "));
  const price = escapeHtml(formatPrice(event));
  const ticketUrl = safeUrl(event.ticket_url);
  const sourceUrl = safeUrl(event.source_url);
  const mapsUrl = safeUrl(googleMapsUrl(rawLocation, event.area));
  const links = [
    ticketUrl ? `<a href="${ticketUrl}" target="_blank" rel="noreferrer">Tickets / RSVP</a>` : "",
    sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noreferrer">Website</a>` : "",
    mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noreferrer">Google Maps</a>` : ""
  ].filter(Boolean).join(" · ");
  const images = getEventImages(event);
  return {
    html: `
      <h3 id="modal-title">${title}</h3>
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
    `,
    onOpen() {
      mountModalGallery(images, titleText);
    }
  };
}

function openDayModal(date, events) {
  const dayLabel = date.toLocaleDateString(state.uiLang, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (!events.length) {
    openModal(`<h3 id="modal-title">${escapeHtml(dayLabel)}</h3><p>No events for this day.</p>`);
    return;
  }

  const items = events
    .map(
      (event) => `
      <div class="modal-event" data-event-id="${event.id}">
        <h4>${escapeHtml(pickText(event, "title") || "Untitled")}</h4>
        ${getEventImages(event)[0] ? `<img class="modal-poster" src="${getEventImages(event)[0]}" alt="${escapeHtml(pickText(event, "title") || "Event")}" loading="lazy" />` : ""}
        <p>${escapeHtml(formatDateRange(event.date_start, event.date_end))}</p>
        <p>${escapeHtml(pickText(event, "location") || formatAreaLabel(event.area) || "")}</p>
      </div>
    `
    )
    .join("");

  openModal(`<h3 id="modal-title">${escapeHtml(dayLabel)}</h3>${items}`);
  modalBody.querySelectorAll(".modal-event").forEach((el) => {
    el.addEventListener("click", () => {
      const target = events.find((evt) => String(evt.id) === el.dataset.eventId);
      if (target) openModal(eventDetailHtml(target));
    });
  });
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function createSelect(name, labelText, options, includeAny = true) {
  const wrap = document.createElement("div");
  wrap.className = "control";
  const label = document.createElement("label");
  label.textContent = labelText;
  const select = document.createElement("select");
  select.name = name;
  if (includeAny) {
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
    state.filters[name] = event.target.value;
    render();
  });
  wrap.append(label, select);
  return wrap;
}

function createInput(name, labelText, type = "text", placeholder = "") {
  const wrap = document.createElement("div");
  wrap.className = "control";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  input.placeholder = placeholder;
  input.addEventListener("input", (event) => {
    state.filters[name] = event.target.value;
    render();
  });
  wrap.append(label, input);
  return wrap;
}

function renderFilters() {
  filterControls.innerHTML = "";
  const strings = uiStrings[state.uiLang];
  filterControls.append(
    createInput("search", strings.filters.search, "text", "Search titles and descriptions"),
    createSelect("eventType", strings.filters.eventType, EVENT_TYPES.map((t) => ({ value: t, label: t }))),
    createSelect("area", strings.filters.area, AREA_GROUPS),
    createSelect("eventLanguage", strings.filters.eventLanguage, state.eventLanguageOptions.map((l) => ({ value: l.code, label: l.label }))),
    createInput("dateFrom", strings.filters.dateFrom, "date"),
    createInput("dateTo", strings.filters.dateTo, "date"),
    createSelect("sort", strings.filters.sort, Object.entries(strings.sortOptions).map(([value, label]) => ({ value, label })), false)
  );
}

function filterEvents() {
  const { search, eventType, area, eventLanguage, dateFrom, dateTo } = state.filters;
  return state.events
    .filter((event) => {
      const searchText = `${pickText(event, "title")} ${pickText(event, "description")}`.toLowerCase();
      const matchesSearch = !search || searchText.includes(search.toLowerCase());
      const matchesType = !eventType || event.event_type === eventType;
      const matchesArea = !area || normalizeAreaValue(event.area) === area;
      const matchesLanguage = !eventLanguage || (event.event_language || []).includes(eventLanguage);
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

function getHighlightedEvents() {
  const selected = state.events
    .filter((event) => event.is_highlighted && !event.feature_blocked && isFeaturedEligibleArea(event.area) && !event.recurrence_group_id)
    .sort((a, b) => new Date(a.date_start || 0) - new Date(b.date_start || 0));
  const fallback = state.events
    .filter((event) => !event.is_highlighted && !event.feature_blocked && isFeaturedEligibleArea(event.area) && !event.recurrence_group_id)
    .sort(featuredFallbackSort);
  return [...selected, ...fallback].slice(0, 10);
}

function renderEvents() {
  const events = filterEvents();
  eventList.innerHTML = "";
  resultsCount.textContent = `${events.length} ${uiStrings[state.uiLang].results}`;
  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "notice";
    empty.textContent = "No events match these filters yet.";
    eventList.appendChild(empty);
    return;
  }

  events.forEach((event) => {
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("h3");
    title.textContent = pickText(event, "title");
    const desc = document.createElement("p");
    desc.innerHTML = linkifyText(pickText(event, "description"));
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
    meta.innerHTML = `
      <span>📍 ${escapeHtml(pickText(event, "location") || formatAreaLabel(event.area))}</span>
      <span>🗓️ ${escapeHtml(formatDateRange(event.date_start, event.date_end))}</span>
      <span>🏷️ ${escapeHtml(event.event_type || "")}</span>
      <span>💬 ${escapeHtml((event.event_language || []).map((value) => formatEventLanguageValue(value, state.eventLanguageOptions)).join(", "))}</span>
      <span>💰 ${escapeHtml(formatPrice(event))}</span>
    `;

    const actions = document.createElement("div");
    const ticketUrl = safeUrl(event.ticket_url);
    const sourceUrl = safeUrl(event.source_url);
    const mapsUrl = safeUrl(googleMapsUrl(pickText(event, "location") || formatAreaLabel(event.area), event.area));
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

    if (eventImageUrl) {
      card.append(title, image, desc, meta, actions);
    } else {
      card.append(title, desc, meta, actions);
    }
    card.addEventListener("click", () => openModal(eventDetailHtml(event)));
    eventList.appendChild(card);
  });
}

function renderFeatured() {
  const items = getHighlightedEvents();
  const placeholderImage = state.settings?.featured_placeholder_image_url || "";

  featuredGrid.innerHTML = "";
  const list = [...items];
  while (list.length < 10) {
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
      applyFeaturedPosterColor(box, eventImageUrl, image);
    } else {
      box.classList.add("featured-item-no-image");
      box.innerHTML = `<div class="featured-fallback"><span class="featured-fallback-title">${escapeHtml(eventTitle)}</span></div>`;
    }
    box.addEventListener("click", () => openModal(eventDetailHtml(event)));
    featuredGrid.appendChild(box);
  });
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

  const wrapper = document.createElement("div");
  wrapper.className = "calendar";
  const header = document.createElement("div");
  header.className = "calendar-header";
  const title = document.createElement("h3");
  title.textContent = monthStart.toLocaleDateString(state.uiLang, { month: "long", year: "numeric" });
  const nav = document.createElement("div");
  nav.className = "admin-bar";
  const prev = document.createElement("button");
  prev.className = "secondary";
  prev.textContent = "←";
  prev.addEventListener("click", () => {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1);
    render();
  });
  const next = document.createElement("button");
  next.className = "secondary";
  next.textContent = "→";
  next.addEventListener("click", () => {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1);
    render();
  });
  nav.append(prev, next);
  header.append(title, nav);

  const grid = document.createElement("div");
  grid.className = "calendar-grid";
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  dayNames.forEach((day) => {
    const el = document.createElement("div");
    el.className = "calendar-day";
    el.textContent = day;
    grid.appendChild(el);
  });

  days.forEach((date) => {
    const key = toDateKey(date);
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    if (date < monthStart || date > monthEnd) cell.classList.add("inactive");
    const dateLabel = document.createElement("div");
    dateLabel.className = "calendar-date";
    dateLabel.textContent = date.getDate();
    const eventsWrap = document.createElement("div");
    eventsWrap.className = "calendar-events";
    const items = grouped[key] || [];
    items.slice(0, 3).forEach((event) => {
      const chip = document.createElement("div");
      chip.className = "calendar-chip";
      chip.title = pickText(event, "title");
      chip.textContent = pickText(event, "title");
      eventsWrap.appendChild(chip);
    });
    if (items.length > 3) {
      const more = document.createElement("div");
      more.className = "calendar-chip";
      more.textContent = `+${items.length - 3} more`;
      eventsWrap.appendChild(more);
    }
    cell.addEventListener("click", () => openDayModal(date, items));
    cell.append(dateLabel, eventsWrap);
    grid.appendChild(cell);
  });

  wrapper.append(header, grid);
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
    (grouped[key] || []).forEach((event) => {
      const chip = document.createElement("div");
      chip.className = "calendar-chip";
      chip.title = pickText(event, "title");
      chip.textContent = pickText(event, "title");
      eventsWrap.appendChild(chip);
    });
    day.addEventListener("click", () => openDayModal(date, grouped[key] || []));
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
  state.events = (data || [])
    .map((event) => ({ ...event, area: normalizeAreaValue(event.area) }))
    .filter((event) => isPublicEventActive(event, now));
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
    eventType: "",
    area: "",
    eventLanguage: "",
    dateFrom: "",
    dateTo: "",
    sort: "date_asc"
  };
  renderFilters();
  render();
});

viewControls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (!button) return;
  state.viewMode = button.dataset.view;
  [...viewControls.querySelectorAll("button[data-view]")].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.viewMode);
  });
  render();
});

languageButton.addEventListener("click", () => {
  languageMenu.classList.toggle("hidden");
});
document.addEventListener("click", (event) => {
  if (!languageButton.contains(event.target) && !languageMenu.contains(event.target)) {
    languageMenu.classList.add("hidden");
  }
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
  if (event.target.dataset.closeModal === "true") {
    closeModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !eventModal.classList.contains("hidden")) {
    closeModal();
  }
});

syncUiCopy();
renderFilters();
render();
loadEvents();
loadSettings();
loadLanguageOptions();

import { createClient } from "../../shared/vendor.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, EVENT_IMAGE_BUCKET, ADMIN_API_URL } from "../../shared/config.js";
import { EVENT_TYPES, AREA_GROUPS, LANGS } from "../../shared/constants.js";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_ROWS = 10;
const CURRENCY_OPTIONS = [
  { value: "ALL", label: "ALL / LEK" },
  { value: "EUR", label: "EURO" },
  { value: "USD", label: "USD" }
];
const PRICE_TYPE_OPTIONS = ["Free", "Paid"];
const MAX_GENERATED_EVENTS = 250;
const MAX_SPECIFIC_REPEAT_DATES = 10;
const WEEKDAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" }
];

const rowsBody = document.getElementById("public-batch-rows");
const rowCount = document.getElementById("public-batch-count");
const addRowButton = document.getElementById("public-batch-add");
const fillRowsButton = document.getElementById("public-batch-fill");
const submitButton = document.getElementById("public-batch-submit");
const statusBox = document.getElementById("public-batch-status");
const descriptionModal = document.getElementById("description-modal");
const descriptionEditor = document.getElementById("description-editor");
const descriptionCounter = document.getElementById("description-counter");
const descriptionDoneButton = document.getElementById("description-done");

const submitterName = document.getElementById("submitter-name");
const submitterEmail = document.getElementById("submitter-email");
const organizerName = document.getElementById("organizer-name");
const organizerEmail = document.getElementById("organizer-email");
const submitterNote = document.getElementById("submitter-note");

let activeDescriptionInput = null;

function setStatus(message, kind = "info") {
  statusBox.style.display = "block";
  statusBox.textContent = message;
  statusBox.classList.remove("success", "error");
  if (kind === "success") statusBox.classList.add("success");
  if (kind === "error") statusBox.classList.add("error");
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function toIsoOrNull(value) {
  const input = String(value || "").trim();
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateOnlyValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addYears(date, years) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function combineDateWithTime(dateString, timeSource) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(
    year,
    month - 1,
    day,
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds()
  );
}

async function uploadImage(file) {
  const safeName = sanitizeFilename(file.name || "poster.jpg");
  const path = `public-batch/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await client.storage.from(EVENT_IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  const { data } = client.storage.from(EVENT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function createOptionElements(select, options) {
  options.forEach((option) => {
    if (option?.options) {
      const group = document.createElement("optgroup");
      group.label = option.label;
      createOptionElements(group, option.options);
      select.appendChild(group);
      return;
    }
    const el = document.createElement("option");
    if (typeof option === "string") {
      el.value = option;
      el.textContent = option;
    } else {
      el.value = option.value;
      el.textContent = option.label;
    }
    select.appendChild(el);
  });
}

function createField(labelText, input) {
  const wrap = document.createElement("label");
  wrap.className = "public-submit-field";
  const label = document.createElement("span");
  label.className = "public-submit-label";
  label.textContent = labelText;
  wrap.append(label, input);
  return wrap;
}

function createInput(type, className, placeholder = "", required = false) {
  const input = document.createElement("input");
  input.type = type;
  input.className = className;
  if (placeholder) input.placeholder = placeholder;
  if (required) input.required = true;
  return input;
}

function createTextarea(className, placeholder = "", required = false) {
  const textarea = document.createElement("textarea");
  textarea.className = className;
  textarea.placeholder = placeholder;
  if (required) textarea.required = true;
  return textarea;
}

function descriptionSummary(value) {
  const text = String(value || "").trim();
  if (!text) return "Open description";
  if (text.length <= 72) return text;
  return `${text.slice(0, 69)}...`;
}

function setDescriptionCounter(value) {
  const remaining = Math.max(0, 2000 - String(value || "").length);
  descriptionCounter.textContent = `${remaining} / 2000 left`;
}

function syncDescriptionButton(input) {
  const button = input.closest(".public-submit-field")?.querySelector(".description-launch");
  if (!button) return;
  const hasValue = Boolean(String(input.value || "").trim());
  button.textContent = descriptionSummary(input.value);
  button.classList.toggle("is-filled", hasValue);
}

function openDescriptionModal(input) {
  activeDescriptionInput = input;
  descriptionEditor.value = input.value || "";
  setDescriptionCounter(descriptionEditor.value);
  descriptionModal.hidden = false;
  descriptionEditor.focus();
  descriptionEditor.setSelectionRange(descriptionEditor.value.length, descriptionEditor.value.length);
}

function closeDescriptionModal(save) {
  if (save && activeDescriptionInput) {
    activeDescriptionInput.value = descriptionEditor.value;
    syncDescriptionButton(activeDescriptionInput);
  }
  activeDescriptionInput = null;
  descriptionModal.hidden = true;
}

function createDescriptionField() {
  const hiddenInput = createTextarea("description", "", true);
  hiddenInput.hidden = true;
  hiddenInput.maxLength = 2000;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "public-submit-launch description-launch";
  button.textContent = "Open description";
  button.addEventListener("click", () => openDescriptionModal(hiddenInput));

  const wrap = document.createElement("label");
  wrap.className = "public-submit-field";
  const label = document.createElement("span");
  label.className = "public-submit-label";
  label.textContent = "Description *";
  wrap.append(label, button, hiddenInput);
  return wrap;
}

function createLanguageField() {
  const wrap = document.createElement("div");
  wrap.className = "public-submit-field public-submit-language-field";

  const label = document.createElement("span");
  label.className = "public-submit-label";
  label.textContent = "Languages *";

  const options = document.createElement("div");
  options.className = "public-submit-language-options";

  LANGS.forEach((lang) => {
    const chip = document.createElement("label");
    chip.className = "public-submit-language-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "language-option";
    input.value = lang.code;
    const text = document.createElement("span");
    text.textContent = lang.label;
    chip.append(input, text);
    options.appendChild(chip);
  });

  const otherRow = document.createElement("div");
  otherRow.className = "public-submit-language-other";

  const otherChip = document.createElement("label");
  otherChip.className = "public-submit-language-chip";
  const otherToggle = document.createElement("input");
  otherToggle.type = "checkbox";
  otherToggle.className = "language-other-toggle";
  const otherText = document.createElement("span");
  otherText.textContent = "Other:";
  otherChip.append(otherToggle, otherText);

  const otherInput = createInput("text", "language-other-input", "Add language");
  otherInput.disabled = true;

  otherRow.append(otherChip, otherInput);
  wrap.append(label, options, otherRow);
  return wrap;
}

function addSpecificDateRow(list, initialValue = "") {
  if (!list || list.querySelectorAll(".repeat-specific-date-row").length >= MAX_SPECIFIC_REPEAT_DATES) return;
  const row = document.createElement("div");
  row.className = "repeat-specific-date-row";

  const input = createInput("date", "repeat-specific-date");
  input.value = initialValue;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    const addButton = list.closest(".public-submit-repeat-config")?.querySelector(".repeat-add-date");
    if (addButton) {
      addButton.disabled = list.querySelectorAll(".repeat-specific-date-row").length >= MAX_SPECIFIC_REPEAT_DATES;
    }
  });

  row.append(input, removeButton);
  list.appendChild(row);
}

function createRecurringField() {
  const wrap = document.createElement("div");
  wrap.className = "public-submit-field public-submit-repeat-field";

  const label = document.createElement("span");
  label.className = "public-submit-label";
  label.textContent = "Repeating event";

  const toggleChip = document.createElement("label");
  toggleChip.className = "public-submit-language-chip";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.className = "repeat-enabled";
  const toggleText = document.createElement("span");
  toggleText.textContent = "Repeat this event";
  toggleChip.append(toggle, toggleText);

  const config = document.createElement("div");
  config.className = "public-submit-repeat-config";
  config.hidden = true;

  const frequencySelect = createSelect("repeat-frequency", [
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "annually", label: "Annually (same date)" },
    { value: "specific_dates", label: "Specific dates" }
  ]);

  const weeklyPanel = document.createElement("div");
  weeklyPanel.className = "repeat-panel repeat-panel-weekly";
  const weeklyLabel = document.createElement("span");
  weeklyLabel.className = "public-submit-label";
  weeklyLabel.textContent = "Repeat on";
  const weeklyOptions = document.createElement("div");
  weeklyOptions.className = "public-submit-language-options";
  WEEKDAY_OPTIONS.forEach((day) => {
    const chip = document.createElement("label");
    chip.className = "public-submit-language-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "repeat-weekday";
    input.value = String(day.value);
    const text = document.createElement("span");
    text.textContent = day.label;
    chip.append(input, text);
    weeklyOptions.appendChild(chip);
  });
  weeklyPanel.append(weeklyLabel, weeklyOptions);

  const monthlyPanel = document.createElement("div");
  monthlyPanel.className = "repeat-panel repeat-panel-monthly";
  const monthlyLabel = document.createElement("span");
  monthlyLabel.className = "public-submit-label";
  monthlyLabel.textContent = "Day of month";
  const monthlyInput = createInput("number", "repeat-month-day", "1");
  monthlyInput.min = "1";
  monthlyInput.max = "31";
  monthlyPanel.append(monthlyLabel, monthlyInput);

  const annualPanel = document.createElement("div");
  annualPanel.className = "repeat-panel repeat-panel-annual";
  annualPanel.innerHTML = '<span class="public-submit-label">Annual repeat uses the same month and day as the start date.</span>';

  const specificPanel = document.createElement("div");
  specificPanel.className = "repeat-panel repeat-panel-specific";
  const specificLabel = document.createElement("span");
  specificLabel.className = "public-submit-label";
  specificLabel.textContent = "Specific dates (up to 10)";
  const specificList = document.createElement("div");
  specificList.className = "repeat-specific-dates";
  const addDateButton = document.createElement("button");
  addDateButton.type = "button";
  addDateButton.className = "secondary repeat-add-date";
  addDateButton.textContent = "Add date";
  addDateButton.addEventListener("click", () => {
    addSpecificDateRow(specificList);
    addDateButton.disabled = specificList.querySelectorAll(".repeat-specific-date-row").length >= MAX_SPECIFIC_REPEAT_DATES;
  });
  specificPanel.append(specificLabel, specificList, addDateButton);

  const untilWrap = document.createElement("div");
  untilWrap.className = "repeat-until-wrap";
  const untilLabel = document.createElement("span");
  untilLabel.className = "public-submit-label";
  untilLabel.textContent = "Repeat until (optional)";
  const untilInput = createInput("date", "repeat-until");
  const helper = document.createElement("p");
  helper.className = "small repeat-helper";
  untilWrap.append(untilLabel, untilInput, helper);

  config.append(
    createField("Frequency", frequencySelect),
    weeklyPanel,
    monthlyPanel,
    annualPanel,
    specificPanel,
    untilWrap
  );

  wrap.append(label, toggleChip, config);
  return wrap;
}

function createSelect(className, options, required = false) {
  const select = document.createElement("select");
  select.className = className;
  if (required) select.required = true;
  createOptionElements(select, options);
  return select;
}

function updateCount() {
  rowCount.textContent = `${rowsBody.querySelectorAll(".public-submit-card").length} / ${MAX_ROWS} rows`;
}

function reindex() {
  Array.from(rowsBody.querySelectorAll(".public-submit-card")).forEach((row, idx) => {
    row.querySelector(".public-submit-row-number").textContent = `Event ${idx + 1}`;
  });
  updateCount();
}

function syncPriceState(card) {
  const priceType = card.querySelector(".price-type").value;
  const minInput = card.querySelector(".price-min");
  const maxInput = card.querySelector(".price-max");
  const isFree = priceType === "Free";
  minInput.disabled = isFree;
  maxInput.disabled = isFree;
  minInput.required = !isFree;
  maxInput.required = !isFree;
  if (isFree) {
    minInput.value = "";
    maxInput.value = "";
  }
}

function syncImageState(card) {
  const imageUrlInput = card.querySelector(".image-url");
  const imageFileInput = card.querySelector(".image-file");
  const hasFile = Boolean(imageFileInput?.files?.length);
  if (!imageUrlInput) return;
  imageUrlInput.disabled = hasFile;
}

function syncLanguageState(card) {
  const otherToggle = card.querySelector(".language-other-toggle");
  const otherInput = card.querySelector(".language-other-input");
  if (!otherToggle || !otherInput) return;
  otherInput.disabled = !otherToggle.checked;
  if (!otherToggle.checked) otherInput.value = "";
}

function collectLanguages(card) {
  const selected = Array.from(card.querySelectorAll(".language-option:checked")).map((input) => input.value.trim()).filter(Boolean);
  const otherToggle = card.querySelector(".language-other-toggle");
  const otherInput = card.querySelector(".language-other-input");
  if (otherToggle?.checked) {
    const otherValue = String(otherInput?.value || "").trim();
    if (otherValue) selected.push(otherValue);
  }
  return selected;
}

function defaultRepeatUntil(startDate, frequency) {
  const until = frequency === "annually" ? addYears(startDate, 3) : addYears(startDate, 1);
  until.setHours(23, 59, 59, 999);
  return until;
}

function syncRecurringState(card) {
  const enabled = card.querySelector(".repeat-enabled")?.checked;
  const config = card.querySelector(".public-submit-repeat-config");
  if (!config) return;
  config.hidden = !enabled;
  if (!enabled) return;

  const frequency = card.querySelector(".repeat-frequency")?.value || "weekly";
  card.querySelector(".repeat-panel-weekly")?.toggleAttribute("hidden", frequency !== "weekly");
  card.querySelector(".repeat-panel-monthly")?.toggleAttribute("hidden", frequency !== "monthly");
  card.querySelector(".repeat-panel-annual")?.toggleAttribute("hidden", frequency !== "annually");
  card.querySelector(".repeat-panel-specific")?.toggleAttribute("hidden", frequency !== "specific_dates");

  const untilWrap = card.querySelector(".repeat-until-wrap");
  if (untilWrap) untilWrap.hidden = frequency === "specific_dates";

  const startValue = card.querySelector(".date-start")?.value || "";
  const startDate = startValue ? new Date(startValue) : null;
  if (startDate && !Number.isNaN(startDate.getTime())) {
    const monthlyInput = card.querySelector(".repeat-month-day");
    if (monthlyInput && !monthlyInput.value) {
      monthlyInput.value = String(startDate.getDate());
    }

    const weekdayInputs = Array.from(card.querySelectorAll(".repeat-weekday"));
    if (frequency === "weekly" && weekdayInputs.length && !weekdayInputs.some((input) => input.checked)) {
      const matching = weekdayInputs.find((input) => Number(input.value) === startDate.getDay());
      if (matching) matching.checked = true;
    }

    if (frequency === "specific_dates") {
      const list = card.querySelector(".repeat-specific-dates");
      if (list && list.querySelectorAll(".repeat-specific-date-row").length === 0) {
        addSpecificDateRow(list, toDateOnlyValue(startDate));
      }
    }
  }

  const addDateButton = card.querySelector(".repeat-add-date");
  const specificRows = card.querySelectorAll(".repeat-specific-date-row").length;
  if (addDateButton) addDateButton.disabled = specificRows >= MAX_SPECIFIC_REPEAT_DATES;

  const helper = card.querySelector(".repeat-helper");
  if (helper) {
    helper.textContent = frequency === "annually"
      ? "If you leave this blank, the event repeats for 3 years."
      : frequency === "specific_dates"
        ? "Choose up to 10 occurrence dates. The event time stays the same."
        : "If you leave this blank, the event repeats for 1 year.";
  }
}

function buildRecurringEvents(card, basePayload, rowLabel) {
  const enabled = card.querySelector(".repeat-enabled")?.checked;
  if (!enabled) return { events: [basePayload] };

  const baseStart = new Date(basePayload.date_start);
  const baseEnd = new Date(basePayload.date_end);
  if (Number.isNaN(baseStart.getTime()) || Number.isNaN(baseEnd.getTime()) || baseEnd < baseStart) {
    return { error: `${rowLabel} has invalid start/end times for recurrence.` };
  }

  const durationMs = baseEnd.getTime() - baseStart.getTime();
  const frequency = card.querySelector(".repeat-frequency")?.value || "weekly";
  const untilInput = String(card.querySelector(".repeat-until")?.value || "").trim();
  const explicitUntil = untilInput ? new Date(`${untilInput}T23:59:59`) : null;
  const until = explicitUntil && !Number.isNaN(explicitUntil.getTime()) ? explicitUntil : defaultRepeatUntil(baseStart, frequency);

  if (frequency !== "specific_dates" && until < baseStart) {
    return { error: `${rowLabel} has a repeat end date before the event starts.` };
  }

  const occurrences = [];
  const seen = new Set();

  function pushOccurrence(startDate) {
    const key = startDate.toISOString();
    if (seen.has(key)) return;
    seen.add(key);
    occurrences.push({
      ...basePayload,
      date_start: startDate.toISOString(),
      date_end: new Date(startDate.getTime() + durationMs).toISOString()
    });
  }

  if (frequency === "weekly") {
    const selectedDays = Array.from(card.querySelectorAll(".repeat-weekday:checked")).map((input) => Number(input.value));
    if (!selectedDays.length) return { error: `${rowLabel} needs at least one weekday selected.` };

    let cursor = new Date(baseStart);
    cursor.setHours(0, 0, 0, 0);
    let guard = 0;
    while (cursor <= until && guard < 370) {
      if (selectedDays.includes(cursor.getDay())) {
        const occurrenceStart = new Date(cursor);
        occurrenceStart.setHours(baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds(), baseStart.getMilliseconds());
        if (occurrenceStart >= baseStart && occurrenceStart <= until) {
          pushOccurrence(occurrenceStart);
        }
      }
      cursor = addDays(cursor, 1);
      guard += 1;
    }
  } else if (frequency === "monthly") {
    const dayValue = Number(card.querySelector(".repeat-month-day")?.value || baseStart.getDate());
    if (!dayValue || dayValue < 1 || dayValue > 31) {
      return { error: `${rowLabel} needs a valid day of the month.` };
    }

    let year = baseStart.getFullYear();
    let month = baseStart.getMonth();
    let guard = 0;
    while (guard < 24) {
      const day = Math.min(dayValue, daysInMonth(year, month));
      const occurrenceStart = new Date(year, month, day, baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds(), baseStart.getMilliseconds());
      if (occurrenceStart >= baseStart && occurrenceStart <= until) {
        pushOccurrence(occurrenceStart);
      }
      if (occurrenceStart > until) break;
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      guard += 1;
    }
  } else if (frequency === "annually") {
    let year = baseStart.getFullYear();
    let guard = 0;
    while (guard < 5) {
      const day = Math.min(baseStart.getDate(), daysInMonth(year, baseStart.getMonth()));
      const occurrenceStart = new Date(year, baseStart.getMonth(), day, baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds(), baseStart.getMilliseconds());
      if (occurrenceStart >= baseStart && occurrenceStart <= until) {
        pushOccurrence(occurrenceStart);
      }
      if (occurrenceStart > until) break;
      year += 1;
      guard += 1;
    }
  } else if (frequency === "specific_dates") {
    const dates = [...new Set(Array.from(card.querySelectorAll(".repeat-specific-date")).map((input) => String(input.value || "").trim()).filter(Boolean))];
    if (!dates.length) return { error: `${rowLabel} needs at least one specific date.` };
    if (dates.length > MAX_SPECIFIC_REPEAT_DATES) return { error: `${rowLabel} can only include up to ${MAX_SPECIFIC_REPEAT_DATES} specific dates.` };
    dates.sort().forEach((dateValue) => {
      const occurrenceStart = combineDateWithTime(dateValue, baseStart);
      if (occurrenceStart && !Number.isNaN(occurrenceStart.getTime())) {
        pushOccurrence(occurrenceStart);
      }
    });
  }

  if (!occurrences.length) {
    return { error: `${rowLabel} did not generate any recurring dates. Check the repeat settings.` };
  }

  return { events: occurrences.sort((a, b) => new Date(a.date_start) - new Date(b.date_start)) };
}

function addRow() {
  if (rowsBody.querySelectorAll(".public-submit-card").length >= MAX_ROWS) return;

  const card = document.createElement("div");
  card.className = "public-submit-card";

  const header = document.createElement("div");
  header.className = "public-submit-card-header";

  const title = document.createElement("h3");
  title.className = "public-submit-row-number";
  title.textContent = "Event 1";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    card.remove();
    reindex();
  });

  header.append(title, removeButton);

  const grid = document.createElement("div");
  grid.className = "public-submit-grid";

  const titleInput = createInput("text", "title", "Event title", true);
  const addressInput = createInput("text", "address", "Street address", true);
  const eventTypeSelect = createSelect("event-type", EVENT_TYPES, true);
  const areaSelect = createSelect("area", AREA_GROUPS, true);
  const startInput = createInput("datetime-local", "date-start", "", true);
  const endInput = createInput("datetime-local", "date-end", "", true);
  const languageField = createLanguageField();
  const recurringField = createRecurringField();
  const priceTypeSelect = createSelect("price-type", PRICE_TYPE_OPTIONS, true);
  const priceMinInput = createInput("number", "price-min", "Minimum price");
  priceMinInput.step = "0.01";
  const priceMaxInput = createInput("number", "price-max", "Maximum price");
  priceMaxInput.step = "0.01";
  const currencySelect = createSelect("currency", CURRENCY_OPTIONS, true);
  const ticketUrlInput = createInput("url", "ticket-url", "Ticket / RSVP URL");
  const imageUrlInput = createInput("url", "image-url", "Image URL");
  const imageFileInput = createInput("file", "image-file");
  imageFileInput.accept = "image/*";

  grid.append(
    createField("Title *", titleInput),
    createDescriptionField(),
    createField("Address *", addressInput),
    createField("Type *", eventTypeSelect),
    createField("Area *", areaSelect),
    createField("Start *", startInput),
    createField("End *", endInput),
    languageField,
    recurringField,
    createField("Paid / Free *", priceTypeSelect),
    createField("Min price", priceMinInput),
    createField("Max price", priceMaxInput),
    createField("Currency *", currencySelect),
    createField("Ticket URL", ticketUrlInput),
    createField("Image URL", imageUrlInput),
    createField("Image file", imageFileInput)
  );

  card.append(header, grid);
  rowsBody.appendChild(card);

  priceTypeSelect.addEventListener("change", () => syncPriceState(card));
  imageFileInput.addEventListener("change", () => syncImageState(card));
  card.querySelector(".language-other-toggle")?.addEventListener("change", () => syncLanguageState(card));
  card.querySelector(".repeat-enabled")?.addEventListener("change", () => syncRecurringState(card));
  card.querySelector(".repeat-frequency")?.addEventListener("change", () => syncRecurringState(card));
  startInput.addEventListener("change", () => syncRecurringState(card));
  syncPriceState(card);
  syncImageState(card);
  syncLanguageState(card);
  syncRecurringState(card);
  reindex();
}

function rowEmpty(card) {
  const fields = [
    ".title",
    ".description",
    ".address",
    ".date-start",
    ".date-end",
    ".language-other-input",
    ".ticket-url",
    ".image-url"
  ];
  const hasValue = fields.some((selector) => String(card.querySelector(selector)?.value || "").trim());
  const hasFile = card.querySelector(".image-file")?.files?.[0];
  return !hasValue && !hasFile;
}

function validateSubmitterInfo() {
  return "";
}

async function submitRows() {
  statusBox.style.display = "none";
  const submitterError = validateSubmitterInfo();
  if (submitterError) {
    setStatus(submitterError, "error");
    return;
  }

  const cards = Array.from(rowsBody.querySelectorAll(".public-submit-card")).filter((card) => !rowEmpty(card));
  if (!cards.length) {
    setStatus("Add at least one event row.", "error");
    return;
  }

  const payloads = [];
  for (const card of cards) {
    const rowNo = card.querySelector(".public-submit-row-number").textContent;
    const title = card.querySelector(".title").value.trim();
    const description = card.querySelector(".description").value.trim();
    const address = card.querySelector(".address").value.trim();
    const eventType = card.querySelector(".event-type").value.trim();
    const area = card.querySelector(".area").value.trim();
    const dateStart = toIsoOrNull(card.querySelector(".date-start").value.trim());
    const dateEnd = toIsoOrNull(card.querySelector(".date-end").value.trim());
    const languages = collectLanguages(card);
    const priceType = card.querySelector(".price-type").value.trim();
    const priceMin = card.querySelector(".price-min").value.trim();
    const priceMax = card.querySelector(".price-max").value.trim();
    const currency = card.querySelector(".currency").value.trim();
    const ticketUrl = card.querySelector(".ticket-url").value.trim();
    const imageUrlInput = card.querySelector(".image-url").value.trim();
    const file = card.querySelector(".image-file")?.files?.[0] || null;

    const required = [title, description, address, eventType, area, dateStart, dateEnd, priceType, currency];
    if (required.some((value) => !value)) {
      setStatus(`${rowNo} is missing required fields.`, "error");
      return;
    }

    if (!languages.length) {
      setStatus(`${rowNo} needs at least one language selected.`, "error");
      return;
    }

    if (priceType !== "Free" && (!priceMin || !priceMax)) {
      setStatus(`${rowNo} needs min and max prices unless the event is Free.`, "error");
      return;
    }

    let imageUrl = imageUrlInput || null;
    if (file) {
      try {
        imageUrl = await uploadImage(file);
      } catch (error) {
        setStatus(`Image upload failed on ${rowNo}: ${error.message}`, "error");
        return;
      }
    }

    const basePayload = {
      status: "pending",
      title_en: title,
      description_en: description,
      location_en: address,
      event_type: eventType,
      area,
      event_language: languages,
      date_start: dateStart,
      date_end: dateEnd,
      price_type: priceType,
      price_min: priceType === "Free" ? null : priceMin,
      price_max: priceType === "Free" ? null : priceMax,
      currency,
      ticket_url: ticketUrl || null,
      event_image_url: imageUrl,
      organizer_name: organizerName.value.trim(),
      organizer_email: organizerEmail.value.trim(),
      submitter_name: submitterName.value.trim(),
      submitter_email: submitterEmail.value.trim(),
      submitter_note: submitterNote.value.trim()
    };

    const recurring = buildRecurringEvents(card, basePayload, rowNo);
    if (recurring.error) {
      setStatus(recurring.error, "error");
      return;
    }

    payloads.push(...recurring.events);
    if (payloads.length > MAX_GENERATED_EVENTS) {
      setStatus(`This submission expands to more than ${MAX_GENERATED_EVENTS} events. Please shorten the repeat range or submit fewer rows.`, "error");
      return;
    }
  }

  const response = await fetch(`${ADMIN_API_URL}/v1/public-submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ events: payloads })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(result?.error || `HTTP ${response.status}`, "error");
    return;
  }

  setStatus(`Save successful. Submitted ${payloads.length} event(s) for approval.`, "success");
}

addRowButton.addEventListener("click", addRow);
fillRowsButton.addEventListener("click", () => {
  while (rowsBody.querySelectorAll(".public-submit-card").length < MAX_ROWS) addRow();
});
submitButton.addEventListener("click", submitRows);
descriptionEditor.addEventListener("input", () => setDescriptionCounter(descriptionEditor.value));
descriptionDoneButton.addEventListener("click", () => closeDescriptionModal(true));

addRow();

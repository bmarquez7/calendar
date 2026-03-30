import { createClient } from "../../shared/vendor.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, EVENT_IMAGE_BUCKET, ADMIN_API_URL } from "../../shared/config.js";
import {
  EVENT_TYPES,
  AREA_GROUPS,
  DEFAULT_EVENT_LANGUAGE_OPTIONS,
  sortEventLanguageOptions,
  formatEventLanguageValue
} from "../../shared/constants.js";

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
const MAX_EVENT_IMAGES = 5;
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
const submitSections = Array.from(document.querySelectorAll(".public-submit-section"));
const submitSuccessPanel = document.getElementById("public-submit-success");
const submitSuccessMessage = document.getElementById("public-submit-success-message");
const submitAgainButton = document.getElementById("public-submit-again");
const descriptionModal = document.getElementById("description-modal");
const descriptionEditor = document.getElementById("description-editor");
const descriptionCounter = document.getElementById("description-counter");
const descriptionDoneButton = document.getElementById("description-done");
const pickerModal = document.getElementById("picker-modal");
const pickerModalTitle = document.getElementById("picker-modal-title");
const pickerModalBody = document.getElementById("picker-modal-body");
const pickerDoneButton = document.getElementById("picker-done");

const submitterName = document.getElementById("submitter-name");
const submitterEmail = document.getElementById("submitter-email");
const organizerName = document.getElementById("organizer-name");
const organizerEmail = document.getElementById("organizer-email");
const submitterNote = document.getElementById("submitter-note");

let activeDescriptionInput = null;
let activePickerState = null;
let eventLanguageOptions = [...DEFAULT_EVENT_LANGUAGE_OPTIONS];

function setStatus(message, kind = "info") {
  statusBox.style.display = "block";
  statusBox.textContent = message;
  statusBox.classList.remove("success", "error");
  if (kind === "success") statusBox.classList.add("success");
  if (kind === "error") statusBox.classList.add("error");
}

function showSubmitEditor() {
  submitSections.forEach((section) => section.classList.remove("hidden"));
  submitSuccessPanel?.classList.add("hidden");
}

function showSubmitSuccess(count) {
  if (submitSuccessMessage) {
    submitSuccessMessage.textContent = `Thank you for submitting ${count} event${count === 1 ? "" : "s"} and contributing to a more unified events calendar. Your submission is now pending review.`;
  }
  submitSections.forEach((section) => section.classList.add("hidden"));
  submitSuccessPanel?.classList.remove("hidden");
  submitSuccessPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetSubmitForm() {
  submitterName.value = "";
  submitterEmail.value = "";
  organizerName.value = "";
  organizerEmail.value = "";
  submitterNote.value = "";
  rowsBody.innerHTML = "";
  statusBox.style.display = "none";
  addRow();
  showSubmitEditor();
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function customLanguageSort(label) {
  return String(label || "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function languageOptionByCode(code) {
  return eventLanguageOptions.find((option) => option.code === code);
}

function mergeLanguageOptions(customOptions = []) {
  const merged = [...DEFAULT_EVENT_LANGUAGE_OPTIONS];
  customOptions.forEach((option) => {
    if (!option?.code || !option?.label) return;
    if (merged.some((existing) => existing.code === option.code)) return;
    merged.push({
      code: option.code,
      label: option.label,
      sortLabel: option.sort_label || option.sortLabel || customLanguageSort(option.label)
    });
  });
  eventLanguageOptions = sortEventLanguageOptions(merged);
}

function applyLanguageOptionsToSelect(select) {
  if (!select) return;
  const selectedValues = new Set(Array.from(select.selectedOptions).map((option) => option.value));
  select.innerHTML = "";
  createOptionElements(select, [
    ...eventLanguageOptions.map((option) => ({ value: option.code, label: option.label })),
    { value: "other", label: "Other (add your own)" }
  ]);
  Array.from(select.options).forEach((option) => {
    option.selected = selectedValues.has(option.value);
  });
}

function selectDefaultLanguages(select) {
  if (!select) return;
  const hasSelection = Array.from(select.options).some((option) => option.selected);
  if (hasSelection) return;
  Array.from(select.options).forEach((option) => {
    option.selected = option.value === "en" || option.value === "sq";
  });
}

function refreshAllLanguageSelects() {
  document.querySelectorAll(".language-select").forEach((select) => applyLanguageOptionsToSelect(select));
}

async function loadLanguageOptions() {
  try {
    const response = await fetch(`${ADMIN_API_URL}/v1/language-options`);
    if (!response.ok) return;
    const result = await response.json().catch(() => ({}));
    mergeLanguageOptions(Array.isArray(result?.languages) ? result.languages : []);
    refreshAllLanguageSelects();
    document.querySelectorAll(".public-submit-language-field").forEach((field) => syncLanguageLaunch(field));
  } catch (error) {
    console.warn("Language options load failed", error);
  }
}

async function saveCustomLanguage(label) {
  const response = await fetch(`${ADMIN_API_URL}/v1/language-options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || `HTTP ${response.status}`);
  }
  const language = result?.language;
  if (language?.code && language?.label) {
    mergeLanguageOptions([language]);
    refreshAllLanguageSelects();
  }
  return language;
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

function createHelpText(text, className = "public-submit-help-text") {
  const help = document.createElement("p");
  help.className = `small ${className}`;
  help.textContent = text;
  return help;
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
  if (activePickerState) closePickerModal(true);
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

function resolveEditorScope(field, panelClass) {
  const localPanel = field.querySelector(`.${panelClass}`);
  if (localPanel) return localPanel;
  if (activePickerState?.field === field && activePickerState.panel?.classList.contains(panelClass)) {
    return activePickerState.panel;
  }
  return field;
}

function languageDisplayLabel(value) {
  return formatEventLanguageValue(value, eventLanguageOptions);
}

function languageSummary(scope) {
  const values = collectLanguages(scope).map(languageDisplayLabel);
  if (!values.length) return "Select languages";
  if (values.length <= 2) return values.join(", ");
  return `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
}

function createLanguageField() {
  const wrap = document.createElement("div");
  wrap.className = "public-submit-field public-submit-language-field";

  const label = document.createElement("span");
  label.className = "public-submit-label";
  label.textContent = "Languages *";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "public-submit-launch language-launch";
  button.textContent = "Select languages";

  const editor = document.createElement("div");
  editor.className = "picker-editor-panel language-editor-panel";
  editor.hidden = true;

  const select = document.createElement("select");
  select.className = "language-select";
  select.multiple = true;
  select.size = 8;
  applyLanguageOptionsToSelect(select);
  selectDefaultLanguages(select);
  const help = createHelpText("Hold Ctrl (Windows) or Command (Mac) to select multiple.");

  const otherRow = document.createElement("div");
  otherRow.className = "public-submit-language-other";
  otherRow.hidden = true;
  const otherInput = createInput("text", "language-other-input", "Add another language and press Enter");
  otherInput.disabled = true;
  const otherHelp = createHelpText("Press Enter after each language to save it for future use.");
  const otherStatus = document.createElement("div");
  otherStatus.className = "small public-submit-inline-status";

  otherRow.append(otherInput, otherHelp, otherStatus);
  editor.append(select, help, otherRow);
  wrap.append(label, button, editor);

  button.addEventListener("click", () => {
    openPickerModal("Languages", wrap, editor, () => {
      syncLanguageState(editor);
      syncLanguageLaunch(wrap);
    });
  });
  select.addEventListener("change", () => {
    syncLanguageState(editor);
    syncLanguageLaunch(wrap);
  });
  otherInput.addEventListener("input", () => syncLanguageLaunch(wrap));
  otherInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = otherInput.value.trim();
    if (!value) return;
    otherStatus.textContent = "Saving...";
    otherStatus.classList.remove("error", "success");
    otherInput.disabled = true;
    try {
      const saved = await saveCustomLanguage(value);
      if (saved?.code) {
        Array.from(select.options).forEach((option) => {
          if (option.value === "other") option.selected = false;
          if (option.value === saved.code) option.selected = true;
        });
      }
      otherInput.value = "";
      otherStatus.textContent = "Added.";
      otherStatus.classList.add("success");
      syncLanguageState(editor);
      syncLanguageLaunch(wrap);
    } catch (error) {
      otherStatus.textContent = error.message || "Could not save language.";
      otherStatus.classList.add("error");
    } finally {
      otherInput.disabled = false;
      otherInput.focus();
    }
  });
  syncLanguageLaunch(wrap);
  return wrap;
}

function renderFeaturedImageChoices(card, files = Array.from(card.querySelector(".image-files")?.files || [])) {
  const field = card.querySelector(".featured-image-field");
  const optionsWrap = card.querySelector(".featured-image-options");
  const help = card.querySelector(".public-submit-image-help");
  if (!field || !optionsWrap) return;

  (card._featuredPreviewUrls || []).forEach((url) => URL.revokeObjectURL(url));
  card._featuredPreviewUrls = [];
  optionsWrap.innerHTML = "";
  if (help) help.textContent = "";

  if (!files.length) {
    field.hidden = true;
    card.dataset.featuredImageIndex = "0";
    return;
  }

  field.hidden = false;
  const storedIndex = Number(card.dataset.featuredImageIndex || 0);
  const selectedIndex = Number.isFinite(storedIndex)
    ? Math.min(Math.max(storedIndex, 0), files.length - 1)
    : 0;
  card.dataset.featuredImageIndex = String(selectedIndex);
  if (help) {
    help.textContent = files.length === 1
      ? "1 photo selected. This preview will be used as the featured image."
      : "Choose which photo appears first on the calendar card.";
  }

  files.forEach((file, index) => {
    const previewUrl = URL.createObjectURL(file);
    card._featuredPreviewUrls.push(previewUrl);
    const option = document.createElement("label");
    option.className = "featured-image-option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `featured-image-${card.dataset.rowId || "row"}`;
    radio.value = String(index);
    radio.checked = index === selectedIndex;
    radio.addEventListener("change", () => {
      card.dataset.featuredImageIndex = radio.value;
    });

    const tile = document.createElement("span");
    tile.className = "featured-image-tile";
    tile.title = file.name;

    const image = document.createElement("img");
    image.className = "featured-image-preview";
    image.src = previewUrl;
    image.alt = file.name;

    const caption = document.createElement("span");
    caption.className = "featured-image-caption";
    caption.textContent = `Photo ${index + 1}`;

    tile.append(image, caption);

    option.append(radio, tile);
    optionsWrap.append(option);
  });
}

function createImageFields() {
  const imageUrlInput = createInput("url", "image-url", "Image URL");

  const imageFilesInput = createInput("file", "image-files");
  imageFilesInput.accept = "image/*";
  imageFilesInput.multiple = true;

  const featuredField = document.createElement("div");
  featuredField.className = "public-submit-field featured-image-field";
  featuredField.hidden = true;

  const featuredLabel = document.createElement("span");
  featuredLabel.className = "public-submit-label";
  featuredLabel.textContent = "Featured photo";

  const featuredHelp = document.createElement("p");
  featuredHelp.className = "small public-submit-image-help";

  const featuredOptions = document.createElement("div");
  featuredOptions.className = "featured-image-options";

  featuredField.append(featuredLabel, featuredHelp, featuredOptions);

  return {
    imageUrlField: createField("Image URL", imageUrlInput),
    imageFilesField: createField(`Upload photos (up to ${MAX_EVENT_IMAGES})`, imageFilesInput),
    featuredField
  };
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

function repeatSummary(scope) {
  const enabled = scope.querySelector(".repeat-enabled")?.checked;
  if (!enabled) return "No repeat";
  const frequency = scope.querySelector(".repeat-frequency")?.value || "weekly";
  const until = String(scope.querySelector(".repeat-until")?.value || "").trim();
  let summary = "No repeat";

  if (frequency === "weekly") {
    const days = Array.from(scope.querySelectorAll(".repeat-weekday:checked")).map((input) => {
      const match = WEEKDAY_OPTIONS.find((day) => String(day.value) === input.value);
      return match ? match.label : input.value;
    });
    summary = days.length ? `Weekly • ${days.join(", ")}` : "Weekly";
  } else if (frequency === "monthly") {
    const day = scope.querySelector(".repeat-month-day")?.value || "";
    summary = day ? `Monthly • Day ${day}` : "Monthly";
  } else if (frequency === "annually") {
    summary = "Annually";
  } else if (frequency === "specific_dates") {
    const count = Array.from(scope.querySelectorAll(".repeat-specific-date"))
      .map((input) => String(input.value || "").trim())
      .filter(Boolean).length;
    summary = count ? `Specific dates • ${count} selected` : "Specific dates";
  }

  return until ? `${summary} • until ${until}` : summary;
}

function syncLanguageLaunch(scope) {
  const source = resolveEditorScope(scope, "language-editor-panel");
  const button = scope.querySelector(".language-launch");
  if (!button) return;
  const summary = languageSummary(source);
  button.textContent = summary;
  button.classList.toggle("is-filled", summary !== "Select languages");
}

function createRecurringFields() {
  const wrap = document.createElement("div");
  wrap.className = "public-submit-field public-submit-repeat-launch-field";

  const label = document.createElement("span");
  label.className = "public-submit-label";
  label.textContent = "Repeating event?";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "public-submit-launch repeat-launch";
  button.textContent = "No repeat";

  const editor = document.createElement("div");
  editor.className = "picker-editor-panel repeat-editor-panel";
  editor.hidden = true;

  const toggleControl = document.createElement("label");
  toggleControl.className = "repeat-toggle-control repeat-toggle-control-inline";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.className = "repeat-enabled";
  const toggleText = document.createElement("span");
  toggleText.className = "repeat-toggle-text";
  toggleText.textContent = "Repeat this event";
  toggleControl.append(toggle, toggleText);

  const config = document.createElement("div");
  config.className = "public-submit-repeat-config";

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

  editor.append(toggleControl, config);
  wrap.append(label, button, editor);

  button.addEventListener("click", () => {
    openPickerModal("Repeating event", wrap, editor, () => syncRecurringState(wrap));
  });
  toggle.addEventListener("change", () => syncRecurringState(wrap));
  frequencySelect.addEventListener("change", () => syncRecurringState(wrap));
  monthlyInput.addEventListener("input", () => syncRecurringState(wrap));
  untilInput.addEventListener("input", () => syncRecurringState(wrap));
  Array.from(weeklyOptions.querySelectorAll(".repeat-weekday")).forEach((input) => {
    input.addEventListener("change", () => syncRecurringState(wrap));
  });
  button.classList.remove("is-filled");
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
  const imageFileInput = card.querySelector(".image-files");
  if (imageFileInput?.files?.length > MAX_EVENT_IMAGES) {
    imageFileInput.value = "";
    setStatus(`Each event can include up to ${MAX_EVENT_IMAGES} photos.`, "error");
  }
  const files = Array.from(imageFileInput?.files || []);
  const hasFile = Boolean(files.length);
  if (!imageUrlInput) return;
  imageUrlInput.disabled = hasFile;
  imageUrlInput.placeholder = hasFile ? "Disabled when photos are uploaded" : "Image URL";
  renderFeaturedImageChoices(card, files);
}

function syncLanguageState(scope) {
  const select = scope.querySelector(".language-select");
  const otherInput = scope.querySelector(".language-other-input");
  const otherRow = scope.querySelector(".public-submit-language-other");
  if (!select || !otherInput || !otherRow) return;
  const hasOther = Array.from(select.selectedOptions).some((option) => option.value === "other");
  otherRow.hidden = !hasOther;
  otherInput.disabled = !hasOther;
  if (!hasOther) otherInput.value = "";
}

function collectLanguages(card) {
  const select = card.querySelector(".language-select");
  const selected = Array.from(select?.selectedOptions || [])
    .map((option) => option.value.trim())
    .filter((value) => value && value !== "other");
  const otherInput = card.querySelector(".language-other-input");
  if (Array.from(select?.selectedOptions || []).some((option) => option.value === "other")) {
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
  const editorScope = resolveEditorScope(card, "repeat-editor-panel");
  const enabled = editorScope.querySelector(".repeat-enabled")?.checked;
  const config = editorScope.querySelector(".public-submit-repeat-config");
  const button = card.querySelector(".repeat-launch");
  if (!config || !button) return;
  config.hidden = !enabled;
  if (!enabled) {
    button.textContent = "No repeat";
    button.classList.remove("is-filled");
    return;
  }

  const frequency = editorScope.querySelector(".repeat-frequency")?.value || "weekly";
  editorScope.querySelector(".repeat-panel-weekly")?.toggleAttribute("hidden", frequency !== "weekly");
  editorScope.querySelector(".repeat-panel-monthly")?.toggleAttribute("hidden", frequency !== "monthly");
  editorScope.querySelector(".repeat-panel-annual")?.toggleAttribute("hidden", frequency !== "annually");
  editorScope.querySelector(".repeat-panel-specific")?.toggleAttribute("hidden", frequency !== "specific_dates");

  const untilWrap = editorScope.querySelector(".repeat-until-wrap");
  if (untilWrap) untilWrap.hidden = frequency === "specific_dates";

  const startValue = card.querySelector(".date-start")?.value || "";
  const startDate = startValue ? new Date(startValue) : null;
  if (startDate && !Number.isNaN(startDate.getTime())) {
    const monthlyInput = editorScope.querySelector(".repeat-month-day");
    if (monthlyInput && !monthlyInput.value) {
      monthlyInput.value = String(startDate.getDate());
    }

    const weekdayInputs = Array.from(editorScope.querySelectorAll(".repeat-weekday"));
    if (frequency === "weekly" && weekdayInputs.length && !weekdayInputs.some((input) => input.checked)) {
      const matching = weekdayInputs.find((input) => Number(input.value) === startDate.getDay());
      if (matching) matching.checked = true;
    }

    if (frequency === "specific_dates") {
      const list = editorScope.querySelector(".repeat-specific-dates");
      if (list && list.querySelectorAll(".repeat-specific-date-row").length === 0) {
        addSpecificDateRow(list, toDateOnlyValue(startDate));
      }
    }
  }

  const addDateButton = editorScope.querySelector(".repeat-add-date");
  const specificRows = editorScope.querySelectorAll(".repeat-specific-date-row").length;
  if (addDateButton) addDateButton.disabled = specificRows >= MAX_SPECIFIC_REPEAT_DATES;

  const helper = editorScope.querySelector(".repeat-helper");
  if (helper) {
    helper.textContent = frequency === "annually"
      ? "If you leave this blank, the event repeats for 3 years."
      : frequency === "specific_dates"
        ? "Choose up to 10 occurrence dates. The event time stays the same."
        : "If you leave this blank, the event repeats for 1 year.";
  }

  button.textContent = repeatSummary(editorScope);
  button.classList.toggle("is-filled", enabled);
}

function resetRecurringSummary(card) {
  const editorScope = resolveEditorScope(card, "repeat-editor-panel");
  const button = card.querySelector(".repeat-launch");
  if (!button) return;
  const enabled = editorScope.querySelector(".repeat-enabled")?.checked;
  button.textContent = enabled ? repeatSummary(editorScope) : "No repeat";
  button.classList.toggle("is-filled", Boolean(enabled));
}

function openPickerModal(title, field, panel, onDone) {
  if (!descriptionModal.hidden) closeDescriptionModal(true);
  if (activePickerState?.panel && activePickerState.panel !== panel) {
    closePickerModal(true);
  }
  activePickerState = { field, panel, onDone };
  pickerModalTitle.textContent = title;
  panel.hidden = false;
  pickerModalBody.append(panel);
  pickerModal.hidden = false;
  panel.querySelector("input, select, textarea, button")?.focus();
}

function closePickerModal(save = true) {
  if (!activePickerState) return;
  const { field, panel, onDone } = activePickerState;
  field.append(panel);
  panel.hidden = true;
  pickerModal.hidden = true;
  activePickerState = null;
  if (save && typeof onDone === "function") onDone();
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
  card.dataset.rowId = `public-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
    (card._featuredPreviewUrls || []).forEach((url) => URL.revokeObjectURL(url));
    card._featuredPreviewUrls = [];
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
  const recurringField = createRecurringFields();
  const priceTypeSelect = createSelect("price-type", PRICE_TYPE_OPTIONS, true);
  const priceMinInput = createInput("number", "price-min", "Minimum price");
  priceMinInput.step = "0.01";
  const priceMaxInput = createInput("number", "price-max", "Maximum price");
  priceMaxInput.step = "0.01";
  const currencySelect = createSelect("currency", CURRENCY_OPTIONS, true);
  const ticketUrlInput = createInput("url", "ticket-url", "Ticket / RSVP URL");
  const imageFields = createImageFields();

  grid.append(
    createField("Title *", titleInput),
    createDescriptionField(),
    createField("Address *", addressInput),
    createField("Type *", eventTypeSelect),
    createField("Area *", areaSelect),
    createField("Start *", startInput),
    createField("End *", endInput),
    languageField,
    createField("Paid / Free *", priceTypeSelect),
    createField("Min price", priceMinInput),
    createField("Max price", priceMaxInput),
    createField("Currency *", currencySelect),
    createField("Ticket URL", ticketUrlInput),
    recurringField,
    imageFields.imageUrlField,
    imageFields.imageFilesField,
    imageFields.featuredField
  );

  card.append(header, grid);
  rowsBody.appendChild(card);

  priceTypeSelect.addEventListener("change", () => syncPriceState(card));
  card.querySelector(".image-files")?.addEventListener("change", () => syncImageState(card));
  startInput.addEventListener("change", () => syncRecurringState(card));
  syncPriceState(card);
  syncImageState(card);
  syncLanguageState(card);
  syncRecurringState(card);
  syncLanguageLaunch(card);
  resetRecurringSummary(card);
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
  const hasFile = card.querySelector(".image-files")?.files?.[0];
  return !hasValue && !hasFile;
}

function validateSubmitterInfo() {
  return "";
}

async function submitRows() {
  if (activePickerState) closePickerModal(true);
  if (!descriptionModal.hidden) closeDescriptionModal(true);
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
    const imageFiles = Array.from(card.querySelector(".image-files")?.files || []);

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

    let eventImageUrls = imageUrlInput ? [imageUrlInput] : [];
    let featuredImageUrl = imageUrlInput || null;
    if (imageFiles.length) {
      try {
        const uploadedUrls = [];
        for (const imageFile of imageFiles.slice(0, MAX_EVENT_IMAGES)) {
          uploadedUrls.push(await uploadImage(imageFile));
        }
        const selectedIndex = Math.min(
          Math.max(Number(card.dataset.featuredImageIndex || 0), 0),
          Math.max(uploadedUrls.length - 1, 0)
        );
        featuredImageUrl = uploadedUrls[selectedIndex] || uploadedUrls[0] || null;
        eventImageUrls = [
          ...(featuredImageUrl ? [featuredImageUrl] : []),
          ...uploadedUrls.filter((url) => url && url !== featuredImageUrl)
        ];
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
      event_image_url: featuredImageUrl,
      event_image_urls: eventImageUrls.length ? eventImageUrls : null,
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
  showSubmitSuccess(payloads.length);
}

addRowButton.addEventListener("click", addRow);
fillRowsButton.addEventListener("click", () => {
  while (rowsBody.querySelectorAll(".public-submit-card").length < MAX_ROWS) addRow();
});
submitButton.addEventListener("click", submitRows);
descriptionEditor.addEventListener("input", () => setDescriptionCounter(descriptionEditor.value));
descriptionDoneButton.addEventListener("click", () => closeDescriptionModal(true));
pickerDoneButton.addEventListener("click", () => closePickerModal(true));

pickerModal.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal-backdrop")) {
    closePickerModal(true);
  }
});

descriptionModal.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal-backdrop")) {
    closeDescriptionModal(true);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!pickerModal.hidden) closePickerModal(true);
  if (!descriptionModal.hidden) closeDescriptionModal(true);
});

submitAgainButton?.addEventListener("click", resetSubmitForm);

addRow();
loadLanguageOptions();

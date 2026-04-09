import { createClient } from "../shared/vendor.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, EVENT_IMAGE_BUCKET, ADMIN_API_URL } from "../shared/config.js";
import { AREA_GROUPS, formatAreaLabel, normalizeAreaValue, isFeaturedEligibleArea } from "../shared/constants.js";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginGate = document.getElementById("login-gate");
const protectedApp = document.getElementById("protected-app");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const accessRequestForm = document.getElementById("access-request-form");
const accessRequestStatus = document.getElementById("access-request-status");
const logoutButton = document.getElementById("logout");
const rolePill = document.getElementById("role-pill");

const refreshButton = document.getElementById("refresh");
const adminCount = document.getElementById("admin-count");
const adminSearchInput = document.getElementById("admin-search");
const adminTableBody = document.querySelector("#admin-table tbody");
const adminSelectAll = document.getElementById("admin-select-all");
const adminSelectedCount = document.getElementById("admin-selected-count");
const adminBulkStatus = document.getElementById("admin-bulk-status");
const bulkApproveButton = document.getElementById("bulk-approve");
const bulkPendingButton = document.getElementById("bulk-pending");
const bulkDenyButton = document.getElementById("bulk-deny");
const bulkNeedsInfoButton = document.getElementById("bulk-needs-info");
const bulkHighlightButton = document.getElementById("bulk-highlight");
const bulkUnhighlightButton = document.getElementById("bulk-unhighlight");
const bulkDeleteButton = document.getElementById("bulk-delete");

const editForm = document.getElementById("edit-form");
const editStatus = document.getElementById("edit-status");
const newEventButton = document.getElementById("new-event");
const approveEmailButton = document.getElementById("approve-email");
const denyEmailButton = document.getElementById("deny-email");
const needsInfoEmailButton = document.getElementById("needs-info-email");

const batchSection = document.getElementById("batch-section");
const batchForm = document.getElementById("batch-form");
const batchStatus = document.getElementById("batch-status");
const batchRowsBody = document.getElementById("batch-rows");
const batchRowCount = document.getElementById("batch-row-count");
const batchAddRowButton = document.getElementById("batch-add-row");
const batchAddTenButton = document.getElementById("batch-add-ten");
const batchFillFiftyButton = document.getElementById("batch-fill-fifty");

const usersSection = document.getElementById("users-section");
const usersStatus = document.getElementById("users-status");
const usersTableBody = document.querySelector("#users-table tbody");
const accessRequestsTableBody = document.querySelector("#access-requests-table tbody");
const inviteForm = document.getElementById("invite-form");
const resetForm = document.getElementById("reset-form");
const emailDiagnosticsButton = document.getElementById("email-diagnostics-button");
const emailTestButton = document.getElementById("email-test-button");
const emailDiagnosticsStatus = document.getElementById("email-diagnostics-status");

const settingsSection = document.getElementById("settings-section");
const settingsForm = document.getElementById("settings-form");
const settingsStatus = document.getElementById("settings-status");
const textSettingKey = document.getElementById("text-setting-key");
const taskHub = document.getElementById("task-hub");
const taskPages = Array.from(document.querySelectorAll(".task-page"));
const taskButtons = Array.from(document.querySelectorAll("[data-open-page]"));
const hubBackButtons = Array.from(document.querySelectorAll("[data-back-to-hub]"));
const ACTIVE_TASK_STORAGE_KEY = "grow-albania-admin-active-page";

function readStoredTaskPage() {
  try {
    return sessionStorage.getItem(ACTIVE_TASK_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function writeStoredTaskPage(pageId) {
  try {
    if (pageId) {
      sessionStorage.setItem(ACTIVE_TASK_STORAGE_KEY, pageId);
    } else {
      sessionStorage.removeItem(ACTIVE_TASK_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access hiccups and keep the UI usable.
  }
}

let currentEvents = [];
let currentAccessRequests = [];
let selectedId = null;
let currentRole = null;
let accessToken = null;
let lastKnownSession = null;
let activeTaskPage = readStoredTaskPage();
let settingsLoaded = false;
let currentSettings = { id: 1 };
let activeTextKey = "hero_title";
const MAX_BATCH_ROWS = 50;
const selectedEventIds = new Set();
const expandedSeriesIds = new Set();
const expandedTitleGroupIds = new Set();
let adminSearchQuery = "";
let currentVisibleEventIds = [];

const ROLE_RANK = {
  moderator: 1,
  editor: 2,
  owner: 3
};

const EVENT_STATUS_RANK = {
  pending: 0,
  needs_info: 1,
  approved: 2,
  denied: 3
};

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

function supabaseProjectRef() {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function clearPersistedAuth() {
  const ref = supabaseProjectRef();
  if (!ref) return;
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    if (!storage) return;
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && (key.includes(`sb-${ref}`) || key.includes(`lock:sb-${ref}`))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => storage.removeItem(key));
  });
  lastKnownSession = null;
  accessToken = null;
}

function appendSelectOptions(select, options) {
  options.forEach((option) => {
    if (option?.options) {
      const group = document.createElement("optgroup");
      group.label = option.label;
      appendSelectOptions(group, option.options);
      select.appendChild(group);
      return;
    }
    const el = document.createElement("option");
    el.value = option.value ?? option;
    el.textContent = option.label ?? option;
    select.appendChild(el);
  });
}

function populateGroupedSelect(select, options, placeholder = "") {
  if (!select) return;
  select.innerHTML = "";
  if (placeholder) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    select.appendChild(empty);
  }
  appendSelectOptions(select, options);
}

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function canFeatureEventArea(area, status = "approved", featureBlocked = false) {
  return !featureBlocked && status === "approved" && isFeaturedEligibleArea(area);
}

function syncEditHighlightAvailability() {
  const featureBlocked = Boolean(editForm.feature_blocked?.checked);
  const canHighlight = canFeatureEventArea(editForm.area.value, editForm.status.value, featureBlocked);
  editForm.is_highlighted.disabled = !canHighlight;
  if (!canHighlight) editForm.is_highlighted.checked = false;
  editForm.is_highlighted.closest(".toggle-field")?.classList.toggle("disabled", !canHighlight);
}

function hasRole(minRole) {
  if (!currentRole) return false;
  return ROLE_RANK[currentRole] >= ROLE_RANK[minRole];
}

function makeRecurrenceGroupId() {
  return globalThis.crypto?.randomUUID?.() || null;
}

function uniqueById(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = String(event?.id || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function visibleEventIds() {
  return currentVisibleEventIds.slice();
}

function reconcileSelection() {
  const validIds = new Set(visibleEventIds());
  [...selectedEventIds].forEach((id) => {
    if (!validIds.has(id)) selectedEventIds.delete(id);
  });
}

function syncBulkSelectionUi() {
  reconcileSelection();
  const visibleIds = visibleEventIds();
  const selectedVisibleCount = visibleIds.filter((id) => selectedEventIds.has(id)).length;
  if (adminSelectedCount) {
    adminSelectedCount.textContent = `${selectedVisibleCount} selected`;
  }
  if (adminSelectAll) {
    adminSelectAll.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
    adminSelectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  }
  const disabled = selectedVisibleCount === 0;
  [
    bulkApproveButton,
    bulkPendingButton,
    bulkDenyButton,
    bulkNeedsInfoButton,
    bulkHighlightButton,
    bulkUnhighlightButton,
    bulkDeleteButton
  ].forEach((button) => {
    if (button) button.disabled = disabled;
  });
}

function toggleSelectedEventIds(ids, checked) {
  ids.forEach((id) => {
    const key = String(id || "");
    if (!key) return;
    if (checked) selectedEventIds.add(key);
    else selectedEventIds.delete(key);
  });
  syncBulkSelectionUi();
}

function normalizeTitleGroupKey(title) {
  return normalizeSearchValue(title);
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

function duplicateKeyFromEventLike(event) {
  const dayKey = dateKeyInTirana(event.date_start);
  const titleKey = normalizeSearchValue(event.title_en);
  if (!dayKey || !titleKey) return "";
  const areaKey = normalizeSearchValue(normalizeAreaValue(event.area));
  const locationKey = normalizeSearchValue(event.location_en || event.location_es || event.location_sq || normalizeAreaValue(event.area));
  return [dayKey, titleKey, areaKey, locationKey].join("|");
}

function duplicateLabelFromEventLike(event) {
  const title = String(event.title_en || "Untitled").trim();
  const dayKey = dateKeyInTirana(event.date_start) || "unknown date";
  const areaLabel = formatAreaLabel(event.area || "");
  return areaLabel ? `${title} on ${dayKey} (${areaLabel})` : `${title} on ${dayKey}`;
}

function findDuplicateConflicts(candidateRows, options = {}) {
  const excludeIds = new Set((options.excludeIds || []).map((value) => String(value || "")).filter(Boolean));
  const activeExistingByKey = new Map();
  currentEvents
    .filter((event) => event.status !== "denied" && !excludeIds.has(String(event.id || "")))
    .forEach((event) => {
      const key = duplicateKeyFromEventLike(event);
      if (key && !activeExistingByKey.has(key)) activeExistingByKey.set(key, event);
    });

  const existingConflicts = [];
  const internalConflicts = [];
  const seenCandidateKeys = new Map();

  candidateRows
    .filter((event) => (event.status || "approved") !== "denied")
    .forEach((event, index) => {
      const key = duplicateKeyFromEventLike(event);
      if (!key) return;
      const existing = activeExistingByKey.get(key);
      if (existing) {
        existingConflicts.push({ index, event, existing });
      }
      if (seenCandidateKeys.has(key)) {
        internalConflicts.push({ index, event, firstIndex: seenCandidateKeys.get(key) });
      } else {
        seenCandidateKeys.set(key, index);
      }
    });

  return { existingConflicts, internalConflicts };
}

function duplicateConflictMessage(conflicts) {
  const parts = [];
  if (conflicts.existingConflicts.length) {
    const preview = conflicts.existingConflicts
      .slice(0, 3)
      .map(({ event }) => duplicateLabelFromEventLike(event))
      .join("; ");
    parts.push(`Already exists: ${preview}`);
  }
  if (conflicts.internalConflicts.length) {
    const preview = conflicts.internalConflicts
      .slice(0, 3)
      .map(({ event }) => duplicateLabelFromEventLike(event))
      .join("; ");
    parts.push(`Repeated in this save: ${preview}`);
  }
  return `Duplicate same-day event detected. ${parts.join(" | ")}`.trim();
}

function matchesAdminSearch(event, rawQuery) {
  const query = normalizeSearchValue(rawQuery);
  if (!query) return true;
  const haystack = [
    event.title_en,
    event.title_es,
    event.title_sq,
    event.description_en,
    event.description_es,
    event.description_sq,
    event.location_en,
    event.location_es,
    event.location_sq,
    formatAreaLabel(event.area || ""),
    event.event_type,
    event.status
  ]
    .map((value) => normalizeSearchValue(value))
    .join(" ");
  return haystack.includes(query);
}

function statusLabel(status, count = 0) {
  if (status === "mixed") return "mixed";
  if (!count || count === 1) return status;
  return `${status} (${count})`;
}

function buildStatusBreakdown(events) {
  const counts = new Map();
  events.forEach((event) => {
    const status = event.status || "unknown";
    counts.set(status, (counts.get(status) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => (EVENT_STATUS_RANK[a[0]] ?? 99) - (EVENT_STATUS_RANK[b[0]] ?? 99))
    .map(([status, count]) => statusLabel(status, count));
}

function dateValue(value) {
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function summarizeSeries(events) {
  const sorted = [...events].sort((a, b) => dateValue(a.date_start) - dateValue(b.date_start));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const distinctTitles = [...new Set(sorted.map((event) => String(event.title_en || "").trim()).filter(Boolean))];
  const distinctAreas = [...new Set(sorted.map((event) => formatAreaLabel(event.area || "")).filter(Boolean))];
  const distinctTypes = [...new Set(sorted.map((event) => String(event.event_type || "").trim()).filter(Boolean))];
  const distinctStatuses = [...new Set(sorted.map((event) => String(event.status || "").trim()).filter(Boolean))];
  return {
    id: String(first.recurrence_group_id),
    kind: "series",
    events: sorted,
    title: distinctTitles.length === 1 ? distinctTitles[0] : `${distinctTitles[0] || "Recurring event"} +${distinctTitles.length - 1}`,
    subtitle: `${sorted.length} occurrences • ${buildStatusBreakdown(sorted).join(" • ")}`,
    status: distinctStatuses.length === 1 ? distinctStatuses[0] : "mixed",
    statusParts: buildStatusBreakdown(sorted),
    dateLabel: `${first.date_start ? new Date(first.date_start).toLocaleString() : "Unknown"}${last?.date_start && last.date_start !== first.date_start ? ` → ${new Date(last.date_start).toLocaleString()}` : ""}`,
    areaLabel: distinctAreas.length === 1 ? distinctAreas[0] : "Multiple areas",
    typeLabel: distinctTypes.length === 1 ? distinctTypes[0] : "Multiple types",
    posterUrl: safeUrl(first.event_image_url),
    isHighlighted: sorted.some((event) => event.is_highlighted),
    featureBlocked: sorted.every((event) => Boolean(event.feature_blocked)),
    featureBlockedCount: sorted.filter((event) => event.feature_blocked).length,
    selectedIds: sorted.map((event) => String(event.id)),
    canHighlight: sorted.every((event) => canFeatureEventArea(event.area, event.status, event.feature_blocked)),
    createdAt: Math.max(...sorted.map((event) => dateValue(event.created_at))),
    sortStatusRank: Math.min(...sorted.map((event) => EVENT_STATUS_RANK[event.status] ?? 99)),
    expanded: expandedSeriesIds.has(String(first.recurrence_group_id)),
    titleGroupKey: normalizeTitleGroupKey(distinctTitles[0] || "")
  };
}

function buildSingleEventEntry(event) {
  return {
    id: String(event.id),
    kind: "event",
    event,
    events: [event],
    title: event.title_en || "Untitled",
    subtitle: "",
    status: event.status || "",
    statusParts: [event.status || ""],
    dateLabel: event.date_start ? new Date(event.date_start).toLocaleString() : "",
    areaLabel: formatAreaLabel(event.area || ""),
    typeLabel: event.event_type || "",
    posterUrl: safeUrl(event.event_image_url),
    isHighlighted: Boolean(event.is_highlighted),
    featureBlocked: Boolean(event.feature_blocked),
    featureBlockedCount: event.feature_blocked ? 1 : 0,
    selectedIds: [String(event.id)],
    canHighlight: canFeatureEventArea(event.area, event.status, event.feature_blocked),
    createdAt: dateValue(event.created_at),
    sortStatusRank: EVENT_STATUS_RANK[event.status] ?? 99,
    titleGroupKey: normalizeTitleGroupKey(event.title_en || "")
  };
}

function sortReviewEntries(entries) {
  return entries.sort((a, b) => {
    const statusDiff = a.sortStatusRank - b.sortStatusRank;
    if (statusDiff !== 0) return statusDiff;
    const createdDiff = b.createdAt - a.createdAt;
    if (createdDiff !== 0) return createdDiff;
    return dateValue(a.events?.[0]?.date_start) - dateValue(b.events?.[0]?.date_start);
  });
}

function summarizeTitleGroup(entries) {
  const allEvents = entries.flatMap((entry) => entry.events || []);
  const sortedEvents = [...allEvents].sort((a, b) => dateValue(a.date_start) - dateValue(b.date_start));
  const first = sortedEvents[0];
  const last = sortedEvents[sortedEvents.length - 1];
  const distinctAreas = [...new Set(allEvents.map((event) => formatAreaLabel(event.area || "")).filter(Boolean))];
  const distinctTypes = [...new Set(allEvents.map((event) => String(event.event_type || "").trim()).filter(Boolean))];
  const title = entries[0]?.title || "Untitled";
  const titleKey = entries[0]?.titleGroupKey || normalizeTitleGroupKey(title);
  return {
    id: `title:${titleKey}`,
    kind: "title_group",
    title,
    subtitle: `${entries.length} row${entries.length === 1 ? "" : "s"} • ${allEvents.length} event${allEvents.length === 1 ? "" : "s"}`,
    status: entries.every((entry) => entry.status === entries[0].status) ? entries[0].status : "mixed",
    statusParts: buildStatusBreakdown(allEvents),
    dateLabel: `${first?.date_start ? new Date(first.date_start).toLocaleString() : "Unknown"}${last?.date_start && last.date_start !== first.date_start ? ` → ${new Date(last.date_start).toLocaleString()}` : ""}`,
    areaLabel: distinctAreas.length === 1 ? distinctAreas[0] : "Multiple areas",
    typeLabel: distinctTypes.length === 1 ? distinctTypes[0] : "Multiple types",
    posterUrl: entries.find((entry) => entry.posterUrl)?.posterUrl || "",
    isHighlighted: allEvents.some((event) => event.is_highlighted),
    featureBlocked: allEvents.every((event) => Boolean(event.feature_blocked)),
    featureBlockedCount: allEvents.filter((event) => event.feature_blocked).length,
    selectedIds: allEvents.map((event) => String(event.id)),
    canHighlight: allEvents.every((event) => canFeatureEventArea(event.area, event.status, event.feature_blocked)),
    createdAt: Math.max(...allEvents.map((event) => dateValue(event.created_at))),
    sortStatusRank: Math.min(...allEvents.map((event) => EVENT_STATUS_RANK[event.status] ?? 99)),
    expanded: expandedTitleGroupIds.has(titleKey),
    titleGroupKey: titleKey,
    childEntries: sortReviewEntries(entries)
  };
}

function buildReviewEntries(events) {
  const grouped = new Map();
  const baseEntries = [];
  events.forEach((event) => {
    const groupId = String(event.recurrence_group_id || "").trim();
    if (!groupId) {
      baseEntries.push(buildSingleEventEntry(event));
      return;
    }
    const list = grouped.get(groupId) || [];
    list.push(event);
    grouped.set(groupId, list);
  });

  grouped.forEach((groupEvents) => {
    if (groupEvents.length <= 1) {
      const [event] = groupEvents;
      baseEntries.push(buildSingleEventEntry(event));
      return;
    }
    baseEntries.push(summarizeSeries(groupEvents));
  });

  const titleGrouped = new Map();
  baseEntries.forEach((entry) => {
    const key = entry.titleGroupKey || normalizeTitleGroupKey(entry.title);
    const list = titleGrouped.get(key) || [];
    list.push(entry);
    titleGrouped.set(key, list);
  });

  const entries = [];
  titleGrouped.forEach((titleEntries) => {
    if (titleEntries.length > 1) {
      entries.push(summarizeTitleGroup(titleEntries));
    } else {
      entries.push(titleEntries[0]);
    }
  });

  return sortReviewEntries(entries);
}

function pageAllowed(pageId) {
  if (pageId === "event-queue-page") return hasRole("moderator");
  if (pageId === "event-editor-page") return hasRole("editor");
  if (pageId === "batch-page") return hasRole("editor");
  if (pageId === "users-page") return hasRole("editor");
  if (pageId === "settings-page") return hasRole("owner");
  return false;
}

function showTaskHub() {
  activeTaskPage = null;
  writeStoredTaskPage(null);
  taskHub.classList.remove("hidden");
  taskPages.forEach((page) => page.classList.add("hidden"));
}

function showTaskPage(pageId) {
  if (!pageAllowed(pageId)) return;
  activeTaskPage = pageId;
  writeStoredTaskPage(pageId);
  taskHub.classList.add("hidden");
  taskPages.forEach((page) => {
    page.classList.toggle("hidden", page.id !== pageId);
  });
}

function setStatus(element, message, kind = "info") {
  element.style.display = "block";
  element.textContent = message;
  element.classList.remove("success", "error");
  if (kind === "success") element.classList.add("success");
  if (kind === "error") element.classList.add("error");
  element.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

function toLocalInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function uploadEventImage(file, folder) {
  const safeName = sanitizeFilename(file.name || "poster.jpg");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await client.storage.from(EVENT_IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  const { data } = client.storage.from(EVENT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function api(path, options = {}) {
  const response = await fetch(`${ADMIN_API_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function publicApi(path, options = {}) {
  const response = await fetch(`${ADMIN_API_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

function inviteResultMessage(result) {
  const emailMessage = formatEmailResult(result?.email_result);
  if (result?.action_link) {
    return `${emailMessage} Share this invite link manually if needed: ${result.action_link}`;
  }
  if (result?.existing_user) {
    return `${emailMessage} Existing user can sign in at ${result.admin_url || `${ADMIN_API_URL}/admin/`}.`;
  }
  return emailMessage || `Access updated for ${result?.email || "user"}.`;
}

function availableRequestRoles() {
  return hasRole("owner") ? ["moderator", "editor", "owner"] : ["moderator"];
}

function formatEmailDiagnostics(diagnostics) {
  const lines = [
    `SMTP configured: ${diagnostics.configured ? "yes" : "no"}`,
    `Transport verified: ${diagnostics.transport_verified ? "yes" : "no"}`,
    `Host: ${diagnostics.host || "missing"}`,
    `Port: ${diagnostics.port || "missing"}`,
    `Secure: ${diagnostics.secure ? "true" : "false"}`,
    `From: ${diagnostics.from || "missing"}`,
    `Auth user: ${diagnostics.auth_user || "missing"}`,
    `Notify emails: ${(diagnostics.notify_emails || []).join(", ") || "missing"}`,
    `Admin redirect URL: ${diagnostics.admin_redirect_url || "missing"}`
  ];
  if (diagnostics.error) lines.push(`Error: ${diagnostics.error}`);
  return lines.join(" | ");
}

function formatEmailResult(emailResult, fallback = "No email attempt was made.") {
  if (!emailResult) return fallback;
  const recipients = (emailResult.recipients || []).join(", ") || "no recipients";
  if (emailResult.counts && Array.isArray(emailResult.attempts)) {
    const parts = [`Email summary — sent: ${emailResult.counts.sent}, skipped: ${emailResult.counts.skipped}, failed: ${emailResult.counts.failed}`];
    emailResult.attempts.forEach((attempt) => {
      const detail = `${attempt.status.toUpperCase()} to ${(attempt.recipients || []).join(", ") || "no recipients"}${attempt.error ? ` (${attempt.error})` : ""}`;
      parts.push(detail);
    });
    return parts.join(" | ");
  }
  return `Email ${String(emailResult.status || "unknown").toUpperCase()} to ${recipients}${emailResult.error ? ` (${emailResult.error})` : ""}`;
}

function applyRoleUi() {
  rolePill.textContent = `role: ${currentRole || "none"}`;

  taskButtons.forEach((button) => {
    const pageId = button.dataset.openPage || "";
    button.classList.toggle("hidden", !pageAllowed(pageId));
  });
  taskPages.forEach((page) => {
    page.classList.toggle("hidden", true);
  });
  if (activeTaskPage && pageAllowed(activeTaskPage)) {
    showTaskPage(activeTaskPage);
  } else {
    showTaskHub();
  }

  inviteForm.querySelector("select[name='role']").disabled = !hasRole("owner");
  if (emailDiagnosticsButton) emailDiagnosticsButton.disabled = !hasRole("owner");
  if (emailTestButton) emailTestButton.disabled = !hasRole("owner");
}

function setAuthUi(session) {
  const isAuthed = Boolean(session);
  loginGate.classList.toggle("hidden", isAuthed);
  protectedApp.classList.toggle("hidden", !isAuthed);
  if (!isAuthed) {
    adminCount.textContent = "0 events";
    adminTableBody.innerHTML = "";
    currentEvents = [];
    currentVisibleEventIds = [];
    selectedEventIds.clear();
    expandedSeriesIds.clear();
    expandedTitleGroupIds.clear();
    syncBulkSelectionUi();
    if (adminBulkStatus) adminBulkStatus.style.display = "none";
    usersTableBody.innerHTML = "";
    if (accessRequestsTableBody) accessRequestsTableBody.innerHTML = "";
    selectedId = null;
    currentRole = null;
    accessToken = null;
    currentAccessRequests = [];
    showTaskHub();
  }
}

async function ensureSession() {
  let session = null;
  let sessionError = null;

  try {
    const { data, error } = await client.auth.getSession();
    session = data?.session || null;
    if (error) sessionError = error;
  } catch (error) {
    sessionError = error;
  }

  if (!session) {
    try {
      const { data, error } = await client.auth.refreshSession();
      session = data?.session || null;
      if (error) sessionError = sessionError || error;
    } catch (error) {
      sessionError = sessionError || error;
    }
  }

  if (session) {
    lastKnownSession = session;
    accessToken = session.access_token;
    setAuthUi(session);
    return session;
  }

  if (sessionError && lastKnownSession?.access_token) {
    accessToken = lastKnownSession.access_token;
    setAuthUi(lastKnownSession);
    setStatus(loginStatus, "Session check had a brief hiccup. We kept your admin view in place.", "error");
    return lastKnownSession;
  }

  setAuthUi(null);
  return null;
}

async function loadRole() {
  if (!accessToken) return;
  try {
    const result = await api("/v1/me/role", { method: "GET" });
    currentRole = result?.role || null;
  } catch (error) {
    setStatus(loginStatus, error.message);
    currentRole = null;
  }
  applyRoleUi();
}

async function signIn(email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    setStatus(loginStatus, error.message, "error");
    return;
  }
  setStatus(loginStatus, "Signed in.", "success");
  const session = await ensureSession();
  if (!session) return;
  await loadRole();
  await loadEvents();
  await loadSettings();
  await loadUsers();
}

async function signOut() {
  writeStoredTaskPage(null);
  await client.auth.signOut();
  setStatus(loginStatus, "Signed out.", "success");
}

function fillEditForm(event) {
  selectedId = event.id;
  editForm.title_en.value = event.title_en || "";
  editForm.title_es.value = event.title_es || "";
  editForm.title_sq.value = event.title_sq || "";
  editForm.description_en.value = event.description_en || "";
  editForm.description_es.value = event.description_es || "";
  editForm.description_sq.value = event.description_sq || "";
  editForm.location_en.value = event.location_en || "";
  editForm.location_es.value = event.location_es || "";
  editForm.location_sq.value = event.location_sq || "";
  editForm.event_type.value = event.event_type || "";
  editForm.area.value = normalizeAreaValue(event.area) || "";
  editForm.event_language.value = (event.event_language || []).join(",");
  editForm.date_start.value = toLocalInputValue(event.date_start);
  editForm.date_end.value = toLocalInputValue(event.date_end);
  editForm.repeat_frequency.value = "none";
  editForm.repeat_until.value = "";
  editForm.status.value = event.status || "pending";
  editForm.is_highlighted.checked = Boolean(event.is_highlighted);
  editForm.feature_blocked.checked = Boolean(event.feature_blocked);
  editForm.price_type.value = event.price_type || "";
  editForm.price_min.value = event.price_min || "";
  editForm.price_max.value = event.price_max || "";
  editForm.currency.value = event.currency || "";
  editForm.ticket_url.value = event.ticket_url || "";
  editForm.event_image_url.value = event.event_image_url || "";
  editForm.admin_response_note.value = event.admin_response_note || "";
  syncEditHighlightAvailability();
}

function clearFormForNew() {
  selectedId = null;
  editForm.reset();
  editForm.repeat_frequency.value = "none";
  editForm.repeat_until.value = "";
  editForm.status.value = "approved";
  editForm.area.value = "Skanderbeg Square";
  editForm.is_highlighted.checked = false;
  editForm.feature_blocked.checked = false;
  editForm.price_type.value = "Paid";
  editForm.currency.value = "ALL";
  editForm.admin_response_note.value = "";
  syncEditHighlightAvailability();
  setStatus(editStatus, "Creating a new event.");
}

function toPayload(formData) {
  const status = formData.get("status") || "approved";
  const featureBlocked = formData.get("feature_blocked") === "on";
  return {
    title_en: formData.get("title_en") || "",
    title_es: formData.get("title_es") || null,
    title_sq: formData.get("title_sq") || null,
    description_en: formData.get("description_en") || "",
    description_es: formData.get("description_es") || null,
    description_sq: formData.get("description_sq") || null,
    location_en: formData.get("location_en") || null,
    location_es: formData.get("location_es") || null,
    location_sq: formData.get("location_sq") || null,
    event_type: formData.get("event_type") || "Community",
    area: formData.get("area") || "Skanderbeg Square",
    event_language: (formData.get("event_language") || "en")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    date_start: toIsoOrNull(formData.get("date_start")),
    date_end: toIsoOrNull(formData.get("date_end")),
    repeat_frequency: formData.get("repeat_frequency") || "none",
    repeat_until: formData.get("repeat_until") || null,
    status,
    feature_blocked: featureBlocked,
    is_highlighted: !featureBlocked && canFeatureEventArea(formData.get("area"), status, featureBlocked) && formData.get("is_highlighted") === "on",
    price_type: formData.get("price_type") || "Paid",
    price_min: formData.get("price_min") || null,
    price_max: formData.get("price_max") || null,
    currency: formData.get("currency") || "ALL",
    ticket_url: formData.get("ticket_url") || null,
    event_image_url: formData.get("event_image_url") || null,
    admin_response_note: formData.get("admin_response_note") || null
  };
}

function addByFrequency(date, frequency) {
  const next = new Date(date);
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}

function buildRecurringRows(payload) {
  const frequency = payload.repeat_frequency || "none";
  const untilRaw = payload.repeat_until;
  if (frequency === "none" || !untilRaw) {
    const single = { ...payload };
    delete single.repeat_frequency;
    delete single.repeat_until;
    return [single];
  }

  const start = new Date(payload.date_start);
  if (Number.isNaN(start.getTime())) return [];
  const end = payload.date_end ? new Date(payload.date_end) : null;
  const durationMs = end && !Number.isNaN(end.getTime()) ? end.getTime() - start.getTime() : null;
  const until = new Date(`${untilRaw}T23:59:59`);
  if (Number.isNaN(until.getTime()) || until < start) return [];

  const rows = [];
  let currentStart = new Date(start);
  let guard = 0;
  while (currentStart <= until && guard < 500) {
    const row = { ...payload };
    row.date_start = currentStart.toISOString();
    row.date_end = durationMs !== null ? new Date(currentStart.getTime() + durationMs).toISOString() : null;
    delete row.repeat_frequency;
    delete row.repeat_until;
    rows.push(row);
    currentStart = addByFrequency(currentStart, frequency);
    guard += 1;
  }
  const recurrenceGroupId = rows.length > 1 ? makeRecurrenceGroupId() : null;
  return rows.map((row) => ({
    ...row,
    recurrence_group_id: recurrenceGroupId
  }));
}

async function saveEvent(payload) {
  if (!hasRole("editor")) {
    setStatus(editStatus, "Editor or owner required.");
    return;
  }
  if (!payload.title_en || !payload.description_en || !payload.date_start) {
    setStatus(editStatus, "Title, description, and date_start are required.");
    return;
  }

  let query;
  if (selectedId) {
    const updatePayload = { ...payload };
    delete updatePayload.repeat_frequency;
    delete updatePayload.repeat_until;
    const duplicateConflicts = findDuplicateConflicts([{ ...updatePayload, id: selectedId }], { excludeIds: [selectedId] });
    if (duplicateConflicts.existingConflicts.length || duplicateConflicts.internalConflicts.length) {
      setStatus(editStatus, duplicateConflictMessage(duplicateConflicts), "error");
      return;
    }
    query = client.from("events").update(updatePayload).eq("id", selectedId);
  } else {
    const recurringRows = buildRecurringRows(payload).map((row) => ({ ...row, status: row.status || "approved" }));
    if (!recurringRows.length) {
      setStatus(editStatus, "Invalid recurring settings. Check repeat frequency and end date.");
      return;
    }
    const duplicateConflicts = findDuplicateConflicts(recurringRows);
    if (duplicateConflicts.existingConflicts.length || duplicateConflicts.internalConflicts.length) {
      setStatus(editStatus, duplicateConflictMessage(duplicateConflicts), "error");
      return;
    }
    query = client.from("events").insert(recurringRows);
  }

  const { error } = await query;
  if (error) {
    setStatus(editStatus, error.message, "error");
    return;
  }
  setStatus(editStatus, selectedId ? "Saved." : "Created recurring event set.", "success");
  await loadEvents();
}

async function updateStatus(id, status) {
  await sendReviewDecision(id, status);
}

async function performBulkReview(ids, status) {
  const eventIds = uniqueById(
    ids
      .map((id) => currentEvents.find((event) => String(event.id) === String(id)))
      .filter(Boolean)
  ).map((event) => String(event.id));
  if (!eventIds.length) {
    setStatus(adminBulkStatus, "Select at least one event first.", "error");
    return;
  }
  if (!hasRole("moderator")) {
    setStatus(adminBulkStatus, "Moderator or higher required.", "error");
    return;
  }

  try {
    const result = await api("/v1/events/review-bulk", {
      method: "POST",
      body: JSON.stringify({ event_ids: eventIds, status })
    });
    setStatus(
      adminBulkStatus,
      `Updated ${result?.updated_count || eventIds.length} event(s) to ${status}. | ${formatEmailResult(result?.email)}`,
      "success"
    );
    eventIds.forEach((id) => selectedEventIds.delete(String(id)));
    await loadEvents();
  } catch (error) {
    setStatus(adminBulkStatus, error.message, "error");
  }
}

async function performBulkHighlight(ids, isHighlighted) {
  const events = uniqueById(
    ids
      .map((id) => currentEvents.find((event) => String(event.id) === String(id)))
      .filter(Boolean)
  );
  if (!events.length) {
    setStatus(adminBulkStatus, "Select at least one event first.", "error");
    return;
  }
  if (!hasRole("moderator")) {
    setStatus(adminBulkStatus, "Moderator or higher required.", "error");
    return;
  }

  const eligible = isHighlighted
    ? events.filter((event) => canFeatureEventArea(event.area, event.status, event.feature_blocked))
    : events;
  if (!eligible.length) {
    setStatus(adminBulkStatus, "Only approved Tirana events can be highlighted.", "error");
    return;
  }

  const { error } = await client.from("events").update({ is_highlighted: isHighlighted }).in("id", eligible.map((event) => event.id));
  if (error) {
    setStatus(adminBulkStatus, error.message, "error");
    return;
  }

  setStatus(
    adminBulkStatus,
    `${isHighlighted ? "Highlighted" : "Unhighlighted"} ${eligible.length} event(s)${eligible.length !== events.length ? ` (${events.length - eligible.length} skipped)` : ""}.`,
    "success"
  );
  await loadEvents();
}

async function performFeatureBlock(ids, featureBlocked) {
  const events = uniqueById(
    ids
      .map((id) => currentEvents.find((event) => String(event.id) === String(id)))
      .filter(Boolean)
  );
  if (!events.length) {
    setStatus(adminBulkStatus, "Choose at least one event first.", "error");
    return;
  }
  if (!hasRole("moderator")) {
    setStatus(adminBulkStatus, "Moderator or higher required.", "error");
    return;
  }

  const patch = featureBlocked
    ? { feature_blocked: true, is_highlighted: false }
    : { feature_blocked: false };

  const { error } = await client.from("events").update(patch).in("id", events.map((event) => event.id));
  if (error) {
    setStatus(adminBulkStatus, error.message, "error");
    return;
  }

  setStatus(
    adminBulkStatus,
    `${featureBlocked ? "Blocked" : "Re-enabled"} featuring for ${events.length} event(s).`,
    "success"
  );
  await loadEvents();
}

async function performBulkDelete(ids) {
  const eventIds = uniqueById(
    ids
      .map((id) => currentEvents.find((event) => String(event.id) === String(id)))
      .filter(Boolean)
  ).map((event) => String(event.id));
  if (!eventIds.length) {
    setStatus(adminBulkStatus, "Select at least one event first.", "error");
    return;
  }
  if (!hasRole("editor")) {
    setStatus(adminBulkStatus, "Editor or owner required.", "error");
    return;
  }
  if (!window.confirm(`Delete ${eventIds.length} selected event${eventIds.length === 1 ? "" : "s"}? This cannot be undone.`)) {
    return;
  }

  const { error } = await client.from("events").delete().in("id", eventIds);
  if (error) {
    setStatus(adminBulkStatus, error.message, "error");
    return;
  }

  eventIds.forEach((id) => selectedEventIds.delete(String(id)));
  setStatus(adminBulkStatus, `Deleted ${eventIds.length} event(s).`, "success");
  await loadEvents();
}

async function toggleHighlight(id, isHighlighted) {
  if (!hasRole("moderator")) return;
  const targetEvent = currentEvents.find((event) => String(event.id) === String(id));
  if (isHighlighted && targetEvent && !canFeatureEventArea(targetEvent.area, targetEvent.status, targetEvent.feature_blocked)) {
    const reason = targetEvent.feature_blocked
      ? "This event is blocked from being featured."
      : "Only approved Tirana events can be featured on the public calendar.";
    setStatus(editStatus, reason, "error");
    return;
  }
  const { error } = await client.from("events").update({ is_highlighted: isHighlighted }).eq("id", id);
  if (error) {
    setStatus(editStatus, error.message, "error");
    return;
  }
  setStatus(editStatus, isHighlighted ? "Event highlighted." : "Event removed from highlights.", "success");
  await loadEvents();
}

async function prepareEditPayload() {
  const formData = new FormData(editForm);
  const selectedFile = formData.get("event_image_file");
  if (selectedFile && selectedFile.size > 0) {
    try {
      const uploadedUrl = await uploadEventImage(selectedFile, "admin");
      formData.set("event_image_url", uploadedUrl);
    } catch (uploadError) {
      setStatus(editStatus, `Image upload failed: ${uploadError.message}`, "error");
      return null;
    }
  }
  return toPayload(formData);
}

async function sendReviewDecision(id, status, options = {}) {
  if (!hasRole("moderator")) return;
  const { useFormNote = false } = options;
  let note = null;

  if (useFormNote) {
    if (!selectedId || selectedId !== id) {
      setStatus(editStatus, "Open the event in Edit first so we can include your email note.", "error");
      return;
    }
    const payload = await prepareEditPayload();
    if (!payload) return;
    await saveEvent(payload);
    note = payload.admin_response_note || null;
  }

  try {
    const result = await api(`/v1/events/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ status, note })
    });
    setStatus(editStatus, `Saved status update: ${status}. | ${formatEmailResult(result?.email)}`, "success");
    await loadEvents();
  } catch (error) {
    setStatus(editStatus, error.message, "error");
  }
}

async function deleteEvent(id) {
  if (!hasRole("editor")) return;
  const { error } = await client.from("events").delete().eq("id", id);
  if (error) {
    setStatus(editStatus, error.message, "error");
    return;
  }
  selectedEventIds.delete(String(id));
  setStatus(editStatus, "Event deleted.", "success");
  await loadEvents();
}

function renderTable() {
  adminTableBody.innerHTML = "";
  const filteredEvents = currentEvents.filter((event) => matchesAdminSearch(event, adminSearchQuery));
  const entries = buildReviewEntries(filteredEvents);
  currentVisibleEventIds = [...new Set(filteredEvents.map((event) => String(event.id)).filter(Boolean))];
  adminCount.textContent = adminSearchQuery
    ? `${filteredEvents.length} of ${currentEvents.length} events • ${entries.length} review row${entries.length === 1 ? "" : "s"}`
    : `${currentEvents.length} events • ${entries.length} review row${entries.length === 1 ? "" : "s"}`;

  function renderPoster(cell, posterUrl, alt) {
    if (posterUrl) {
      const image = document.createElement("img");
      image.className = "admin-poster-thumb";
      image.src = posterUrl;
      image.alt = alt || "Event poster";
      image.loading = "lazy";
      cell.appendChild(image);
      return;
    }
    const emptyPoster = document.createElement("span");
    emptyPoster.className = "admin-poster-empty";
    emptyPoster.textContent = "No image";
    cell.appendChild(emptyPoster);
  }

  function renderStatusCell(cell, entry) {
    const wrap = document.createElement("div");
    wrap.className = "admin-status-summary";
    (entry.statusParts || [entry.status]).forEach((statusPart) => {
      const pill = document.createElement("span");
      pill.className = "status-pill";
      pill.textContent = statusPart;
      wrap.appendChild(pill);
    });
    cell.appendChild(wrap);
  }

  function renderFeatureState(cell, entry) {
    const blockedCount = Number(entry.featureBlockedCount || 0);
    if (blockedCount > 0) {
      const blocked = document.createElement("span");
      blocked.className = "status-pill";
      blocked.textContent = blockedCount === (entry.selectedIds?.length || 0)
        ? "Blocked"
        : `${blockedCount} blocked`;
      cell.appendChild(blocked);
      return;
    }
    cell.innerHTML = entry.isHighlighted ? '<span class="status-pill">Yes</span>' : "—";
  }

  function createActionButton(label, onClick, secondary = false) {
    const button = document.createElement("button");
    button.textContent = label;
    if (secondary) button.className = "secondary";
    button.addEventListener("click", onClick);
    return button;
  }

  function renderActions(cell, entry) {
    const actions = document.createElement("div");
    actions.className = "admin-actions";
    const targetIds = entry.selectedIds || [];
    const bulkSuffix = entry.kind === "series" ? " all" : entry.kind === "title_group" ? " group" : "";

    if (entry.kind === "title_group") {
      actions.appendChild(createActionButton(
        entry.expanded ? "Collapse" : "Expand",
        () => {
          if (entry.expanded) expandedTitleGroupIds.delete(entry.titleGroupKey);
          else expandedTitleGroupIds.add(entry.titleGroupKey);
          renderTable();
        },
        true
      ));
    }

    if (entry.kind === "series") {
      actions.appendChild(createActionButton(
        entry.expanded ? "Regroup" : "Break apart",
        () => {
          if (entry.expanded) expandedSeriesIds.delete(entry.id);
          else expandedSeriesIds.add(entry.id);
          renderTable();
        },
        true
      ));
    }

    if (hasRole("moderator")) {
      actions.appendChild(createActionButton(`Approve${bulkSuffix}`, () => performBulkReview(targetIds, "approved")));
      actions.appendChild(createActionButton(`Pending${bulkSuffix}`, () => performBulkReview(targetIds, "pending"), true));
      actions.appendChild(createActionButton(`Deny${bulkSuffix}`, () => performBulkReview(targetIds, "denied"), true));
      actions.appendChild(createActionButton(`Needs info${bulkSuffix}`, () => performBulkReview(targetIds, "needs_info"), true));

      if (entry.canHighlight || entry.isHighlighted) {
        actions.appendChild(createActionButton(
          entry.isHighlighted ? `Unhighlight${bulkSuffix}` : `Highlight${bulkSuffix}`,
          () => performBulkHighlight(targetIds, !entry.isHighlighted),
          true
        ));
      }

      actions.appendChild(createActionButton(
        entry.featureBlocked ? "Allow featured" : "Block featured",
        () => performFeatureBlock(targetIds, !entry.featureBlocked),
        true
      ));
    }

    if (entry.kind === "event" && hasRole("editor")) {
      actions.appendChild(createActionButton("Edit", () => {
        fillEditForm(entry.event);
        showTaskPage("event-editor-page");
      }, true));
    }

    if (hasRole("editor")) {
      actions.appendChild(createActionButton(entry.kind === "series" ? "Delete series" : "Delete", () => performBulkDelete(targetIds), true));
    }

    cell.appendChild(actions);
  }

  function renderEventRow(entry, { childLevel = 0, occurrenceIndex = 0, seriesLength = 0 } = {}) {
    const row = document.createElement("tr");
    if (childLevel > 0) {
      row.classList.add("admin-table-child");
      row.style.setProperty("--admin-indent-level", String(childLevel));
    }

    const selectCell = document.createElement("td");
    selectCell.className = "admin-table-select-cell";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const selectedCount = (entry.selectedIds || []).filter((id) => selectedEventIds.has(String(id))).length;
    checkbox.checked = entry.selectedIds.length > 0 && selectedCount === entry.selectedIds.length;
    checkbox.indeterminate = selectedCount > 0 && selectedCount < entry.selectedIds.length;
    checkbox.addEventListener("change", () => toggleSelectedEventIds(entry.selectedIds, checkbox.checked));
    selectCell.appendChild(checkbox);

    const posterCell = document.createElement("td");
    posterCell.className = "admin-poster-cell";
    renderPoster(posterCell, entry.posterUrl, entry.title);

    const titleCell = document.createElement("td");
    titleCell.className = "admin-title-cell";
    const titleWrap = document.createElement("div");
    titleWrap.className = "admin-event-title";
    const strong = document.createElement("strong");
    strong.textContent = entry.title || "Untitled";
    titleWrap.appendChild(strong);
    const subtitle = seriesLength
      ? `Occurrence ${occurrenceIndex + 1} of ${seriesLength}`
      : entry.subtitle;
    if (subtitle) {
      const sub = document.createElement("span");
      sub.className = "admin-event-subtitle";
      sub.textContent = subtitle;
      titleWrap.appendChild(sub);
    }
    titleCell.appendChild(titleWrap);

    const statusCell = document.createElement("td");
    renderStatusCell(statusCell, entry);

    const highlightedCell = document.createElement("td");
    renderFeatureState(highlightedCell, entry);

    const dateCell = document.createElement("td");
    dateCell.textContent = entry.dateLabel || "";

    const areaCell = document.createElement("td");
    areaCell.textContent = entry.areaLabel || "";

    const typeCell = document.createElement("td");
    typeCell.textContent = entry.typeLabel || "";

    const actionsCell = document.createElement("td");
    actionsCell.className = "admin-actions-cell";
    renderActions(actionsCell, entry);

    row.append(selectCell, posterCell, titleCell, statusCell, highlightedCell, dateCell, areaCell, typeCell, actionsCell);
    adminTableBody.appendChild(row);
  }

  function renderEntry(entry, childLevel = 0) {
    renderEventRow(entry, { childLevel });
    if (entry.kind === "title_group" && entry.expanded) {
      entry.childEntries.forEach((childEntry) => renderEntry(childEntry, childLevel + 1));
      return;
    }
    if (entry.kind === "series" && entry.expanded) {
      entry.events.forEach((event, index) => {
        renderEventRow(buildSingleEventEntry(event), {
          childLevel: childLevel + 1,
          occurrenceIndex: index,
          seriesLength: entry.events.length
        });
      });
    }
  }

  entries.forEach((entry) => renderEntry(entry));

  syncBulkSelectionUi();
}

async function loadEvents() {
  const session = await ensureSession();
  if (!session) return;
  let result;
  try {
    result = await api(`/v1/events?ts=${Date.now()}`, { method: "GET" });
  } catch (error) {
    setStatus(loginStatus, `Load failed: ${error.message}`, "error");
    return;
  }
  const data = result?.events || [];
  currentEvents = (data || [])
    .map((event) => ({ ...event, area: normalizeAreaValue(event.area) }))
    .sort((a, b) => {
    const statusDiff = (EVENT_STATUS_RANK[a.status] ?? 99) - (EVENT_STATUS_RANK[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    const createdDiff = new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (createdDiff !== 0) return createdDiff;
    return new Date(a.date_start || 0) - new Date(b.date_start || 0);
  });
  const validGroupIds = new Set(currentEvents.map((event) => String(event.recurrence_group_id || "")).filter(Boolean));
  [...expandedSeriesIds].forEach((groupId) => {
    if (!validGroupIds.has(groupId)) expandedSeriesIds.delete(groupId);
  });
  const validTitleKeys = new Set(currentEvents.map((event) => normalizeTitleGroupKey(event.title_en || "")).filter(Boolean));
  [...expandedTitleGroupIds].forEach((titleKey) => {
    if (!validTitleKeys.has(titleKey)) expandedTitleGroupIds.delete(titleKey);
  });
  reconcileSelection();
  loginStatus.style.display = "none";
  renderTable();
}

async function loadUsers() {
  if (!hasRole("editor")) return;
  try {
    const result = await api("/v1/users", { method: "GET" });
    const users = result?.users || [];
    usersTableBody.innerHTML = "";
    users.forEach((user) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(user.email || "")}</td>
        <td>${escapeHtml(user.id)}</td>
        <td>${escapeHtml(user.role || "moderator")}</td>
        <td></td>
      `;
      const actions = row.querySelector("td:last-child");

      if (hasRole("moderator")) {
        const elevate = document.createElement("button");
        elevate.className = "secondary";
        elevate.textContent = "Elevate to editor";
        elevate.addEventListener("click", async () => {
          try {
            await api(`/v1/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ role: "editor" }) });
            setStatus(usersStatus, "Role updated.", "success");
            loadUsers();
          } catch (error) {
            setStatus(usersStatus, error.message, "error");
          }
        });
        actions.appendChild(elevate);
      }

      if (hasRole("owner")) {
        const roleSelect = document.createElement("select");
        ["moderator", "editor", "owner"].forEach((r) => {
          const opt = document.createElement("option");
          opt.value = r;
          opt.textContent = r;
          if (user.role === r) opt.selected = true;
          roleSelect.appendChild(opt);
        });
        roleSelect.addEventListener("change", async () => {
          try {
            await api(`/v1/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ role: roleSelect.value }) });
            setStatus(usersStatus, "Role updated.", "success");
            loadUsers();
          } catch (error) {
            setStatus(usersStatus, error.message, "error");
          }
        });
        actions.appendChild(roleSelect);
      }

      if (hasRole("editor")) {
        const remove = document.createElement("button");
        remove.className = "secondary";
        remove.textContent = "Remove user";
        remove.addEventListener("click", async () => {
          try {
            await api(`/v1/users/${user.id}`, { method: "DELETE" });
            setStatus(usersStatus, "User removed.", "success");
            loadUsers();
          } catch (error) {
            setStatus(usersStatus, error.message, "error");
          }
        });
        actions.appendChild(remove);
      }

      usersTableBody.appendChild(row);
    });

    await loadAccessRequests();
  } catch (error) {
    setStatus(usersStatus, error.message);
  }
}

function renderAccessRequests() {
  if (!accessRequestsTableBody) return;
  accessRequestsTableBody.innerHTML = "";

  currentAccessRequests.forEach((request) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(request.name || "—")}</td>
      <td>${escapeHtml(request.email || "")}</td>
      <td>${escapeHtml(request.requested_role || "moderator")}</td>
      <td>${escapeHtml(request.note || "—")}</td>
      <td><span class="status-pill">${escapeHtml(request.status || "pending")}</span></td>
      <td>${escapeHtml(request.created_at ? new Date(request.created_at).toLocaleString() : "")}</td>
      <td></td>
    `;

    const actions = row.querySelector("td:last-child");
    const roleSelect = document.createElement("select");
    availableRequestRoles().forEach((role) => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = role;
      option.selected = (request.requested_role || "moderator") === role;
      roleSelect.appendChild(option);
    });
    roleSelect.disabled = request.status === "approved";
    actions.appendChild(roleSelect);

    const approve = document.createElement("button");
    approve.textContent = request.status === "approved" ? "Approved" : "Approve";
    approve.disabled = request.status === "approved";
    approve.addEventListener("click", async () => {
      try {
        const result = await api(`/v1/admin-access-requests/${request.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "approved", role: roleSelect.value })
        });
        const invite = result?.invite || {};
        const pieces = [
          `Approved request for ${request.email}.`,
          formatEmailResult(invite.email, "No invite email result returned.")
        ];
        if (invite.action_link) pieces.push(`Manual invite link: ${invite.action_link}`);
        setStatus(usersStatus, pieces.join(" | "), "success");
        await loadUsers();
      } catch (error) {
        setStatus(usersStatus, error.message, "error");
      }
    });
    actions.appendChild(approve);

    const deny = document.createElement("button");
    deny.className = "secondary";
    deny.textContent = "Deny";
    deny.disabled = request.status === "denied";
    deny.addEventListener("click", async () => {
      try {
        const result = await api(`/v1/admin-access-requests/${request.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "denied" })
        });
        setStatus(usersStatus, `Denied access request for ${request.email}. | ${formatEmailResult(result?.email)}`, "success");
        await loadUsers();
      } catch (error) {
        setStatus(usersStatus, error.message, "error");
      }
    });
    actions.appendChild(deny);

    accessRequestsTableBody.appendChild(row);
  });
}

async function loadAccessRequests() {
  if (!hasRole("editor")) return;
  try {
    const result = await api("/v1/admin-access-requests", { method: "GET" });
    currentAccessRequests = result?.requests || [];
    renderAccessRequests();
  } catch (error) {
    setStatus(usersStatus, error.message, "error");
  }
}

async function loadSettings() {
  if (!hasRole("owner")) return;
  const { data, error } = await client.from("site_settings").select("*").eq("id", 1).maybeSingle();
  if (error) {
    setStatus(settingsStatus, `Settings load failed: ${error.message}`, "error");
    settingsLoaded = false;
    return;
  }
  currentSettings = data || { id: 1 };
  settingsLoaded = true;
  activeTextKey = textSettingKey.value || "hero_title";
  loadTextInputsFromSettings(activeTextKey);
  settingsForm.featured_placeholder_image_url.value = currentSettings.featured_placeholder_image_url || "";
  const theme = currentSettings.widget_theme || {};
  settingsForm.theme_bg.value = theme.bg || "";
  settingsForm.theme_surface.value = theme.surface || "";
  settingsForm.theme_text.value = theme.text || "";
  settingsForm.theme_muted.value = theme.muted || "";
  settingsForm.theme_brand.value = theme.brand || "";
  settingsForm.theme_border.value = theme.border || "";
  settingsForm.theme_title_font.value = theme.titleFont || "";
  settingsForm.theme_body_font.value = theme.bodyFont || "";
  settingsForm.theme_hero_align.value = theme.heroAlign || "";
  settingsForm.theme_featured_position.value = theme.featuredPosition || "";
  settingsForm.theme_featured_cols_desktop.value = theme.featuredColsDesktop || "";
  settingsForm.theme_featured_cols_mobile.value = theme.featuredColsMobile || "";
}

function loadTextInputsFromSettings(baseKey) {
  settingsForm.text_value_en.value = currentSettings[`${baseKey}_en`] || "";
  settingsForm.text_value_es.value = currentSettings[`${baseKey}_es`] || "";
  settingsForm.text_value_sq.value = currentSettings[`${baseKey}_sq`] || "";
}

function saveTextInputsToSettings(baseKey) {
  currentSettings[`${baseKey}_en`] = settingsForm.text_value_en.value || null;
  currentSettings[`${baseKey}_es`] = settingsForm.text_value_es.value || null;
  currentSettings[`${baseKey}_sq`] = settingsForm.text_value_sq.value || null;
}

function updateBatchRowCount() {
  const count = batchRowsBody.querySelectorAll("tr").length;
  batchRowCount.textContent = `${count} / ${MAX_BATCH_ROWS} rows`;
}

function createBatchCell(type, className, placeholder = "", required = false) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = type;
  input.className = className;
  if (placeholder) input.placeholder = placeholder;
  if (required) input.required = true;
  td.appendChild(input);
  return td;
}

function createBatchSelectCell(className, options, placeholder = "", required = false) {
  const td = document.createElement("td");
  const select = document.createElement("select");
  select.className = className;
  if (required) select.required = true;
  populateGroupedSelect(select, options, placeholder);
  td.appendChild(select);
  return td;
}

function createBatchCheckboxCell(className) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = className;
  td.appendChild(input);
  return td;
}

function addBatchRow(prefill = {}) {
  const currentCount = batchRowsBody.querySelectorAll("tr").length;
  if (currentCount >= MAX_BATCH_ROWS) return;

  const row = document.createElement("tr");
  row.innerHTML = `<td class="batch-row-index"></td>`;
  row.appendChild(createBatchCell("text", "batch-title", "Title", true));
  row.appendChild(createBatchCell("text", "batch-description", "Description", true));
  row.appendChild(createBatchCell("text", "batch-location", "Location", true));
  row.appendChild(createBatchCell("text", "batch-type", "Type", true));
  row.appendChild(createBatchSelectCell("batch-area", AREA_GROUPS, "Choose area", true));
  row.appendChild(createBatchCell("datetime-local", "batch-date-start", "", true));
  row.appendChild(createBatchCell("datetime-local", "batch-date-end", "", true));
  row.appendChild(createBatchCell("text", "batch-languages", "en,sq", true));
  row.appendChild(createBatchCell("text", "batch-price-type", "Paid", true));
  row.appendChild(createBatchCell("number", "batch-price-min", "0", true));
  row.appendChild(createBatchCell("number", "batch-price-max", "0", true));
  row.appendChild(createBatchCell("text", "batch-currency", "ALL", true));
  row.appendChild(createBatchCell("text", "batch-status", "approved", true));
  row.appendChild(createBatchCheckboxCell("batch-highlighted"));
  row.appendChild(createBatchCell("url", "batch-ticket-url", "https://...", true));
  row.appendChild(createBatchCell("url", "batch-image-url", "https://...", false));

  const fileTd = document.createElement("td");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.className = "batch-image-file";
  fileInput.accept = "image/*";
  fileTd.appendChild(fileInput);
  row.appendChild(fileTd);

  const actionTd = document.createElement("td");
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    reindexBatchRows();
  });
  actionTd.appendChild(removeButton);
  row.appendChild(actionTd);

  batchRowsBody.appendChild(row);

  row.querySelector(".batch-title").value = prefill.title_en || "";
  row.querySelector(".batch-description").value = prefill.description_en || "";
  row.querySelector(".batch-location").value = prefill.location_en || "";
  row.querySelector(".batch-type").value = prefill.event_type || "";
  row.querySelector(".batch-area").value = prefill.area || "";
  row.querySelector(".batch-date-start").value = toLocalInputValue(prefill.date_start);
  row.querySelector(".batch-date-end").value = toLocalInputValue(prefill.date_end);
  row.querySelector(".batch-languages").value = prefill.event_language || "en";
  row.querySelector(".batch-price-type").value = prefill.price_type || "Paid";
  row.querySelector(".batch-price-min").value = prefill.price_min || "0";
  row.querySelector(".batch-price-max").value = prefill.price_max || "0";
  row.querySelector(".batch-currency").value = prefill.currency || "ALL";
  row.querySelector(".batch-status").value = prefill.status || "approved";
  row.querySelector(".batch-highlighted").checked = Boolean(prefill.is_highlighted);
  row.querySelector(".batch-ticket-url").value = prefill.ticket_url || "";
  row.querySelector(".batch-image-url").value = prefill.event_image_url || "";

  reindexBatchRows();
}

function reindexBatchRows() {
  Array.from(batchRowsBody.querySelectorAll("tr")).forEach((row, index) => {
    row.querySelector(".batch-row-index").textContent = String(index + 1);
  });
  updateBatchRowCount();
}

function rowIsEmpty(row) {
  const textValues = [
    ".batch-title",
    ".batch-description",
    ".batch-location",
    ".batch-type",
    ".batch-area",
    ".batch-date-start",
    ".batch-date-end",
    ".batch-languages",
    ".batch-price-type",
    ".batch-price-min",
    ".batch-price-max",
    ".batch-currency",
    ".batch-status",
    ".batch-ticket-url",
    ".batch-image-url"
  ].map((selector) => (row.querySelector(selector)?.value || "").trim());
  const hasText = textValues.some((value) => value.length > 0);
  const file = row.querySelector(".batch-image-file")?.files?.[0];
  return !hasText && !file;
}

function collectBatchRowPayload(row) {
  const title_en = (row.querySelector(".batch-title")?.value || "").trim();
  const description_en = (row.querySelector(".batch-description")?.value || "").trim();
  const location_en = (row.querySelector(".batch-location")?.value || "").trim();
  const event_type = (row.querySelector(".batch-type")?.value || "").trim();
  const area = (row.querySelector(".batch-area")?.value || "").trim();
  const date_start = toIsoOrNull(row.querySelector(".batch-date-start")?.value || "");
  const date_end = toIsoOrNull(row.querySelector(".batch-date-end")?.value || "");
  const languages = (row.querySelector(".batch-languages")?.value || "").trim();
  const price_type = (row.querySelector(".batch-price-type")?.value || "").trim();
  const price_min = (row.querySelector(".batch-price-min")?.value || "").trim();
  const price_max = (row.querySelector(".batch-price-max")?.value || "").trim();
  const currency = (row.querySelector(".batch-currency")?.value || "").trim();
  const status = (row.querySelector(".batch-status")?.value || "").trim();
  const is_highlighted = Boolean(row.querySelector(".batch-highlighted")?.checked);
  const ticket_url = (row.querySelector(".batch-ticket-url")?.value || "").trim();
  const event_image_url = (row.querySelector(".batch-image-url")?.value || "").trim();
  const event_image_file = row.querySelector(".batch-image-file")?.files?.[0] || null;

  const requiredValues = [title_en, description_en, location_en, event_type, area, date_start, date_end, languages, price_type, price_min, price_max, currency, status, ticket_url];
  const missingRequired = requiredValues.some((value) => !value);

  return {
    missingRequired,
    event_image_file,
    payload: {
      title_en,
      description_en,
      location_en,
      event_type,
      area,
      date_start,
      date_end,
      event_language: languages.split(",").map((v) => v.trim()).filter(Boolean),
      price_type,
      price_min: price_min || null,
      price_max: price_max || null,
      currency,
      status,
      is_highlighted: canFeatureEventArea(area, status) ? is_highlighted : false,
      ticket_url,
      event_image_url: event_image_url || null
    }
  };
}

async function batchInsertRows() {
  if (!hasRole("editor")) {
    setStatus(batchStatus, "Editor or owner required.", "error");
    return;
  }

  const rows = Array.from(batchRowsBody.querySelectorAll("tr"));
  const nonEmptyRows = rows.filter((row) => !rowIsEmpty(row));
  if (!nonEmptyRows.length) {
    setStatus(batchStatus, "Add at least one event row.", "error");
    return;
  }

  const inserts = [];
  const invalidIndexes = [];
  for (let i = 0; i < nonEmptyRows.length; i += 1) {
    const row = nonEmptyRows[i];
    const rowNumber = Number(row.querySelector(".batch-row-index")?.textContent || i + 1);
    const { missingRequired, event_image_file, payload } = collectBatchRowPayload(row);
    if (missingRequired) {
      invalidIndexes.push(rowNumber);
      continue;
    }
    if (event_image_file) {
      try {
        payload.event_image_url = await uploadEventImage(event_image_file, "batch");
      } catch (uploadError) {
        setStatus(batchStatus, `Image upload failed on row ${rowNumber}: ${uploadError.message}`, "error");
        return;
      }
    }
    inserts.push(payload);
  }

  if (invalidIndexes.length) {
    setStatus(batchStatus, `Missing required fields on row(s): ${invalidIndexes.join(", ")}`, "error");
    return;
  }

  const duplicateConflicts = findDuplicateConflicts(inserts);
  if (duplicateConflicts.existingConflicts.length || duplicateConflicts.internalConflicts.length) {
    setStatus(batchStatus, duplicateConflictMessage(duplicateConflicts), "error");
    return;
  }

  const { error } = await client.from("events").insert(inserts);
  if (error) {
    setStatus(batchStatus, error.message, "error");
    return;
  }

  setStatus(batchStatus, `Save successful. Inserted ${inserts.length} event(s).`, "success");
  await loadEvents();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  await signIn(formData.get("email"), formData.get("password"));
});

logoutButton.addEventListener("click", signOut);
refreshButton.addEventListener("click", loadEvents);
adminSearchInput?.addEventListener("input", (event) => {
  adminSearchQuery = event.target.value || "";
  renderTable();
});
adminSelectAll?.addEventListener("change", () => {
  toggleSelectedEventIds(visibleEventIds(), adminSelectAll.checked);
});
bulkApproveButton?.addEventListener("click", () => performBulkReview([...selectedEventIds], "approved"));
bulkPendingButton?.addEventListener("click", () => performBulkReview([...selectedEventIds], "pending"));
bulkDenyButton?.addEventListener("click", () => performBulkReview([...selectedEventIds], "denied"));
bulkNeedsInfoButton?.addEventListener("click", () => performBulkReview([...selectedEventIds], "needs_info"));
bulkHighlightButton?.addEventListener("click", () => performBulkHighlight([...selectedEventIds], true));
bulkUnhighlightButton?.addEventListener("click", () => performBulkHighlight([...selectedEventIds], false));
bulkDeleteButton?.addEventListener("click", () => performBulkDelete([...selectedEventIds]));
taskButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const pageId = button.dataset.openPage || "";
    showTaskPage(pageId);
    if (pageId === "event-queue-page") await loadEvents();
    if (pageId === "users-page") await loadUsers();
    if (pageId === "settings-page") await loadSettings();
  });
});
hubBackButtons.forEach((button) => {
  button.addEventListener("click", () => showTaskHub());
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = await prepareEditPayload();
  if (!payload) return;
  await saveEvent(payload);
});

batchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await batchInsertRows();
});

batchAddRowButton.addEventListener("click", () => addBatchRow());
batchAddTenButton.addEventListener("click", () => {
  for (let i = 0; i < 10; i += 1) addBatchRow();
});
batchFillFiftyButton.addEventListener("click", () => {
  while (batchRowsBody.querySelectorAll("tr").length < MAX_BATCH_ROWS) {
    addBatchRow();
  }
});

accessRequestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(accessRequestForm);
  try {
    const result = await publicApi("/v1/admin-access-requests", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        requested_role: formData.get("requested_role"),
        note: formData.get("note")
      })
    });
    const receipt = result?.email?.requester_receipt;
    setStatus(accessRequestStatus, `Request sent. ${formatEmailResult(receipt, "We’ll email you after review.")}`, "success");
    accessRequestForm.reset();
  } catch (error) {
    setStatus(accessRequestStatus, error.message, "error");
  }
});

emailDiagnosticsButton?.addEventListener("click", async () => {
  if (!hasRole("owner")) {
    setStatus(emailDiagnosticsStatus, "Owner required.", "error");
    return;
  }
  try {
    const result = await api("/v1/email-diagnostics", { method: "GET" });
    setStatus(emailDiagnosticsStatus, formatEmailDiagnostics(result?.diagnostics || {}), (result?.diagnostics?.transport_verified ? "success" : "error"));
  } catch (error) {
    setStatus(emailDiagnosticsStatus, error.message, "error");
  }
});

emailTestButton?.addEventListener("click", async () => {
  if (!hasRole("owner")) {
    setStatus(emailDiagnosticsStatus, "Owner required.", "error");
    return;
  }
  try {
    const result = await api("/v1/email-test", {
      method: "POST",
      body: JSON.stringify({})
    });
    setStatus(emailDiagnosticsStatus, formatEmailResult(result?.email, "No test email result returned."), result?.ok ? "success" : "error");
  } catch (error) {
    setStatus(emailDiagnosticsStatus, error.message, "error");
  }
});

inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!hasRole("editor")) {
    setStatus(usersStatus, "Editor or owner required.");
    return;
  }
  const formData = new FormData(inviteForm);
  const role = formData.get("role");
  if (!hasRole("owner") && role !== "moderator") {
    setStatus(usersStatus, "Only owner can assign editor/owner during invite.");
    return;
  }
  try {
    const result = await api("/v1/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: formData.get("email"), role })
    });
    setStatus(usersStatus, inviteResultMessage(result), "success");
    inviteForm.reset();
    inviteForm.querySelector("select[name='role']").value = "moderator";
    loadUsers();
  } catch (error) {
    setStatus(usersStatus, error.message, "error");
  }
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!hasRole("editor")) {
    setStatus(usersStatus, "Editor or owner required.");
    return;
  }
  const formData = new FormData(resetForm);
  try {
    const result = await api(`/v1/users/${formData.get("user_id")}/reset`, { method: "POST" });
    setStatus(usersStatus, `Reset link generated: ${result.action_link}`, "success");
  } catch (error) {
    setStatus(usersStatus, error.message, "error");
  }
});

textSettingKey.addEventListener("change", () => {
  if (!settingsLoaded) return;
  saveTextInputsToSettings(activeTextKey);
  activeTextKey = textSettingKey.value;
  loadTextInputsFromSettings(activeTextKey);
});

document.querySelectorAll(".hex-swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    const target = swatch.dataset.colorTarget;
    const color = swatch.dataset.color;
    if (!target || !color) return;
    const input = settingsForm.querySelector(`[name='${target}']`);
    if (input) input.value = color;
  });
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!hasRole("owner")) {
    setStatus(settingsStatus, "Owner required.");
    return;
  }
  if (!settingsLoaded) {
    setStatus(settingsStatus, "Settings not loaded yet. Refresh and try again.", "error");
    return;
  }
  const formData = new FormData(settingsForm);
  saveTextInputsToSettings(activeTextKey);
  const keepOrReplace = (name, fallback) => {
    const value = String(formData.get(name) || "").trim();
    return value || fallback || null;
  };

  let featuredPlaceholderImageUrl = keepOrReplace("featured_placeholder_image_url", currentSettings.featured_placeholder_image_url);
  const selectedPlaceholderFile = formData.get("featured_placeholder_image_file");

  if (selectedPlaceholderFile && selectedPlaceholderFile.size > 0) {
    try {
      featuredPlaceholderImageUrl = await uploadEventImage(selectedPlaceholderFile, "settings");
    } catch (uploadError) {
      setStatus(settingsStatus, `Placeholder image upload failed: ${uploadError.message}`, "error");
      return;
    }
  }

  const currentTheme = currentSettings.widget_theme || {};
  const theme = {
    bg: keepOrReplace("theme_bg", currentTheme.bg),
    surface: keepOrReplace("theme_surface", currentTheme.surface),
    text: keepOrReplace("theme_text", currentTheme.text),
    muted: keepOrReplace("theme_muted", currentTheme.muted),
    brand: keepOrReplace("theme_brand", currentTheme.brand),
    border: keepOrReplace("theme_border", currentTheme.border),
    titleFont: keepOrReplace("theme_title_font", currentTheme.titleFont),
    bodyFont: keepOrReplace("theme_body_font", currentTheme.bodyFont),
    heroAlign: keepOrReplace("theme_hero_align", currentTheme.heroAlign),
    featuredPosition: keepOrReplace("theme_featured_position", currentTheme.featuredPosition),
    featuredColsDesktop: keepOrReplace("theme_featured_cols_desktop", currentTheme.featuredColsDesktop),
    featuredColsMobile: keepOrReplace("theme_featured_cols_mobile", currentTheme.featuredColsMobile)
  };

  const payload = {
    id: 1,
    hero_title_en: currentSettings.hero_title_en || null,
    hero_title_es: currentSettings.hero_title_es || null,
    hero_title_sq: currentSettings.hero_title_sq || null,
    hero_subtitle_en: currentSettings.hero_subtitle_en || null,
    hero_subtitle_es: currentSettings.hero_subtitle_es || null,
    hero_subtitle_sq: currentSettings.hero_subtitle_sq || null,
    featured_title_en: currentSettings.featured_title_en || null,
    featured_title_es: currentSettings.featured_title_es || null,
    featured_title_sq: currentSettings.featured_title_sq || null,
    featured_placeholder_image_url: featuredPlaceholderImageUrl,
    widget_theme: theme
  };
  const { error } = await client.from("site_settings").upsert(payload, { onConflict: "id" });
  if (error) {
    setStatus(settingsStatus, error.message, "error");
    return;
  }
  currentSettings = { ...currentSettings, ...payload };
  setStatus(settingsStatus, "Save successful.", "success");
});

newEventButton.addEventListener("click", (event) => {
  event.preventDefault();
  clearFormForNew();
});

approveEmailButton.addEventListener("click", async () => {
  if (!selectedId) {
    setStatus(editStatus, "Open an existing event before sending an approval email.", "error");
    return;
  }
  await sendReviewDecision(selectedId, "approved", { useFormNote: true });
});

denyEmailButton.addEventListener("click", async () => {
  if (!selectedId) {
    setStatus(editStatus, "Open an existing event before sending a rejection email.", "error");
    return;
  }
  await sendReviewDecision(selectedId, "denied", { useFormNote: true });
});

needsInfoEmailButton.addEventListener("click", async () => {
  if (!selectedId) {
    setStatus(editStatus, "Open an existing event before requesting more information.", "error");
    return;
  }
  await sendReviewDecision(selectedId, "needs_info", { useFormNote: true });
});

if (batchRowsBody.querySelectorAll("tr").length === 0) {
  addBatchRow();
}

populateGroupedSelect(editForm.area, AREA_GROUPS, "Choose area");
editForm.area.addEventListener("change", syncEditHighlightAvailability);
editForm.status.addEventListener("change", syncEditHighlightAvailability);
editForm.feature_blocked?.addEventListener("change", syncEditHighlightAvailability);
syncEditHighlightAvailability();

client.auth.onAuthStateChange(async (_evt, session) => {
  setAuthUi(session);
  if (session) {
    lastKnownSession = session;
    accessToken = session.access_token;
    await loadRole();
    await loadEvents();
    await loadSettings();
    await loadUsers();
  } else {
    lastKnownSession = null;
  }
});

window.addEventListener("pageshow", async (event) => {
  if (!event.persisted) return;
  const session = await ensureSession();
  if (session && (activeTaskPage === "event-queue-page" || !activeTaskPage)) {
    await loadEvents();
  }
});

document.addEventListener("visibilitychange", async () => {
  if (document.hidden) return;
  if (activeTaskPage !== "event-queue-page") return;
  const session = await ensureSession();
  if (session) {
    await loadEvents();
  }
});

window.addEventListener("beforeunload", () => {
  clearPersistedAuth();
});

ensureSession().then(async (session) => {
  if (session) {
    await loadRole();
    await loadEvents();
    await loadSettings();
    await loadUsers();
  }
});

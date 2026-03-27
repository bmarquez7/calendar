import { createClient } from "../shared/vendor.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, EVENT_IMAGE_BUCKET, ADMIN_API_URL } from "../shared/config.js";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginGate = document.getElementById("login-gate");
const protectedApp = document.getElementById("protected-app");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const logoutButton = document.getElementById("logout");
const rolePill = document.getElementById("role-pill");

const refreshButton = document.getElementById("refresh");
const adminCount = document.getElementById("admin-count");
const adminTableBody = document.querySelector("#admin-table tbody");

const editForm = document.getElementById("edit-form");
const editStatus = document.getElementById("edit-status");
const newEventButton = document.getElementById("new-event");

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
const inviteForm = document.getElementById("invite-form");
const resetForm = document.getElementById("reset-form");

const settingsSection = document.getElementById("settings-section");
const settingsForm = document.getElementById("settings-form");
const settingsStatus = document.getElementById("settings-status");
const textSettingKey = document.getElementById("text-setting-key");
const taskHub = document.getElementById("task-hub");
const taskPages = Array.from(document.querySelectorAll(".task-page"));
const taskButtons = Array.from(document.querySelectorAll("[data-open-page]"));
const hubBackButtons = Array.from(document.querySelectorAll("[data-back-to-hub]"));

let currentEvents = [];
let selectedId = null;
let currentRole = null;
let accessToken = null;
let activeTaskPage = null;
let settingsLoaded = false;
let currentSettings = { id: 1 };
let activeTextKey = "hero_title";
const MAX_BATCH_ROWS = 50;

const ROLE_RANK = {
  moderator: 1,
  editor: 2,
  owner: 3
};

const EVENT_STATUS_RANK = {
  pending: 0,
  approved: 1,
  denied: 2
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function hasRole(minRole) {
  if (!currentRole) return false;
  return ROLE_RANK[currentRole] >= ROLE_RANK[minRole];
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
  taskHub.classList.remove("hidden");
  taskPages.forEach((page) => page.classList.add("hidden"));
}

function showTaskPage(pageId) {
  if (!pageAllowed(pageId)) return;
  activeTaskPage = pageId;
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
}

function setAuthUi(session) {
  const isAuthed = Boolean(session);
  loginGate.classList.toggle("hidden", isAuthed);
  protectedApp.classList.toggle("hidden", !isAuthed);
  if (!isAuthed) {
    adminCount.textContent = "0 events";
    adminTableBody.innerHTML = "";
    usersTableBody.innerHTML = "";
    selectedId = null;
    currentRole = null;
    accessToken = null;
    showTaskHub();
  }
}

async function ensureSession() {
  const { data } = await client.auth.getSession();
  setAuthUi(data.session);
  if (data.session) {
    accessToken = data.session.access_token;
  }
  return data.session;
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
    setStatus(loginStatus, error.message);
    return;
  }
  setStatus(loginStatus, "Signed in.");
  const session = await ensureSession();
  if (!session) return;
  await loadRole();
  await loadEvents();
  await loadSettings();
  await loadUsers();
}

async function signOut() {
  await client.auth.signOut();
  setStatus(loginStatus, "Signed out.");
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
  editForm.area.value = event.area || "";
  editForm.event_language.value = (event.event_language || []).join(",");
  editForm.date_start.value = toLocalInputValue(event.date_start);
  editForm.date_end.value = toLocalInputValue(event.date_end);
  editForm.repeat_frequency.value = "none";
  editForm.repeat_until.value = "";
  editForm.status.value = event.status || "pending";
  editForm.is_highlighted.checked = Boolean(event.is_highlighted);
  editForm.price_type.value = event.price_type || "";
  editForm.price_min.value = event.price_min || "";
  editForm.price_max.value = event.price_max || "";
  editForm.currency.value = event.currency || "";
  editForm.ticket_url.value = event.ticket_url || "";
  editForm.event_image_url.value = event.event_image_url || "";
}

function clearFormForNew() {
  selectedId = null;
  editForm.reset();
  editForm.repeat_frequency.value = "none";
  editForm.repeat_until.value = "";
  editForm.status.value = "approved";
  editForm.is_highlighted.checked = false;
  editForm.price_type.value = "Paid";
  editForm.currency.value = "ALL";
  setStatus(editStatus, "Creating a new event.");
}

function toPayload(formData) {
  const status = formData.get("status") || "approved";
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
    is_highlighted: status === "approved" && formData.get("is_highlighted") === "on",
    price_type: formData.get("price_type") || "Paid",
    price_min: formData.get("price_min") || null,
    price_max: formData.get("price_max") || null,
    currency: formData.get("currency") || "ALL",
    ticket_url: formData.get("ticket_url") || null,
    event_image_url: formData.get("event_image_url") || null
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
  return rows;
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
    query = client.from("events").update(updatePayload).eq("id", selectedId);
  } else {
    const recurringRows = buildRecurringRows(payload).map((row) => ({ ...row, status: row.status || "approved" }));
    if (!recurringRows.length) {
      setStatus(editStatus, "Invalid recurring settings. Check repeat frequency and end date.");
      return;
    }
    query = client.from("events").insert(recurringRows);
  }

  const { error } = await query;
  if (error) {
    setStatus(editStatus, error.message);
    return;
  }
  setStatus(editStatus, selectedId ? "Saved." : "Created recurring event set.");
  await loadEvents();
}

async function updateStatus(id, status) {
  if (!hasRole("moderator")) return;
  const patch = { status };
  if (status !== "approved") patch.is_highlighted = false;
  const { error } = await client.from("events").update(patch).eq("id", id);
  if (error) {
    alert(error.message);
    return;
  }
  await loadEvents();
}

async function toggleHighlight(id, isHighlighted) {
  if (!hasRole("moderator")) return;
  const { error } = await client.from("events").update({ is_highlighted: isHighlighted }).eq("id", id);
  if (error) {
    alert(error.message);
    return;
  }
  await loadEvents();
}

async function deleteEvent(id) {
  if (!hasRole("editor")) return;
  const { error } = await client.from("events").delete().eq("id", id);
  if (error) {
    alert(error.message);
    return;
  }
  await loadEvents();
}

function renderTable() {
  adminTableBody.innerHTML = "";
  adminCount.textContent = `${currentEvents.length} events`;

  currentEvents.forEach((event) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(event.title_en || "Untitled")}</td>
      <td><span class="status-pill">${escapeHtml(event.status || "")}</span></td>
      <td>${event.is_highlighted ? '<span class="status-pill">Yes</span>' : "—"}</td>
      <td>${escapeHtml(event.date_start ? new Date(event.date_start).toLocaleString() : "")}</td>
      <td>${escapeHtml(event.area || "")}</td>
      <td>${escapeHtml(event.event_type || "")}</td>
      <td></td>
    `;

    const actionsCell = row.querySelector("td:last-child");

    if (hasRole("moderator")) {
      const approve = document.createElement("button");
      approve.textContent = "Approve";
      approve.addEventListener("click", () => updateStatus(event.id, "approved"));

      const hold = document.createElement("button");
      hold.textContent = "Pending";
      hold.className = "secondary";
      hold.addEventListener("click", () => updateStatus(event.id, "pending"));

      const deny = document.createElement("button");
      deny.textContent = "Deny";
      deny.className = "secondary";
      deny.addEventListener("click", () => updateStatus(event.id, "denied"));

      actionsCell.append(approve, hold, deny);

      if (event.status === "approved" || event.is_highlighted) {
        const highlight = document.createElement("button");
        highlight.textContent = event.is_highlighted ? "Unhighlight" : "Highlight";
        highlight.className = "secondary";
        highlight.addEventListener("click", () => toggleHighlight(event.id, !event.is_highlighted));
        actionsCell.appendChild(highlight);
      }
    }

    if (hasRole("editor")) {
      const edit = document.createElement("button");
      edit.textContent = "Edit";
      edit.className = "secondary";
      edit.addEventListener("click", () => {
        fillEditForm(event);
        showTaskPage("event-editor-page");
      });

      const remove = document.createElement("button");
      remove.textContent = "Delete";
      remove.className = "secondary";
      remove.addEventListener("click", () => deleteEvent(event.id));

      actionsCell.append(edit, remove);
    }

    adminTableBody.appendChild(row);
  });
}

async function loadEvents() {
  const session = await ensureSession();
  if (!session) return;
  const { data, error } = await client.from("events").select("*").order("date_start", { ascending: true });
  if (error) {
    setStatus(loginStatus, `Load failed: ${error.message}`);
    return;
  }
  currentEvents = (data || []).sort((a, b) => {
    const statusDiff = (EVENT_STATUS_RANK[a.status] ?? 99) - (EVENT_STATUS_RANK[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    const createdDiff = new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (createdDiff !== 0) return createdDiff;
    return new Date(a.date_start || 0) - new Date(b.date_start || 0);
  });
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
            setStatus(usersStatus, "Role updated.");
            loadUsers();
          } catch (error) {
            setStatus(usersStatus, error.message);
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
            setStatus(usersStatus, "Role updated.");
            loadUsers();
          } catch (error) {
            setStatus(usersStatus, error.message);
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
            setStatus(usersStatus, "User removed.");
            loadUsers();
          } catch (error) {
            setStatus(usersStatus, error.message);
          }
        });
        actions.appendChild(remove);
      }

      usersTableBody.appendChild(row);
    });
  } catch (error) {
    setStatus(usersStatus, error.message);
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
  row.appendChild(createBatchCell("text", "batch-area", "Area", true));
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
      is_highlighted: status === "approved" ? is_highlighted : false,
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
  const formData = new FormData(editForm);
  const selectedFile = formData.get("event_image_file");
  if (selectedFile && selectedFile.size > 0) {
    try {
      const uploadedUrl = await uploadEventImage(selectedFile, "admin");
      formData.set("event_image_url", uploadedUrl);
    } catch (uploadError) {
      setStatus(editStatus, `Image upload failed: ${uploadError.message}`);
      return;
    }
  }
  const payload = toPayload(formData);
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
    setStatus(usersStatus, `Invitation sent to ${result.email}.`);
    inviteForm.reset();
    loadUsers();
  } catch (error) {
    setStatus(usersStatus, error.message);
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
    setStatus(usersStatus, `Reset link generated: ${result.action_link}`);
  } catch (error) {
    setStatus(usersStatus, error.message);
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

if (batchRowsBody.querySelectorAll("tr").length === 0) {
  addBatchRow();
}

client.auth.onAuthStateChange(async (_evt, session) => {
  setAuthUi(session);
  if (session) {
    accessToken = session.access_token;
    await loadRole();
    await loadEvents();
    await loadSettings();
    await loadUsers();
  }
});

ensureSession().then(async (session) => {
  if (session) {
    await loadRole();
    await loadEvents();
    await loadSettings();
    await loadUsers();
  }
});

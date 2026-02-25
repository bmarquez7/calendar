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

const usersSection = document.getElementById("users-section");
const usersStatus = document.getElementById("users-status");
const usersTableBody = document.querySelector("#users-table tbody");
const inviteForm = document.getElementById("invite-form");
const resetForm = document.getElementById("reset-form");

const settingsSection = document.getElementById("settings-section");
const settingsForm = document.getElementById("settings-form");
const settingsStatus = document.getElementById("settings-status");
const taskHub = document.getElementById("task-hub");
const taskPages = Array.from(document.querySelectorAll(".task-page"));
const taskButtons = Array.from(document.querySelectorAll("[data-open-page]"));
const hubBackButtons = Array.from(document.querySelectorAll("[data-back-to-hub]"));

let currentEvents = [];
let selectedId = null;
let currentRole = null;
let accessToken = null;
let activeTaskPage = null;

const ROLE_RANK = {
  moderator: 1,
  editor: 2,
  owner: 3
};

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

function setStatus(element, message) {
  element.style.display = "block";
  element.textContent = message;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
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
  editForm.date_start.value = event.date_start ? event.date_start.slice(0, 16) : "";
  editForm.date_end.value = event.date_end ? event.date_end.slice(0, 16) : "";
  editForm.repeat_frequency.value = "none";
  editForm.repeat_until.value = "";
  editForm.status.value = event.status || "pending";
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
  editForm.price_type.value = "Paid";
  editForm.currency.value = "ALL";
  setStatus(editStatus, "Creating a new event.");
}

function toPayload(formData) {
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
    date_start: formData.get("date_start") || null,
    date_end: formData.get("date_end") || null,
    repeat_frequency: formData.get("repeat_frequency") || "none",
    repeat_until: formData.get("repeat_until") || null,
    status: formData.get("status") || "approved",
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
  const { error } = await client.from("events").update({ status }).eq("id", id);
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
      <td>${event.title_en || "Untitled"}</td>
      <td><span class="status-pill">${event.status}</span></td>
      <td>${event.date_start ? new Date(event.date_start).toLocaleString() : ""}</td>
      <td>${event.area || ""}</td>
      <td>${event.event_type || ""}</td>
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
  currentEvents = data || [];
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
        <td>${user.email || ""}</td>
        <td>${user.id}</td>
        <td>${user.role || "moderator"}</td>
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
    setStatus(settingsStatus, `Settings load failed: ${error.message}`);
    return;
  }
  if (!data) return;
  settingsForm.hero_title_en.value = data.hero_title_en || "";
  settingsForm.hero_title_es.value = data.hero_title_es || "";
  settingsForm.hero_title_sq.value = data.hero_title_sq || "";
  settingsForm.hero_subtitle_en.value = data.hero_subtitle_en || "";
  settingsForm.hero_subtitle_es.value = data.hero_subtitle_es || "";
  settingsForm.hero_subtitle_sq.value = data.hero_subtitle_sq || "";
  settingsForm.featured_title_en.value = data.featured_title_en || "";
  settingsForm.featured_title_es.value = data.featured_title_es || "";
  settingsForm.featured_title_sq.value = data.featured_title_sq || "";
  settingsForm.featured_placeholder_image_url.value = data.featured_placeholder_image_url || "";
}

function parseBatchLine(line) {
  const [
    title,
    description,
    location,
    event_type,
    area,
    date_start,
    date_end,
    languages,
    price_type,
    price_min,
    price_max,
    status,
    ticket_url,
    event_image_url
  ] = line.split("|").map((v) => v.trim());

  if (!title || !description || !event_type || !area || !date_start) return null;

  return {
    title_en: title,
    description_en: description,
    location_en: location || null,
    event_type,
    area,
    date_start,
    date_end: date_end || null,
    event_language: (languages || "en").split(",").map((v) => v.trim()).filter(Boolean),
    price_type: price_type || "Paid",
    price_min: price_min || null,
    price_max: price_max || null,
    status: status || "pending",
    currency: "ALL",
    ticket_url: ticket_url || null,
    event_image_url: event_image_url || null
  };
}

async function batchInsert(raw) {
  if (!hasRole("editor")) {
    setStatus(batchStatus, "Editor or owner required.");
    return;
  }
  const lines = raw.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  const mapped = lines.map(parseBatchLine);
  const validRows = mapped.filter(Boolean);
  const skipped = mapped.length - validRows.length;
  if (!validRows.length) {
    setStatus(batchStatus, "No valid rows found.");
    return;
  }
  const { error } = await client.from("events").insert(validRows);
  if (error) {
    setStatus(batchStatus, error.message);
    return;
  }
  setStatus(batchStatus, `Inserted ${validRows.length} events. Skipped ${skipped} invalid line(s).`);
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
  const formData = new FormData(batchForm);
  await batchInsert(formData.get("batch_rows") || "");
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

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!hasRole("owner")) {
    setStatus(settingsStatus, "Owner required.");
    return;
  }
  const formData = new FormData(settingsForm);
  let featuredPlaceholderImageUrl = formData.get("featured_placeholder_image_url") || null;
  const selectedPlaceholderFile = formData.get("featured_placeholder_image_file");

  if (selectedPlaceholderFile && selectedPlaceholderFile.size > 0) {
    try {
      featuredPlaceholderImageUrl = await uploadEventImage(selectedPlaceholderFile, "settings");
    } catch (uploadError) {
      setStatus(settingsStatus, `Placeholder image upload failed: ${uploadError.message}`);
      return;
    }
  }

  const payload = {
    id: 1,
    hero_title_en: formData.get("hero_title_en") || null,
    hero_title_es: formData.get("hero_title_es") || null,
    hero_title_sq: formData.get("hero_title_sq") || null,
    hero_subtitle_en: formData.get("hero_subtitle_en") || null,
    hero_subtitle_es: formData.get("hero_subtitle_es") || null,
    hero_subtitle_sq: formData.get("hero_subtitle_sq") || null,
    featured_title_en: formData.get("featured_title_en") || null,
    featured_title_es: formData.get("featured_title_es") || null,
    featured_title_sq: formData.get("featured_title_sq") || null,
    featured_placeholder_image_url: featuredPlaceholderImageUrl
  };
  const { error } = await client.from("site_settings").upsert(payload, { onConflict: "id" });
  if (error) {
    setStatus(settingsStatus, error.message);
    return;
  }
  setStatus(settingsStatus, "Page settings saved.");
});

newEventButton.addEventListener("click", (event) => {
  event.preventDefault();
  clearFormForNew();
});

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

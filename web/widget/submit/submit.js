import { createClient } from "../../shared/vendor.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, EVENT_IMAGE_BUCKET } from "../../shared/config.js";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_ROWS = 10;
const rowsBody = document.getElementById("public-batch-rows");
const rowCount = document.getElementById("public-batch-count");
const addRowButton = document.getElementById("public-batch-add");
const fillRowsButton = document.getElementById("public-batch-fill");
const submitButton = document.getElementById("public-batch-submit");
const statusBox = document.getElementById("public-batch-status");

const submitterName = document.getElementById("submitter-name");
const submitterEmail = document.getElementById("submitter-email");
const organizerName = document.getElementById("organizer-name");
const organizerEmail = document.getElementById("organizer-email");
const submitterNote = document.getElementById("submitter-note");

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

function createCell(type, className, required = false, placeholder = "") {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = type;
  input.className = className;
  if (required) input.required = true;
  if (placeholder) input.placeholder = placeholder;
  td.appendChild(input);
  return td;
}

function updateCount() {
  rowCount.textContent = `${rowsBody.querySelectorAll("tr").length} / ${MAX_ROWS} rows`;
}

function reindex() {
  Array.from(rowsBody.querySelectorAll("tr")).forEach((row, idx) => {
    row.querySelector(".row-index").textContent = String(idx + 1);
  });
  updateCount();
}

function addRow() {
  if (rowsBody.querySelectorAll("tr").length >= MAX_ROWS) return;
  const row = document.createElement("tr");
  row.innerHTML = `<td class="row-index"></td>`;
  row.appendChild(createCell("text", "title", true));
  row.appendChild(createCell("text", "description", true));
  row.appendChild(createCell("text", "location", true));
  row.appendChild(createCell("text", "event-type", true));
  row.appendChild(createCell("text", "area", true));
  row.appendChild(createCell("datetime-local", "date-start", true));
  row.appendChild(createCell("datetime-local", "date-end", true));
  row.appendChild(createCell("text", "languages", true, "en,sq"));
  row.appendChild(createCell("text", "price-type", true, "Paid"));
  row.appendChild(createCell("number", "price-min", true, "0"));
  row.appendChild(createCell("number", "price-max", true, "0"));
  row.appendChild(createCell("text", "currency", true, "ALL"));
  row.appendChild(createCell("url", "ticket-url", true, "https://..."));
  row.appendChild(createCell("url", "image-url", false, "https://..."));

  const fileTd = document.createElement("td");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.className = "image-file";
  fileInput.accept = "image/*";
  fileTd.appendChild(fileInput);
  row.appendChild(fileTd);

  const actionTd = document.createElement("td");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    row.remove();
    reindex();
  });
  actionTd.appendChild(remove);
  row.appendChild(actionTd);
  rowsBody.appendChild(row);
  row.querySelector(".price-type").value = "Paid";
  row.querySelector(".currency").value = "ALL";
  reindex();
}

function rowEmpty(row) {
  const hasValue = Array.from(row.querySelectorAll("input")).some((input) => input.type !== "file" && String(input.value || "").trim());
  const hasFile = row.querySelector(".image-file")?.files?.[0];
  return !hasValue && !hasFile;
}

function validateSubmitterInfo() {
  if (!submitterName.value.trim()) return "Submitter name is required.";
  if (!submitterEmail.value.trim()) return "Submitter email is required.";
  if (!organizerName.value.trim()) return "Organizer name is required.";
  if (!organizerEmail.value.trim()) return "Organizer email is required.";
  if (!submitterNote.value.trim()) return "Submitter note is required.";
  return "";
}

async function submitRows() {
  statusBox.style.display = "none";
  const submitterError = validateSubmitterInfo();
  if (submitterError) {
    setStatus(submitterError, "error");
    return;
  }

  const rows = Array.from(rowsBody.querySelectorAll("tr")).filter((row) => !rowEmpty(row));
  if (!rows.length) {
    setStatus("Add at least one event row.", "error");
    return;
  }

  const payloads = [];
  for (const row of rows) {
    const rowNo = row.querySelector(".row-index").textContent;
    const title = row.querySelector(".title").value.trim();
    const description = row.querySelector(".description").value.trim();
    const location = row.querySelector(".location").value.trim();
    const eventType = row.querySelector(".event-type").value.trim();
    const area = row.querySelector(".area").value.trim();
    const dateStart = toIsoOrNull(row.querySelector(".date-start").value.trim());
    const dateEnd = toIsoOrNull(row.querySelector(".date-end").value.trim());
    const languages = row.querySelector(".languages").value.trim();
    const priceType = row.querySelector(".price-type").value.trim();
    const priceMin = row.querySelector(".price-min").value.trim();
    const priceMax = row.querySelector(".price-max").value.trim();
    const currency = row.querySelector(".currency").value.trim();
    const ticketUrl = row.querySelector(".ticket-url").value.trim();
    const imageUrlInput = row.querySelector(".image-url").value.trim();
    const file = row.querySelector(".image-file")?.files?.[0] || null;

    const required = [title, description, location, eventType, area, dateStart, dateEnd, languages, priceType, priceMin, priceMax, currency, ticketUrl];
    if (required.some((v) => !v)) {
      setStatus(`Row ${rowNo} is missing required fields.`, "error");
      return;
    }

    let imageUrl = imageUrlInput || null;
    if (file) {
      try {
        imageUrl = await uploadImage(file);
      } catch (error) {
        setStatus(`Image upload failed on row ${rowNo}: ${error.message}`, "error");
        return;
      }
    }

    payloads.push({
      status: "pending",
      title_en: title,
      description_en: description,
      location_en: location,
      event_type: eventType,
      area,
      event_language: languages.split(",").map((v) => v.trim()).filter(Boolean),
      date_start: dateStart,
      date_end: dateEnd,
      price_type: priceType,
      price_min: priceMin,
      price_max: priceMax,
      currency,
      ticket_url: ticketUrl,
      event_image_url: imageUrl,
      organizer_name: organizerName.value.trim(),
      organizer_email: organizerEmail.value.trim(),
      submitter_name: submitterName.value.trim(),
      submitter_email: submitterEmail.value.trim(),
      submitter_note: submitterNote.value.trim()
    });
  }

  const { error } = await client.from("events").insert(payloads);
  if (error) {
    setStatus(error.message, "error");
    return;
  }

  setStatus(`Save successful. Submitted ${payloads.length} event(s) for approval.`, "success");
}

addRowButton.addEventListener("click", addRow);
fillRowsButton.addEventListener("click", () => {
  while (rowsBody.querySelectorAll("tr").length < MAX_ROWS) addRow();
});
submitButton.addEventListener("click", submitRows);

addRow();

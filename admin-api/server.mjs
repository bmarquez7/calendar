import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = Fastify({ logger: true });

const {
  PORT = "10000",
  HOST = "0.0.0.0",
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  APP_ORIGIN = "",
  OWNER_EMAIL = "",
  SMTP_HOST = "",
  SMTP_PORT = "587",
  SMTP_SECURE = "false",
  SMTP_USER = "",
  SMTP_PASS = "",
  SMTP_FROM = "",
  NOTIFY_EMAILS = ""
} = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  app.log.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ROLE_RANK = { moderator: 1, editor: 2, owner: 3 };
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const PAST_EVENT_RETENTION_MONTHS = 3;
const MAX_PUBLIC_SUBMISSION_EVENTS = 250;
const PUBLIC_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_RATE_LIMITS = {
  submissions: 12,
  accessRequests: 6,
  languageOptions: 20
};
const CUSTOM_LANGUAGE_LABEL_RE = /^[\p{L}\p{M}0-9 .,'’()\/&+-]{1,120}$/u;
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..", "web");
const appOrigin = normalizeOrigin(APP_ORIGIN);
let lastCleanupRunAt = 0;
let cleanupPromise = null;
const publicRateLimitState = new Map();
const emailRecipients = [...new Set((NOTIFY_EMAILS || OWNER_EMAIL || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean))];
const mailTransport = SMTP_HOST && SMTP_FROM
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: String(SMTP_SECURE).toLowerCase() === "true",
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
    })
  : null;

await app.register(cors, {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, Boolean(appOrigin && origin === appOrigin));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"]
});

await app.register(fastifyStatic, {
  root: webRoot,
  prefix: "/",
  index: false,
  setHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }
});

function normalizeOrigin(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  try {
    return new URL(input).origin;
  } catch {
    return "";
  }
}

function normalizeOptionalEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return null;
  return SIMPLE_EMAIL_RE.test(email) ? email : null;
}

function normalizePublicUrl(value) {
  const input = String(value || "").trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requestRateLimitKey(request, scope) {
  const forwardedFor = String(request.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const remote = forwardedFor || request.ip || request.socket?.remoteAddress || "unknown";
  return `${scope}:${remote}`;
}

function enforcePublicRateLimit(request, reply, scope, maxRequests) {
  const key = requestRateLimitKey(request, scope);
  const now = Date.now();
  const windowStart = now - PUBLIC_RATE_LIMIT_WINDOW_MS;
  if (publicRateLimitState.size > 5000) {
    for (const [storedKey, timestamps] of publicRateLimitState.entries()) {
      if (!timestamps.some((timestamp) => timestamp > windowStart)) {
        publicRateLimitState.delete(storedKey);
      }
    }
  }
  const attempts = (publicRateLimitState.get(key) || []).filter((timestamp) => timestamp > windowStart);
  if (attempts.length >= maxRequests) {
    reply
      .code(429)
      .header("Retry-After", String(Math.ceil(PUBLIC_RATE_LIMIT_WINDOW_MS / 1000)))
      .send({ error: "Too many requests. Please wait a few minutes and try again." });
    return false;
  }
  attempts.push(now);
  publicRateLimitState.set(key, attempts);
  return true;
}

async function getRole(user) {
  const { data, error } = await serviceClient
    .from("admin_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data?.role) return data.role;

  if (OWNER_EMAIL && String(user.email || "").toLowerCase() === String(OWNER_EMAIL).toLowerCase()) {
    const upsert = await serviceClient
      .from("admin_user_roles")
      .upsert({ user_id: user.id, email: user.email, role: "owner" }, { onConflict: "user_id" });
    if (upsert.error) throw upsert.error;
    return "owner";
  }

  return null;
}

function canRole(actorRole, minRole) {
  return (ROLE_RANK[actorRole] || 0) >= (ROLE_RANK[minRole] || 0);
}

function uniqueEmails(...values) {
  return [...new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))];
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLanguageKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildLanguageCode(label) {
  const normalized = normalizeLanguageKey(label)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "language";
  return `custom-${normalized}-${hashString(label).slice(0, 6)}`;
}

function uniqueImageUrls(featuredValue, galleryValues) {
  const urls = [];
  [featuredValue, ...toArray(galleryValues)]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => {
      if (!urls.includes(value)) urls.push(value);
    });
  return urls.slice(0, 5);
}

function normalizeSubmissionRow(row) {
  const eventImageUrls = uniqueImageUrls(
    normalizePublicUrl(row?.event_image_url),
    toArray(row?.event_image_urls).map((value) => normalizePublicUrl(value)).filter(Boolean)
  );
  return {
    status: "pending",
    title_en: String(row?.title_en || "").trim(),
    title_es: row?.title_es ? String(row.title_es).trim() : null,
    title_sq: row?.title_sq ? String(row.title_sq).trim() : null,
    description_en: String(row?.description_en || "").trim(),
    description_es: row?.description_es ? String(row.description_es).trim() : null,
    description_sq: row?.description_sq ? String(row.description_sq).trim() : null,
    location_en: row?.location_en ? String(row.location_en).trim() : null,
    location_es: row?.location_es ? String(row.location_es).trim() : null,
    location_sq: row?.location_sq ? String(row.location_sq).trim() : null,
    event_type: String(row?.event_type || "").trim(),
    area: String(row?.area || "").trim(),
    event_language: toArray(row?.event_language).map((value) => String(value).trim()).filter(Boolean),
    date_start: row?.date_start || null,
    date_end: row?.date_end || null,
    price_type: String(row?.price_type || "").trim(),
    price_min: normalizeOptionalNumber(row?.price_min),
    price_max: normalizeOptionalNumber(row?.price_max),
    currency: row?.currency ? String(row.currency).trim() : "ALL",
    ticket_url: normalizePublicUrl(row?.ticket_url),
    event_image_url: eventImageUrls[0] || null,
    event_image_urls: eventImageUrls.length ? eventImageUrls : null,
    recurrence_group_id: row?.recurrence_group_id ? String(row.recurrence_group_id).trim() : null,
    organizer_name: row?.organizer_name ? String(row.organizer_name).trim() : null,
    organizer_email: normalizeOptionalEmail(row?.organizer_email),
    submitter_name: row?.submitter_name ? String(row.submitter_name).trim() : null,
    submitter_email: normalizeOptionalEmail(row?.submitter_email),
    submitter_note: row?.submitter_note ? String(row.submitter_note).trim() : null,
    source_url: normalizePublicUrl(row?.source_url),
    is_highlighted: false
  };
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

function duplicateEventKey(row) {
  const dayKey = dateKeyInTirana(row?.date_start);
  const titleKey = normalizeDuplicateValue(row?.title_en);
  if (!dayKey || !titleKey) return "";
  const areaKey = normalizeDuplicateValue(row?.area);
  const locationKey = normalizeDuplicateValue(row?.location_en || row?.location_es || row?.location_sq || row?.area);
  return [dayKey, titleKey, areaKey, locationKey].join("|");
}

function duplicateEventLabel(row) {
  const title = String(row?.title_en || "Untitled").trim();
  const dayKey = dateKeyInTirana(row?.date_start) || "unknown date";
  const area = String(row?.area || "").trim();
  return area ? `${title} on ${dayKey} (${area})` : `${title} on ${dayKey}`;
}

async function findDuplicateEventConflicts(candidateRows, options = {}) {
  const filteredRows = candidateRows.filter((row) => (row?.status || "pending") !== "denied");
  if (!filteredRows.length) {
    return { existingConflicts: [], internalConflicts: [] };
  }

  const parsedDates = filteredRows
    .map((row) => new Date(row.date_start))
    .filter((date) => !Number.isNaN(date.getTime()));
  if (!parsedDates.length) {
    return { existingConflicts: [], internalConflicts: [] };
  }

  const minTime = Math.min(...parsedDates.map((date) => date.getTime())) - (24 * 60 * 60 * 1000);
  const maxTime = Math.max(...parsedDates.map((date) => date.getTime())) + (24 * 60 * 60 * 1000);
  const excludeIds = new Set((options.excludeIds || []).map((value) => String(value || "")).filter(Boolean));

  const listed = await serviceClient
    .from("events")
    .select("id, status, title_en, area, location_en, location_es, location_sq, date_start")
    .neq("status", "denied")
    .gte("date_start", new Date(minTime).toISOString())
    .lte("date_start", new Date(maxTime).toISOString());
  if (listed.error) throw listed.error;

  const existingByKey = new Map();
  (listed.data || [])
    .filter((row) => !excludeIds.has(String(row.id || "")))
    .forEach((row) => {
      const key = duplicateEventKey(row);
      if (key && !existingByKey.has(key)) existingByKey.set(key, row);
    });

  const existingConflicts = [];
  const internalConflicts = [];
  const seenKeys = new Map();

  filteredRows.forEach((row, index) => {
    const key = duplicateEventKey(row);
    if (!key) return;
    const existing = existingByKey.get(key);
    if (existing) existingConflicts.push({ index, row, existing });
    if (seenKeys.has(key)) internalConflicts.push({ index, row, firstIndex: seenKeys.get(key) });
    else seenKeys.set(key, index);
  });

  return { existingConflicts, internalConflicts };
}

function duplicateConflictErrorMessage(conflicts) {
  const parts = [];
  if (conflicts.existingConflicts.length) {
    parts.push(`Already exists: ${conflicts.existingConflicts.slice(0, 3).map(({ row }) => duplicateEventLabel(row)).join("; ")}`);
  }
  if (conflicts.internalConflicts.length) {
    parts.push(`Repeated in this submission: ${conflicts.internalConflicts.slice(0, 3).map(({ row }) => duplicateEventLabel(row)).join("; ")}`);
  }
  return `Duplicate same-day event detected. ${parts.join(" | ")}`.trim();
}

function validateSubmissionRow(row, index, sourceRow = {}) {
  if (row.title_en.length > 200) return `Event ${index + 1} title is too long.`;
  if (row.description_en.length > 2000) return `Event ${index + 1} description must be 2000 characters or fewer.`;
  if (String(row.location_en || "").length > 240) return `Event ${index + 1} address is too long.`;
  const required = [
    row.title_en,
    row.description_en,
    row.location_en,
    row.event_type,
    row.area,
    row.date_start,
    row.date_end,
    row.price_type,
    row.currency
  ];
  if (required.some((value) => !value)) {
    return `Event ${index + 1} is missing required fields.`;
  }
  if (!row.event_language.length) {
    return `Event ${index + 1} must include at least one language.`;
  }
  if (row.event_language.length > 12) {
    return `Event ${index + 1} can include up to 12 languages.`;
  }
  if (row.event_language.some((value) => String(value || "").trim().length > 120)) {
    return `Event ${index + 1} includes a language label that is too long.`;
  }
  if (row.event_language.some((value) => !CUSTOM_LANGUAGE_LABEL_RE.test(String(value || "").trim()))) {
    return `Event ${index + 1} includes a language label with unsupported characters.`;
  }
  if (String(row.organizer_name || "").length > 160) return `Event ${index + 1} organizer name is too long.`;
  if (String(row.submitter_name || "").length > 160) return `Event ${index + 1} submitter name is too long.`;
  if (String(row.submitter_note || "").length > 2000) return `Event ${index + 1} note for admin is too long.`;
  if (new Date(row.date_end).getTime() < new Date(row.date_start).getTime()) {
    return `Event ${index + 1} must end after it starts.`;
  }
  if (row.price_type !== "Free" && (row.price_min === null || row.price_min === "" || row.price_max === null || row.price_max === "")) {
    return `Event ${index + 1} needs min and max prices unless it is Free.`;
  }
  if (row.price_min !== null && row.price_min < 0) {
    return `Event ${index + 1} cannot have a negative minimum price.`;
  }
  if (row.price_max !== null && row.price_max < 0) {
    return `Event ${index + 1} cannot have a negative maximum price.`;
  }
  if (row.price_min !== null && row.price_max !== null && row.price_max < row.price_min) {
    return `Event ${index + 1} cannot have a maximum price lower than the minimum price.`;
  }
  if (toArray(row.event_image_urls).length > 5) {
    return `Event ${index + 1} can include up to 5 photos.`;
  }
  if (String(sourceRow?.event_image_url || "").trim() && !row.event_image_url && !toArray(row.event_image_urls).length) {
    return `Event ${index + 1} has an invalid image URL.`;
  }
  if (String(sourceRow?.ticket_url || "").trim() && !row.ticket_url) {
    return `Event ${index + 1} has an invalid ticket URL.`;
  }
  if (String(sourceRow?.source_url || "").trim() && !row.source_url) {
    return `Event ${index + 1} has an invalid website URL.`;
  }
  if (String(sourceRow?.organizer_email || "").trim() && !row.organizer_email) {
    return `Event ${index + 1} has an invalid organizer email.`;
  }
  if (String(sourceRow?.submitter_email || "").trim() && !row.submitter_email) {
    return `Event ${index + 1} has an invalid submitter email.`;
  }
  return "";
}

function recipientList(...values) {
  return [...new Set(values
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean))];
}

function buildEmailResult(status, recipients, subject, error = "") {
  return {
    status,
    recipients,
    subject: String(subject || ""),
    error: error ? String(error) : ""
  };
}

function mergeEmailResults(results = []) {
  const normalized = results.filter(Boolean);
  const counts = {
    sent: normalized.filter((result) => result.status === "sent").length,
    skipped: normalized.filter((result) => result.status === "skipped").length,
    failed: normalized.filter((result) => result.status === "failed").length
  };
  return {
    counts,
    attempts: normalized
  };
}

async function sendMailSafe(message) {
  const recipients = recipientList(message?.to, message?.cc, message?.bcc);
  const subject = String(message?.subject || "");

  if (!mailTransport || !SMTP_FROM) {
    const result = buildEmailResult("skipped", recipients, subject, "SMTP is not configured on the server.");
    app.log.warn({ mail: result }, "Email skipped");
    return result;
  }

  app.log.info({ mail: { recipients, subject } }, "Email send attempt");
  try {
    await mailTransport.sendMail(message);
    const result = buildEmailResult("sent", recipients, subject);
    app.log.info({ mail: result }, "Email sent");
    return result;
  } catch (error) {
    const result = buildEmailResult("failed", recipients, subject, error?.message || String(error));
    app.log.error({ err: error, mail: result }, "Email send failed");
    return result;
  }
}

function adminRedirectUrl() {
  if (!appOrigin) return "";
  return `${appOrigin}/admin/`;
}

function describeAuthAdminError(error) {
  const message = String(error?.message || "Unexpected auth error");
  const redirectUrl = adminRedirectUrl();
  if (!redirectUrl) return message;
  if (/redirect|site url|bad request|invalid/i.test(message)) {
    return `${message}. Check Supabase Auth URL Configuration and make sure ${redirectUrl} is listed in Site URL or Redirect URLs.`;
  }
  return message;
}

async function findUserByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  let page = 1;
  while (page <= 10) {
    const listed = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (listed.error) throw listed.error;
    const users = listed.data?.users || [];
    const found = users.find((user) => String(user.email || "").trim().toLowerCase() === normalized);
    if (found) return found;
    if (users.length < 1000) break;
    page += 1;
  }

  return null;
}

async function sendAdminAccessInviteEmail({ email, role, actionLink = "", existingUser = false }) {
  const adminUrl = adminRedirectUrl();
  const lines = existingUser
    ? [
        `Your Grow Albania admin access has been updated to: ${role}.`,
        "",
        adminUrl ? `Sign in here: ${adminUrl}` : "Sign in to the admin portal using your existing account.",
        "If you need a password reset, contact the site owner or use the reset-link tool in admin."
      ]
    : [
        `You have been invited to Grow Albania admin access as: ${role}.`,
        "",
        actionLink ? `Use this secure invite link to finish setup: ${actionLink}` : "Your invite link could not be generated automatically.",
        adminUrl ? `Admin portal: ${adminUrl}` : "",
        "",
        "If the invite link expires, contact the site owner for a fresh invite."
      ].filter(Boolean);

  return sendMailSafe({
    from: SMTP_FROM,
    to: email,
    subject: existingUser ? "Your Grow Albania admin access was updated" : "You're invited to Grow Albania admin",
    text: lines.join("\n")
  });
}

async function grantAdminAccess(email, role) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email required");
  }

  const redirectTo = adminRedirectUrl() || undefined;
  let existingUser = await findUserByEmail(normalizedEmail);
  let actionLink = null;

  if (!existingUser) {
    const generated = await serviceClient.auth.admin.generateLink({
      type: "invite",
      email: normalizedEmail,
      options: redirectTo ? { redirectTo } : undefined
    });
    if (generated.error) {
      throw new Error(describeAuthAdminError(generated.error));
    }
    existingUser = generated.data?.user || null;
    actionLink = generated.data?.properties?.action_link || null;
    if (!existingUser?.id) {
      throw new Error("Invite link was generated without a user record.");
    }
  }

  const upsert = await serviceClient
    .from("admin_user_roles")
    .upsert({ user_id: existingUser.id, email: normalizedEmail, role }, { onConflict: "user_id" });
  if (upsert.error) throw upsert.error;

  const emailResult = await sendAdminAccessInviteEmail({
    email: normalizedEmail,
    role,
    actionLink,
    existingUser: Boolean(actionLink === null)
  });

  return {
    user: existingUser,
    actionLink,
    emailResult,
    existingUser: Boolean(actionLink === null)
  };
}

async function notifyAdminOfSubmission(insertedRows) {
  if (!emailRecipients.length) {
    return buildEmailResult("skipped", [], `Calendar submission pending approval (${insertedRows.length})`, "No notification emails are configured.");
  }
  const lines = insertedRows.slice(0, 25).map((row) => {
    const dateLabel = row.date_start ? new Date(row.date_start).toLocaleString("en-GB", { timeZone: "Europe/Tirane" }) : "Unknown date";
    return `- ${row.title_en} | ${dateLabel} | ${row.area}`;
  });
  if (insertedRows.length > 25) {
    lines.push(`...and ${insertedRows.length - 25} more event(s).`);
  }

  return sendMailSafe({
    from: SMTP_FROM,
    to: emailRecipients.join(", "),
    subject: `Calendar submission pending approval (${insertedRows.length})`,
    text: [
      "A new public submission is waiting for approval.",
      "",
      ...lines,
      "",
      `Review in admin: ${adminRedirectUrl() || "Open the admin portal"}`
    ].join("\n")
  });
}

async function sendConfirmationEmails(insertedRows) {
  const grouped = new Map();

  insertedRows.forEach((row) => {
    [row.submitter_email, row.organizer_email].forEach((email) => {
      const normalized = String(email || "").trim().toLowerCase();
      if (!normalized) return;
      const list = grouped.get(normalized) || [];
      list.push(row.title_en);
      grouped.set(normalized, list);
    });
  });

  const attempts = await Promise.all(
    [...grouped.entries()].map(([email, titles]) =>
      sendMailSafe({
        from: SMTP_FROM,
        to: email,
        subject: "We received your Grow Albania event submission",
        text: [
          "Thanks for your submission.",
          "Your event is now pending admin approval.",
          "",
          "Submitted events:",
          ...titles.map((title) => `- ${title}`),
          "",
          "You will need to contact the site admin directly for edits before approval."
        ].join("\n")
      })
    )
  );
  return mergeEmailResults(attempts);
}

async function notifyAdminOfAccessRequest(requestRow) {
  if (!emailRecipients.length) {
    return buildEmailResult("skipped", [], "New admin access request", "No notification emails are configured.");
  }
  return sendMailSafe({
    from: SMTP_FROM,
    to: emailRecipients.join(", "),
    subject: "New admin access request",
    text: [
      "A user requested admin access.",
      "",
      `Name: ${requestRow.name || "Not provided"}`,
      `Email: ${requestRow.email}`,
      `Requested role: ${requestRow.requested_role || "moderator"}`,
      requestRow.note ? `Note: ${requestRow.note}` : "",
      "",
      `Review in admin: ${adminRedirectUrl() || "Open the admin users page"}`
    ]
      .filter(Boolean)
      .join("\n")
  });
}

async function sendAccessRequestReceipt(requestRow) {
  if (!requestRow?.email) {
    return buildEmailResult("skipped", [], "We received your Grow Albania admin access request", "No recipient email was provided.");
  }
  return sendMailSafe({
    from: SMTP_FROM,
    to: requestRow.email,
    subject: "We received your Grow Albania admin access request",
    text: [
      "Thanks for reaching out.",
      "Your admin access request has been received and is now pending review.",
      "",
      `Requested role: ${requestRow.requested_role || "moderator"}`,
      requestRow.note ? `Your note: ${requestRow.note}` : "",
      "",
      "We’ll email you when a decision is made."
    ]
      .filter(Boolean)
      .join("\n")
  });
}

async function sendAccessRequestDecisionEmail(requestRow, status, reviewNote, approvedRole = "") {
  if (!requestRow?.email) {
    return buildEmailResult("skipped", [], "Update on your Grow Albania admin access request", "No recipient email was provided.");
  }
  const subject = status === "approved"
    ? "Your Grow Albania admin access request was approved"
    : "Update on your Grow Albania admin access request";
  const intro = status === "approved"
    ? `Your request was approved${approvedRole ? ` as ${approvedRole}` : ""}.`
    : status === "denied"
      ? "Your admin access request was reviewed and was not approved."
      : "Your admin access request has been reviewed.";

  return sendMailSafe({
    from: SMTP_FROM,
    to: requestRow.email,
    subject,
    text: [
      intro,
      reviewNote ? "" : "",
      reviewNote ? "Additional information from the admin:" : "",
      reviewNote || "",
      status === "approved" && adminRedirectUrl() ? `Admin portal: ${adminRedirectUrl()}` : ""
    ]
      .filter(Boolean)
      .join("\n")
  });
}

async function runEmailDiagnostics() {
  const diagnostics = {
    configured: Boolean(mailTransport && SMTP_FROM),
    host: SMTP_HOST || null,
    port: SMTP_PORT || null,
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    from: SMTP_FROM || null,
    auth_user: SMTP_USER || null,
    notify_emails: emailRecipients,
    admin_redirect_url: adminRedirectUrl() || null,
    transport_verified: false,
    error: null
  };

  if (!mailTransport || !SMTP_FROM) {
    diagnostics.error = "SMTP is not configured on the server.";
    return diagnostics;
  }

  try {
    await mailTransport.verify();
    diagnostics.transport_verified = true;
  } catch (error) {
    diagnostics.error = error?.message || String(error);
  }

  return diagnostics;
}

function reviewSubject(status) {
  if (status === "approved") return "Your Grow Albania event was approved";
  if (status === "denied") return "Your Grow Albania event was not approved";
  if (status === "needs_info") return "More information is needed for your Grow Albania event";
  return "Update on your Grow Albania event submission";
}

function reviewIntro(status) {
  if (status === "approved") return "Your event has been approved and can now appear on the public calendar.";
  if (status === "denied") return "Your event submission was reviewed and was not approved.";
  if (status === "needs_info") return "Your submission needs more information before it can be approved.";
  return "Your event submission status has been updated.";
}

async function sendReviewEmails(eventRow, status, note) {
  const recipients = uniqueEmails(eventRow.submitter_email, eventRow.organizer_email);
  if (!recipients.length) {
    return buildEmailResult("skipped", [], reviewSubject(status), "No submitter or organizer email was provided.");
  }

  const attempts = await Promise.all(
    recipients.map((email) =>
      sendMailSafe({
        from: SMTP_FROM,
        to: email,
        subject: reviewSubject(status),
        text: [
          reviewIntro(status),
          "",
          `Event: ${eventRow.title_en || "Untitled"}`,
          eventRow.date_start ? `Date: ${new Date(eventRow.date_start).toLocaleString("en-GB", { timeZone: "Europe/Tirane" })}` : "",
          note ? "" : "",
          note ? "Additional information from the admin:" : "",
          note || "",
          "",
          "You can reply directly to the site admin if you need to follow up."
        ]
          .filter(Boolean)
          .join("\n")
      })
    )
  );
  return mergeEmailResults(attempts);
}

async function cleanupExpiredEvents() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - PAST_EVENT_RETENTION_MONTHS);
  const cutoffIso = cutoff.toISOString();

  const endedDelete = await serviceClient
    .from("events")
    .delete()
    .lt("date_end", cutoffIso);
  if (endedDelete.error) throw endedDelete.error;

  const singleDayDelete = await serviceClient
    .from("events")
    .delete()
    .is("date_end", null)
    .lt("date_start", cutoffIso);
  if (singleDayDelete.error) throw singleDayDelete.error;
}

function maybeRunCleanup(force = false) {
  const now = Date.now();
  if (!force && now - lastCleanupRunAt < CLEANUP_INTERVAL_MS) return cleanupPromise;
  if (cleanupPromise) return cleanupPromise;

  lastCleanupRunAt = now;
  cleanupPromise = cleanupExpiredEvents()
    .catch((error) => {
      app.log.error({ err: error }, "Expired event cleanup failed");
    })
    .finally(() => {
      cleanupPromise = null;
    });

  return cleanupPromise;
}

app.addHook("preHandler", async (request, reply) => {
  const path = request.raw.url || "";
  if (!path.startsWith("/v1/")) return;
  if (path.startsWith("/v1/health") || path.startsWith("/v1/public-submissions") || path.startsWith("/v1/language-options")) return;
  if (request.method === "POST" && path.startsWith("/v1/admin-access-requests")) return;
  const auth = request.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    reply.code(401).send({ error: "Missing bearer token" });
    return;
  }

  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data?.user) {
    reply.code(401).send({ error: "Invalid token" });
    return;
  }

  const role = await getRole(data.user);
  request.user = data.user;
  request.role = role;
});

app.addHook("onSend", async (request, reply, payload) => {
  const path = request.raw.url || "";
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  reply.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  if (path.startsWith("/admin") || path.startsWith("/widget") || path.startsWith("/shared/") || path.startsWith("/v1/")) {
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    reply.header("Surrogate-Control", "no-store");
  }
  if (path.startsWith("/admin") || path.startsWith("/v1/")) {
    reply.header("X-Frame-Options", "SAMEORIGIN");
  }
  return payload;
});

app.get("/v1/health", async () => {
  void maybeRunCleanup();
  return { ok: true };
});

app.get("/", async (_, reply) => {
  void maybeRunCleanup();
  return reply.redirect("/widget/");
});

app.get("/widget/", async (_, reply) => {
  void maybeRunCleanup();
  return reply.sendFile("widget/index.html");
});

app.get("/widget/submit/", async (_, reply) => {
  void maybeRunCleanup();
  return reply.sendFile("widget/submit/index.html");
});

app.get("/admin/", async (_, reply) => {
  void maybeRunCleanup();
  return reply.sendFile("admin/index.html");
});

app.get("/v1/me/role", async (request, reply) => {
  if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
  return { role: request.role };
});

app.post("/v1/public-submissions", async (request, reply) => {
  if (!enforcePublicRateLimit(request, reply, "submissions", PUBLIC_RATE_LIMITS.submissions)) return;
  const submittedEvents = Array.isArray(request.body?.events) ? request.body.events : [];
  if (!submittedEvents.length) return reply.code(400).send({ error: "At least one event is required" });
  if (submittedEvents.length > MAX_PUBLIC_SUBMISSION_EVENTS) {
    return reply.code(400).send({ error: `Maximum ${MAX_PUBLIC_SUBMISSION_EVENTS} generated events per submission` });
  }

  const normalized = submittedEvents.map(normalizeSubmissionRow);
  for (let i = 0; i < normalized.length; i += 1) {
    const validationError = validateSubmissionRow(normalized[i], i, submittedEvents[i]);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }
  }

  try {
    const duplicateConflicts = await findDuplicateEventConflicts(normalized);
    if (duplicateConflicts.existingConflicts.length || duplicateConflicts.internalConflicts.length) {
      return reply.code(409).send({ error: duplicateConflictErrorMessage(duplicateConflicts) });
    }
  } catch (error) {
    return reply.code(500).send({ error: error.message });
  }

  const inserted = await serviceClient.from("events").insert(normalized).select("*");
  if (inserted.error) return reply.code(500).send({ error: inserted.error.message });

  const rows = inserted.data || [];
  const [adminEmail, confirmationEmails] = await Promise.all([
    notifyAdminOfSubmission(rows),
    sendConfirmationEmails(rows)
  ]);

  return {
    ok: true,
    inserted: rows.length,
    email: {
      admin_notification: adminEmail,
      confirmations: confirmationEmails
    }
  };
});

app.post("/v1/admin-access-requests", async (request, reply) => {
  if (!enforcePublicRateLimit(request, reply, "access-requests", PUBLIC_RATE_LIMITS.accessRequests)) return;
  const email = normalizeOptionalEmail(request.body?.email);
  const name = String(request.body?.name || "").trim();
  const note = String(request.body?.note || "").trim();
  const requestedRole = String(request.body?.requested_role || "moderator").trim();

  if (!email) return reply.code(400).send({ error: "A valid email is required" });
  if (!["moderator", "editor"].includes(requestedRole)) {
    return reply.code(400).send({ error: "Invalid requested role" });
  }
  if (name.length > 160) return reply.code(400).send({ error: "Name is too long" });
  if (note.length > 2000) return reply.code(400).send({ error: "Note is too long" });

  const existingPending = await serviceClient
    .from("admin_access_requests")
    .select("id")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existingPending.error) return reply.code(500).send({ error: existingPending.error.message });
  if (existingPending.data) {
    return reply.code(409).send({ error: "There is already a pending access request for this email." });
  }

  const inserted = await serviceClient
    .from("admin_access_requests")
    .insert({
      name: name || null,
      email,
      note: note || null,
      requested_role: requestedRole,
      status: "pending"
    })
    .select("*")
    .maybeSingle();
  if (inserted.error) return reply.code(500).send({ error: inserted.error.message });

  const [adminNotification, requesterReceipt] = await Promise.all([
    notifyAdminOfAccessRequest(inserted.data),
    sendAccessRequestReceipt(inserted.data)
  ]);

  return {
    ok: true,
    email: {
      admin_notification: adminNotification,
      requester_receipt: requesterReceipt
    }
  };
});

app.get("/v1/language-options", async (_, reply) => {
  const listed = await serviceClient
    .from("language_options")
    .select("code, label, sort_label")
    .order("sort_label", { ascending: true });
  if (listed.error) return reply.code(500).send({ error: listed.error.message });
  return { languages: listed.data || [] };
});

app.post("/v1/language-options", async (request, reply) => {
  if (!enforcePublicRateLimit(request, reply, "language-options", PUBLIC_RATE_LIMITS.languageOptions)) return;
  const label = String(request.body?.label || "").trim();
  if (!label) return reply.code(400).send({ error: "Language label is required" });
  if (label.length > 120) return reply.code(400).send({ error: "Language label is too long" });
  if (!CUSTOM_LANGUAGE_LABEL_RE.test(label)) {
    return reply.code(400).send({ error: "Language label contains unsupported characters." });
  }

  const labelKey = normalizeLanguageKey(label);
  const existing = await serviceClient
    .from("language_options")
    .select("code, label, sort_label")
    .eq("label_key", labelKey)
    .maybeSingle();
  if (existing.error) return reply.code(500).send({ error: existing.error.message });
  if (existing.data) return { ok: true, created: false, language: existing.data };

  const payload = {
    code: buildLanguageCode(label),
    label,
    label_key: labelKey,
    sort_label: labelKey
  };
  const inserted = await serviceClient
    .from("language_options")
    .insert(payload)
    .select("code, label, sort_label")
    .maybeSingle();
  if (inserted.error) return reply.code(500).send({ error: inserted.error.message });

  return { ok: true, created: true, language: inserted.data };
});

app.get("/v1/admin-access-requests", async (request, reply) => {
  if (!canRole(request.role, "editor")) return reply.code(403).send({ error: "Editor+ required" });

  const listed = await serviceClient
    .from("admin_access_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (listed.error) return reply.code(500).send({ error: listed.error.message });

  const requests = (listed.data || []).sort((a, b) => {
    const statusRank = { pending: 0, approved: 1, denied: 2, reviewed: 3 };
    const statusDiff = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  return { requests };
});

app.get("/v1/email-diagnostics", async (request, reply) => {
  if (!canRole(request.role, "owner")) return reply.code(403).send({ error: "Owner required" });
  return { diagnostics: await runEmailDiagnostics() };
});

app.post("/v1/email-test", async (request, reply) => {
  if (!canRole(request.role, "owner")) return reply.code(403).send({ error: "Owner required" });
  const targetEmail = normalizeOptionalEmail(request.body?.email || request.user?.email);
  if (!targetEmail) return reply.code(400).send({ error: "No valid target email available" });

  const result = await sendMailSafe({
    from: SMTP_FROM,
    to: targetEmail,
    subject: "Grow Albania calendar test email",
    text: [
      "This is a test email from the Grow Albania calendar admin service.",
      "",
      `Sent at: ${new Date().toISOString()}`,
      adminRedirectUrl() ? `Admin portal: ${adminRedirectUrl()}` : ""
    ]
      .filter(Boolean)
      .join("\n")
  });

  return { ok: result.status === "sent", email: result };
});

app.patch("/v1/admin-access-requests/:requestId", async (request, reply) => {
  if (!canRole(request.role, "editor")) return reply.code(403).send({ error: "Editor+ required" });

  const { requestId } = request.params;
  const { status, role = "moderator", review_note = null } = request.body || {};
  if (!["approved", "denied", "reviewed"].includes(status)) {
    return reply.code(400).send({ error: "Invalid request status" });
  }
  if (!["moderator", "editor", "owner"].includes(role)) {
    return reply.code(400).send({ error: "Invalid admin role" });
  }
  if ((role === "editor" || role === "owner") && !canRole(request.role, "owner")) {
    return reply.code(403).send({ error: "Only owner can approve editor/owner access" });
  }

  const current = await serviceClient
    .from("admin_access_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (current.error) return reply.code(500).send({ error: current.error.message });
  if (!current.data) return reply.code(404).send({ error: "Access request not found" });

  let inviteResult = null;
  if (status === "approved") {
    try {
      inviteResult = await grantAdminAccess(current.data.email, role);
    } catch (error) {
      return reply.code(500).send({ error: error.message || "Could not grant admin access" });
    }
  }

  const updated = await serviceClient
    .from("admin_access_requests")
    .update({
      status,
      resolved_role: status === "approved" ? role : null,
      review_note: review_note ? String(review_note).trim() : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: request.user?.id || null
    })
    .eq("id", requestId)
    .select("*")
    .maybeSingle();
  if (updated.error) return reply.code(500).send({ error: updated.error.message });

  const requestEmail = status !== "approved"
    ? await sendAccessRequestDecisionEmail(updated.data || current.data, status, updated.data?.review_note || null, "")
    : null;

  return {
    ok: true,
    request: updated.data || current.data,
    email: requestEmail,
    invite: inviteResult
      ? {
          email: inviteResult.emailResult,
          action_link: inviteResult.emailResult?.status === "sent" ? null : inviteResult.actionLink,
          existing_user: inviteResult.existingUser
        }
      : null
  };
});

app.post("/v1/events/:eventId/review", async (request, reply) => {
  if (!canRole(request.role, "moderator")) return reply.code(403).send({ error: "Moderator+ required" });

  const { eventId } = request.params;
  const { status, note = null } = request.body || {};
  if (!["approved", "denied", "needs_info", "pending"].includes(status)) {
    return reply.code(400).send({ error: "Invalid review status" });
  }

  const current = await serviceClient.from("events").select("*").eq("id", eventId).maybeSingle();
  if (current.error) return reply.code(500).send({ error: current.error.message });
  if (!current.data) return reply.code(404).send({ error: "Event not found" });

  const patch = {
    status,
    admin_response_note: note ? String(note).trim() : null
  };
  if (status !== "approved") patch.is_highlighted = false;

  if (status === "approved") {
    try {
      const duplicateConflicts = await findDuplicateEventConflicts([{ ...current.data, ...patch }], { excludeIds: [eventId] });
      if (duplicateConflicts.existingConflicts.length || duplicateConflicts.internalConflicts.length) {
        return reply.code(409).send({ error: duplicateConflictErrorMessage(duplicateConflicts) });
      }
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  }

  const updated = await serviceClient.from("events").update(patch).eq("id", eventId).select("*").maybeSingle();
  if (updated.error) return reply.code(500).send({ error: updated.error.message });

  const email = status !== "pending"
    ? await sendReviewEmails(updated.data || current.data, status, patch.admin_response_note)
    : buildEmailResult("skipped", [], reviewSubject(status), "Pending status does not send review emails.");

  return { ok: true, event: updated.data || current.data, email };
});

app.post("/v1/events/review-bulk", async (request, reply) => {
  if (!canRole(request.role, "moderator")) return reply.code(403).send({ error: "Moderator+ required" });

  const status = String(request.body?.status || "").trim();
  const note = request.body?.note ? String(request.body.note).trim() : null;
  const eventIds = [...new Set(toArray(request.body?.event_ids).map((value) => String(value || "").trim()).filter(Boolean))];

  if (!["approved", "denied", "needs_info", "pending"].includes(status)) {
    return reply.code(400).send({ error: "Invalid review status" });
  }
  if (!eventIds.length) {
    return reply.code(400).send({ error: "At least one event id is required" });
  }

  const current = await serviceClient.from("events").select("*").in("id", eventIds);
  if (current.error) return reply.code(500).send({ error: current.error.message });
  const currentRows = current.data || [];
  if (!currentRows.length) return reply.code(404).send({ error: "No matching events found" });

  const patch = {
    status,
    admin_response_note: note
  };
  if (status !== "approved") patch.is_highlighted = false;

  if (status === "approved") {
    try {
      const duplicateConflicts = await findDuplicateEventConflicts(
        currentRows.map((row) => ({ ...row, ...patch })),
        { excludeIds: eventIds }
      );
      if (duplicateConflicts.existingConflicts.length || duplicateConflicts.internalConflicts.length) {
        return reply.code(409).send({ error: duplicateConflictErrorMessage(duplicateConflicts) });
      }
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  }

  const updated = await serviceClient.from("events").update(patch).in("id", eventIds).select("*");
  if (updated.error) return reply.code(500).send({ error: updated.error.message });
  const updatedRows = updated.data || currentRows;

  let email = buildEmailResult("skipped", [], reviewSubject(status), "Pending status does not send review emails.");
  if (status !== "pending") {
    const attempts = [];
    for (const event of updatedRows) {
      const result = await sendReviewEmails(event, status, note);
      if (result?.attempts?.length) attempts.push(...result.attempts);
      else if (result) attempts.push(result);
    }
    email = mergeEmailResults(attempts);
  }

  return {
    ok: true,
    updated_count: updatedRows.length,
    events: updatedRows,
    email
  };
});

app.get("/v1/events", async (request, reply) => {
  if (!canRole(request.role, "moderator")) return reply.code(403).send({ error: "Moderator+ required" });

  const listed = await serviceClient
    .from("events")
    .select("*")
    .order("date_start", { ascending: true });
  if (listed.error) return reply.code(500).send({ error: listed.error.message });

  return { events: listed.data || [] };
});

app.get("/v1/users", async (request, reply) => {
  if (!canRole(request.role, "editor")) return reply.code(403).send({ error: "Editor+ required" });

  const listed = await serviceClient.auth.admin.listUsers();
  if (listed.error) return reply.code(500).send({ error: listed.error.message });

  const roleRows = await serviceClient.from("admin_user_roles").select("user_id, role");
  if (roleRows.error) return reply.code(500).send({ error: roleRows.error.message });

  const roleMap = new Map((roleRows.data || []).map((row) => [row.user_id, row.role]));
  const users = (listed.data?.users || []).map((u) => ({
    id: u.id,
    email: u.email,
    role: roleMap.get(u.id) || null
  }));

  return { users };
});

app.post("/v1/users/invite", async (request, reply) => {
  if (!canRole(request.role, "editor")) return reply.code(403).send({ error: "Editor+ required" });
  const email = normalizeOptionalEmail(request.body?.email);
  const { role = "moderator" } = request.body || {};
  if (!email) return reply.code(400).send({ error: "A valid email is required" });
  if (!["moderator", "editor", "owner"].includes(role)) return reply.code(400).send({ error: "Invalid role" });
  if (role !== "moderator" && !canRole(request.role, "owner")) {
    return reply.code(403).send({ error: "Only owner can invite editor/owner" });
  }

  try {
    const granted = await grantAdminAccess(email, role);
    return {
      ok: true,
      email,
      user_id: granted.user.id,
      role,
      email_result: granted.emailResult,
      action_link: granted.emailResult?.status === "sent" ? null : granted.actionLink,
      existing_user: granted.existingUser,
      admin_url: adminRedirectUrl() || null
    };
  } catch (error) {
    return reply.code(500).send({ error: error.message || "Could not invite user" });
  }
});

app.patch("/v1/users/:userId/role", async (request, reply) => {
  if (!canRole(request.role, "moderator")) return reply.code(403).send({ error: "Moderator+ required" });

  const { userId } = request.params;
  const { role } = request.body || {};
  if (!["moderator", "editor", "owner"].includes(role)) return reply.code(400).send({ error: "Invalid role" });

  const currentRoleRow = await serviceClient
    .from("admin_user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (currentRoleRow.error) return reply.code(500).send({ error: currentRoleRow.error.message });
  const targetCurrentRole = currentRoleRow.data?.role || null;

  if (canRole(request.role, "moderator") && !canRole(request.role, "owner")) {
    if (role !== "editor") return reply.code(403).send({ error: "Moderator can only elevate to editor" });
    if (targetCurrentRole === "owner") return reply.code(403).send({ error: "Only owner can modify owner role" });
  }

  if (role === "owner" && !canRole(request.role, "owner")) {
    return reply.code(403).send({ error: "Only owner can assign owner" });
  }

  const userGet = await serviceClient.auth.admin.getUserById(userId);
  if (userGet.error) return reply.code(404).send({ error: userGet.error.message });

  const email = userGet.data?.user?.email || null;
  const upsert = await serviceClient
    .from("admin_user_roles")
    .upsert({ user_id: userId, email, role }, { onConflict: "user_id" });
  if (upsert.error) return reply.code(500).send({ error: upsert.error.message });

  return { ok: true, user_id: userId, role };
});

app.post("/v1/users/:userId/reset", async (request, reply) => {
  if (!canRole(request.role, "editor")) return reply.code(403).send({ error: "Editor+ required" });
  const { userId } = request.params;

  const userGet = await serviceClient.auth.admin.getUserById(userId);
  if (userGet.error) return reply.code(404).send({ error: userGet.error.message });
  const email = userGet.data?.user?.email;
  if (!email) return reply.code(400).send({ error: "User email not found" });

  const generated = await serviceClient.auth.admin.generateLink({ type: "recovery", email });
  if (generated.error) return reply.code(500).send({ error: generated.error.message });

  return { ok: true, email, action_link: generated.data?.properties?.action_link || null };
});

app.delete("/v1/users/:userId", async (request, reply) => {
  if (!canRole(request.role, "editor")) return reply.code(403).send({ error: "Editor+ required" });
  const { userId } = request.params;

  const roleRow = await serviceClient.from("admin_user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (!roleRow.error && roleRow.data?.role === "owner" && !canRole(request.role, "owner")) {
    return reply.code(403).send({ error: "Only owner can remove owner" });
  }

  const removed = await serviceClient.auth.admin.deleteUser(userId);
  if (removed.error) return reply.code(500).send({ error: removed.error.message });

  await serviceClient.from("admin_user_roles").delete().eq("user_id", userId);
  return { ok: true, user_id: userId };
});

void maybeRunCleanup(true);
const cleanupTimer = setInterval(() => {
  void maybeRunCleanup(true);
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

try {
  await app.listen({ port: Number(PORT), host: HOST });
} catch (error) {
  app.log.error({ err: error }, "Server failed to start");
  process.exit(1);
}

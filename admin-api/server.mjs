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
  APP_ORIGIN = "*",
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
const MAX_PUBLIC_SUBMISSION_EVENTS = 250;
const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..", "web");
let lastCleanupRunAt = 0;
let cleanupPromise = null;
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
  origin: APP_ORIGIN === "*" ? true : APP_ORIGIN,
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

function normalizeSubmissionRow(row) {
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
    price_min: row?.price_min ?? null,
    price_max: row?.price_max ?? null,
    currency: row?.currency ? String(row.currency).trim() : "ALL",
    ticket_url: row?.ticket_url ? String(row.ticket_url).trim() : null,
    event_image_url: row?.event_image_url ? String(row.event_image_url).trim() : null,
    organizer_name: row?.organizer_name ? String(row.organizer_name).trim() : null,
    organizer_email: row?.organizer_email ? String(row.organizer_email).trim() : null,
    submitter_name: row?.submitter_name ? String(row.submitter_name).trim() : null,
    submitter_email: row?.submitter_email ? String(row.submitter_email).trim() : null,
    submitter_note: row?.submitter_note ? String(row.submitter_note).trim() : null,
    source_url: row?.source_url ? String(row.source_url).trim() : null,
    is_highlighted: false
  };
}

function validateSubmissionRow(row, index) {
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
  if (row.price_type !== "Free" && (row.price_min === null || row.price_min === "" || row.price_max === null || row.price_max === "")) {
    return `Event ${index + 1} needs min and max prices unless it is Free.`;
  }
  return "";
}

async function sendMailSafe(message) {
  if (!mailTransport || !SMTP_FROM) return;
  try {
    await mailTransport.sendMail(message);
  } catch (error) {
    app.log.error({ err: error }, "Email send failed");
  }
}

async function notifyAdminOfSubmission(insertedRows) {
  if (!emailRecipients.length) return;
  const lines = insertedRows.slice(0, 25).map((row) => {
    const dateLabel = row.date_start ? new Date(row.date_start).toLocaleString("en-GB", { timeZone: "Europe/Tirane" }) : "Unknown date";
    return `- ${row.title_en} | ${dateLabel} | ${row.area}`;
  });
  if (insertedRows.length > 25) {
    lines.push(`...and ${insertedRows.length - 25} more event(s).`);
  }

  await sendMailSafe({
    from: SMTP_FROM,
    to: emailRecipients.join(", "),
    subject: `Calendar submission pending approval (${insertedRows.length})`,
    text: [
      "A new public submission is waiting for approval.",
      "",
      ...lines,
      "",
      `Review in admin: ${APP_ORIGIN === "*" ? "" : `${APP_ORIGIN}/admin/`}`
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

  await Promise.all(
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
  if (!recipients.length) return;

  await Promise.all(
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
}

async function cleanupExpiredEvents() {
  const cutoffIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

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
  if (path.startsWith("/v1/health") || path.startsWith("/v1/public-submissions")) return;
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
  if (path.startsWith("/admin") || path.startsWith("/widget") || path.startsWith("/shared/") || path.startsWith("/v1/")) {
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    reply.header("Surrogate-Control", "no-store");
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
  const submittedEvents = Array.isArray(request.body?.events) ? request.body.events : [];
  if (!submittedEvents.length) return reply.code(400).send({ error: "At least one event is required" });
  if (submittedEvents.length > MAX_PUBLIC_SUBMISSION_EVENTS) {
    return reply.code(400).send({ error: `Maximum ${MAX_PUBLIC_SUBMISSION_EVENTS} generated events per submission` });
  }

  const normalized = submittedEvents.map(normalizeSubmissionRow);
  for (let i = 0; i < normalized.length; i += 1) {
    const validationError = validateSubmissionRow(normalized[i], i);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }
  }

  const inserted = await serviceClient.from("events").insert(normalized).select("*");
  if (inserted.error) return reply.code(500).send({ error: inserted.error.message });

  const rows = inserted.data || [];
  await Promise.all([
    notifyAdminOfSubmission(rows),
    sendConfirmationEmails(rows)
  ]);

  return { ok: true, inserted: rows.length };
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

  const updated = await serviceClient.from("events").update(patch).eq("id", eventId).select("*").maybeSingle();
  if (updated.error) return reply.code(500).send({ error: updated.error.message });

  if (status !== "pending") {
    await sendReviewEmails(updated.data || current.data, status, patch.admin_response_note);
  }

  return { ok: true, event: updated.data || current.data };
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
  const { email, role = "moderator" } = request.body || {};
  if (!email) return reply.code(400).send({ error: "Email required" });
  if (!["moderator", "editor", "owner"].includes(role)) return reply.code(400).send({ error: "Invalid role" });
  if (role !== "moderator" && !canRole(request.role, "owner")) {
    return reply.code(403).send({ error: "Only owner can invite editor/owner" });
  }

  const invited = await serviceClient.auth.admin.inviteUserByEmail(email);
  if (invited.error) return reply.code(500).send({ error: invited.error.message });
  const user = invited.data?.user;
  if (!user?.id) return reply.code(500).send({ error: "Invite returned no user" });

  const upsert = await serviceClient
    .from("admin_user_roles")
    .upsert({ user_id: user.id, email, role }, { onConflict: "user_id" });
  if (upsert.error) return reply.code(500).send({ error: upsert.error.message });

  return { ok: true, email, user_id: user.id, role };
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

app.listen({ port: Number(PORT), host: HOST });

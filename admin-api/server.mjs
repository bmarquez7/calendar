import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
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
  OWNER_EMAIL = ""
} = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  app.log.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ROLE_RANK = { moderator: 1, editor: 2, owner: 3 };
const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..", "web");

await app.register(cors, {
  origin: APP_ORIGIN === "*" ? true : APP_ORIGIN,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"]
});

await app.register(fastifyStatic, {
  root: webRoot,
  prefix: "/",
  index: false
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

app.addHook("preHandler", async (request, reply) => {
  const path = request.raw.url || "";
  if (!path.startsWith("/v1/")) return;
  if (request.routerPath === "/v1/health") return;
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

app.get("/v1/health", async () => ({ ok: true }));

app.get("/", async (_, reply) => {
  return reply.redirect("/widget/");
});

app.get("/widget/", async (_, reply) => {
  return reply.sendFile("widget/index.html");
});

app.get("/widget/submit/", async (_, reply) => {
  return reply.sendFile("widget/submit/index.html");
});

app.get("/admin/", async (_, reply) => {
  return reply.sendFile("admin/index.html");
});

app.get("/v1/me/role", async (request, reply) => {
  if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
  return { role: request.role };
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

  if (canRole(request.role, "moderator") && !canRole(request.role, "owner")) {
    if (role !== "editor") return reply.code(403).send({ error: "Moderator can only elevate to editor" });
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

app.listen({ port: Number(PORT), host: HOST });

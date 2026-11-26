import { auth } from "./auth";
import { portal } from "./portal";

const TO = "hello@stayon.site";
const FIELDS = ["name", "email", "kind", "where", "start", "brief", "nda"] as const;

async function contact(req: Request, env: Env) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const form = await req.formData().catch(() => null);
  const get = (k: string) => String(form?.get(k) ?? "").slice(0, 5000);
  const email = get("email");
  if (get("website")) return new Response(null, { status: 204 }); // honeypot: bots fill it
  if (!get("name") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response("Invalid", { status: 400 });
  }

  try {
    await env.EMAIL.send({
      from: { email: TO, name: "StayonSite form" },
      to: TO,
      replyTo: email,
      subject: `New brief from ${get("name").slice(0, 80).replace(/[\r\n]/g, " ")}`,
      text: FIELDS.map((k) => `${k}: ${get(k)}`).join("\n"),
    });
  } catch {
    return new Response("Send failed", { status: 502 });
  }
  return new Response(null, { status: 204 });
}

/** Dev only: prints the SQL Better Auth needs, for migrations/0001_auth.sql. */
async function authSql() {
  const { getMigrations } = await import("better-auth/db/migration");
  const { compileMigrations } = await getMigrations(auth.options);
  return new Response(await compileMigrations(), { headers: { "content-type": "text/plain" } });
}

export default {
  async fetch(req: Request, env: Env) {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/contact") return contact(req, env);
    if (pathname.startsWith("/api/auth/")) return auth.handler(req);
    // Which sign-in buttons the login page should show.
    if (pathname === "/api/providers")
      return Response.json({ google: !!env.GOOGLE_CLIENT_ID, microsoft: !!env.MICROSOFT_CLIENT_ID, okta: false });
    if (pathname.startsWith("/api/portal/")) return portal(req);
    // Proves to Microsoft that stayon.site publishes the Entra app (publisher domain).
    if (pathname === "/.well-known/microsoft-identity-association" || pathname === "/.well-known/microsoft-identity-association.json")
      return env.MICROSOFT_CLIENT_ID
        ? Response.json({ associatedApplications: [{ applicationId: env.MICROSOFT_CLIENT_ID }] })
        : new Response("Not found", { status: 404 });
    if (import.meta.env.DEV && pathname === "/api/dev/auth-sql") return authSql();
    // Every console URL is the same app; it routes on the client.
    if (pathname === "/console" || pathname.startsWith("/console/"))
      return env.ASSETS.fetch(new Request(new URL("/console/", req.url), req));
    return new Response("Not found", { status: 404 });
  },
};

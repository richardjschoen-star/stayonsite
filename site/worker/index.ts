interface Env {
  EMAIL: SendEmail;
}

const TO = "hello@stayon.site";
const FIELDS = ["name", "email", "kind", "where", "start", "brief", "nda"] as const;

export default {
  async fetch(req: Request, env: Env) {
    const { pathname } = new URL(req.url);
    if (pathname !== "/api/contact") return new Response("Not found", { status: 404 });
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
  },
};

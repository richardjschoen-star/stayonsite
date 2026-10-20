import { env, waitUntil } from "cloudflare:workers";

const FROM = "StayonSite <portal@stayon.site>";

/**
 * Sends through Resend without holding up the response. With no key set
 * (local dev) it logs the message instead, so OTP codes show in the terminal.
 */
export function send(to: string, subject: string, text: string) {
  if (!env.RESEND_API_KEY) {
    console.log(`\n[mail] to ${to}: ${subject}\n${text}\n`);
    return;
  }
  waitUntil(
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, text }),
    }).then(async (r) => {
      if (!r.ok) console.error("[mail]", r.status, await r.text());
    }),
  );
}

/** Absolute link into the console, for emails. */
export const link = (path = "") => `${env.BETTER_AUTH_URL}/console${path}`;

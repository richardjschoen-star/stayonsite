import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { env, waitUntil } from "cloudflare:workers";
import { link, send } from "./mail";

const live = () => Date.now();

const inviteFor = (email: string) =>
  env.DB.prepare(
    "SELECT name FROM invite WHERE email = ? AND expires_at > ? LIMIT 1",
  )
    .bind(email.toLowerCase(), live())
    .first<{ name: string | null }>();

const userExists = (email: string) =>
  env.DB.prepare('SELECT 1 FROM "user" WHERE email = ?')
    .bind(email.toLowerCase())
    .first();

/** Turns every pending invite for this email into memberships (or staff). */
function claimInvites(user: { id: string; email: string }) {
  const email = user.email.toLowerCase();
  const t = live();
  return env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO member (org_id, user_id, role, created_at)
       SELECT org_id, ?, role, ? FROM invite WHERE email = ? AND org_id IS NOT NULL AND expires_at > ?`,
    ).bind(user.id, t, email, t),
    env.DB.prepare(
      `UPDATE "user" SET role = 'staff' WHERE id = ?
       AND EXISTS (SELECT 1 FROM invite WHERE email = ? AND org_id IS NULL AND expires_at > ?)`,
    ).bind(user.id, email, t),
    env.DB.prepare(
      "UPDATE org SET version = version + 1 WHERE id IN (SELECT org_id FROM invite WHERE email = ?)",
    ).bind(email),
    env.DB.prepare("DELETE FROM invite WHERE email = ?").bind(email),
  ]);
}

const social: Record<string, object> = {};
if (env.GOOGLE_CLIENT_ID)
  social.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
if (env.MICROSOFT_CLIENT_ID)
  social.microsoft = {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    // Work and school accounts only. Emails count as verified only when the ID
    // token carries `verified_primary_email` / `verified_secondary_email`
    // (add them as optional claims in the Entra app's Token configuration).
    tenantId: "organizations",
  };

export const auth = betterAuth({
  database: env.DB,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  trustedOrigins: [env.BETTER_AUTH_URL],
  socialProviders: social,
  user: {
    additionalFields: {
      // 'staff' is StayonSite; everyone else is a client. Never client-settable.
      role: { type: "string", defaultValue: "client", input: false },
      title: { type: "string", required: false },
      tz: { type: "string", required: false },
    },
  },
  account: {
    // Only Google proves email ownership well enough to merge accounts by email.
    accountLinking: { trustedProviders: ["google"] },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        // Only people with an account or an invite get a code; the response
        // is identical either way, so the endpoint can't probe for invites.
        if (!(await userExists(email)) && !(await inviteFor(email))) return;
        send(
          email,
          `${otp} is your StayonSite sign-in code`,
          `Your sign-in code is ${otp}. It expires in 5 minutes.\n\n${link("/login")}\n\nIf you didn't ask for this, you can ignore this email.`,
        );
      },
    }),
  ],
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/sign-in/email-otp": { window: 60, max: 5 },
    },
  },
  advanced: {
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    backgroundTasks: { handler: waitUntil },
  },
  databaseHooks: {
    user: {
      create: {
        // Invite-only, for every sign-in method: the email must be verified
        // by the provider (or the OTP) and have a pending invite.
        async before(user) {
          const invite = user.emailVerified ? await inviteFor(user.email) : null;
          if (!invite)
            throw new APIError("FORBIDDEN", {
              message: "This email hasn't been invited to StayonSite.",
            });
          return {
            data: {
              ...user,
              name: user.name || invite.name || user.email.split("@")[0],
            },
          };
        },
        async after(user) {
          await claimInvites(user);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;

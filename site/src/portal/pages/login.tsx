import { AuthCard } from "@/components/application/auth/auth-card";
import type { SocialProvider } from "@/components/base/social-button/social-providers";
import { useEffect, useState } from "react";
import { authClient } from "../api";

/** Invite-only sign-in: email → 6-digit code, or the company's SSO. */
export function Login() {
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const next = new URLSearchParams(location.search).get("next") ?? "/console";
  const failed = new URLSearchParams(location.search).get("error");

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((p: Record<string, boolean>) => setProviders((["microsoft", "google", "okta"] as const).filter((k) => p[k])))
      .catch(() => {});
  }, []);

  const send = async (to: string) => {
    setPending(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: to, type: "sign-in" });
    setPending(false);
    if (error) return setError(error.status === 429 ? "Too many codes requested. Wait a minute and try again." : (error.message ?? "Couldn't send the code."));
    setEmail(to);
  };

  const verify = async (otp: string) => {
    if (!email || otp.length < 6) return setError("Enter the 6-digit code.");
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    setPending(false);
    if (error)
      return setError(
        error.status === 403 ? "This email hasn't been invited. Ask your StayonSite contact for an invite." : "That code didn't work. Check it, or send a new one.",
      );
    location.href = next.startsWith("/console") ? next : "/console";
  };

  const social = async (provider: SocialProvider) => {
    setError(null);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: next.startsWith("/console") ? next : "/console",
      errorCallbackURL: "/console/login",
    });
    if (error) setError(error.message ?? "Sign-in failed.");
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background-full px-4 py-12">
      <a href="/" className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <img src="/mark.png" alt="" className="size-6" />
        <span className="text-title-3-medium text-text-primary">
          Stayon<span className="italic">Site</span>
        </span>
      </a>
      {email ? (
        <AuthCard
          mode="verify"
          email={email}
          title="Check your inbox"
          onComplete={(c) => {
            setCode(c);
            void verify(c);
          }}
          onSubmit={() => verify(code)}
          onResend={() => send(email)}
          pending={pending}
          error={error}
        />
      ) : (
        <AuthCard
          mode="signin"
          passwordless
          layout="stacked"
          title="Sign in to your console"
          description="For StayonSite clients and team. We'll email you a sign-in code."
          providers={providers}
          onSubmit={(data) => send(String(data.get("email") ?? "").trim())}
          onProvider={social}
          pending={pending}
          error={error ?? (failed ? "That account hasn't been invited, or its email isn't verified." : null)}
          footnote={
            <>
              Not a client yet? <a className="underline" href="/#contact">Book a discovery call</a>.
            </>
          }
        />
      )}
    </main>
  );
}

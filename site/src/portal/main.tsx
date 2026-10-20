import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "@/styles/globals.css";
import { Login } from "./pages/login";
import { getRoute, navigate, to, useRoute } from "./router";
import { Shell } from "./shell";
import { boot, useStore } from "./store";

/** Signed out → login. /console → your last workspace. Anything else → the shell. */
function App() {
  const route = useRoute();
  const { me, orgs, booting, loadError } = useStore();

  useEffect(() => {
    if (booting || route.name === "login") return;
    if (!me) return void location.replace(`/console/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    if (route.name === "pick") {
      const last = orgs.find((o) => o.slug === localStorage.getItem("console:org")) ?? orgs[0];
      if (last) navigate(to(last.slug), { replace: true });
    }
  }, [booting, me, orgs, route.name]);

  if (route.name === "login") return <Login />;
  if (booting || !me) return <div className="min-h-dvh bg-background-full" aria-busy="true" />;
  if (loadError) return <p className="p-8 text-body-regular text-text-error-primary">{loadError}</p>;
  return <Shell />;
}

// The login page has no session to ask about.
if (getRoute().name !== "login") void boot();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);

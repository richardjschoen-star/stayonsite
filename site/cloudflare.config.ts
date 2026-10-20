import { defineConfig } from "cf/config";
import { bindings } from "@cloudflare/config";

export default defineConfig({
  worker: {
    "name": "site",
    "domains": ["stayon.site"],
    "compatibilityDate": "2026-09-30",
    // Better Auth needs AsyncLocalStorage.
    "compatibilityFlags": ["nodejs_compat"],
    "observability": {
      "enabled": true
    },
    "entrypoint": "./worker/index.ts",
    "env": {
      "EMAIL": bindings.sendEmail({ destinationAddress: "hello@stayon.site" }),
      "ASSETS": bindings.assets(),
      "DB": bindings.d1({ name: "stayonsite-portal" }),
      "FILES": bindings.r2({ name: "stayonsite-portal-files" }),
      "BETTER_AUTH_SECRET": bindings.secret(),
      "BETTER_AUTH_URL": bindings.secret(),
      "GOOGLE_CLIENT_ID": bindings.secret(),
      "GOOGLE_CLIENT_SECRET": bindings.secret(),
      "MICROSOFT_CLIENT_ID": bindings.secret(),
      "MICROSOFT_CLIENT_SECRET": bindings.secret(),
      "RESEND_API_KEY": bindings.secret()
    },
    "assets": {
      "notFoundHandling": "none",
      "runWorkerFirst": ["/api/*", "/console", "/console/*"]
    }
  }
});

import { defineConfig } from "cf/config";
import { bindings } from "@cloudflare/config";

export default defineConfig({
  worker: {
    "name": "site",
    "domains": ["stayon.site"],
    "compatibilityDate": "2026-09-30",
    "observability": {
      "enabled": true
    },
    "entrypoint": "./worker/index.ts",
    "env": {
      "EMAIL": bindings.sendEmail({ destinationAddress: "hello@stayon.site" })
    },
    "assets": {
      "notFoundHandling": "none",
      "runWorkerFirst": ["/api/*"]
    }
  }
});

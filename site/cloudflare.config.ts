import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    "name": "site",
    "domains": ["stayon.site"],
    "compatibilityDate": "2026-09-30",
    "observability": {
      "enabled": true
    },
    "assets": {
      "notFoundHandling": "single-page-application"
    }
  }
});

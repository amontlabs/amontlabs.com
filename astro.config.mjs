import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://amontlabs.com",
  output: "static",
  build: { inlineStylesheets: "always" },
  devToolbar: { enabled: false },
  image: { service: { entrypoint: "astro/assets/services/sharp" } },
});

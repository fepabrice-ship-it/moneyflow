import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Version unique, lue depuis package.json — affichée dans la sidebar et
    // le splash pour ne plus jamais avoir de numéro codé en dur qui ment.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});

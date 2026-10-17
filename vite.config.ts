import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => ({
  plugins: [
    tsConfigPaths(),
    // Only bundle for Workers on build; dev and tests run on the plain Vite server.
    command === "build" && mode !== "test" && cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    // Route the server entry through src/server.ts so SSR errors get the custom error page.
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
  ],
  server: { port: 3000 },
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
}));

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const apiHost = process.env.API_HOST || env.API_HOST || "localhost";
  const apiPort = process.env.API_PORT || env.API_PORT || "5001";
  const apiTarget = `http://${apiHost}:${apiPort}`;

  return {
    envDir: "..",
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true
        }
      }
    }
  };
});

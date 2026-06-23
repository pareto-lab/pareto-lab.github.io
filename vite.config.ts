import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const API_TARGET = process.env.VITE_API_TARGET ?? "http://127.0.0.1:8098";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
      },
      "/uploads": {
        target: API_TARGET,
        changeOrigin: true,
      },
      "/sitemap.xml": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        api_template: path.resolve(__dirname, "index_for_api.html"),
      },
    },
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), false].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "monaco-editor/esm/vs/editor/editor.api.js": path.resolve(__dirname, "node_modules/monaco-editor/esm/vs/editor/editor.api.js"),
    },
  },
}));

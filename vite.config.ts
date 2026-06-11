import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
  },
  // Fallback inlining of public Supabase config so production builds work even when
  // .env is not present at build time (e.g. when .gitignore excludes it). These are
  // the publishable/anon values — safe to commit and ship to the browser.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL ?? "https://mimlfjkisguktiqqkpkm.supabase.co"
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbWxmamtpc2d1a3RpcXFrcGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTY0NjEsImV4cCI6MjA4NTY3MjQ2MX0.hBBQlfrPG_i1sjMOJiL6Lps1raXH3C-df6e5Uzmi9o0"
    ),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
      process.env.VITE_SUPABASE_PROJECT_ID ?? "mimlfjkisguktiqqkpkm"
    ),
  },
}));

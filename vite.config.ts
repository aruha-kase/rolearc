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
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        lsm: path.resolve(__dirname, "lsm.html"),
      },
      output: {
        // 大きめの依存をベンダーチャンクに分離（初回ロード・キャッシュ効率の改善）
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          tiptap: [
            "@tiptap/react",
            "@tiptap/core",
            "@tiptap/starter-kit",
            "@tiptap/extension-color",
            "@tiptap/extension-heading",
            "@tiptap/extension-image",
            "@tiptap/extension-text-align",
            "@tiptap/extension-text-style",
          ],
          motion: ["framer-motion"],
        },
      },
    },
  },
}));

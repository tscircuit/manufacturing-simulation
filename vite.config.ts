import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      lib: fileURLToPath(new URL("./lib", import.meta.url)),
      tests: fileURLToPath(new URL("./tests", import.meta.url)),
    },
  },
})

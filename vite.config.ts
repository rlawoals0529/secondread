import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The repository name, because GitHub Pages serves a project site from a subpath and every
// grammar URL is built from BASE_URL. Getting this wrong 404s the wasm and the page reports
// nothing at all, which looks exactly like clean code.
export default defineConfig({ base: "/secondread/", plugins: [react()] });

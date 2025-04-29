import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    // Enable JSX parsing for .js files
    loader: "jsx", // Treat .js files as JSX
    include: [
      // Include all .js and .jsx files in src/
      "src/**/*.js",
      "src/**/*.jsx",
    ],
  },
});

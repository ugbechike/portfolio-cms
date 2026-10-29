import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  bundle: true,
  clean: true,
  noExternal: [/^@portfolio\//],
});

// After `next build` with output: "standalone", the minimal server does not
// include public/ or .next/static/. Copy them in so server.js can serve them.
import { cpSync, existsSync } from "node:fs";

const standalone = ".next/standalone";
if (!existsSync(standalone)) {
  console.error(`${standalone} not found — is output: "standalone" set in next.config.ts?`);
  process.exit(1);
}

cpSync("public", `${standalone}/public`, { recursive: true });
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
console.log("Copied public/ and .next/static/ into .next/standalone/");

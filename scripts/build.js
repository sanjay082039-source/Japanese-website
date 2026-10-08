const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");

// 1. Ensure DATABASE_URL fallback exists in environment
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

// 2. Ensure .env exists so Prisma CLI never fails with P1012
const envPath = path.join(rootDir, ".env");
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(
    envPath,
    'DATABASE_URL="file:./dev.db"\nNEXTAUTH_SECRET="nihongo-secure-production-master-secret-2026-key"\nJWT_SECRET="nihongo-secure-production-master-secret-2026-key"\nNEXTAUTH_URL="http://localhost:3000"\n'
  );
  console.log("[Build] Created fallback .env file for build environment.");
}

// 3. Update initial-db.ts snapshot from prisma/dev.db if present
const dbPath = path.join(rootDir, "prisma", "dev.db");
if (fs.existsSync(dbPath)) {
  try {
    const dbBytes = fs.readFileSync(dbPath);
    const b64 = dbBytes.toString("base64");
    const initialDbFile = path.join(rootDir, "src", "lib", "initial-db.ts");
    fs.writeFileSync(initialDbFile, `export const SEED_DB_BASE64 = "${b64}";\n`);
    console.log(`[Build] Updated src/lib/initial-db.ts with latest dev.db (${dbBytes.length} bytes).`);
  } catch (err) {
    console.warn("[Build] Warning: Could not update initial-db.ts:", err.message);
  }
}

// 4. Run Prisma generate
console.log("[Build] Running Prisma generate...");
execSync("npx prisma generate", { stdio: "inherit", env: process.env, cwd: rootDir });

// 5. Database synchronization
// If on local development or non-serverless, sync schema and seed
const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER);
if (!isVercel) {
  try {
    console.log("[Build] Syncing local Prisma database schema...");
    execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", env: process.env, cwd: rootDir });
  } catch (err) {
    console.warn("[Build] Local db push skipped or failed:", err.message);
  }
} else {
  console.log("[Build] Running in Vercel environment. Database snapshot bundled in initial-db.ts.");
}

// 6. Run Next.js build
console.log("[Build] Running Next.js build...");
execSync("npx next build", { stdio: "inherit", env: process.env, cwd: rootDir });

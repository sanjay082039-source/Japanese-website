import { PrismaClient } from "@prisma/client";
import fs from "fs";
import { SEED_DB_BASE64 } from "./initial-db";

function getDatabaseUrl(): string {
  const currentUrl = process.env.DATABASE_URL;
  if (currentUrl && (currentUrl.startsWith("postgresql://") || currentUrl.startsWith("postgres://"))) {
    return currentUrl;
  }

  // Check if running on Vercel or serverless environment
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL_ENV ||
    process.env.NOW_REGION
  );

  if (isServerless) {
    const tmpDb = "/tmp/dev.db";
    try {
      if (!fs.existsSync(tmpDb) || fs.statSync(tmpDb).size === 0) {
        fs.writeFileSync(tmpDb, Buffer.from(SEED_DB_BASE64, "base64"));
      }
    } catch (err) {
      console.error("Vercel SQLite init error:", err);
    }
    // Explicitly set process.env.DATABASE_URL so Prisma's Rust Query Engine respects the writable /tmp path
    process.env.DATABASE_URL = "file:/tmp/dev.db";
    return "file:/tmp/dev.db";
  }

  return process.env.DATABASE_URL || "file:./dev.db";
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const dbUrl = getDatabaseUrl();

export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;

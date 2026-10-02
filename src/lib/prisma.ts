import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

function getDatabaseUrl(): string {
  // Check if running on Vercel or serverless environment
  if (process.env.VERCEL) {
    const tmpDb = "/tmp/dev.db";
    try {
      if (!fs.existsSync(tmpDb)) {
        const candidates = [
          path.join(process.cwd(), "prisma", "dev.db"),
          path.join("/var/task", "prisma", "dev.db"),
          path.resolve("./prisma/dev.db"),
        ];

        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            fs.copyFileSync(candidate, tmpDb);
            break;
          }
        }
      }
    } catch (err) {
      console.error("Vercel SQLite init error:", err);
    }
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


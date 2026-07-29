import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient, Prisma } from "@prisma/client";

// Re-exported so services can use Prisma.DbNull/JsonNull etc. without a direct @prisma/client dep
// (e.g. clearing a nullable Json column to SQL NULL, which a plain `null` does not do).
export { Prisma };

const globalForPrisma = globalThis as { prisma?: PrismaClient };

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

function loadWorkspaceEnv(): Record<string, string> {
  const discovered: string[] = [];
  let currentDir = process.cwd();

  while (true) {
    const envPath = path.join(currentDir, ".env");
    const envLocalPath = path.join(currentDir, ".env.local");
    const workspaceMarker = path.join(currentDir, "pnpm-workspace.yaml");

    if (existsSync(envPath)) discovered.push(envPath);
    if (existsSync(envLocalPath)) discovered.push(envLocalPath);
    if (existsSync(workspaceMarker)) break;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return discovered.reverse().reduce<Record<string, string>>((acc, filePath) => {
    Object.assign(acc, parseEnvFile(filePath));
    return acc;
  }, {});
}

function firstDefined(source: Record<string, string | undefined>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function resolveDatabaseUrl(source: Record<string, string | undefined>): string | undefined {
  const directUrl = firstDefined(source, ["DATABASE_URL"]);
  if (directUrl) return directUrl;

  const host = firstDefined(source, ["DATABASE_HOST", "DB_HOST", "PGHOST"]);
  const port = firstDefined(source, ["DATABASE_PORT", "DB_PORT", "PGPORT"]) ?? "5432";
  const database = firstDefined(source, ["DATABASE_NAME", "DB_NAME", "PGDATABASE"]);
  const username = firstDefined(source, ["DATABASE_USER", "DB_USER", "PGUSER"]);
  const password = firstDefined(source, ["DATABASE_PASSWORD", "DB_PASSWORD", "PGPASSWORD"]);

  if (!host || !database || !username) {
    return undefined;
  }

  const query = new URLSearchParams();
  const sslMode = firstDefined(source, ["DATABASE_SSLMODE", "DB_SSLMODE", "PGSSLMODE"]);
  const schema = firstDefined(source, ["DATABASE_SCHEMA", "DB_SCHEMA"]);

  if (sslMode) query.set("sslmode", sslMode);
  if (schema) query.set("schema", schema);

  const credentials = password
    ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}`
    : encodeURIComponent(username);
  const queryString = query.toString();

  return `postgresql://${credentials}@${host}:${port}/${database}${queryString ? `?${queryString}` : ""}`;
}

const POSTGRES_URL_PATTERN = /^postgres(ql)?:\/\//i;

// Trim whitespace/newlines and a single layer of surrounding quotes. Several secret injectors
// (Helm `valueFrom`, some Secrets Manager -> env mappings) wrap the value in quotes or append a
// trailing newline, which alone is enough to fail Prisma's `postgresql://` protocol check.
function sanitizeDatabaseUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let cleaned = value.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

// Reveal only the *shape* of a bad value (JSON blob, jdbc:, arn:, host-only) so an operator can
// diagnose it from logs, without leaking credentials.
function maskDatabaseUrl(value: string): string {
  return `${value.slice(0, 12)}${value.length > 12 ? "…" : ""} (length=${value.length})`;
}

// A whole AWS Secrets Manager JSON secret can land in DATABASE_URL when the injector maps the
// secret without selecting a key (ECS `valueFrom` without `:KEY::`, ESO `dataFrom` misuse, etc.).
// Recover the real URL from the two shapes we actually see:
//   1. our app-config blob: {"DATABASE_URL":"postgresql://…", "JWT_SECRET":"…", …}
//   2. an RDS-managed-secret blob: {"host","port","username","password","dbname"|"database"}
function extractDatabaseUrlFromJson(value: string): string | undefined {
  if (!value.startsWith("{")) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const obj = parsed as Record<string, unknown>;
  const asString = (key: string): string | undefined => {
    const raw = obj[key];
    if (typeof raw === "string") return raw;
    if (typeof raw === "number") return String(raw);
    return undefined;
  };

  const nestedUrl = sanitizeDatabaseUrl(asString("DATABASE_URL"));
  if (nestedUrl && POSTGRES_URL_PATTERN.test(nestedUrl)) return nestedUrl;

  const host = asString("host");
  const username = asString("username");
  const database = asString("dbname") ?? asString("database");
  if (host && username && database) {
    const password = asString("password");
    const port = asString("port") ?? "5432";
    const credentials = password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}`
      : encodeURIComponent(username);
    return `postgresql://${credentials}@${host}:${port}/${database}`;
  }

  return undefined;
}

// Prisma resolves env("DATABASE_URL") when the client is constructed, which can happen before an
// individual service calls its own config loader. Resolve it here as a shared safety net.
{
  const sanitized = sanitizeDatabaseUrl(process.env.DATABASE_URL);

  if (sanitized && POSTGRES_URL_PATTERN.test(sanitized)) {
    // Persist the cleaned value so Prisma reads a well-formed URL (fixes quote/whitespace cases).
    process.env.DATABASE_URL = sanitized;
  } else {
    // Either unset/empty, or set to something malformed (an RDS secret JSON blob, a jdbc: URL, a
    // Secrets Manager ARN, or a bare host). Recover it, in priority order:
    const fileEnv = loadWorkspaceEnv();

    // 1. A valid DATABASE_URL from a .env file (the local-dev case: process.env has none but the
    //    workspace .env does). This must win over an unset/malformed process-env value.
    const fromFile = sanitizeDatabaseUrl(fileEnv.DATABASE_URL);

    // 2. Rebuild from discrete DATABASE_* parts (DATABASE_HOST/USER/PASSWORD/NAME). The malformed
    //    process-env DATABASE_URL is dropped here so it can't shadow a parts-based rebuild.
    const rebuilt = sanitizeDatabaseUrl(
      resolveDatabaseUrl({ ...fileEnv, ...process.env, DATABASE_URL: undefined })
    );

    // 3. Recover a URL that arrived wrapped in a whole Secrets Manager JSON blob.
    const fromJson = sanitized ? extractDatabaseUrlFromJson(sanitized) : undefined;

    if (fromFile && POSTGRES_URL_PATTERN.test(fromFile)) {
      process.env.DATABASE_URL = fromFile;
    } else if (rebuilt && POSTGRES_URL_PATTERN.test(rebuilt)) {
      process.env.DATABASE_URL = rebuilt;
    } else if (fromJson && POSTGRES_URL_PATTERN.test(fromJson)) {
      process.env.DATABASE_URL = fromJson;
      console.warn(
        "[@eventrax/database] DATABASE_URL arrived as a JSON secret blob and was auto-extracted. " +
          "Fix the secret injection to map the DATABASE_URL key individually (e.g. ECS valueFrom " +
          "`...:secret:<name>:DATABASE_URL::`) so this fallback isn't relied on."
      );
    } else if (sanitized) {
      // A value is present but neither it nor the discrete parts yield a valid URL. Leave it in
      // place (Prisma will still error per-query) but log ONCE at startup with the value's shape
      // so the misconfiguration is diagnosable instead of an opaque per-request 500.
      console.error(
        `[@eventrax/database] DATABASE_URL is set but is not a valid Postgres connection string ` +
          `(must start with postgresql:// or postgres://). Received: ${maskDatabaseUrl(sanitized)}. ` +
          `If your secret store injects an RDS JSON blob, map its fields to ` +
          `DATABASE_HOST/DATABASE_USER/DATABASE_PASSWORD/DATABASE_NAME instead, or store a URL string.`
      );
    }
    // If nothing is present at all, leave DATABASE_URL unset so Prisma emits its own
    // "environment variable not found" error — unchanged prior behaviour.
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "./audit.js";
export * from "./tenant-context.js";
export * from "./reconcile-enquiry-dispatch.js";
export * from "./route-inbound-flow.js";
export * from "./mirror-enquiry-status.js";
export * from "./dispatch-notification.js";
export * from "./gdpr-retention.js";

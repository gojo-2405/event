import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadConfig } from "../src/index.js";

const originalEnv = { ...process.env };

function resetEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
}

describe("loadConfig database resolution", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.OTEL_ENABLED = "false";
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_FILE;
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    delete process.env.DATABASE_NAME;
    delete process.env.DATABASE_USER;
    delete process.env.DATABASE_PASSWORD;
    delete process.env.DATABASE_SSLMODE;
    delete process.env.DATABASE_SCHEMA;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_SSLMODE;
    delete process.env.DB_SCHEMA;
    delete process.env.PGHOST;
    delete process.env.PGPORT;
    delete process.env.PGDATABASE;
    delete process.env.PGUSER;
    delete process.env.PGPASSWORD;
    delete process.env.PGSSLMODE;
  });

  afterEach(() => {
    resetEnv();
  });

  it("builds DATABASE_URL from split DATABASE_* variables", () => {
    const config = loadConfig({
      DATABASE_URL: undefined,
      DATABASE_HOST: "db.internal",
      DATABASE_PORT: "5433",
      DATABASE_NAME: "eventrax",
      DATABASE_USER: "svc_user",
      DATABASE_PASSWORD: "p@ss word",
      DATABASE_SSLMODE: "require",
      DATABASE_SCHEMA: "public"
    });

    expect(config.DATABASE_URL).toBe(
      "postgresql://svc_user:p%40ss%20word@db.internal:5433/eventrax?sslmode=require&schema=public"
    );
  });

  it("reads DATABASE_URL from a file when DATABASE_URL_FILE is set", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "eventrax-config-"));
    const secretFile = path.join(tempDir, "database-url.txt");
    writeFileSync(secretFile, "postgresql://file-user:file-pass@file-host:5432/file-db\n");

    try {
      const config = loadConfig({
        DATABASE_URL: undefined,
        DATABASE_URL_FILE: secretFile
      });

      expect(config.DATABASE_URL).toBe("postgresql://file-user:file-pass@file-host:5432/file-db");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});

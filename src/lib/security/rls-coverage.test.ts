import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every table the migrations create in `public` must have row level security switched on by the migrations themselves (the project
// rule; the database also auto-enables it, but the migrations must not depend on that). Also checks that no migration DISABLES it.
const dir = path.join(process.cwd(), "supabase", "migrations");
const sql = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort().map((name) => readFileSync(path.join(dir, name), "utf8")).join("\n");

describe("row level security in the migrations", () => {
  it("is enabled for every table created in public", () => {
    const created = [...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((match) => match[1]);
    const dropped = new Set([...sql.matchAll(/drop table (?:if exists )?(?:public\.)?(\w+)/gi)].map((match) => match[1]));
    const enabled = new Set([...sql.matchAll(/alter table (?:if exists )?(?:only )?public\.(\w+)\s+enable row level security/gi)].map((match) => match[1]));
    const missing = [...new Set(created)].filter((table) => !dropped.has(table) && !enabled.has(table));
    expect(missing).toEqual([]);
  });
  it("is never disabled", () => {
    expect([...sql.matchAll(/disable row level security/gi)]).toHaveLength(0);
    expect([...sql.matchAll(/no force row level security/gi)]).toHaveLength(0);
  });
  it("no migration grants table access to anon or public wholesale", () => {
    const grants = [...sql.matchAll(/grant\s+(all|insert|update|delete)[^;]*\bto\s+(anon|public)\b[^;]*;/gi)].map((match) => match[0]);
    expect(grants).toEqual([]);
  });
});

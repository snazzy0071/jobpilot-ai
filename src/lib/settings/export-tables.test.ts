import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXPORT_EXCLUDED_TABLES, EXPORT_TABLES } from "@/lib/settings/export-tables";

// Drift guard: every table the migrations create with a user id that references auth.users must be in the account data export, or be
// excluded with a stated reason. Adding a personal-data table and forgetting the export fails here.
function userOwnedTables(): string[] {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const found = new Set<string>();
  const dropped = new Set<string>();
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql"))) {
    const sql = readFileSync(path.join(dir, file), "utf8");
    for (const match of sql.matchAll(/drop table (?:if exists )?(?:public\.)?(\w+)/gi)) dropped.add(match[1]);
    for (const match of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g)) {
      if (/user_id\s+uuid[^,\n]*references\s+auth\.users/i.test(match[2])) found.add(match[1]);
    }
  }
  return [...found].filter((table) => !dropped.has(table)).sort();
}

describe("account data export coverage", () => {
  it("covers every table that stores data against a user id", () => {
    const covered = new Set([...EXPORT_TABLES.map((entry) => entry.table), ...EXPORT_EXCLUDED_TABLES.map((entry) => entry.table)]);
    const missing = userOwnedTables().filter((table) => !covered.has(table));
    expect(missing).toEqual([]);
  });
  it("lists no table twice and gives every exclusion a reason", () => {
    const names = EXPORT_TABLES.map((entry) => entry.table);
    expect(new Set(names).size).toBe(names.length);
    for (const entry of EXPORT_EXCLUDED_TABLES) expect(entry.reason.length).toBeGreaterThan(20);
  });
});

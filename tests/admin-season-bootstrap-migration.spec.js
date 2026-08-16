import { test, expect } from "@playwright/test";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/202608150001_admin_season_bootstrap.sql", "utf8");

test("season bootstrap commands are administrator-only and organization-scoped", () => {
  expect(migration.match(/if not public\.is_administrator\(\)/g)?.length).toBe(2);
  expect(migration).toContain("v_organization_id uuid := public.current_organization_id()");
  expect(migration).toContain("where organization_id = v_organization_id");
  expect(migration).toContain("and organization_id = v_organization_id");
});

test("active season transitions are atomic within one database command", () => {
  const createFunction = migration.slice(
    migration.indexOf("create or replace function public.create_season"),
    migration.indexOf("create or replace function public.activate_season")
  );
  expect(createFunction).toContain("update public.seasons");
  expect(createFunction).toContain("set active = false");
  expect(createFunction).toContain("insert into public.seasons");
  expect(createFunction).toContain("p_active");

  const activateFunction = migration.slice(migration.indexOf("create or replace function public.activate_season"));
  expect(activateFunction).toContain("set active = false");
  expect(activateFunction).toContain("set active = true");
  expect(activateFunction).toContain("where id = p_season_id");
});

test("season commands are not executable by public or anonymous callers", () => {
  expect(migration).toContain("revoke all on function public.create_season(text, date, date, boolean) from public");
  expect(migration).toContain("revoke all on function public.activate_season(uuid) from public");
  expect(migration).toContain("grant execute on function public.create_season(text, date, date, boolean) to authenticated");
  expect(migration).toContain("grant execute on function public.activate_season(uuid) to authenticated");
});

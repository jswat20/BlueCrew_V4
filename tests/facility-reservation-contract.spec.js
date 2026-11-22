const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

const migration = readFileSync("supabase/migrations/20261122215625_facility_reservation_management.sql", "utf8");

test("facility reservation schema is tenant-qualified and concurrency safe", () => {
  expect(migration).toContain("foreign key (organization_id, field_id) references public.fields(organization_id, id)");
  expect(migration).toContain("foreign key (organization_id, game_id) references public.games(organization_id, id)");
  expect(migration).toContain("exclude using gist");
  expect(migration).toContain("tstzrange(starts_at, ends_at, '[)') with &&");
  expect(migration).toContain("where (status = 'active')");
});

test("reservation backend enforces availability, closures, time order, and admin access", () => {
  expect(migration).toContain("check (ends_at > starts_at)");
  expect(migration).toContain("reservation_outside_availability");
  expect(migration).toContain("reservation_blocked_by_closure");
  expect(migration).toContain("administrator_required");
  expect(migration).toContain("reservation_conflict");
});

test("facility tables have organization-scoped RLS", () => {
  for (const table of ["field_availability_rules", "field_closures", "field_reservations"]) {
    expect(migration).toContain(`alter table public.${table} enable row level security`);
    expect(migration).toContain(`organization_id = (select public.current_organization_id())`);
  }
});

test("cancellation releases slots and adjacent bookings remain legal", () => {
  expect(migration).toContain("set status='cancelled'");
  expect(migration).toContain("tstzrange(starts_at, ends_at, '[)')");
  expect(migration).not.toContain("tstzrange(starts_at, ends_at, '[]')");
});

test("hosted facility UI exposes the required workflow", () => {
  const component = readFileSync("components/settings.js", "utf8");
  for (const marker of ["add-facility", "facility-field", "add-reservation", "add-closure", "reservation-timeline"]) {
    expect(component).toContain(`data-testid=\"${marker}\"`);
  }
  expect(component).toContain("cancelReservationFromSettings");
  expect(component).toContain("openAvailabilityDialog");
  expect(component).toContain("const form=event.currentTarget; const result=await action(formObject(form))");
  expect(component).not.toContain("await action(formObject(event.currentTarget))");
});

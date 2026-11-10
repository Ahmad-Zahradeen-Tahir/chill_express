import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { addSimple, checkout, chooseBranch, env, openStaffOrder, simulatePay, staffLogin } from "./helpers";

test("delivery order has no reject or cancel option anywhere; approval moves it on", async ({ browser }) => {
  const customer = await browser.newPage();
  await chooseBranch(customer, "Lagos Street");
  await addSimple(customer, "Frosty Chillerz");
  await checkout(customer, { type: "DELIVERY" });
  await expect(customer.getByText("₦5,000").first()).toBeVisible(); // 3,000 + ₦2,000 delivery
  const ref = await simulatePay(customer, "success");

  const staff = await browser.newPage();
  await staffLogin(staff, "lagos.manager@demo.chillexpress.local");
  await openStaffOrder(staff, ref);
  await expect(staff.getByRole("button", { name: /reject|cancel/i })).toHaveCount(0);
  await staff.getByRole("button", { name: "Approve" }).click();
  await expect(staff.getByRole("button", { name: "Start preparing" })).toBeVisible();
  await expect(staff.getByRole("button", { name: /reject|cancel/i })).toHaveCount(0);

  // Filters no longer offer Rejected / Cancelled statuses.
  await staff.goto("/staff/orders");
  await expect(staff.locator("select[name=s] option", { hasText: /Rejected|Cancelled/ })).toHaveCount(0);
});

test("unavailable products cannot be ordered", async ({ browser }) => {
  const mgr = await browser.newPage();
  await staffLogin(mgr, "gombole.manager@demo.chillexpress.local");
  await mgr.goto("/admin/menu");
  // Branch manager: only their own branch's switch, and no editing controls.
  await expect(mgr.getByRole("link", { name: "New product" })).toHaveCount(0);
  await expect(mgr.getByRole("switch", { name: "Lagos Street availability" })).toHaveCount(0);
  const row = mgr.getByRole("listitem").filter({ hasText: /^Soda/ });
  const sw = row.getByRole("switch", { name: "Gombole Road availability" });
  await sw.click();
  await expect(sw).toContainText("Sold out");

  const customer = await browser.newPage();
  await chooseBranch(customer, "Gombole Road");
  await expect(customer.getByRole("button", { name: "Add Soda" })).toBeDisabled();
  // Lagos Street is unaffected
  await chooseBranch(customer, "Lagos Street");
  await expect(customer.getByRole("button", { name: "Add Soda" })).toBeEnabled();

  await mgr.reload();
  await expect(sw).toContainText("Sold out"); // persisted
  await sw.click(); // restore
  await expect(sw).toContainText("Available");
});

test("branch and role permissions are enforced on the server", async ({ browser, request }) => {
  // Anonymous
  const anon = await browser.newPage();
  await anon.goto("/staff");
  await expect(anon).toHaveURL(/\/staff\/login/);
  expect((await request.get("/api/reports/sales?format=xlsx")).status()).toBe(401);

  // Gombole cashier cannot open a Lagos order, admin pages or exports
  const lagos = await browser.newPage();
  await staffLogin(lagos, "lagos.cashier@demo.chillexpress.local");
  await lagos.goto("/staff/orders?from=");
  const href = await lagos.getByRole("link", { name: /^CE-LS-/ }).first().getAttribute("href");

  const cashier = await browser.newPage();
  await staffLogin(cashier, "gombole.cashier@demo.chillexpress.local");
  const res = await cashier.goto(href!);
  expect(res?.status()).toBe(404);
  await cashier.goto("/admin/staff");
  await expect(cashier).toHaveURL(/denied=staff.manage/);
  const exp = await cashier.request.get("/api/reports/sales?format=xlsx");
  expect(exp.status()).toBe(403);
  await cashier.goto("/staff/orders?b=" + "00000000-0000-0000-0000-000000000000");
  await expect(cashier.getByRole("link", { name: /^CE-LS-/ })).toHaveCount(0);
});

test("webhooks: bad signatures rejected, duplicates processed once", async ({ request }) => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "DOES_NOT_EXIST_" + Date.now() } });
  const bad = await request.post("/api/paystack/webhook", { data: body, headers: { "content-type": "application/json", "x-paystack-signature": "deadbeef" } });
  expect(bad.status()).toBe(401);
  const sig = createHmac("sha512", env.DEV_SIM_SECRET).update(body).digest("hex");
  const first = await request.post("/api/paystack/webhook", { data: body, headers: { "content-type": "application/json", "x-paystack-signature": sig } });
  expect(first.status()).toBe(200);
  expect(await first.json()).toEqual({ ok: true });
  const dup = await request.post("/api/paystack/webhook", { data: body, headers: { "content-type": "application/json", "x-paystack-signature": sig } });
  expect(await dup.json()).toEqual({ ok: true, duplicate: true });
});

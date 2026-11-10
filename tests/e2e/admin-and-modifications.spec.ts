import { expect, test } from "@playwright/test";
import { addSimple, checkout, chooseBranch, openStaffOrder, simulatePay, staffLogin } from "./helpers";

test("modification that raises the total holds the order until the extra Paystack payment is verified", async ({ browser }) => {
  const customer = await browser.newPage();
  await chooseBranch(customer, "Gombole Road");
  await addSimple(customer, "Soda"); // ₦1,500
  await checkout(customer, { type: "PICKUP" });
  const ref = await simulatePay(customer, "success");

  const mgr = await browser.newPage();
  await staffLogin(mgr, "gombole.manager@demo.chillexpress.local");
  await openStaffOrder(mgr, ref);
  await mgr.getByRole("button", { name: "Approve" }).click();
  await expect(mgr.getByRole("button", { name: "Start preparing" })).toBeVisible();
  await mgr.getByRole("button", { name: "Edit" }).click();
  await mgr.getByRole("combobox").first().selectOption({ label: "Ice Cream (₦2,500)" });
  await mgr.getByRole("button", { name: "Add", exact: true }).click();
  await expect(mgr.getByText("Customer must pay ₦2,500 extra")).toBeVisible();
  await mgr.getByPlaceholder("e.g. Customer called to add a soda").fill("Customer phoned to add ice cream");
  await mgr.getByRole("button", { name: "Save changes" }).click();
  await expect(mgr.getByText("Awaiting extra payment").first()).toBeVisible();
  // Kitchen actions are not available while on hold, and the paid total is unchanged.
  await expect(mgr.getByRole("button", { name: "Start preparing" })).toHaveCount(0);

  await customer.reload();
  await customer.getByRole("link", { name: /Pay extra ₦2,500/ }).click();
  await simulatePay(customer, "success");
  await expect(customer.getByText("Ice Cream")).toBeVisible();
  await expect(customer.getByText("₦4,000").first()).toBeVisible();

  await mgr.reload();
  await expect(mgr.getByText("Confirmed").first()).toBeVisible(); // restored to previous status
  await expect(mgr.getByRole("button", { name: "Start preparing" })).toBeVisible();
});

test("modification that lowers the total is applied immediately, with no refund", async ({ browser }) => {
  const customer = await browser.newPage();
  await chooseBranch(customer, "Gombole Road");
  await addSimple(customer, "Soda");
  await addSimple(customer, "Ice Cream");
  await checkout(customer, { type: "PICKUP" });
  const ref = await simulatePay(customer, "success");

  const mgr = await browser.newPage();
  await staffLogin(mgr, "gombole.manager@demo.chillexpress.local");
  await openStaffOrder(mgr, ref);
  await mgr.getByRole("button", { name: "Edit" }).click();
  await mgr.getByRole("button", { name: "Remove item" }).last().click();
  await expect(mgr.getByText("No money is returned automatically")).toBeVisible();
  await mgr.getByPlaceholder("e.g. Customer called to add a soda").fill("Ice cream machine down");
  await mgr.getByRole("button", { name: "Save changes" }).click();
  await expect(mgr.getByText("Changes saved.")).toBeVisible();
  await mgr.reload();
  await expect(mgr.getByText("Pending approval").first()).toBeVisible(); // not held for payment
  await expect(mgr.locator("dt", { hasText: /^Order total$/ }).first().locator("xpath=following-sibling::dd[1]")).toHaveText("₦1,500"); // 4,000 − ice cream
  await expect(mgr.getByText(/refund/i)).toHaveCount(0);
});

test("CEO creates, suspends and reactivates staff; suspended staff cannot sign in", async ({ browser }) => {
  const ceo = await browser.newPage();
  await staffLogin(ceo, "ceo@demo.chillexpress.local");
  await ceo.goto("/admin/staff");
  const email = `e2e.cashier.${Date.now()}@demo.chillexpress.local`;
  const form = ceo.locator("form", { has: ceo.getByRole("button", { name: "Create account" }) });
  await form.getByLabel("Full name").fill("E2E Cashier (Demo)");
  await form.getByLabel("Work email").fill(email);
  await form.getByLabel("Gombole Road").check();
  await form.getByRole("button", { name: "Create account" }).click();
  const temp = (await form.locator("code").textContent())!.trim();
  expect(temp).toMatch(/^Chill-/);

  const newbie = await browser.newPage();
  await newbie.goto("/staff/login");
  await newbie.getByLabel("Work email").fill(email);
  await newbie.getByLabel("Password").fill(temp);
  await newbie.getByRole("button", { name: "Sign in" }).click();
  await expect(newbie).toHaveURL(/\/staff\/password/);

  ceo.on("dialog", (d) => d.accept());
  await ceo.reload();
  const card = ceo.locator("div.rounded-2xl", { hasText: email }).first();
  await card.getByRole("button", { name: "Suspend" }).click();
  await expect(card.getByText("suspended", { exact: true })).toBeVisible();

  // Existing session is revoked immediately
  await newbie.goto("/staff");
  await expect(newbie).toHaveURL(/\/staff\/login/);
  await newbie.getByLabel("Work email").fill(email);
  await newbie.getByLabel("Password").fill(temp);
  await newbie.getByRole("button", { name: "Sign in" }).click();
  await expect(newbie.getByText("This account is suspended")).toBeVisible();

  await card.getByRole("button", { name: "Reactivate" }).click();
  await expect(card.getByText("suspended", { exact: true })).toHaveCount(0);
});

test("menu price changes go live and are server-enforced", async ({ browser }) => {
  const ceo = await browser.newPage();
  await staffLogin(ceo, "ceo@demo.chillexpress.local");
  await ceo.goto("/admin/menu");
  await ceo.getByRole("link", { name: /Soda/ }).click();
  const price = ceo.getByLabel("Base price (₦)");
  await expect(price).toHaveValue("1500");
  await price.fill("1600");
  await ceo.getByRole("button", { name: "Save product" }).click();
  await expect(ceo.getByText("Saved.")).toBeVisible();

  const customer = await browser.newPage();
  await chooseBranch(customer, "Gombole Road");
  await expect(customer.getByRole("article").filter({ hasText: "Soda" })).toContainText("₦1,600");

  // restore official price
  await price.fill("1500");
  await ceo.getByRole("button", { name: "Save product" }).click();
  await expect(ceo.getByText("Saved.")).toBeVisible();
  await customer.reload();
  await expect(customer.getByRole("article").filter({ hasText: "Soda" })).toContainText("₦1,500");
});

import { expect, test, type Page } from "@playwright/test";
import { addSimple, checkout, chooseBranch, simulatePay, staffLogin } from "./helpers";

const badge = (page: Page) => page.getByRole("link", { name: /^Notifications/ }).first().locator("span.rounded-full");

test("notifications are marked read once opened (list page and order page)", async ({ browser }) => {
  const staff = await browser.newPage();
  await staffLogin(staff, "gombole.cashier@demo.chillexpress.local");

  // Opening the notifications page clears the unread badge and the unread dots.
  await staff.goto("/staff/notifications");
  await expect(badge(staff)).toHaveCount(0);
  await expect(staff.locator("li span.bg-brand-red")).toHaveCount(0);

  // A new paid order raises a fresh notification…
  const customer = await browser.newPage();
  await chooseBranch(customer, "Gombole Road");
  await addSimple(customer, "Soda");
  await checkout(customer, { type: "PICKUP" });
  const ref = await simulatePay(customer, "success");

  await staff.goto("/staff");
  await expect(badge(staff)).toHaveText("1");

  // …which disappears from the unread count once the order itself is opened.
  await staff.getByRole("link", { name: ref }).first().click();
  await expect(staff.getByRole("heading", { name: ref })).toBeVisible();
  await expect(badge(staff)).toHaveCount(0);
  await staff.goto("/staff/notifications");
  await expect(staff.locator("li span.bg-brand-red")).toHaveCount(0);
});

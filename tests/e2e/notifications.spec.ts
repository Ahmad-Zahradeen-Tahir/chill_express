import { expect, test, type Page } from "@playwright/test";
import { addSimple, checkout, chooseBranch, simulatePay, staffLogin } from "./helpers";

const badge = (page: Page) => page.getByRole("link", { name: /^Notifications/ }).first().locator("span.rounded-full");
const items = (page: Page) => page.locator("main li button, li button").filter({ hasText: /./ });

async function newPaidOrder(page: Page) {
  await chooseBranch(page, "Gombole Road");
  await addSimple(page, "Soda");
  await checkout(page, { type: "PICKUP" });
  return simulatePay(page, "success");
}

test("notifications: viewing does not clear, clicking clears one, Mark all read clears all", async ({ browser }) => {
  const staff = await browser.newPage();
  await staffLogin(staff, "gombole.cashier@demo.chillexpress.local");
  await staff.goto("/staff/notifications");
  if (await staff.getByRole("button", { name: "Mark all read" }).count()) await staff.getByRole("button", { name: "Mark all read" }).click();
  await expect(staff.getByText("You're all caught up")).toBeVisible();
  await expect(badge(staff)).toHaveCount(0);

  const customer = await browser.newPage();
  const ref1 = await newPaidOrder(customer);
  const ref2 = await newPaidOrder(customer);

  // Just opening the tab (and opening the order directly) must NOT mark anything read.
  await staff.goto(`/staff/orders?q=${ref1}&from=`);
  await staff.getByRole("link", { name: ref1 }).click();
  await staff.goto("/staff/notifications");
  await expect(items(staff)).toHaveCount(2);
  await staff.reload();
  await expect(items(staff)).toHaveCount(2);
  await expect(badge(staff)).toHaveText("2");

  // Clicking a notification opens it and removes only that one.
  await items(staff).filter({ hasText: ref2 }).click();
  await expect(staff.getByRole("heading", { name: ref2 })).toBeVisible();
  await expect(badge(staff)).toHaveText("1");
  await staff.goto("/staff/notifications");
  await expect(items(staff)).toHaveCount(1);
  await expect(items(staff).filter({ hasText: ref1 })).toHaveCount(1);

  // Mark all read clears the inbox.
  await staff.getByRole("button", { name: "Mark all read" }).click();
  await expect(staff.getByText("You're all caught up")).toBeVisible();
  await expect(badge(staff)).toHaveCount(0);
});

import { expect, test, type Page } from "@playwright/test";
import { addSimple, checkout, chooseBranch, simulatePay, staffLogin } from "./helpers";

async function newPaidOrder(page: Page) {
  await chooseBranch(page, "Gombole Road");
  await addSimple(page, "Soda");
  await checkout(page, { type: "PICKUP" });
  return simulatePay(page, "success");
}

const polled = (page: Page) => page.waitForResponse((r) => r.url().includes("/api/staff/new-orders") && r.ok());

test("cashier gets a popup per new order, stacked oldest first, each closed with Okay", async ({ browser }) => {
  const staff = await browser.newPage();
  // Count the notes played, since a test can't listen to the speakers.
  await staff.addInitScript(() => {
    const w = window as unknown as { __notes: number };
    w.__notes = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args: [number?]) {
      w.__notes++;
      return start.apply(this, args);
    };
  });
  const notes = () => staff.evaluate(() => (window as unknown as { __notes: number }).__notes);
  await staffLogin(staff, "gombole.cashier@demo.chillexpress.local");
  const first = polled(staff);
  await staff.goto("/staff");
  await first; // orders already waiting at sign-in don't pop up
  const popup = staff.getByRole("alertdialog", { name: "New order" });
  await expect(popup).toHaveCount(0);
  expect(await notes()).toBe(0);

  const customer = await browser.newPage();
  const ref1 = await newPaidOrder(customer);
  const ref2 = await newPaidOrder(customer);

  // Shows up by itself on the next poll, oldest order on top.
  await expect(popup).toBeVisible({ timeout: 12_000 });
  await expect(popup).toContainText(ref1);
  await expect(popup).toContainText("1 of 2");
  await expect(popup).toContainText("1× Soda");
  // A ring is two bursts of four notes, played once per poll that finds new orders.
  const played = await notes();
  expect(played).toBeGreaterThan(0);
  expect(played % 8).toBe(0);
  await popup.getByRole("button", { name: "Okay" }).click();

  await expect(popup).toContainText(ref2);
  await expect(popup).not.toContainText("1 of");
  await popup.getByRole("button", { name: "Okay" }).click();
  await expect(popup).toHaveCount(0);

  // Acknowledged orders stay acknowledged, while still waiting on the queue for approval.
  const again = polled(staff);
  await staff.reload();
  await again;
  await expect(popup).toHaveCount(0);
  await expect(staff.getByRole("link", { name: ref1 })).toBeVisible();

  // Okay also cleared those orders' "New paid order" notifications for this cashier.
  await staff.goto("/staff/notifications");
  await expect(staff.getByRole("heading", { name: /Notifications/i }).first()).toBeVisible();
  await expect(staff.getByText(`New paid order · ${ref1}`)).toHaveCount(0);
  await expect(staff.getByText(`New paid order · ${ref2}`)).toHaveCount(0);

  // Managers don't get the popups.
  const mgr = await browser.newPage();
  await staffLogin(mgr, "gombole.manager@demo.chillexpress.local");
  await mgr.goto("/staff");
  await mgr.waitForTimeout(1500);
  await expect(mgr.getByRole("alertdialog")).toHaveCount(0);
  // ...and their own notifications are untouched by the cashier's Okay.
  await mgr.goto("/staff/notifications");
  await expect(mgr.getByText(`New paid order · ${ref1}`)).toBeVisible();
});

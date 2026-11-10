import { expect, test } from "@playwright/test";
import { addShawarma, addSimple, checkout, chooseBranch, openStaffOrder, simulatePay, staffLogin } from "./helpers";

test("full demo journey: order → pay → approve → kitchen → customer sees status → CEO analytics", async ({ browser }) => {
  const customer = await browser.newPage();
  // 1–5: visit, branch, browse, choose variations, add to cart
  await chooseBranch(customer, "Gombole Road");
  await addShawarma(customer, "Chicken", "King Size"); // ₦6,000
  await addSimple(customer, "Soda"); // ₦1,500
  await customer.goto("/menu?c=loaded-fries");
  await customer.getByRole("button", { name: "Add Regular Box" }).click();
  const d = customer.getByRole("dialog", { name: "Regular Box" });
  await d.getByRole("button", { name: /^With Cheese/ }).click();
  await d.getByRole("button", { name: /^Add · ₦3,500/ }).click(); // cheese variant price
  // 6–8: checkout (pickup) and pay
  await checkout(customer, { type: "PICKUP" });
  await expect(customer.getByText("₦11,000").first()).toBeVisible(); // 6,000 + 1,500 + 3,500
  const ref = await simulatePay(customer, "success");
  // 9: verified -> pending approval
  await expect(customer.getByText("Pending approval").first()).toBeVisible();

  // 10–13: cashier sees, approves, kitchen workflow
  const staff = await browser.newPage();
  await staffLogin(staff, "gombole.cashier@demo.chillexpress.local");
  await staff.goto("/staff");
  await expect(staff.getByRole("link", { name: ref })).toBeVisible();
  await openStaffOrder(staff, ref);
  await expect(staff.getByText("Chicken · King Size")).toBeVisible();
  await staff.getByRole("button", { name: "Approve" }).click();
  await expect(staff.getByText("Confirmed").first()).toBeVisible();
  await staff.getByRole("button", { name: "Start preparing" }).click();
  await expect(staff.getByRole("button", { name: "Ready for pickup" })).toBeVisible();
  await expect(staff.getByRole("button", { name: "Out for delivery" })).toHaveCount(0); // pickup order
  await staff.getByRole("button", { name: "Ready for pickup" }).click();
  await staff.getByRole("button", { name: "Complete" }).click();
  await expect(staff.getByText("Completed").first()).toBeVisible();

  // 14: customer sees status
  await customer.reload();
  await expect(customer.getByText("Order completed. Enjoy your meal!")).toBeVisible();

  // 15: CEO sees it in analytics (real data only, today)
  const ceo = await browser.newPage();
  await staffLogin(ceo, "ceo@demo.chillexpress.local");
  await ceo.goto("/admin?r=today&demo=0");
  const gross = ceo.locator("div", { hasText: /^Gross paid sales/ }).first();
  await expect(gross).toContainText("₦");
  const text = (await gross.textContent()) ?? "";
  const value = Number(text.replace(/[^\d]/g, "").slice(0, -0 || undefined));
  expect(value).toBeGreaterThan(0);
  await expect(ceo.getByText("Shawarma").first()).toBeVisible();
});

test("payment can be retried after a declined card; unpaid orders never reach staff", async ({ browser }) => {
  const customer = await browser.newPage();
  await chooseBranch(customer, "Lagos Street");
  await addSimple(customer, "Ice Cream");
  await checkout(customer, { type: "PICKUP" });
  const ref = await simulatePay(customer, "failed");
  await expect(customer.getByText("Payment was not completed")).toBeVisible();
  await expect(customer.getByText("Payment failed").first()).toBeVisible();

  const staff = await browser.newPage();
  await staffLogin(staff, "lagos.cashier@demo.chillexpress.local");
  await staff.goto(`/staff/orders?q=${ref}&from=`);
  await expect(staff.getByText("No orders match these filters.")).toBeVisible();

  // Retry and succeed
  await customer.getByRole("button", { name: /^Pay ₦2,500 with Paystack/ }).click();
  await customer.waitForURL(/simulated-payment/);
  await simulatePay(customer, "success");
  await expect(customer.getByText("Pending approval").first()).toBeVisible();
  await staff.goto(`/staff/orders?q=${ref}&from=`);
  await expect(staff.getByRole("link", { name: ref })).toBeVisible();
});

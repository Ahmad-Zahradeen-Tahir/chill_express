import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

export const PASSWORD = "ChillDemo#2026";
export const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

export async function chooseBranch(page: Page, name: "Gombole Road" | "Lagos Street") {
  await page.goto("/menu");
  await page.getByRole("button", { name: /Choose branch|Gombole Road|Lagos Street/ }).first().click();
  await page.getByRole("dialog", { name: "Choose a branch" }).getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByText(`Ordering from ${name}`)).toBeVisible();
}

export async function addShawarma(page: Page, protein: "Beef" | "Chicken", size: string) {
  await page.getByRole("button", { name: "Add Shawarma" }).click();
  const d = page.getByRole("dialog", { name: "Shawarma" });
  await d.getByRole("button", { name: new RegExp(`^${protein}`) }).click();
  await d.getByRole("button", { name: new RegExp(`^${size}`) }).click();
  await d.getByRole("button", { name: /^Add · / }).click();
}

export async function addSimple(page: Page, name: string) {
  await page.getByRole("button", { name: `Add ${name}`, exact: true }).click();
}

export async function checkout(page: Page, opts: { type: "PICKUP" | "DELIVERY"; name?: string; phone?: string }) {
  await page.goto("/checkout");
  if (opts.type === "DELIVERY") await page.getByRole("button", { name: /^Delivery/ }).click();
  await page.getByLabel("Full name").fill(opts.name ?? "E2E Test Customer");
  await page.getByLabel("Phone number").fill(opts.phone ?? "+234 801 234 5678");
  await page.getByLabel("Email").fill("e2e@example.com");
  if (opts.type === "DELIVERY") {
    await page.getByLabel("Address").fill("12 Test Road, Maiduguri");
    await page.getByLabel("Nearest landmark").fill("Near the test mosque");
  }
  await page.getByRole("button", { name: /^Pay ₦/ }).click();
  await page.waitForURL(/simulated-payment|paystack/);
}

export async function simulatePay(page: Page, outcome: "success" | "failed") {
  await expect(page.getByText("Simulated payment", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: outcome === "success" ? "Simulate successful payment" : "Simulate declined card" }).click();
  await page.waitForURL(/\/order\/CE-/);
  return page.url().match(/\/order\/(CE-[A-Z]{2}-[A-Z0-9]{6})/)![1];
}

export async function staffLogin(page: Page, email: string) {
  await page.goto("/staff/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"));
}

export async function openStaffOrder(page: Page, ref: string) {
  await page.goto(`/staff/orders?q=${ref}&from=`);
  await page.getByRole("link", { name: ref }).click();
  await expect(page.getByRole("heading", { name: ref })).toBeVisible();
}

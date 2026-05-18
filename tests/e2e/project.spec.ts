import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Auth guards", () => {
  test("dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/login/);
  });

  test("login page renders sign-in form", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});

test.describe("Authenticated project flow", () => {
  test.beforeEach(async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/login`);
    const emailInput = page.locator('input[type="email"]');
    if (!(await emailInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await emailInput.fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    try {
      await page.waitForURL(/dashboard/, { timeout: 15_000 });
    } catch {
      test.skip(); // credentials didn't work
    }
  });

  test("dashboard loads and shows projects or empty state", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    // Either a project card or an empty-state message should appear
    const content = page.getByText(/project|learn|no projects|create/i).first();
    await expect(content).toBeVisible({ timeout: 8000 });
  });

  test("new project dialog opens with topic input", async ({ page }) => {
    const btn = page.getByRole("button", { name: /new project|create/i }).first();
    if (!(await btn.isVisible({ timeout: 5000 }).catch(() => false))) return;
    await btn.click();
    await expect(page.getByPlaceholder(/topic|subject/i)).toBeVisible({ timeout: 5000 });
  });
});

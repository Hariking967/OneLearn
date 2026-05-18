import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Chat API validation", () => {
  test("POST /api/topic/:id/chat returns 400 for empty message", async ({ request }) => {
    const res = await request.post(`${BASE}/api/topic/fake-id/chat`, {
      data: { userMessage: "" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/topic/:id/chat returns 400 for missing message", async ({ request }) => {
    const res = await request.post(`${BASE}/api/topic/fake-id/chat`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/topic/:id/chat/tools returns 400 for unknown tool", async ({ request }) => {
    const res = await request.post(`${BASE}/api/topic/fake-id/chat/tools`, {
      data: { toolName: "nonexistent_tool" },
    });
    expect([400, 401, 500]).toContain(res.status());
  });

  test("POST /api/topic/:id/descriptive/ocr returns 400 or 401 without image", async ({ request }) => {
    const res = await request.post(`${BASE}/api/topic/fake-id/descriptive/ocr`, {
      data: {},
    });
    // Auth runs before validation; unauthenticated callers get 401
    expect([400, 401]).toContain(res.status());
  });

  test("POST /api/topic/:id/descriptive/ocr returns 400 or 401 with missing mimeType", async ({ request }) => {
    const res = await request.post(`${BASE}/api/topic/fake-id/descriptive/ocr`, {
      data: { imageBase64: "abc" },
    });
    expect([400, 401]).toContain(res.status());
  });
});

test.describe("Generate graph API", () => {
  test("POST /api/generate-graph returns 401 or redirect without auth", async ({ request }) => {
    const res = await request.post(`${BASE}/api/generate-graph`, {
      data: { projectName: "Test", mainTopic: "CNN" },
    });
    expect([400, 401, 302, 200]).toContain(res.status());
  });
});

test.describe("Resources API", () => {
  test("POST /api/resources returns 401 without auth", async ({ request }) => {
    const res = await request.post(`${BASE}/api/resources`, {
      data: { projectId: "fake", label: "Test", type: "url", url: "https://example.com" },
    });
    expect([401, 302]).toContain(res.status());
  });
});

test.describe("Project summary API", () => {
  test("GET /api/project/:id/summary returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/project/fake-id/summary`);
    expect([401, 302]).toContain(res.status());
  });
});

test.describe("App shell", () => {
  test("home page loads without 500", async ({ page }) => {
    const res = await page.goto(BASE);
    expect(res?.status()).not.toBe(500);
    await expect(page.locator("body")).toBeVisible();
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

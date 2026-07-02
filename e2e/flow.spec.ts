import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('happy path: login → dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('h1:has-text("ACCESS_GATE")', { timeout: 10000 });
  await expect(page).toHaveTitle(/KOMPRESSA/);

  await page.fill('input[type="password"]', 'phantom');
  await page.fill('input[inputmode="numeric"]', '000000');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: 5000 });
  await expect(page.getByText('CONFIG.SYS')).toBeVisible();
  await expect(page.getByText('DROP FILE')).toBeVisible();
  await expect(page.getByText('JOB_QUEUE')).toBeVisible();
});

test('login rejects bad credentials', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('h1:has-text("ACCESS_GATE")', { timeout: 10000 });
  await page.fill('input[type="password"]', 'wrong');
  await page.fill('input[inputmode="numeric"]', '111111');
  await page.click('button[type="submit"]');
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 3000 });
});

test('redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL('**/login', { timeout: 5000 });
  await expect(page.getByText('ACCESS_GATE')).toBeVisible();
});

test('dashboard accepts a file and shows probe data', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('h1:has-text("ACCESS_GATE")');
  await page.fill('input[type="password"]', 'phantom');
  await page.fill('input[inputmode="numeric"]', '000000');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  await page.setInputFiles('input[type="file"]', {
    name: 'sample.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.alloc(2048),
  });

  await expect(page.getByText('sample.mp4')).toBeVisible();
  const probePanel = page.locator('dl').first();
  await expect(probePanel).toBeVisible({ timeout: 5000 });
  await expect(probePanel.getByText('DURATION', { exact: true })).toBeVisible();
  await expect(probePanel.getByText('RESOLUTION', { exact: true })).toBeVisible();
  await expect(probePanel.getByText('CODEC', { exact: true })).toBeVisible();
});

test('job appears in sidebar after submit', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('h1:has-text("ACCESS_GATE")');
  await page.fill('input[type="password"]', 'phantom');
  await page.fill('input[inputmode="numeric"]', '000000');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  await page.setInputFiles('input[type="file"]', {
    name: 'clip.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.alloc(1024),
  });
  await expect(page.getByText(/DURATION/i)).toBeVisible({ timeout: 5000 });
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/jobs\//, { timeout: 5000 });

  await page.goto('/dashboard');
  await expect(page.getByText(/clip\.mp4/)).toBeVisible();
  await expect(page.getByText(/\[1\]/)).toBeVisible();
});

test('skip link is keyboard accessible', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('h1:has-text("ACCESS_GATE")');
  const link = page.locator('a[href="#main-content"]');
  await expect(link).toHaveCount(1);
  const main = page.locator('#main-content');
  await expect(main).toHaveCount(1);
});

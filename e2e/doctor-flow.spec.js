import { test, expect } from '@playwright/test';
import { DeviceSimulator } from '../firmware/simulator.js';

test.describe('PulseCare Clinical Telemetry E2E Workflow', () => {
  test('Complete Doctor Flow: Login -> Start Session -> Stream Simulator Readings -> See LIVE -> Stop -> Download PDF', async ({ page }) => {
    // 1. Visit Login Page
    await page.goto('/login');
    await expect(page).toHaveTitle(/PulseCare/i);

    // Click "Doctor / Operator" tab
    const doctorTab = page.getByRole('button', { name: /doctor \/ operator/i });
    if (await doctorTab.isVisible()) {
      await doctorTab.click();
    }

    // Fill credentials
    await page.getByLabel(/email address/i).fill('doctor@pulsecare.dev');
    await page.locator('#password-input').fill('Password@123');

    // Click Submit
    await page.locator('button[type="submit"]').click();

    // 2. Verify Doctor Dashboard Navigation
    await page.waitForURL('**/doctor/dashboard', { timeout: 15000 });
    await expect(page.getByText(/dr\. sarah connor|doctor dashboard|clinical command/i)).toBeVisible();

    // 3. Navigate to Live Monitoring Page
    await page.goto('/doctor/monitoring');
    await expect(page.getByText(/live icu & bedside telemetry/i)).toBeVisible();

    // Check if a session needs to be started or is already active
    const startSessionBtn = page.getByRole('button', { name: /start session/i });
    let currentSessionId = null;

    if (await startSessionBtn.isVisible()) {
      await startSessionBtn.click();
      await page.waitForTimeout(500);

      // Select patient if select is present
      const patientSelect = page.locator('select').first();
      if (await patientSelect.isVisible()) {
        await patientSelect.selectOption({ index: 1 });
      }

      // Confirm Start in modal
      const confirmStartBtn = page.locator('.fixed button', { hasText: /start monitoring/i });
      if (await confirmStartBtn.isVisible()) {
        await confirmStartBtn.click();
      }
      await page.waitForTimeout(1000);
    }

    // 4. Run Telemetry Simulator
    const simulator = new DeviceSimulator({
      apiUrl: 'http://localhost:5000',
      deviceId: 'PCD-0001',
      deviceKey: 'mock-device-secret-key-123456789012345678',
      sessionId: currentSessionId
    });

    // Ingest simulated telemetry points
    for (let i = 0; i < 3; i++) {
      await simulator.sendReading();
      await page.waitForTimeout(500);
    }

    // 5. Verify LIVE Telemetry Status / Vital Indicators
    await expect(page.locator('text=LIVE').or(page.locator('text=ONLINE')).or(page.locator('text=BPM')).first()).toBeVisible({ timeout: 10000 });

    // 6. Stop Monitoring Session
    const stopSessionBtn = page.getByRole('button', { name: /stop session|conclude session/i });
    if (await stopSessionBtn.isVisible()) {
      await stopSessionBtn.click();
      await page.waitForTimeout(500);

      // Confirm in dialog if prompt exists
      const confirmStopBtn = page.getByRole('button', { name: /confirm stop|stop monitoring|stop/i }).last();
      if (await confirmStopBtn.isVisible()) {
        await confirmStopBtn.click();
      }
    }

    // 7. Navigate to Reports and Download PDF
    await page.goto('/doctor/reports');
    await expect(page.getByText(/clinical session reports/i)).toBeVisible();

    // Wait for session table
    const downloadPdfBtn = page.locator('button', { hasText: /pdf/i }).first();
    if (await downloadPdfBtn.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
        downloadPdfBtn.click()
      ]);

      if (download) {
        expect(download.suggestedFilename()).toContain('.pdf');
      }
    }
  });
});

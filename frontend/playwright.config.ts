import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: process.env.PLAB_URL ?? 'http://127.0.0.1:5173',
    viewport: { width: 1280, height: 1400 },
    // Machines whose firewall blocks outbound TCP per-exe can route the
    // browser through a local CONNECT proxy (node is allowed out)
    ...(process.env.PLAB_PROXY
      ? { proxy: { server: process.env.PLAB_PROXY } }
      : {}),
  },
});

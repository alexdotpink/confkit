import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Add packages that have tests/configs
  'packages/confkit',
  'packages/confkit-next',
  'packages/confkit-aws',
  'packages/confkit-1password',
  'packages/confkit-azure',
  'packages/confkit-gcp',
  'packages/confkit-doppler',
  'packages/confkit-vite',
  'packages/confkit-expo',
]);


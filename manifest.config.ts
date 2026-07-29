import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'PinAds Studio AI',
  short_name: 'PinAds Studio AI',
  version: pkg.version,
  description:
    'A conversational AI marketing assistant for planning, creating, and optimizing Pinterest advertising campaigns.',
  minimum_chrome_version: '114',
  action: {
    default_title: 'PinAds Studio AI',
  },
  side_panel: {
    default_path: 'src/ui/sidepanel.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage', 'sidePanel', 'identity'],
  host_permissions: [
    'https://api.openai.com/*',
    'https://api.anthropic.com/*',
    'https://generativelanguage.googleapis.com/*',
    'https://api.mistral.ai/*',
    'https://api.pinterest.com/*',
    'https://www.pinterest.com/*',
  ],
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  icons: {
    16: 'public/icons/icon16.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
});

import { defineManifest } from '@crxjs/vite-plugin';

import packageData from '../package.json';

const isDev = process.env.NODE_ENV == 'development';

export default defineManifest({
  name: `${packageData.displayName || packageData.name}${isDev ? ' ➡️ Dev' : ''}`,
  description: packageData.description,
  version: packageData.version,
  manifest_version: 3,
  icons: {
    16: 'img/logo.png',
    32: 'img/logo.png',
    48: 'img/logo.png',
    128: 'img/logo.png',
  },
  action: {
    default_popup: 'popup.html',
    default_icon: 'img/logo.png',
  },
  background: {
    service_worker: 'src/background/index.js',
    type: 'module',
  },
  content_scripts: [
    {
      all_frames: true,
      matches: ['https://plan.pixelplus.ru/*'],
      js: ['src/content-scripts/isolated.js'],
      type: 'module',
      world: 'ISOLATED',
    },
  ],
  web_accessible_resources: [
    {
      resources: [
        'src/content-scripts/main.js',
        'assets/*',
        'img/logo.png',
      ],
      matches: ['https://plan.pixelplus.ru/*'],
    },
  ],
  permissions: [
    'notifications',
    'storage',
  ],
  host_permissions: isDev
    ? ['http://*/*', 'https://*/*']
    : ['https://plan.pixelplus.ru/*'],
});

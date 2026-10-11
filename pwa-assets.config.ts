import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

// Icon-Hintergrund = Token --color-bg (Assets können keine CSS-Variablen lesen).
const background = '#0A0D12';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: combinePresetAndAppleSplashScreens(
    {
      ...minimal2023Preset,
      transparent: { ...minimal2023Preset.transparent, padding: 0 },
      maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background } },
      apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
    },
    {
      padding: 0.72,
      resizeOptions: { background, fit: 'contain' },
      linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/', xhtml: false },
    },
    [
      'iPhone 17 Pro Max',
      'iPhone 17 Pro',
      'iPhone Air',
      'iPhone 17',
      'iPhone 16 Pro Max',
      'iPhone 16 Pro',
      'iPhone 16 Plus',
      'iPhone 16',
      'iPhone 16e',
      'iPhone 15 Pro Max',
      'iPhone 15 Pro',
      'iPhone 15',
      'iPhone 14 Plus',
      'iPhone 14',
      'iPhone 13 mini',
      'iPhone 11',
      'iPhone SE 4.7"',
    ],
  ),
  images: ['public/icon.svg'],
});

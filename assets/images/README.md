# Lumen Login Screen Assets

## Files

| File | Usage | Size |
|------|-------|------|
| `moon.svg` | Moon with glow rings, crescent shadow, craters | 160×160 |
| `background-sky.svg` | Full night sky background with stars and moon halo | 375×370 |
| `wave-divider.svg` | Curved wave transition from sky to dark form section | 375×72 |
| `stars-overlay.svg` | Stars only (transparent bg) — layer independently | 375×370 |
| `app-icon.svg` | 1024×1024 app icon — moon + finance chart line | 1024×1024 |

---

## React Native Usage

### Install SVG support
```bash
npx expo install react-native-svg
```

### Import in your login screen
```jsx
import { SvgXml } from 'react-native-svg';
import { Image } from 'react-native';

// For SVG files, use react-native-svg transformer
// OR convert to PNG for simpler use with Image component
```

### Recommended: SVG Transformer setup
Add to `metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];
module.exports = config;
```

Then import SVGs directly:
```jsx
import MoonSvg from './assets/moon.svg';
import BackgroundSky from './assets/background-sky.svg';
import WaveDivider from './assets/wave-divider.svg';

// Use as components:
<BackgroundSky width="375" height="370" />
<MoonSvg width={160} height={160} />
<WaveDivider width="100%" height={72} preserveAspectRatio="none" />
```

### Login screen layout structure
```
<View style={{ flex: 1, backgroundColor: '#07070f' }}>
  {/* Top sky section */}
  <View style={{ height: 370, overflow: 'hidden' }}>
    <BackgroundSky width={375} height={370} />
    <MoonSvg style={{ position: 'absolute', alignSelf: 'center', top: 58 }} />
    {/* Lumen wordmark */}
  </View>

  {/* Wave at boundary */}
  <WaveDivider width={375} height={72} style={{ marginTop: -40 }} />

  {/* Form section */}
  <View style={{ flex: 1, paddingHorizontal: 28 }}>
    {/* TextInput fields, buttons */}
  </View>
</View>
```

### App icon
Place `app-icon.svg` in your assets and reference it in `app.json`:
```json
{
  "expo": {
    "icon": "./assets/app-icon.png"
  }
}
```
Convert SVG → PNG at 1024×1024 using a tool like Figma, Inkscape, or svgexport:
```bash
npx svgexport assets/app-icon.svg assets/app-icon.png 1024:1024
```

---

## Color Reference
| Token | Hex | Used in |
|-------|-----|---------|
| Primary accent | `#6C63FF` | Glow rings, button, chart line |
| Light accent | `#8B84FF` | Links, highlights |
| Moon surface | `#dcd6ff` | Moon lit face |
| Moon shadow | `#a89fe8` | Moon gradient edge |
| Sky dark | `#07070f` | App background |
| Sky mid | `#0d0d1f` | Sky gradient base |
| Sky light | `#1a1640` | Sky gradient center |

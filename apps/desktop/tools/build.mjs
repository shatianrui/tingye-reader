// Bundles the iOS app source for the Electron renderer with react-native-web
// and the desktop shims in src/shims. Needs `npm ci` in apps/ios as well.
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ios = path.resolve(root, '../ios');
const out = path.join(root, 'dist/renderer');
const fixture = process.argv.includes('--fixture');
for (const dir of [path.join(ios, 'node_modules/react'), path.join(root, 'node_modules/react-native-web')]) {
  if (!fs.existsSync(dir)) throw new Error(`Missing ${path.relative(root, dir)}: run npm ci in apps/ios and apps/desktop.`);
}

const shim = name => path.join(root, 'src/shims', name);
// Exact module names only, so e.g. 'expo' and 'expo/fetch' map independently.
const modules = {
  'react': path.join(ios, 'node_modules/react/index.js'),
  'react/jsx-runtime': path.join(ios, 'node_modules/react/jsx-runtime.js'),
  'react-dom': path.join(root, 'node_modules/react-dom/index.js'),
  'react-dom/client': path.join(root, 'node_modules/react-dom/client.js'),
  'react-native': shim('react-native.ts'),
  'react-native-webview': shim('react-native-webview.tsx'),
  'expo': shim('expo.ts'),
  'expo/fetch': shim('expo-fetch.ts'),
  'expo-file-system': shim('expo-file-system.ts'),
  'expo-audio': shim('expo-audio.ts'),
  'expo-speech': shim('expo-speech.ts'),
  'expo-secure-store': shim('expo-secure-store.ts'),
  'expo-asset': shim('expo-asset.ts'),
  'expo-font': shim('expo-font.ts'),
  'expo-image': shim('expo-image.tsx'),
  'expo-document-picker': shim('expo-document-picker.ts'),
  'expo-crypto': shim('expo-crypto.ts'),
  'expo-status-bar': shim('expo-status-bar.ts'),
};
const desktopModules = {
  name: 'desktop-modules',
  setup(build) {
    build.onResolve({ filter: /^[@\w]/ }, args => {
      if (modules[args.path]) return { path: modules[args.path] };
      if (args.path.startsWith('@ios/')) return build.resolve('./' + args.path.slice(5), { resolveDir: ios, kind: args.kind });
      if (args.path === '@ios') return { path: path.join(ios, 'App.tsx') };
      return undefined;
    });
  },
};

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const entryPoints = { app: path.join(root, 'src/main.tsx') };
if (fixture) entryPoints.fixture = path.join(root, 'src/fixture.tsx');

const result = await esbuild.build({
  entryPoints, outdir: out, bundle: true, format: 'esm', splitting: true, platform: 'browser',
  target: ['chrome130'], jsx: 'automatic', minify: true, legalComments: 'linked', metafile: true,
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.mjs', '.json'],
  mainFields: ['browser', 'module', 'main'], conditions: ['browser', 'import', 'default'],
  nodePaths: [path.join(ios, 'node_modules'), path.join(root, 'node_modules')],
  plugins: [desktopModules],
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"', 'process.env.EXPO_OS': '"web"', global: 'globalThis' },
  banner: { js: 'globalThis.process??={env:{NODE_ENV:"production"}};' },
  loader: { '.otf': 'file', '.ttf': 'file', '.reader': 'file', '.png': 'file', '.jpg': 'file', '.epub': 'file', '.js': 'jsx' },
  assetNames: 'assets/[name]-[hash]', chunkNames: 'chunks/[name]-[hash]', publicPath: 'tingye://app/',
  logLevel: 'warning',
});

const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), html.replace('%ENTRY%', 'app'));
if (fixture) fs.writeFileSync(path.join(out, 'fixture.html'), html.replace('%ENTRY%', 'fixture'));
fs.copyFileSync(path.join(ios, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'), path.join(out, 'pdf.worker.min.mjs'));
const bytes = Object.values(result.metafile.outputs).reduce((sum, o) => sum + o.bytes, 0);
console.log(`Renderer bundled${fixture ? ' with e2e fixture' : ''}: ${(bytes / 1048576).toFixed(1)} MB in ${path.relative(process.cwd(), out) || '.'}`);

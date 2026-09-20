const fs = require('node:fs');
require('./fix-audio-clock.cjs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
// A separate simulator target; the device IPA never imports the fixture entry.
pkg.main = process.env.EAS_BUILD_PROFILE === 'ui-verification' ? 'verification/index.tsx' : 'index.ts';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Native React entry:', pkg.main);

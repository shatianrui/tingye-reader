const fs = require('node:fs');
require('./fix-audio-clock.cjs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.main = 'index.ts';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Native React entry:', pkg.main);

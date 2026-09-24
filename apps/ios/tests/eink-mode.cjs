const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load-ts.cjs');

const { readingTheme } = load('src/tingye/themes.ts');
const { readerScript } = load('src/tingye/reader-script.ts');
const { originalPage } = load('src/tingye/original-page.ts');
const { defaultTypography } = load('src/tingye/typesetting.ts');

const eink = readingTheme('eink');
assert.equal(eink.eink, true);
assert.equal(eink.dark, false);
assert.equal(eink.text, '#111111');
assert.match(readerScript, /filter:grayscale\(1\) contrast\(1\.08\)!important/);
assert.match(readerScript, /background-image:none!important/);
assert.match(readerScript, /animation:none!important;transition:none!important/);

const page = originalPage(
  { title: 'E-ink fixture', text: 'Quiet reading', document: { html: '<p>Quiet reading</p>', css: '' } },
  { fontSize: 22, typography: defaultTypography, colors: eink, original: false, spread: false, eink: true },
  0
);
assert.match(page, /"eink":true/);

const application = fs.readFileSync('src/tingye/ReaderApplication.tsx', 'utf8');
assert.match(application, /theme\.eink\?/);
assert.match(application, /spreadMode:'single'/);
assert.match(application, /alignment:'justify'/);

console.log('PASS: e-ink mode uses a persisted theme, high-contrast single-page typography, grayscale media and reduced visual effects.');

const fs = require('node:fs');
const path = require('node:path');

const header = path.join(__dirname, '..', 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI-Cxx', 'include', 'RuntimeScheduler.h');
const source = fs.readFileSync(header, 'utf8');
const constructors = [
  'SWIFT_RETURNS_RETAINED RuntimeScheduler(void *scheduler, ScheduleFn fn) noexcept',
  'SWIFT_RETURNS_RETAINED RuntimeScheduler() {}',
];
let patched = source;
for (const constructor of constructors) {
  if (!patched.includes(constructor)) {
    throw new Error(`Unexpected expo-modules-jsi RuntimeScheduler constructor: ${constructor}`);
  }
  patched = patched.replace(constructor, constructor.replace('SWIFT_RETURNS_RETAINED ', ''));
}
if ((source.match(/SWIFT_RETURNS_RETAINED/g) || []).length !== constructors.length) {
  throw new Error('Unexpected expo-modules-jsi ownership annotations; review the compiler fix.');
}
fs.writeFileSync(header, patched);
console.log('Removed redundant RuntimeScheduler constructor annotations for Xcode 26.');

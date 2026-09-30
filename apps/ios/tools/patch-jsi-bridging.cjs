const fs = require('node:fs');
const path = require('node:path');

function replaceExact(source, before, after, expected) {
  const count = source.split(before).length - 1;
  if (count === expected) return source.split(before).join(after);
  if (count === 0 && source.split(after).length - 1 === expected) return source;
  throw new Error(`Unexpected expo-modules-jsi source (${count}/${expected}): ${before}`);
}

function patchHeader(source) {
  const constructors = [
    'SWIFT_RETURNS_RETAINED RuntimeScheduler(void *scheduler, ScheduleFn fn) noexcept',
    'SWIFT_RETURNS_RETAINED RuntimeScheduler() {}',
  ];
  const annotations = (source.match(/SWIFT_RETURNS_RETAINED/g) || []).length;
  if (annotations !== 0 && annotations !== constructors.length) {
    throw new Error('Unexpected expo-modules-jsi ownership annotations; review the compiler fix.');
  }
  for (const constructor of constructors) {
    source = replaceExact(source, constructor, constructor.replace('SWIFT_RETURNS_RETAINED ', ''), 1);
  }
  return source;
}

function patchRuntime(source) {
  // Swift 6.2 rejects these seven nonisolated(unsafe) pointer captures even though
  // JavaScriptActor.assumeIsolated executes synchronously on the JS thread.
  // Use the package's existing NonisolatedUnsafeVar workaround, as it already
  // does for callerRunLoop, without changing pointer ownership or actor checks.
  // https://github.com/expo/expo/issues/50067
  for (const [name, count] of [['resultPtr', 3], ['thisPtr', 2], ['argumentsPtr', 2]]) {
    source = replaceExact(source, `nonisolated(unsafe) let ${name} = ${name}`, `let ${name} = NonisolatedUnsafeVar(${name})`, count);
  }
  const uses = [
    ['writeJSIValue(to: resultPtr)', 'writeJSIValue(to: resultPtr.value)', 3],
    ['UnsafeMutablePointer(mutating: thisPtr).move()', 'UnsafeMutablePointer(mutating: thisPtr.value).move()', 1],
    ['JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)', 'JavaScriptValuesBuffer(runtime, start: argumentsPtr.value, count: argumentsCount)', 2],
    ['JavaScriptUnownedValue(runtime.pointee, thisPtr)', 'JavaScriptUnownedValue(runtime.pointee, thisPtr.value)', 1],
  ];
  for (const [before, after, count] of uses) source = replaceExact(source, before, after, count);
  return source;
}

if (require.main === module) {
  const sourceRoot = path.join(__dirname, '..', 'node_modules', 'expo-modules-jsi', 'apple', 'Sources');
  const header = path.join(sourceRoot, 'ExpoModulesJSI-Cxx', 'include', 'RuntimeScheduler.h');
  const runtime = path.join(sourceRoot, 'ExpoModulesJSI', 'Runtime', 'JavaScriptRuntime.swift');
  // Validate both transformations before touching either dependency file.
  const nextHeader = patchHeader(fs.readFileSync(header, 'utf8'));
  const nextRuntime = patchRuntime(fs.readFileSync(runtime, 'utf8'));
  fs.writeFileSync(header, nextHeader);
  fs.writeFileSync(runtime, nextRuntime);
  console.log('Applied guarded Xcode 26 constructor and Swift pointer-capture compatibility fixes.');
}
module.exports = {patchHeader, patchRuntime};

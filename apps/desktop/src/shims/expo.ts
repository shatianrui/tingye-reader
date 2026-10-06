// Native-module lookups from the shared app code. On desktop the only module
// is TingyeDocuments.readPDFPages (pdf.js instead of PDFKit); speech alignment
// already skips itself outside iOS.
const modules: Record<string, unknown> = {
  TingyeDocuments: {
    async readPDFPages(uri: string) { const { readPDFPages } = await import('./pdf-pages'); return readPDFPages(uri); },
  },
};
export function requireOptionalNativeModule<T>(name: string): T | null { return (modules[name] as T) ?? null; }
export function requireNativeModule<T>(name: string): T {
  const module = modules[name];
  if (!module) throw new Error(`桌面版不支持原生模块 ${name}`);
  return module as T;
}
export class NativeModule {}
export function registerWebModule<T>(Module: new () => T) { return new Module(); }
export function registerRootComponent(_component: unknown) {}

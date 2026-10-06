// esbuild's file loader turns require('…/font.otf') into a URL next to the bundle.
export class Asset {
  uri = '';
  localUri: string | null = null;
  name = '';
  hash: string | null = null;
  type = '';
  downloaded = true;
  static fromModule(module: unknown) {
    const asset = new Asset();
    const ref = typeof module === 'string' ? module : (module as { uri?: string })?.uri ?? String(module);
    asset.uri = asset.localUri = new URL(ref, document.baseURI).href;
    asset.name = decodeURIComponent(asset.uri.split('/').pop() || '');
    const dot = asset.name.lastIndexOf('.');
    asset.type = dot < 0 ? '' : asset.name.slice(dot + 1);
    asset.hash = /-([A-Z0-9]{8,})\.[^.]+$/i.exec(asset.name)?.[1] ?? asset.name.replace(/\W/g, '');
    return asset;
  }
  static loadAsync(modules: unknown | unknown[]) { return Promise.resolve((Array.isArray(modules) ? modules : [modules]).map(m => Asset.fromModule(m))); }
  async downloadAsync() { return this; }
}

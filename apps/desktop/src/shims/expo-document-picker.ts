// Native Windows open dialog; picked files are copied into the app cache first.
import { desktop } from '../desktop';

type Asset = { uri: string; name: string; size: number; mimeType: string };
export async function getDocumentAsync(options: { multiple?: boolean } = {}) {
  const result = await desktop.invoke<{ canceled: boolean; assets: Asset[] | null }>('dialog:open', { multiple: !!options.multiple });
  return result.canceled ? { canceled: true as const, assets: null } : { canceled: false as const, assets: result.assets!.map(a => ({ ...a, lastModified: Date.now() })) };
}

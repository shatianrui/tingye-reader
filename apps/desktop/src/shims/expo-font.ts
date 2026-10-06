import { useEffect, useState } from 'react';

const loaded = new Set<string>();
const url = (module: unknown) => new URL(typeof module === 'string' ? module : (module as { uri: string }).uri, document.baseURI).href;

export async function loadAsync(map: Record<string, unknown>) {
  await Promise.all(Object.entries(map).map(async ([family, module]) => {
    if (loaded.has(family)) return;
    const face = new FontFace(family, `url("${url(module)}")`);
    await face.load();
    document.fonts.add(face);
    loaded.add(family);
  }));
}
export const isLoaded = (family: string) => loaded.has(family);

export function useFonts(map: Record<string, unknown>): [boolean, Error | null] {
  const [state, setState] = useState<[boolean, Error | null]>(() => [Object.keys(map).every(isLoaded), null]);
  useEffect(() => {
    let live = true;
    loadAsync(map).then(() => { if (live) setState([true, null]); }, error => { if (live) setState([false, error as Error]); });
    return () => { live = false; };
  }, []);
  return state;
}

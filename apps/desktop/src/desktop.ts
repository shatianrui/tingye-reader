// Typed access to the preload bridge (electron/preload.cjs).
export type DesktopBridge = {
  platform: string;
  sync<T = unknown>(channel: string, ...args: unknown[]): T;
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
  abort(id: string): void;
};

export const desktop: DesktopBridge = (globalThis as unknown as { tingyeDesktop: DesktopBridge }).tingyeDesktop;

/** Strips Electron's "Error invoking remote method 'x': Error: " prefix. */
export function remoteMessage(error: unknown) {
  const text = String((error as Error)?.message ?? error);
  return text.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '');
}

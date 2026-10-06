// expo-secure-store via the main process (Windows DPAPI through safeStorage).
import { desktop } from '../desktop';
export const getItemAsync = (key: string) => desktop.invoke<string | null>('secure:get', key);
export const setItemAsync = (key: string, value: string) => desktop.invoke<void>('secure:set', key, value);
export const deleteItemAsync = (key: string) => desktop.invoke<void>('secure:delete', key);
export const isAvailableAsync = async () => true;

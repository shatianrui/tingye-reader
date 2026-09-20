import { Asset } from 'expo-asset';
import { parseBook } from '../src/tingye/import-book';
import { nativeLibrary } from '../src/tingye/native-library';
import type { ReaderServices } from '../src/tingye/reader-services';
const user = { userId: 'ui-verification-local', username: '原生界面验证', displayName: '原生界面验证' };
const shelf = nativeLibrary(user.userId);
export const fixtureServices: ReaderServices = {
  restore: async () => {
    const asset = Asset.fromModule(require('./original-layout.epub'));
    await asset.downloadAsync();
    const book = await parseBook(asset.localUri || asset.uri, '山间来信.epub');
    book.id = 'ui-original-layout';
    await shelf.importBook(book);
    return { token: '', expiresAt: Date.now() + 86400000, user };
  },
  verify: async () => ({ user }),
  library: () => shelf,
};

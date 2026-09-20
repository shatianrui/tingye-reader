import { NativeModule, requireNativeModule } from 'expo';

declare class TingyeDocumentsModule extends NativeModule<{}> {}

export default requireNativeModule<TingyeDocumentsModule>('TingyeDocuments');

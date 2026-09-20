import { registerWebModule, NativeModule } from 'expo';

class TingyeDocumentsModule extends NativeModule<{}> {}

export default registerWebModule(TingyeDocumentsModule, 'TingyeDocumentsModule');

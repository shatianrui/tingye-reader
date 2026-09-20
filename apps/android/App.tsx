import { SafeAreaProvider } from 'react-native-safe-area-context';
import NativeReaderApp from './src/tingye/NativeReaderApp';
import { DisplayScaleProvider } from './src/components/DisplayText';
export default function App() { return <SafeAreaProvider><DisplayScaleProvider><NativeReaderApp /></DisplayScaleProvider></SafeAreaProvider>; }

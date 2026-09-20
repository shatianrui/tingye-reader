import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReaderApplication from './src/tingye/ReaderApplication';
import { DisplayScaleProvider } from './src/components/DisplayText';
export default function App() { return <SafeAreaProvider><DisplayScaleProvider><ReaderApplication /></DisplayScaleProvider></SafeAreaProvider>; }

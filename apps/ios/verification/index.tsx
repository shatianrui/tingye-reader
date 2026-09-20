import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DisplayScaleProvider } from '../src/components/DisplayText';
import NativeReaderApp from '../src/tingye/NativeReaderApp';
import { fixtureServices } from './services';

function VerificationApp() {
  return <SafeAreaProvider><DisplayScaleProvider><NativeReaderApp services={fixtureServices}/></DisplayScaleProvider></SafeAreaProvider>;
}
registerRootComponent(VerificationApp);

// Desktop renderer: the iOS app (apps/ios/App.tsx) on react-native-web.
import { installFetch } from './shims/expo-fetch';
import { AppRegistry } from 'react-native';
import App from '@ios/App';

installFetch();
AppRegistry.registerComponent('main', () => App);
AppRegistry.runApplication('main', { rootTag: document.getElementById('root') });

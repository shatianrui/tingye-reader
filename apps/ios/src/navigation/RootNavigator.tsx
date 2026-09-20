import React, {useEffect} from 'react';
import {ActivityIndicator,View} from 'react-native';
import {useLibraryUI} from '../tingye/library-ui';
import {useAppTheme} from '../theme/useAppTheme';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import { NavigationContainer,DefaultTheme,DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from './types';
import DiscoverScreen from '../screens/DiscoverScreen';
import ShelfScreen from '../screens/ShelfScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import BookDetailScreen from '../screens/BookDetailScreen';
function ReaderScreen({route,navigation}:NativeStackScreenProps<RootStackParamList,'Reader'>){
 const ui=useLibraryUI(),theme=useAppTheme();
 useEffect(()=>{let active=true;void ui.open(route.params.bookId,route.params.initialChapterIndex).finally(()=>{if(active)navigation.goBack();});return()=>{active=false;};},[route.params.bookId,route.params.initialChapterIndex]);
 return <View style={{flex:1,justifyContent:'center',backgroundColor:theme.colors.background}}><ActivityIndicator color={theme.colors.primary}/></View>;
}
import MaterialNavBar from '../components/MaterialNavBar';
import type { NavBarItem } from '../components/MaterialNavBar';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_DEFS: { key: keyof TabParamList; icon: string; label: string }[] = [
  { key: 'Discover', icon: '◯', label: '发现' },
  { key: 'Shelf', icon: '☰', label: '书架' },
  { key: 'Profile', icon: '◔', label: '我' },
];

function Tabs() {
  return (
    <Tab.Navigator initialRouteName="Shelf"
      screenOptions={{ headerShown: false }}
      tabBar={({ navigation, state }) => {
        const items: NavBarItem[] = TAB_DEFS.map((def) => ({
          key: def.key,
          icon: def.icon,
          label: def.label,
          isActive: state.routeNames[state.index] === def.key,
          onPress: () => navigation.navigate(def.key as never),
        }));
        return <MaterialNavBar items={items} />;
      }}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Shelf" component={ShelfScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const theme=useAppTheme(),base=theme.scheme==='dark'?DarkTheme:DefaultTheme;
  return (
    <NavigationContainer theme={{...base,colors:{...base.colors,background:theme.colors.background,card:theme.colors.surface,text:theme.colors.onSurface,primary:theme.colors.primary}}}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="BookDetail" component={BookDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Reader" component={ReaderScreen} options={{ animation: 'fade' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
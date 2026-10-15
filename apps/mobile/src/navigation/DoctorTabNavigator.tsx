import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DoctorHomeStackParamList, DoctorTabParamList } from './types';
import { colors } from '../theme/colors';
import DoctorHomeScreen from '../screens/doctor/DoctorHomeScreen';
import DoctorAchievementsScreen from '../screens/doctor/DoctorAchievementsScreen';
import DoctorPublicationsScreen from '../screens/doctor/DoctorPublicationsScreen';
import DoctorPostsScreen from '../screens/doctor/DoctorPostsScreen';
import {
  DoctorCommunityScreen, DoctorHelpScreen, DoctorLegalScreen, DoctorMarketScreen, DoctorNetworkScreen,
} from '../screens/doctor/DoctorComingSoonScreens';

const Tab = createBottomTabNavigator<DoctorTabParamList>();
const HomeStack = createNativeStackNavigator<DoctorHomeStackParamList>();

function DoctorHomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="DoctorHomeMain" component={DoctorHomeScreen} />
      <HomeStack.Screen name="DoctorAchievements" component={DoctorAchievementsScreen} options={{ headerShown: true, title: 'Add achievement' }} />
      <HomeStack.Screen name="DoctorPublications" component={DoctorPublicationsScreen} options={{ headerShown: true, title: 'Add publication' }} />
    </HomeStack.Navigator>
  );
}

const ICONS: Record<keyof DoctorTabParamList, string> = {
  DoctorHome: '🩺',
  DoctorNetwork: '🕸️',
  DoctorPosts: '📰',
  DoctorCommunity: '🤝',
  DoctorMarket: '🏪',
  DoctorLegal: '⚖️',
  DoctorHelp: '🎧',
};

const LABELS: Record<keyof DoctorTabParamList, string> = {
  DoctorHome: 'Profile',
  DoctorNetwork: 'Network',
  DoctorPosts: 'Posts',
  DoctorCommunity: 'Community',
  DoctorMarket: 'Market',
  DoctorLegal: 'Legal Help',
  DoctorHelp: 'Help Desk',
};

export default function DoctorTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabel: LABELS[route.name as keyof DoctorTabParamList],
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>{ICONS[route.name as keyof DoctorTabParamList]}</Text>,
      })}
    >
      <Tab.Screen name="DoctorHome" component={DoctorHomeStackNavigator} />
      <Tab.Screen name="DoctorNetwork" component={DoctorNetworkScreen} />
      <Tab.Screen name="DoctorPosts" component={DoctorPostsScreen} />
      <Tab.Screen name="DoctorCommunity" component={DoctorCommunityScreen} />
      <Tab.Screen name="DoctorMarket" component={DoctorMarketScreen} />
      <Tab.Screen name="DoctorLegal" component={DoctorLegalScreen} />
      <Tab.Screen name="DoctorHelp" component={DoctorHelpScreen} />
    </Tab.Navigator>
  );
}

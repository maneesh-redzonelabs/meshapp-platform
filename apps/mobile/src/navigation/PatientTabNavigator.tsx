import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  PatientAppointmentsStackParamList, PatientHomeStackParamList, PatientProfileStackParamList, PatientTabParamList,
} from './types';
import { colors } from '../theme/colors';
import PatientHomeScreen from '../screens/patient/PatientHomeScreen';
import BookingFamilyScreen from '../screens/patient/booking/BookingFamilyScreen';
import BookingModeScreen from '../screens/patient/booking/BookingModeScreen';
import BookingDateScreen from '../screens/patient/booking/BookingDateScreen';
import BookingTimeScreen from '../screens/patient/booking/BookingTimeScreen';
import BookingPaymentScreen from '../screens/patient/booking/BookingPaymentScreen';
import BookingSuccessScreen from '../screens/patient/booking/BookingSuccessScreen';
import PatientAppointmentsScreen from '../screens/patient/PatientAppointmentsScreen';
import VideoCallScreen from '../screens/patient/VideoCallScreen';
import PrescriptionScreen from '../screens/patient/PrescriptionScreen';
import PatientAlertsScreen from '../screens/patient/PatientAlertsScreen';
import PatientProfileScreen from '../screens/patient/PatientProfileScreen';
import FamilyMembersScreen from '../screens/patient/FamilyMembersScreen';

const Tab = createBottomTabNavigator<PatientTabParamList>();
const HomeStack = createNativeStackNavigator<PatientHomeStackParamList>();
const AppointmentsStack = createNativeStackNavigator<PatientAppointmentsStackParamList>();
const ProfileStack = createNativeStackNavigator<PatientProfileStackParamList>();

function PatientHomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="PatientHomeMain" component={PatientHomeScreen} />
      <HomeStack.Screen name="BookingFamily" component={BookingFamilyScreen} options={{ headerShown: true, title: 'Select patient' }} />
      <HomeStack.Screen name="BookingMode" component={BookingModeScreen} options={{ headerShown: true, title: 'Appointment mode' }} />
      <HomeStack.Screen name="BookingDate" component={BookingDateScreen} options={{ headerShown: true, title: 'Choose date' }} />
      <HomeStack.Screen name="BookingTime" component={BookingTimeScreen} options={{ headerShown: true, title: 'Choose time' }} />
      <HomeStack.Screen name="BookingPayment" component={BookingPaymentScreen} options={{ headerShown: true, title: 'Payment' }} />
      <HomeStack.Screen name="BookingSuccess" component={BookingSuccessScreen} options={{ headerShown: false }} />
    </HomeStack.Navigator>
  );
}

function PatientAppointmentsStackNavigator() {
  return (
    <AppointmentsStack.Navigator screenOptions={{ headerShown: false }}>
      <AppointmentsStack.Screen name="PatientAppointmentsMain" component={PatientAppointmentsScreen} />
      <AppointmentsStack.Screen name="VideoCall" component={VideoCallScreen} options={{ headerShown: true, title: 'Video call' }} />
      <AppointmentsStack.Screen name="Prescription" component={PrescriptionScreen} options={{ headerShown: true, title: 'Prescription' }} />
      <AppointmentsStack.Screen name="BookingDate" component={BookingDateScreen} options={{ headerShown: true, title: 'Reschedule — date' }} />
      <AppointmentsStack.Screen name="BookingTime" component={BookingTimeScreen} options={{ headerShown: true, title: 'Reschedule — time' }} />
      <AppointmentsStack.Screen name="BookingPayment" component={BookingPaymentScreen} options={{ headerShown: true, title: 'Confirm reschedule' }} />
    </AppointmentsStack.Navigator>
  );
}

function PatientProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="PatientProfileMain" component={PatientProfileScreen} />
      <ProfileStack.Screen name="FamilyMembers" component={FamilyMembersScreen} options={{ headerShown: true, title: 'Family members' }} />
    </ProfileStack.Navigator>
  );
}

const ICONS: Record<keyof PatientTabParamList, string> = {
  PatientHome: '🏠',
  PatientAppointments: '📅',
  PatientAlerts: '🔔',
  PatientProfile: '👤',
};

const LABELS: Record<keyof PatientTabParamList, string> = {
  PatientHome: 'Home',
  PatientAppointments: 'My Appointments',
  PatientAlerts: 'Alerts',
  PatientProfile: 'Profile',
};

export default function PatientTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabel: LABELS[route.name as keyof PatientTabParamList],
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>{ICONS[route.name as keyof PatientTabParamList]}</Text>,
      })}
    >
      <Tab.Screen name="PatientHome" component={PatientHomeStackNavigator} />
      <Tab.Screen name="PatientAppointments" component={PatientAppointmentsStackNavigator} />
      <Tab.Screen name="PatientAlerts" component={PatientAlertsScreen} />
      <Tab.Screen name="PatientProfile" component={PatientProfileStackNavigator} />
    </Tab.Navigator>
  );
}

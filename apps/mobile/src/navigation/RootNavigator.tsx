import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import RoleSelectScreen from '../screens/common/RoleSelectScreen';
import DoctorAuthScreen from '../screens/doctor/DoctorAuthScreen';
import DoctorOnboardingScreen from '../screens/doctor/DoctorOnboardingScreen';
import DoctorTabNavigator from './DoctorTabNavigator';
import PatientAuthScreen from '../screens/patient/PatientAuthScreen';
import PatientTabNavigator from './PatientTabNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { booting, isAuthed, role } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgDark }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthed ? (
        <>
          <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
          <Stack.Screen name="DoctorAuth" component={DoctorAuthScreen} />
          <Stack.Screen name="DoctorOnboarding" component={DoctorOnboardingScreen} />
          <Stack.Screen name="PatientAuth" component={PatientAuthScreen} />
        </>
      ) : role === 'doctor' ? (
        <Stack.Screen name="DoctorApp" component={DoctorTabNavigator} />
      ) : (
        <Stack.Screen name="PatientApp" component={PatientTabNavigator} />
      )}
    </Stack.Navigator>
  );
}

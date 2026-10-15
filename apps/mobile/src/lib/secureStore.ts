import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'meshapp.access_token';
const REFRESH_TOKEN_KEY = 'meshapp.refresh_token';
const USER_TYPE_KEY = 'meshapp.user_type';

export async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveUserType(userType: string) {
  await SecureStore.setItemAsync(USER_TYPE_KEY, userType);
}

export async function getUserType() {
  return SecureStore.getItemAsync(USER_TYPE_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_TYPE_KEY);
}

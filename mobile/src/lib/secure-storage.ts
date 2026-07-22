import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// expo-secure-store não implementa todos os métodos na web (usa Keychain/Keystore nativos).
// Como o projeto tem um target web configurado (app.json), caímos para localStorage lá —
// no mobile (iOS/Android) continua usando o armazenamento seguro nativo normalmente.
const isWeb = Platform.OS === "web";

async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const secureStorage = { getItemAsync, setItemAsync, deleteItemAsync };

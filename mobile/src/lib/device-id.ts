import * as Crypto from 'expo-crypto';

import { secureStorage } from '@/lib/secure-storage';

const DEVICE_ID_KEY = 'abasteceae_device_id';

export async function getDeviceId(): Promise<string> {
  const existing = await secureStorage.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = Crypto.randomUUID();
  await secureStorage.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

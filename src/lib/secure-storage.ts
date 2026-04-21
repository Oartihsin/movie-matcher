import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Supabase-compatible storage adapter backed by expo-secure-store.
 *
 * SecureStore has a 2048-byte value limit, so values are chunked
 * into numbered keys (e.g. "key", "key__1", "key__2", ...).
 * A meta key "key__chunks" stores the chunk count.
 *
 * On first access, migrates any existing AsyncStorage session to
 * SecureStore so users aren't logged out on upgrade.
 */

const CHUNK_SIZE = 2000; // leave headroom below 2048 limit

function chunkKey(key: string, index: number): string {
  return index === 0 ? key : `${key}__${index}`;
}

function metaKey(key: string): string {
  return `${key}__chunks`;
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    // Check if chunked
    const meta = await SecureStore.getItemAsync(metaKey(key));
    if (meta) {
      const count = parseInt(meta, 10);
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(chunkKey(key, i));
        if (part === null) return null; // corrupted — treat as missing
        parts.push(part);
      }
      return parts.join('');
    }

    // Try single value
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) return value;

    // Migrate from AsyncStorage on first access
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      await this.setItem(key, legacy);
      await AsyncStorage.removeItem(key);
      return legacy;
    }

    return null;
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clean up any previous chunks
    await this.removeItem(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    // Chunk the value
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    await SecureStore.setItemAsync(metaKey(key), String(chunks.length));
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
    }
  },

  async removeItem(key: string): Promise<void> {
    // Remove chunks if they exist
    const meta = await SecureStore.getItemAsync(metaKey(key));
    if (meta) {
      const count = parseInt(meta, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
      await SecureStore.deleteItemAsync(metaKey(key));
    }

    // Remove single key (may or may not exist)
    await SecureStore.deleteItemAsync(key);
  },
};

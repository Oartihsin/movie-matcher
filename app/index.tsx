import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '../src/hooks/useUser';
import { useRoom } from '../src/hooks/useRoom';
import { useRoomStore } from '../src/stores/roomStore';

export default function HomeScreen() {
  const router = useRouter();
  const { userId, loading: authLoading } = useUser();
  const { createRoom, joinRoom, loading, error } = useRoom();
  const setRoom = useRoomStore((s) => s.setRoom);

  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'home' | 'join'>('home');

  if (authLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  async function handleCreate() {
    console.log('handleCreate called, userId:', userId, 'loading:', loading);
    if (!userId) {
      console.warn('No userId, cannot create room');
      return;
    }
    const room = await createRoom(userId);
    console.log('createRoom result:', room, 'error:', error);
    if (room) {
      setRoom(room);
      router.push(`/room/${room.code}`);
    }
  }

  async function handleJoin() {
    if (!userId || joinCode.length < 6) return;
    const room = await joinRoom(joinCode, userId);
    if (room) {
      setRoom(room);
      router.push(`/room/${room.code}`);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>🎬</Text>
        <Text style={styles.title}>Movie Matcher</Text>
        <Text style={styles.subtitle}>
          Swipe on movies together.{'\n'}Find what you both love.
        </Text>
      </View>

      {mode === 'home' ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Room</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setMode('join')}
          >
            <Text style={styles.secondaryButtonText}>Join Room</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <Text style={styles.label}>Enter Room Code</Text>
          <TextInput
            style={styles.codeInput}
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.toUpperCase())}
            placeholder="ABCDEF"
            placeholderTextColor="#666"
            maxLength={6}
            autoCapitalize="characters"
            autoFocus
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              joinCode.length < 6 && styles.disabledButton,
            ]}
            onPress={handleJoin}
            disabled={loading || joinCode.length < 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Join</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setMode('home');
              setJoinCode('');
            }}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0b0',
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#e94560',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  secondaryButtonText: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  label: {
    color: '#a0a0b0',
    fontSize: 14,
    marginBottom: 4,
  },
  codeInput: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e94560',
    width: '100%',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
  },
});

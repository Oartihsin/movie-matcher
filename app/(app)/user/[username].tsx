import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useConnectionStore } from '../../../src/stores/connectionStore';
import type { Profile } from '../../../src/types/app';
import { GENRE_MAP } from '../../../src/types/tmdb';

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const connections = useConnectionStore((s) => s.connections);
  const sendRequest = useConnectionStore((s) => s.sendRequest);
  const respondToRequest = useConnectionStore((s) => s.respondToRequest);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  // Find existing connection with this user
  const connection = connections.find(
    (c) => c.other_user_id === profile?.id
  );

  const isOwnProfile = profile?.id === currentUser?.id;

  useEffect(() => {
    if (!username) return;
    loadProfile();
  }, [username]);

  async function loadProfile() {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        'get_profile_by_username',
        { p_username: username!.toLowerCase() }
      );
      if (rpcError) throw rpcError;
      setProfile(data as Profile | null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    if (!profile) return;
    setActionLoading(true);
    setActionResult(null);

    const result = await sendRequest(profile.id);
    if (result.error) {
      setActionResult(result.error);
    } else {
      setActionResult('Request sent!');
    }
    setActionLoading(false);
  }

  async function handleAccept() {
    if (!connection) return;
    setActionLoading(true);
    const result = await respondToRequest(connection.id, 'accepted');
    setActionResult(result.error ?? 'Connected!');
    setActionLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>User not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const genres = (profile.preferred_genres ?? [])
    .map((id) => GENRE_MAP[id])
    .filter(Boolean);

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.display_name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.displayName}>
          {profile.display_name ?? profile.username}
        </Text>
        <Text style={styles.username}>@{profile.username}</Text>
      </View>

      {/* Genres */}
      {genres.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Favorite Genres</Text>
          <View style={styles.chipRow}>
            {genres.map((g) => (
              <View key={g} style={styles.chip}>
                <Text style={styles.chipText}>{g}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Action button */}
      {!isOwnProfile && (
        <View style={styles.actionSection}>
          {connection?.status === 'accepted' ? (
            <View style={styles.connectedBadge}>
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          ) : connection?.status === 'pending' &&
            connection.addressee_id === currentUser?.id ? (
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept Request</Text>
              )}
            </TouchableOpacity>
          ) : connection?.status === 'pending' ? (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>Request Sent</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={handleConnect}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>Connect</Text>
              )}
            </TouchableOpacity>
          )}

          {actionResult && (
            <Text style={[
              styles.actionResultText,
              actionResult === 'Connected!' || actionResult === 'Request sent!'
                ? styles.actionResultSuccess
                : styles.actionResultError,
            ]}>
              {actionResult}
            </Text>
          )}
        </View>
      )}

      {isOwnProfile && (
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/(app)/profile')}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#1c1917',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  container: {
    flex: 1,
    backgroundColor: '#1c1917',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 24 : 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '800',
  },
  displayName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  username: {
    color: '#a8a29e',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: '#a8a29e',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  actionSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  connectButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 16,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  acceptButton: {
    backgroundColor: '#4ecdc4',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 16,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  connectedBadge: {
    backgroundColor: 'rgba(78,205,196,0.15)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4ecdc4',
  },
  connectedText: {
    color: '#4ecdc4',
    fontSize: 16,
    fontWeight: '700',
  },
  pendingBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  pendingText: {
    color: '#a8a29e',
    fontSize: 16,
    fontWeight: '600',
  },
  actionResultText: {
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionResultSuccess: {
    color: '#4ecdc4',
  },
  actionResultError: {
    color: '#ff6b6b',
  },
  editButton: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notFoundText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

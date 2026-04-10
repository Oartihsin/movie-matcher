import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useConnections } from '../../../src/hooks/useConnections';
import { useAuthStore } from '../../../src/stores/authStore';
import { useMatchStore } from '../../../src/stores/matchStore';
import { supabase } from '../../../src/lib/supabase';
import type { Connection } from '../../../src/types/app';

export default function ConnectionsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const matchCounts = useMatchStore((s) => s.matchCounts);
  const fetchMatchCounts = useMatchStore((s) => s.fetchMatchCounts);
  const {
    accepted,
    pendingIncoming,
    pendingSent,
    isLoading,
    loadError,
    sendRequest,
    respondToRequest,
    refresh,
  } = useConnections();

  useEffect(() => { fetchMatchCounts(); }, []);

  const [searchUsername, setSearchUsername] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);

  async function handleSearch() {
    const username = searchUsername.trim().toLowerCase();
    if (!username) return;
    setSearching(true);
    setSearchError(null);
    setSearchSuccess(null);

    try {
      const { data: foundProfile, error } = await supabase.rpc(
        'get_profile_by_username',
        { p_username: username }
      );
      if (error) throw error;
      if (!foundProfile) {
        setSearchError('User not found');
        return;
      }
      if (foundProfile.id === profile?.id) {
        setSearchError("That's you!");
        return;
      }

      const result = await sendRequest(foundProfile.id);
      if (result.error) {
        setSearchError(result.error);
      } else {
        setSearchSuccess(`Request sent to @${username}`);
        setSearchUsername('');
      }
    } catch (err: any) {
      setSearchError(err.message ?? 'Something went wrong');
    } finally {
      setSearching(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refresh(), fetchMatchCounts()]);
    setRefreshing(false);
  }

  async function handleRespond(connectionId: string, action: 'accepted' | 'blocked') {
    setRespondingId(connectionId);
    setRespondError(null);
    const result = await respondToRequest(connectionId, action);
    if (result.error) {
      setRespondError(result.error);
      setTimeout(() => setRespondError(null), 4000);
    }
    setRespondingId(null);
  }

  function ConnectionItem({
    connection,
    type,
  }: {
    connection: Connection;
    type: 'accepted' | 'incoming' | 'sent';
  }) {
    const initial =
      connection.other_display_name?.[0]?.toUpperCase() ??
      connection.other_username?.[0]?.toUpperCase() ??
      '?';

    return (
      <View style={styles.connectionRow}>
        <View style={styles.connectionAvatar}>
          <Text style={styles.connectionAvatarText}>{initial}</Text>
        </View>
        <View style={styles.connectionInfo}>
          <Text style={styles.connectionName}>
            {connection.other_display_name ?? connection.other_username}
          </Text>
          <Text style={styles.connectionUsername}>@{connection.other_username}</Text>
        </View>

        {type === 'incoming' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.acceptButton, respondingId === connection.id && styles.disabled]}
              onPress={() => handleRespond(connection.id, 'accepted')}
              disabled={respondingId === connection.id}
            >
              {respondingId === connection.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.declineButton, respondingId === connection.id && styles.disabled]}
              onPress={() => handleRespond(connection.id, 'blocked')}
              disabled={respondingId === connection.id}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {type === 'sent' && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Pending</Text>
          </View>
        )}

        {type === 'accepted' && (
          <TouchableOpacity
            style={styles.matchBadge}
            onPress={() => router.push(`/(app)/connections/${connection.id}`)}
          >
            <Text style={styles.matchBadgeText}>
              {(matchCounts[connection.id] ?? 0) > 0
                ? `${matchCounts[connection.id]} match${matchCounts[connection.id] === 1 ? '' : 'es'}`
                : 'No matches'}
            </Text>
            <Text style={styles.matchChevron}>›</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#e94560"
          />
        }
      >
        {/* Add Friend */}
        <Text style={styles.sectionLabel}>ADD FRIEND</Text>
        <View style={styles.card}>
          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Enter username"
                placeholderTextColor="#666"
                value={searchUsername}
                onChangeText={(t) => {
                  setSearchUsername(t);
                  setSearchError(null);
                  setSearchSuccess(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleSearch}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[
                  styles.searchButton,
                  (!searchUsername.trim() || searching) && styles.disabled,
                ]}
                onPress={handleSearch}
                disabled={!searchUsername.trim() || searching}
              >
                {searching ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.searchButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
            {searchError && <Text style={styles.errorText}>{searchError}</Text>}
            {searchSuccess && <Text style={styles.successText}>{searchSuccess}</Text>}
          </View>

          <View style={styles.divider} />

          <View style={styles.settingsRow}>
            <Text style={styles.hintText}>
              Or share: moviematcher.app/u/{profile?.username}
            </Text>
          </View>
        </View>

        {/* Incoming Requests */}
        {pendingIncoming.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>REQUESTS ({pendingIncoming.length})</Text>
            <View style={styles.card}>
              {pendingIncoming.map((c, i) => (
                <View key={c.id}>
                  <ConnectionItem connection={c} type="incoming" />
                  {i < pendingIncoming.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Friends */}
        <Text style={styles.sectionLabel}>FRIENDS ({accepted.length})</Text>
        <View style={styles.card}>
          {loadError && !isLoading && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>⚠️ {loadError}</Text>
              <TouchableOpacity onPress={handleRefresh}>
                <Text style={styles.errorBoxRetry}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {isLoading && accepted.length === 0 && (
            <ActivityIndicator color="#e94560" size="large" style={styles.loadingSpinner} />
          )}
          {accepted.length === 0 && !isLoading && !loadError && (
            <View style={styles.settingsRow}>
              <Text style={styles.emptyText}>
                No connections yet. Add friends by username or share your link.
              </Text>
            </View>
          )}
          {accepted.map((c, i) => (
            <View key={c.id}>
              <ConnectionItem connection={c} type="accepted" />
              {i < accepted.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Sent Requests */}
        {pendingSent.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>SENT ({pendingSent.length})</Text>
            <View style={styles.card}>
              {pendingSent.map((c, i) => (
                <View key={c.id}>
                  <ConnectionItem connection={c} type="sent" />
                  {i < pendingSent.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      {respondError && (
        <View style={styles.respondErrorToast}>
          <Text style={styles.respondErrorText}>{respondError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Layout (mirrors profile.tsx) ──────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },

  // ── Section label (identical to profile.tsx) ──────────────────────────────
  sectionLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 6,
    marginTop: 24,
  },

  // ── Card (identical to profile.tsx) ───────────────────────────────────────
  card: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },

  // ── Divider (identical to profile.tsx) ────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginLeft: 16,
  },

  // ── Settings row (identical to profile.tsx) ───────────────────────────────
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },

  // ── Search section ────────────────────────────────────────────────────────
  searchSection: {
    padding: 14,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#0f1228',
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(233,69,96,0.4)',
  },
  searchButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    marginTop: 8,
  },
  successText: {
    color: '#4ecdc4',
    fontSize: 13,
    marginTop: 8,
  },
  hintText: {
    color: '#a0a0b0',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  // ── Connection row ────────────────────────────────────────────────────────
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 64,
  },
  connectionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  connectionAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  connectionUsername: {
    color: '#a0a0b0',
    fontSize: 13,
    marginTop: 2,
  },

  // ── Action buttons (Accept / Decline) ─────────────────────────────────────
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#4ecdc4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  declineButton: {
    backgroundColor: 'rgba(255,107,107,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  declineButtonText: {
    color: '#ff6b6b',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Status badges ──────────────────────────────────────────────────────────
  pendingBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pendingBadgeText: {
    color: '#a0a0b0',
    fontSize: 12,
    fontWeight: '600',
  },
  matchBadge: {
    backgroundColor: 'rgba(233,69,96,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchBadgeText: {
    color: '#e94560',
    fontSize: 12,
    fontWeight: '600',
  },
  matchChevron: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Empty / loading / error states ────────────────────────────────────────
  emptyText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
  },
  loadingSpinner: {
    marginVertical: 24,
  },
  errorBox: {
    backgroundColor: 'rgba(255,107,107,0.12)',
    margin: 14,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBoxText: {
    color: '#ff6b6b',
    fontSize: 14,
    flex: 1,
  },
  errorBoxRetry: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 12,
  },

  // ── Respond error toast ───────────────────────────────────────────────────
  respondErrorToast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,107,107,0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  respondErrorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

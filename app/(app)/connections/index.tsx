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
    sendRequest,
    respondToRequest,
    refresh,
  } = useConnections();

  // Fetch match counts on mount
  useEffect(() => { fetchMatchCounts(); }, []);

  const [searchUsername, setSearchUsername] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleSearch() {
    const username = searchUsername.trim().toLowerCase();
    if (!username) return;
    setSearching(true);
    setSearchError(null);
    setSearchSuccess(null);

    try {
      // Look up user by username
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

      // Send connection request
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
      <View style={styles.connectionItem}>
        <View style={styles.connectionAvatar}>
          <Text style={styles.connectionAvatarText}>{initial}</Text>
        </View>
        <View style={styles.connectionInfo}>
          <Text style={styles.connectionName}>
            {connection.other_display_name ?? connection.other_username}
          </Text>
          <Text style={styles.connectionUsername}>
            @{connection.other_username}
          </Text>
        </View>

        {type === 'incoming' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => respondToRequest(connection.id, 'accepted')}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => respondToRequest(connection.id, 'blocked')}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {type === 'sent' && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Pending</Text>
          </View>
        )}

        {type === 'accepted' && (
          <TouchableOpacity
            style={[styles.statusBadge, styles.matchBadge]}
            onPress={() =>
              router.push(`/(app)/connections/${connection.id}`)
            }
          >
            <Text style={[styles.statusText, styles.matchText]}>
              {(matchCounts[connection.id] ?? 0) > 0
                ? `${matchCounts[connection.id]} match${matchCounts[connection.id] === 1 ? '' : 'es'}`
                : 'No matches yet'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#e94560"
        />
      }
    >
      {/* Search / Add by username */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Friend</Text>
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
        {searchSuccess && (
          <Text style={styles.successText}>{searchSuccess}</Text>
        )}
      </View>

      {/* Share link */}
      <View style={styles.section}>
        <Text style={styles.hintText}>
          Or share your link: moviematcher.app/u/{profile?.username}
        </Text>
      </View>

      {/* Pending incoming */}
      {pendingIncoming.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Requests ({pendingIncoming.length})
          </Text>
          {pendingIncoming.map((c) => (
            <ConnectionItem key={c.id} connection={c} type="incoming" />
          ))}
        </View>
      )}

      {/* Active connections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Friends ({accepted.length})
        </Text>
        {accepted.length === 0 && !isLoading && (
          <Text style={styles.emptyText}>
            No connections yet. Add friends by username or share your link!
          </Text>
        )}
        {accepted.map((c) => (
          <ConnectionItem key={c.id} connection={c} type="accepted" />
        ))}
      </View>

      {/* Sent requests */}
      {pendingSent.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Sent ({pendingSent.length})
          </Text>
          {pendingSent.map((c) => (
            <ConnectionItem key={c.id} connection={c} type="sent" />
          ))}
        </View>
      )}

      {isLoading && accepted.length === 0 && (
        <ActivityIndicator
          color="#e94560"
          size="large"
          style={{ marginTop: 32 }}
        />
      )}

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  content: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 20,
    borderRadius: 12,
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
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
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
    fontSize: 16,
    fontWeight: '600',
  },
  connectionUsername: {
    color: '#a0a0b0',
    fontSize: 13,
    marginTop: 2,
  },
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
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  connectedBadge: {
    backgroundColor: 'rgba(78,205,196,0.15)',
  },
  matchBadge: {
    backgroundColor: 'rgba(233,69,96,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchText: {
    color: '#e94560',
  },
  chevron: {
    color: '#e94560',
    fontSize: 18,
    fontWeight: '700',
  },
  statusText: {
    color: '#a0a0b0',
    fontSize: 12,
    fontWeight: '600',
  },
  connectedText: {
    color: '#4ecdc4',
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingVertical: 24,
  },
});

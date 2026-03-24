import { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useMatchStore } from '../../src/stores/matchStore';
import { MatchListItem } from '../../src/components/MatchListItem';
import { fetchMovieDetails } from '../../src/lib/tmdb';

export default function MatchesScreen() {
  const matches = useMatchStore((s) => s.matches);
  const setMovieForMatch = useMatchStore((s) => s.setMovieForMatch);

  // Fetch movie details for any matches that don't have them
  useEffect(() => {
    for (const match of matches) {
      if (!match.movie) {
        fetchMovieDetails(match.tmdbMovieId)
          .then((movie) => setMovieForMatch(match.tmdbMovieId, movie))
          .catch(console.error);
      }
    }
  }, [matches.length]);

  if (matches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🍿</Text>
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptySubtitle}>
          Keep swiping to find movies you both love!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        keyExtractor={(item) => String(item.tmdbMovieId)}
        renderItem={({ item }) =>
          item.movie ? (
            <MatchListItem movie={item.movie} />
          ) : (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#e94560" />
            </View>
          )
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  list: {
    paddingVertical: 12,
  },
  loadingRow: {
    padding: 24,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#a0a0b0',
    textAlign: 'center',
  },
});

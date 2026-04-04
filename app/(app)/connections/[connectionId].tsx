import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMatchStore } from '../../../src/stores/matchStore';
import { useConnectionStore } from '../../../src/stores/connectionStore';
import { getPosterUrl } from '../../../src/lib/tmdb';
import { fetchMovieDetails } from '../../../src/lib/tmdb';
import { GENRE_MAP } from '../../../src/types/tmdb';
import type { TMDBMovie } from '../../../src/types/tmdb';

export default function ConnectionMatchesScreen() {
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  const router = useRouter();

  const connections = useConnectionStore((s) => s.connections);
  const currentMatches = useMatchStore((s) => s.currentMatches);
  const isLoading = useMatchStore((s) => s.isLoading);
  const fetchMatches = useMatchStore((s) => s.fetchMatchesForConnection);

  const [movieDetails, setMovieDetails] = useState<Record<number, TMDBMovie>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  const connection = connections.find((c) => c.id === connectionId);
  const friendName = connection?.other_display_name ?? connection?.other_username ?? 'Friend';

  useEffect(() => {
    if (connectionId) {
      fetchMatches(connectionId);
    }
  }, [connectionId]);

  // Fetch movie details for matched movies
  useEffect(() => {
    if (currentMatches.length === 0) return;

    const missingIds = currentMatches
      .map((m) => m.tmdb_movie_id)
      .filter((id) => !movieDetails[id]);

    if (missingIds.length === 0) return;

    setLoadingDetails(true);
    Promise.all(missingIds.map((id) => fetchMovieDetails(id).catch(() => null)))
      .then((results) => {
        const newDetails: Record<number, TMDBMovie> = { ...movieDetails };
        results.forEach((movie) => {
          if (movie) newDetails[movie.id] = movie;
        });
        setMovieDetails(newDetails);
      })
      .finally(() => setLoadingDetails(false));
  }, [currentMatches]);

  if (isLoading && currentMatches.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.headerText}>
        Movies you and {friendName} both liked
      </Text>

      {currentMatches.length === 0 && !isLoading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🎬</Text>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptySubtitle}>
            Keep swiping! When you and {friendName} both like a movie, it'll
            show up here.
          </Text>
        </View>
      )}

      <View style={styles.movieGrid}>
        {currentMatches.map((match) => {
          const movie = movieDetails[match.tmdb_movie_id];
          return (
            <View key={match.tmdb_movie_id} style={styles.movieCard}>
              {movie?.poster_path ? (
                <Image
                  source={{ uri: getPosterUrl(movie.poster_path, 'w342') }}
                  style={styles.poster}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.poster, styles.posterPlaceholder]}>
                  {loadingDetails ? (
                    <ActivityIndicator color="#e94560" />
                  ) : (
                    <Text style={styles.placeholderText}>🎬</Text>
                  )}
                </View>
              )}
              <Text style={styles.movieTitle} numberOfLines={2}>
                {movie?.title ?? `Movie #${match.tmdb_movie_id}`}
              </Text>
              {movie && (
                <View style={styles.movieMeta}>
                  <Text style={styles.movieYear}>
                    {movie.release_date?.split('-')[0]}
                  </Text>
                  <Text style={styles.movieRating}>
                    ★ {movie.vote_average.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  content: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 20,
  },
  headerText: {
    color: '#a0a0b0',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#a0a0b0',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  movieGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'space-between',
  },
  movieCard: {
    width: '47%',
    marginBottom: 8,
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
  },
  posterPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
  },
  movieTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  movieMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  movieYear: {
    color: '#a0a0b0',
    fontSize: 12,
  },
  movieRating: {
    color: '#e94560',
    fontSize: 12,
    fontWeight: '600',
  },
});

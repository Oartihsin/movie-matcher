import { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { MovieCard } from '../../src/components/MovieCard';
import { SwipeableCard } from '../../src/components/SwipeableCard';
import { SharePrompt } from '../../src/components/SharePrompt';
import { useAuthStore } from '../../src/stores/authStore';
import { useSwipeStore } from '../../src/stores/swipeStore';
import { useConnectionStore } from '../../src/stores/connectionStore';
import { useMatchStore } from '../../src/stores/matchStore';
import { useMatchSubscription } from '../../src/hooks/useMatchSubscription';
import { MatchToast } from '../../src/components/MatchToast';
import { SwipeTutorial } from '../../src/components/SwipeTutorial';
import { SkeletonCard } from '../../src/components/SkeletonCard';
import { GENRE_MAP } from '../../src/types/tmdb';

const { width } = Dimensions.get('window');

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  hi: 'Hindi', ar: 'Arabic', tr: 'Turkish', pl: 'Polish', nl: 'Dutch',
  sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', th: 'Thai',
  id: 'Indonesian', ms: 'Malay', vi: 'Vietnamese', tl: 'Filipino',
  uk: 'Ukrainian', cs: 'Czech', ro: 'Romanian', hu: 'Hungarian', el: 'Greek',
  he: 'Hebrew', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam',
  kn: 'Kannada', cn: 'Cantonese',
};

export default function HomeSwipeScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const scrollRef = useRef<ScrollView>(null);

  const movies = useSwipeStore((s) => s.movies);
  const currentIndex = useSwipeStore((s) => s.currentIndex);
  const isLoading = useSwipeStore((s) => s.isLoading);
  const loadError = useSwipeStore((s) => s.loadError);
  const loadMovies = useSwipeStore((s) => s.loadMovies);
  const recordSwipe = useSwipeStore((s) => s.recordSwipe);

  const [swipeError, setSwipeError] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pendingSwipeCount = useSwipeStore((s) => s.pendingSwipes.length);

  const pendingCount = useConnectionStore((s) => s.pendingCount);
  const fetchPendingCount = useConnectionStore((s) => s.fetchPendingCount);

  const recentMatchMovieId = useMatchStore((s) => s.recentMatchMovieId);
  const setRecentMatch = useMatchStore((s) => s.setRecentMatch);

  // Subscribe to real-time match notifications
  useMatchSubscription();

  const currentMovie = movies[currentIndex] ?? null;

  // Get matched movie title for toast
  const matchedMovie = recentMatchMovieId
    ? movies.find((m) => m.id === recentMatchMovieId)
    : null;

  const setPreferences = useSwipeStore((s) => s.setPreferences);

  // Load movies with user preferences on mount
  useEffect(() => {
    if (!user) return;
    const genres = profile?.preferred_genres ?? [];
    const languages = profile?.preferred_languages ?? [];
    useSwipeStore.getState().reset();
    setPreferences(genres, languages);
    // Server-side dedup: loadMovies calls filter_unswiped_movie_ids RPC
    loadMovies(0, genres, languages);
    fetchPendingCount();
    // Flush any offline-queued swipes
    useSwipeStore.getState().flushPendingSwipes();
    // Show tutorial on first launch
    AsyncStorage.getItem('@mm_tutorial_seen').then((seen) => {
      if (!seen) setShowTutorial(true);
    });
  }, []);

  const dismissTutorial = useCallback(() => {
    setShowTutorial(false);
    AsyncStorage.setItem('@mm_tutorial_seen', 'true');
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const genres = profile?.preferred_genres ?? [];
    const languages = profile?.preferred_languages ?? [];
    useSwipeStore.getState().reset();
    await loadMovies(0, genres, languages);
    setIsRefreshing(false);
  }, [profile, loadMovies]);

  const handleSwipe = useCallback(
    async (liked: boolean) => {
      if (!user || !currentMovie) return;

      if (showTutorial) dismissTutorial();

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const success = await recordSwipe(user.id, currentMovie.id, liked);
      if (!success && liked) {
        // Swipe failed but is queued for retry — show subtle notice instead of error
        setSwipeError('Swipe queued — will sync when online');
        setTimeout(() => setSwipeError(null), 2000);
      }

      // Reset scroll to top for next card
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    [user, currentMovie, recordSwipe, showTutorial, dismissTutorial]
  );

  // Loading movies — show skeleton card instead of spinner
  if (movies.length === 0 && isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerButton} />
          <Text style={styles.headerTitle}>Home</Text>
          <View style={styles.headerButton} />
        </View>
        <SkeletonCard />
      </View>
    );
  }

  // Failed to load any movies
  if (movies.length === 0 && loadError) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyTitle}>Couldn't load movies</Text>
          <Text style={styles.emptySubtitle}>{loadError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              const genres = profile?.preferred_genres ?? [];
              const languages = profile?.preferred_languages ?? [];
              useSwipeStore.getState().reset();
              loadMovies(0, genres, languages);
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // All movies swiped
  const allSwiped = movies.length > 0 && currentIndex >= movies.length && !isLoading;

  if (allSwiped) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(app)/connections')}
          >
            <Text style={styles.headerIcon}>👥</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Home</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(app)/profile')}
          >
            <Text style={styles.headerButtonText}>
              {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🍿</Text>
          <Text style={styles.emptyTitle}>You've seen them all!</Text>
          <Text style={styles.emptySubtitle}>
            Check back later for fresh picks, or adjust your preferences to discover more movies.
          </Text>
          {pendingSwipeCount > 0 && (
            <Text style={styles.pendingSyncText}>
              {pendingSwipeCount} swipe{pendingSwipeCount > 1 ? 's' : ''} pending sync
            </Text>
          )}
          <View style={styles.emptyActions}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Refresh Feed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryButton, styles.secondaryButton]}
              onPress={() => router.push('/(app)/profile')}
            >
              <Text style={styles.retryButtonText}>Edit Preferences</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Get movie info
  const year = currentMovie?.release_date?.split('-')[0] ?? '';
  const langCode = currentMovie?.original_language ?? '';
  const lang = LANGUAGE_MAP[langCode] ?? langCode.toUpperCase();
  const genres = (currentMovie?.genre_ids ?? [])
    .slice(0, 3)
    .map((id) => GENRE_MAP[id])
    .filter(Boolean);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/(app)/connections')}
        >
          <Text style={styles.headerIcon}>👥</Text>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {pendingCount > 9 ? '9+' : pendingCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Home</Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/(app)/profile')}
        >
          <Text style={styles.headerButtonText}>
            {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Swipe card */}
      <SwipeableCard key={currentIndex} onSwipe={handleSwipe}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#e94560"
              colors={['#e94560']}
            />
          }
        >
          {/* Movie poster */}
          {currentMovie && <MovieCard movie={currentMovie} />}

          {/* Movie info */}
          {currentMovie && (
            <View style={styles.infoSection}>
              <Text style={styles.movieTitle} numberOfLines={2}>
                {currentMovie.title}
              </Text>

              <View style={styles.meta}>
                {year ? <Text style={styles.year}>{year}</Text> : null}
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingIcon}>★</Text>
                  <Text style={styles.ratingText}>
                    {currentMovie.vote_average.toFixed(1)}
                  </Text>
                </View>
                {lang ? (
                  <View style={styles.langBadge}>
                    <Text style={styles.langText}>{lang}</Text>
                  </View>
                ) : null}
              </View>

              {genres.length > 0 && (
                <View style={styles.genres}>
                  {genres.map((g) => (
                    <View key={g} style={styles.genreChip}>
                      <Text style={styles.genreText}>{g}</Text>
                    </View>
                  ))}
                </View>
              )}

              {currentMovie.overview ? (
                <Text style={styles.overview}>{currentMovie.overview}</Text>
              ) : null}
            </View>
          )}

          {/* Bottom padding for buttons */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SwipeableCard>

      {/* Fixed action buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.nopeButton]}
          onPress={() => handleSwipe(false)}
        >
          <Text style={styles.buttonEmoji}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => handleSwipe(true)}
        >
          <Text style={styles.buttonEmoji}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* Share prompt (shown once after onboarding) */}
      {profile && <SharePrompt username={profile.username} />}

      {/* First-time swipe tutorial */}
      {showTutorial && <SwipeTutorial onDismiss={dismissTutorial} />}

      {/* Match toast notification */}
      {recentMatchMovieId && (
        <MatchToast
          movieTitle={matchedMovie?.title ?? 'a movie'}
          onDismiss={() => setRecentMatch(null)}
        />
      )}

      {/* Swipe save error toast */}
      {swipeError && (
        <View style={styles.swipeErrorToast}>
          <Text style={styles.swipeErrorText}>{swipeError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 12,
    paddingBottom: 8,
    backgroundColor: '#1a1a2e',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(233,69,96,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '800',
  },
  headerIcon: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e94560',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  infoSection: {
    marginTop: 20,
    gap: 12,
  },
  movieTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  year: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233,69,96,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  ratingIcon: {
    color: '#fff',
    fontSize: 12,
  },
  ratingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  langBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  langText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genreChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  genreText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  overview: {
    color: '#c0c0d0',
    fontSize: 15,
    lineHeight: 23,
  },
  buttonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 48,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    backgroundColor: 'rgba(22,33,62,0.95)',
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
  },
  nopeButton: {
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  likeButton: {
    borderColor: '#4ecdc4',
    backgroundColor: 'rgba(78,205,196,0.12)',
  },
  buttonEmoji: {
    fontSize: 26,
    color: '#fff',
  },
  loadingText: {
    color: '#a0a0b0',
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
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
    paddingHorizontal: 24,
    marginBottom: 24,
    lineHeight: 24,
  },
  pendingSyncText: {
    fontSize: 13,
    color: '#e94560',
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  retryButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  swipeErrorToast: {
    position: 'absolute',
    bottom: 110,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  swipeErrorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

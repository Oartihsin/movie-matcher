import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

import { MovieCard } from '../../src/components/MovieCard';
import { SwipeableCard } from '../../src/components/SwipeableCard';
import { MatchModal } from '../../src/components/MatchModal';
import { MatchToast } from '../../src/components/MatchToast';
import { useUser } from '../../src/hooks/useUser';
import { useRoomStore } from '../../src/stores/roomStore';
import { useSwipeStore } from '../../src/stores/swipeStore';
import { useMatchStore } from '../../src/stores/matchStore';
import { supabase } from '../../src/lib/supabase';
import { fetchMovieDetails } from '../../src/lib/tmdb';
import { GENRE_MAP } from '../../src/types/tmdb';
import type { TMDBMovie } from '../../src/types/tmdb';

const { width } = Dimensions.get('window');

export default function SwipeScreen() {
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  const router = useRouter();
  const { userId } = useUser();
  const scrollRef = useRef<ScrollView>(null);

  const currentRoom = useRoomStore((s) => s.currentRoom);
  const partnerJoined = useRoomStore((s) => s.partnerJoined);
  const setPartnerJoined = useRoomStore((s) => s.setPartnerJoined);

  const movies = useSwipeStore((s) => s.movies);
  const currentIndex = useSwipeStore((s) => s.currentIndex);
  const isLoading = useSwipeStore((s) => s.isLoading);
  const loadMovies = useSwipeStore((s) => s.loadMovies);
  const recordSwipe = useSwipeStore((s) => s.recordSwipe);
  const likedMovieIds = useSwipeStore((s) => s.likedMovieIds);

  const matches = useMatchStore((s) => s.matches);
  const addMatch = useMatchStore((s) => s.addMatch);
  const setNewMatchMovieId = useMatchStore((s) => s.setNewMatchMovieId);

  const [matchMovie, setMatchMovie] = useState<TMDBMovie | null>(null);
  const [toastMovie, setToastMovie] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const currentMovie = movies[currentIndex] ?? null;

  // Reset stores and load movies when entering a room
  useEffect(() => {
    setPartnerJoined(false);
    useSwipeStore.getState().reset();
    useMatchStore.getState().reset();
    loadMovies(1);
  }, [roomCode]);

  // Fetch room if not set or if roomCode changed (e.g. deep link or page refresh)
  useEffect(() => {
    if (!roomCode) return;
    // If currentRoom matches the roomCode, no need to fetch
    if (currentRoom && currentRoom.code === roomCode) return;

    // Clear stale room data
    useRoomStore.getState().setRoom(null);

    async function fetchRoom() {
      const { data } = await supabase.rpc('get_room_by_code', {
        p_code: roomCode,
      });
      const room = Array.isArray(data) ? data[0] : data;
      if (room) {
        useRoomStore.getState().setRoom(room);
      }
    }
    fetchRoom();
  }, [roomCode]);

  // Check if partner is already in the room
  useEffect(() => {
    if (!currentRoom) return;

    async function checkMembers() {
      const { data: count } = await supabase.rpc('get_room_member_count', {
        p_room_id: currentRoom!.id,
      });
      if ((count ?? 0) >= 2) {
        setPartnerJoined(true);
      }
    }
    checkMembers();
    const interval = setInterval(checkMembers, 3000);
    return () => clearInterval(interval);
  }, [currentRoom]);

  // Subscribe to room_members for partner join detection
  useEffect(() => {
    if (!currentRoom) return;

    const channel = supabase
      .channel(`room:${currentRoom.id}:members`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${currentRoom.id}`,
        },
        () => {
          setPartnerJoined(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom]);

  // Subscribe to swipes for match detection (partner's swipes)
  useEffect(() => {
    if (!currentRoom || !userId) return;

    const channel = supabase
      .channel(`room:${currentRoom.id}:swipes`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'swipes',
          filter: `room_id=eq.${currentRoom.id}`,
        },
        (payload: any) => {
          const newSwipe = payload.new;
          if (newSwipe.user_id === userId) return;
          if (newSwipe.liked && likedMovieIds.has(newSwipe.tmdb_movie_id)) {
            // Partner triggered the match — show a subtle toast, not the full modal
            handlePartnerMatch(newSwipe.tmdb_movie_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom, userId, likedMovieIds]);

  // Load existing matches on mount
  useEffect(() => {
    if (!currentRoom) return;

    async function loadExistingMatches() {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('room_id', currentRoom!.id);

      if (data) {
        for (const m of data) {
          addMatch(m.tmdb_movie_id);
        }
      }
    }
    loadExistingMatches();
  }, [currentRoom]);

  // Full modal — shown to the user who triggers the match (swipes second)
  const handleMatchFound = useCallback(async (movieId: number) => {
    addMatch(movieId);
    try {
      const movie = await fetchMovieDetails(movieId);
      setMatchMovie(movie);
      setNewMatchMovieId(movieId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Still record the match even if we can't fetch details
    }
  }, []);

  // Subtle toast — shown to the user who swiped first (partner triggered the match)
  const handlePartnerMatch = useCallback(async (movieId: number) => {
    addMatch(movieId);
    try {
      const movie = await fetchMovieDetails(movieId);
      setToastMovie(movie.title);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setToastMovie('a movie');
    }
  }, []);

  const handleSwipe = useCallback(
    async (liked: boolean) => {
      if (!currentRoom || !userId || !currentMovie) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const isMatch = await recordSwipe(
        currentRoom.id,
        userId,
        currentMovie.id,
        liked
      );

      if (isMatch) {
        handleMatchFound(currentMovie.id);
      }

      // Reset scroll to top for next card
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    [currentRoom, userId, currentMovie, recordSwipe, handleMatchFound]
  );

  async function copyCode() {
    if (roomCode) {
      await Clipboard.setStringAsync(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  }

  // Waiting room
  if (!partnerJoined) {
    return (
      <View style={styles.container}>
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingEmoji}>🎬</Text>
          <Text style={styles.waitingTitle}>Waiting for partner...</Text>
          <Text style={styles.waitingSubtitle}>
            Share this code with your friend
          </Text>

          <TouchableOpacity style={styles.codeBox} onPress={copyCode}>
            <Text style={styles.codeText}>{roomCode}</Text>
            <Text style={styles.copyHint}>
              {codeCopied ? 'Copied!' : 'Tap to copy'}
            </Text>
          </TouchableOpacity>

          <ActivityIndicator
            size="small"
            color="#e94560"
            style={{ marginTop: 24 }}
          />
        </View>
      </View>
    );
  }

  // Loading movies
  if (movies.length === 0 && isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Loading movies...</Text>
      </View>
    );
  }

  // All movies swiped
  const allSwiped = movies.length > 0 && currentIndex >= movies.length && !isLoading;

  if (allSwiped) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.waitingEmoji}>🎉</Text>
          <Text style={styles.waitingTitle}>You've seen them all!</Text>
          <Text style={styles.waitingSubtitle}>
            Check your matches or come back later for more
          </Text>
          <TouchableOpacity
            style={styles.viewMatchesButton}
            onPress={() =>
              router.push({
                pathname: '/room/matches',
                params: { roomId: currentRoom?.id },
              })
            }
          >
            <Text style={styles.viewMatchesText}>View Matches</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Get movie info for details section
  const year = currentMovie?.release_date?.split('-')[0] ?? '';
  const genres = (currentMovie?.genre_ids ?? [])
    .slice(0, 3)
    .map((id) => GENRE_MAP[id])
    .filter(Boolean);

  return (
    <View style={styles.container}>
      <SwipeableCard key={currentIndex} onSwipe={handleSwipe}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Match count badge */}
          <TouchableOpacity
            style={styles.matchBadge}
            onPress={() =>
              router.push({
                pathname: '/room/matches',
                params: { roomId: currentRoom?.id },
              })
            }
          >
            <Text style={styles.matchBadgeText}>
              {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}
            </Text>
          </TouchableOpacity>

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

      {/* Match modal — shown to the user who triggers the match */}
      {matchMovie && (
        <MatchModal
          movie={matchMovie}
          onClose={() => setMatchMovie(null)}
        />
      )}

      {/* Toast notification — shown to the partner who swiped first */}
      {toastMovie && (
        <MatchToast
          movieTitle={toastMovie}
          onDismiss={() => setToastMovie(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  matchBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#e94560',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  matchBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
  // Waiting room styles
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  waitingEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  waitingSubtitle: {
    fontSize: 16,
    color: '#a0a0b0',
    marginBottom: 32,
  },
  codeBox: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e94560',
    alignItems: 'center',
  },
  codeText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 8,
  },
  copyHint: {
    color: '#a0a0b0',
    fontSize: 12,
    marginTop: 8,
  },
  loadingText: {
    color: '#a0a0b0',
    marginTop: 16,
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  viewMatchesButton: {
    backgroundColor: '#e94560',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 30,
    marginTop: 24,
  },
  viewMatchesText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

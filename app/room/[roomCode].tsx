import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Swiper from 'react-native-deck-swiper';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

import { MovieCard } from '../../src/components/MovieCard';
import { MatchModal } from '../../src/components/MatchModal';
import { useUser } from '../../src/hooks/useUser';
import { useRoomStore } from '../../src/stores/roomStore';
import { useSwipeStore } from '../../src/stores/swipeStore';
import { useMatchStore } from '../../src/stores/matchStore';
import { supabase } from '../../src/lib/supabase';
import { fetchMovieDetails } from '../../src/lib/tmdb';
import type { TMDBMovie } from '../../src/types/tmdb';

const { width } = Dimensions.get('window');

export default function SwipeScreen() {
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  const router = useRouter();
  const { userId } = useUser();
  const swiperRef = useRef<Swiper<TMDBMovie>>(null);

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
  const newMatchMovieId = useMatchStore((s) => s.newMatchMovieId);
  const addMatch = useMatchStore((s) => s.addMatch);
  const setNewMatchMovieId = useMatchStore((s) => s.setNewMatchMovieId);

  const [matchMovie, setMatchMovie] = useState<TMDBMovie | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Reset stores and load movies when entering a room
  useEffect(() => {
    useSwipeStore.getState().reset();
    useMatchStore.getState().reset();
    loadMovies(1);
  }, [roomCode]);

  // Check if partner is already in the room (use RPC to bypass RLS)
  useEffect(() => {
    if (!currentRoom) return;

    async function checkMembers() {
      const { data: count } = await supabase.rpc('get_room_member_count', {
        p_room_id: currentRoom!.id,
      });
      console.log('Member count:', count);
      if ((count ?? 0) >= 2) {
        setPartnerJoined(true);
      }
    }
    checkMembers();

    // Also poll every 3 seconds as a fallback for realtime
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
            handleMatchFound(newSwipe.tmdb_movie_id);
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

  async function handleSwipe(cardIndex: number, liked: boolean) {
    if (!currentRoom || !userId) return;
    const movie = movies[cardIndex];
    if (!movie) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const isMatch = await recordSwipe(
      currentRoom.id,
      userId,
      movie.id,
      liked
    );

    if (isMatch) {
      handleMatchFound(movie.id);
    }
  }

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

  return (
    <View style={styles.container}>
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

      {/* All swiped state */}
      {allSwiped && (
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
      )}

      {/* Card stack - flex:1 fills remaining space between badge and buttons */}
      {movies.length > 0 && currentIndex < movies.length && (
        <Swiper
          key={`swiper-${movies.length}-${currentIndex === 0 ? 'init' : 'active'}`}
          ref={swiperRef}
          cards={movies}
          cardIndex={currentIndex}
          renderCard={(movie) =>
            movie ? <MovieCard movie={movie} /> : null
          }
          onSwipedRight={(i) => { setShowDetails(false); handleSwipe(i, true); }}
          onSwipedLeft={(i) => { setShowDetails(false); handleSwipe(i, false); }}
          backgroundColor="transparent"
          cardHorizontalMargin={24}
          cardVerticalMargin={0}
          marginTop={40}
          marginBottom={130}
          stackSize={3}
          stackScale={6}
          stackSeparation={14}
          animateCardOpacity
          animateOverlayLabelsOpacity
          disableTopSwipe
          disableBottomSwipe
          overlayLabels={{
            left: {
              title: 'NOPE',
              style: {
                label: {
                  backgroundColor: 'transparent',
                  borderColor: '#ff6b6b',
                  color: '#ff6b6b',
                  borderWidth: 3,
                  fontSize: 28,
                  fontWeight: '800',
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 30,
                  marginLeft: -30,
                },
              },
            },
            right: {
              title: 'LIKE',
              style: {
                label: {
                  backgroundColor: 'transparent',
                  borderColor: '#4ecdc4',
                  color: '#4ecdc4',
                  borderWidth: 3,
                  fontSize: 28,
                  fontWeight: '800',
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 30,
                  marginLeft: 30,
                },
              },
            },
          }}
          containerStyle={styles.swiperContainer}
          cardStyle={styles.cardStyle}
        />
      )}

      {/* Bottom area: details + action buttons */}
      <View style={styles.bottomArea}>
        {/* View Details toggle */}
        {movies[currentIndex] && (
          <TouchableOpacity
            style={styles.detailsToggle}
            onPress={() => setShowDetails(!showDetails)}
          >
            <Text style={styles.detailsToggleText}>
              {showDetails ? 'Hide Details' : 'View Details'}
            </Text>
            <Text style={styles.detailsArrow}>{showDetails ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        )}

        {/* Movie overview */}
        {showDetails && movies[currentIndex] && (
          <View style={styles.detailsBox}>
            <Text style={styles.overviewText}>
              {movies[currentIndex].overview}
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.nopeButton]}
            onPress={() => {
              setShowDetails(false);
              swiperRef.current?.swipeLeft();
            }}
          >
            <Text style={styles.buttonEmoji}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => {
              setShowDetails(false);
              swiperRef.current?.swipeRight();
            }}
          >
            <Text style={styles.buttonEmoji}>♥</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Match modal */}
      {matchMovie && (
        <MatchModal
          movie={matchMovie}
          onClose={() => setMatchMovie(null)}
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
  swiperContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStyle: {},
  matchBadge: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: '#e94560',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  matchBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 32,
    zIndex: 20,
  },
  detailsToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(26,26,46,0.8)',
    borderRadius: 14,
    marginBottom: 14,
  },
  detailsToggleText: {
    color: '#e0e0f0',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  detailsArrow: {
    color: '#a0a0b0',
    fontSize: 11,
  },
  detailsBox: {
    backgroundColor: 'rgba(26,26,46,0.95)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  overviewText: {
    color: '#c0c0d0',
    fontSize: 14,
    lineHeight: 21,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 48,
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

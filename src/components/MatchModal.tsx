import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { getPosterUrl } from '../lib/tmdb';
import type { TMDBMovie } from '../types/tmdb';

const { width } = Dimensions.get('window');
const POSTER_WIDTH = Math.min(width * 0.45, 180);
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;

interface Props {
  movie: TMDBMovie;
  onClose: () => void;
}

export function MatchModal({ movie, onClose }: Props) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.container}>
        <Text style={styles.matchText}>It's a Match!</Text>
        <Text style={styles.subtitle}>You both liked this movie</Text>

        {movie.poster_path && (
          <Image
            source={{ uri: getPosterUrl(movie.poster_path, 'w342') }}
            style={styles.poster}
            contentFit="cover"
            transition={300}
          />
        )}

        <Text style={styles.movieTitle}>{movie.title}</Text>

        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Keep Swiping</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    alignItems: 'center',
    padding: 32,
  },
  matchText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#e94560',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0b0',
    marginBottom: 24,
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 16,
    marginBottom: 16,
  },
  movieTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#e94560',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

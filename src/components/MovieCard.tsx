import { StyleSheet, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { getPosterUrl } from '../lib/tmdb';
import type { TMDBMovie } from '../types/tmdb';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 48, 382);
// TMDB posters are 2:3 aspect ratio — preserve full image without cropping
const CARD_HEIGHT = CARD_WIDTH * 1.5;

interface Props {
  movie: TMDBMovie;
}

export function MovieCard({ movie }: Props) {
  if (!movie.poster_path) return null;

  return (
    <Image
      source={{ uri: getPosterUrl(movie.poster_path) }}
      style={styles.poster}
      contentFit="contain"
      transition={200}
    />
  );
}

const styles = StyleSheet.create({
  poster: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    alignSelf: 'center',
    backgroundColor: '#1a1a2e',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }),
  } as any,
});

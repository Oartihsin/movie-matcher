import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { getPosterUrl } from '../lib/tmdb';
import { GENRE_MAP } from '../types/tmdb';
import type { TMDBMovie } from '../types/tmdb';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 48;
const CARD_HEIGHT = height - 350;

interface Props {
  movie: TMDBMovie;
}

export function MovieCard({ movie }: Props) {
  const year = movie.release_date?.split('-')[0] ?? '';
  const genres = movie.genre_ids
    ?.slice(0, 3)
    .map((id) => GENRE_MAP[id])
    .filter(Boolean);

  return (
    <View style={styles.card}>
      {movie.poster_path && (
        <Image
          source={{ uri: getPosterUrl(movie.poster_path) }}
          style={styles.poster}
          contentFit="cover"
          transition={200}
        />
      )}
      {/* Gradient fade from transparent to dark at the bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)']}
        locations={[0, 0.4, 0.75, 1]}
        style={styles.gradient}
      />
      {/* Movie info at the bottom over the gradient */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {movie.title}
        </Text>
        <View style={styles.meta}>
          {year ? <Text style={styles.year}>{year}</Text> : null}
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingIcon}>★</Text>
            <Text style={styles.ratingText}>
              {movie.vote_average.toFixed(1)}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
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
});

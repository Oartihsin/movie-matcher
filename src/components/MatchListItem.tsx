import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { getPosterUrl } from '../lib/tmdb';
import { GENRE_MAP } from '../types/tmdb';
import type { TMDBMovie } from '../types/tmdb';

interface Props {
  movie: TMDBMovie;
}

export function MatchListItem({ movie }: Props) {
  const year = movie.release_date?.split('-')[0] ?? '';
  const genres = (movie.genre_ids ?? [])
    .slice(0, 2)
    .map((id) => GENRE_MAP[id])
    .filter(Boolean);

  return (
    <View style={styles.row}>
      {movie.poster_path && (
        <Image
          source={{ uri: getPosterUrl(movie.poster_path, 'w185') }}
          style={styles.poster}
          contentFit="cover"
        />
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {movie.title}
        </Text>
        <View style={styles.meta}>
          {year ? <Text style={styles.year}>{year}</Text> : null}
          <Text style={styles.rating}>
            {movie.vote_average?.toFixed(1)}
          </Text>
        </View>
        {genres.length > 0 && (
          <Text style={styles.genres}>{genres.join(' / ')}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    gap: 12,
  },
  poster: {
    width: 60,
    height: 90,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  year: {
    color: '#a0a0b0',
    fontSize: 14,
  },
  rating: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '600',
  },
  genres: {
    color: '#777',
    fontSize: 12,
  },
});

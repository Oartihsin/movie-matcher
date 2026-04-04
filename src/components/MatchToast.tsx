import { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';

interface Props {
  movieTitle: string;
  onDismiss: () => void;
}

export function MatchToast({ movieTitle, onDismiss }: Props) {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Slide in
    translateY.value = withTiming(0, { duration: 300 });
    opacity.value = withTiming(1, { duration: 300 });

    // Auto-dismiss after 3s
    translateY.value = withDelay(3000, withTiming(-100, { duration: 300 }));
    opacity.value = withDelay(
      3000,
      withTiming(0, { duration: 300 }, () => {
        runOnJS(onDismiss)();
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Animated.Text style={styles.emoji}>🎉</Animated.Text>
      <Animated.View style={styles.textContainer}>
        <Animated.Text style={styles.title}>New Match!</Animated.Text>
        <Animated.Text style={styles.subtitle} numberOfLines={1}>
          {movieTitle}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(233,69,96,0.95)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
    zIndex: 1000,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
        }),
  } as any,
  emoji: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
});

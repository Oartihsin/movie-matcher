import { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 48, 382);
const CARD_HEIGHT = CARD_WIDTH * 1.5;

function ShimmerOverlay() {
  const translateX = useSharedValue(-CARD_WIDTH);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(CARD_WIDTH, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, animatedStyle]}>
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.06)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.wrapper}>
      {/* Poster placeholder */}
      <View style={styles.poster}>
        <ShimmerOverlay />
      </View>

      {/* Title placeholder */}
      <View style={styles.infoSection}>
        <View style={[styles.block, { width: '70%', height: 24 }]}>
          <ShimmerOverlay />
        </View>

        {/* Badges row */}
        <View style={styles.badgesRow}>
          <View style={[styles.block, { width: 48, height: 18 }]}>
            <ShimmerOverlay />
          </View>
          <View style={[styles.block, { width: 40, height: 18 }]}>
            <ShimmerOverlay />
          </View>
          <View style={[styles.block, { width: 56, height: 18 }]}>
            <ShimmerOverlay />
          </View>
        </View>

        {/* Genre chips */}
        <View style={styles.badgesRow}>
          <View style={[styles.block, { width: 64, height: 22, borderRadius: 11 }]}>
            <ShimmerOverlay />
          </View>
          <View style={[styles.block, { width: 72, height: 22, borderRadius: 11 }]}>
            <ShimmerOverlay />
          </View>
          <View style={[styles.block, { width: 56, height: 22, borderRadius: 11 }]}>
            <ShimmerOverlay />
          </View>
        </View>

        {/* Description lines */}
        <View style={[styles.block, { width: '100%', height: 12, marginTop: 12 }]}>
          <ShimmerOverlay />
        </View>
        <View style={[styles.block, { width: '90%', height: 12 }]}>
          <ShimmerOverlay />
        </View>
        <View style={[styles.block, { width: '75%', height: 12 }]}>
          <ShimmerOverlay />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 24,
  },
  poster: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: '#1e2745',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  infoSection: {
    paddingTop: 16,
    gap: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  block: {
    backgroundColor: '#1e2745',
    borderRadius: 6,
    overflow: 'hidden',
  },
});

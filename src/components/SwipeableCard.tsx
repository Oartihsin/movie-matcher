import { useCallback } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_X = width * 1.5;

interface Props {
  onSwipe: (liked: boolean) => void;
  children: React.ReactNode;
}

export function SwipeableCard({ onSwipe, children }: Props) {
  const translateX = useSharedValue(0);
  const isAnimatingOut = useSharedValue(false);

  const triggerSwipe = useCallback(
    (liked: boolean) => {
      onSwipe(liked);
    },
    [onSwipe]
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (!isAnimatingOut.value) {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (isAnimatingOut.value) return;

      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const liked = e.translationX > 0;
        isAnimatingOut.value = true;
        translateX.value = withTiming(
          liked ? SWIPE_OUT_X : -SWIPE_OUT_X,
          { duration: 300 },
          () => {
            runOnJS(triggerSwipe)(liked);
          }
        );
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-width, 0, width],
      [-8, 0, 8],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, cardStyle]}>
        {/* LIKE overlay */}
        <Animated.View style={[styles.overlayLabel, styles.likeLabel, likeStyle]}>
          <Animated.Text style={[styles.overlayText, styles.likeText]}>
            LIKE
          </Animated.Text>
        </Animated.View>

        {/* NOPE overlay */}
        <Animated.View style={[styles.overlayLabel, styles.nopeLabel, nopeStyle]}>
          <Animated.Text style={[styles.overlayText, styles.nopeText]}>
            NOPE
          </Animated.Text>
        </Animated.View>

        {children}
      </Animated.View>
    </GestureDetector>
  );
}

// Programmatic swipe for button taps
export function useSwipeControls(onSwipe: (liked: boolean) => void) {
  const triggerSwipe = useCallback(
    (liked: boolean) => {
      onSwipe(liked);
    },
    [onSwipe]
  );
  return { triggerSwipe };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlayLabel: {
    position: 'absolute',
    top: 80,
    zIndex: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 3,
    borderRadius: 8,
  },
  likeLabel: {
    left: 24,
    borderColor: '#4ecdc4',
  },
  nopeLabel: {
    right: 24,
    borderColor: '#ff6b6b',
  },
  overlayText: {
    fontSize: 28,
    fontWeight: '800',
  },
  likeText: {
    color: '#4ecdc4',
  },
  nopeText: {
    color: '#ff6b6b',
  },
});

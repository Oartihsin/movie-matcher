import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface Props {
  onDismiss: () => void;
}

export function SwipeTutorial({ onDismiss }: Props) {
  // Overlay fade in
  const opacity = useSharedValue(0);

  // Arrow bounce animations (offset on JS side so they're out of phase)
  const arrowLeftX = useSharedValue(0);
  const arrowRightX = useSharedValue(0);

  // Button pulse ring scale
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Fade in overlay
    opacity.value = withTiming(1, { duration: 350 });

    // Left arrow bounces left repeatedly
    arrowLeftX.value = withDelay(
      100,
      withRepeat(
        withSequence(
          withTiming(-12, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );

    // Right arrow bounces right (offset start so they're out of phase)
    arrowRightX.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(12, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );

    // Button rings pulse
    pulseScale.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1.25, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const arrowLeftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowLeftX.value }],
  }));
  const arrowRightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowRightX.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <TouchableWithoutFeedback onPress={onDismiss}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}>

        {/* Gesture hint row — sits in the middle of the screen */}
        <View style={styles.hintsRow}>
          {/* Left: PASS */}
          <Animated.View style={[styles.hintBlock, arrowLeftStyle]}>
            <Text style={styles.arrowLeft}>←</Text>
            <Text style={styles.hintLabelLeft}>PASS</Text>
          </Animated.View>

          {/* Right: LIKE */}
          <Animated.View style={[styles.hintBlock, arrowRightStyle]}>
            <Text style={styles.hintLabelRight}>LIKE</Text>
            <Text style={styles.arrowRight}>→</Text>
          </Animated.View>
        </View>

        {/* Pulsing rings over ✕ and ♥ buttons */}
        <View style={styles.buttonsOverlay}>
          <Animated.View style={[styles.pulseRing, styles.pulseRingNope, pulseStyle]} />
          <Animated.View style={[styles.pulseRing, styles.pulseRingLike, pulseStyle]} />
        </View>

        {/* Bottom instruction text */}
        <View style={styles.bottomText}>
          <Text style={styles.instructionText}>Swipe or tap to pick movies</Text>
          <Text style={styles.skipText}>Tap anywhere to skip</Text>
        </View>

      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 100,
    justifyContent: 'space-between',
  },

  // ── Gesture hints ──────────────────────────────────────────────────────────
  hintsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    marginTop: Platform.OS === 'ios' ? 120 : 80,
    marginBottom: 40,
  },
  hintBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowLeft: {
    fontSize: 28,
    color: '#ff6b6b',
    fontWeight: '800',
  },
  arrowRight: {
    fontSize: 28,
    color: '#4ecdc4',
    fontWeight: '800',
  },
  hintLabelLeft: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ff6b6b',
    letterSpacing: 2,
  },
  hintLabelRight: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4ecdc4',
    letterSpacing: 2,
  },

  // ── Pulsing rings over buttons ─────────────────────────────────────────────
  buttonsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // gap=32 so ring centers sit at ±54px from screen center, same as buttons (gap=48, width=60)
    gap: 32,
    // paddingBottom=28 so 76px ring centers land at 66px from bottom, same as 60px buttons (pb=36)
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingTop: 12,
  },
  pulseRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
  },
  pulseRingNope: {
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(255,107,107,0.15)',
  },
  pulseRingLike: {
    borderColor: '#4ecdc4',
    backgroundColor: 'rgba(78,205,196,0.15)',
  },

  // ── Bottom text — positioned above the button bar ─────────────────────────
  bottomText: {
    position: 'absolute',
    // Sits above the button rings: ring top is ~104px from bottom, add 12px breathing room
    bottom: Platform.OS === 'ios' ? 116 : 104,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  instructionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});

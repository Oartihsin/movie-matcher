import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const DISMISSED_KEY = 'share_prompt_dismissed';

interface Props {
  username: string;
}

export function SharePrompt({ username }: Props) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const opacity = useSharedValue(0);

  const link = `moviematcher.app/u/${username}`;

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((val) => {
      if (!val) {
        setVisible(true);
        opacity.value = withTiming(1, { duration: 400 });
      }
    });
  }, []);

  function dismiss() {
    opacity.value = withTiming(0, { duration: 300 }, () => {
      runOnJS(setVisible)(false);
    });
    AsyncStorage.setItem(DISMISSED_KEY, 'true');
  }

  async function copyLink() {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, animatedStyle]}>
      <View style={styles.card}>
        <Text style={styles.emoji}>🍿</Text>
        <Text style={styles.title}>Better with friends!</Text>
        <Text style={styles.subtitle}>
          Share your link and discover movies you'll both love
        </Text>

        <View style={styles.linkBox}>
          <Text style={styles.linkText} numberOfLines={1}>
            {link}
          </Text>
        </View>

        <TouchableOpacity style={styles.copyButton} onPress={copyLink}>
          <Text style={styles.copyButtonText}>
            {copied ? 'Copied!' : 'Copy Link'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={dismiss}>
          <Text style={styles.skipText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999,
  },
  card: {
    backgroundColor: '#292524',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  linkBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  linkText: {
    color: '#e94560',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  copyButton: {
    backgroundColor: '#e94560',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    color: '#78716c',
    fontSize: 14,
  },
});

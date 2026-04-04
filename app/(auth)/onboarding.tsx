import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { usePhoneVerification } from '../../src/hooks/usePhoneVerification';
import { GENRE_MAP } from '../../src/types/tmdb';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'tr', label: 'Turkish' },
  { code: 'th', label: 'Thai' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
];

const GENRE_OPTIONS = Object.entries(GENRE_MAP).map(([id, name]) => ({
  id: Number(id),
  name,
}));

type Step = 'phone' | 'otp' | 'profile' | 'preferences';

export default function OnboardingScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const { sendOTP, verifyOTP, loading: otpLoading, error: otpError, codeSent, reset: resetOTP } = usePhoneVerification();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Step 1: Send OTP
  async function handleSendOTP() {
    if (!phone) return;
    await sendOTP(phone);
    if (!otpError) {
      setStep('otp');
    }
  }

  // Step 2: Verify OTP
  async function handleVerifyOTP() {
    if (otpCode.length < 6) return;
    const success = await verifyOTP(phone, otpCode);
    if (success) {
      setStep('profile');
    }
  }

  // Check username availability
  async function checkUsername(value: string) {
    setUsername(value);
    setUsernameAvailable(null);
    if (value.length < 3) return;

    const { data } = await supabase.rpc('is_username_available', {
      p_username: value,
    });
    setUsernameAvailable(!!data);
  }

  // Step 3: Set username + display name
  function handleProfileNext() {
    if (!username || !usernameAvailable || !displayName) return;
    setStep('preferences');
  }

  // Step 4: Select genres + languages → create profile
  async function handleFinish() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        username: username.toLowerCase(),
        display_name: displayName,
        phone_verified: true,
        preferred_genres: selectedGenres,
        preferred_languages: selectedLanguages,
      });

      if (insertError) throw insertError;

      await fetchProfile();
      // Navigation will be handled by auth state in _layout
    } catch (err: any) {
      setError(err.message ?? 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  }

  function toggleGenre(id: number) {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  function toggleLanguage(code: string) {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  }

  // Phone input step
  if (step === 'phone') {
    return (
      <View style={styles.container}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>1 of 3</Text>
          <Text style={styles.stepTitle}>Verify Your Phone</Text>
          <Text style={styles.stepSubtitle}>
            We need your phone number to keep the community safe
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor="#666"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoFocus
          />

          {otpError && <Text style={styles.error}>{otpError}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, !phone && styles.disabled]}
            onPress={handleSendOTP}
            disabled={otpLoading || !phone}
          >
            {otpLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Send Code</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // OTP verification step
  if (step === 'otp') {
    return (
      <View style={styles.container}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>1 of 3</Text>
          <Text style={styles.stepTitle}>Enter Verification Code</Text>
          <Text style={styles.stepSubtitle}>
            We sent a 6-digit code to {phone}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, styles.otpInput]}
            placeholder="000000"
            placeholderTextColor="#666"
            value={otpCode}
            onChangeText={setOtpCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          {otpError && <Text style={styles.error}>{otpError}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, otpCode.length < 6 && styles.disabled]}
            onPress={handleVerifyOTP}
            disabled={otpLoading || otpCode.length < 6}
          >
            {otpLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Verify</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              resetOTP();
              setOtpCode('');
              setStep('phone');
            }}
          >
            <Text style={styles.linkText}>Change phone number</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Profile setup step
  if (step === 'profile') {
    return (
      <View style={styles.container}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>2 of 3</Text>
          <Text style={styles.stepTitle}>Set Up Your Profile</Text>
          <Text style={styles.stepSubtitle}>
            Choose a username friends can find you by
          </Text>
        </View>

        <View style={styles.form}>
          <View>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#666"
              value={username}
              onChangeText={checkUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {username.length >= 3 && usernameAvailable !== null && (
              <Text
                style={[
                  styles.availabilityHint,
                  { color: usernameAvailable ? '#4ecdc4' : '#ff6b6b' },
                ]}
              >
                {usernameAvailable ? 'Available' : 'Already taken'}
              </Text>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Display Name"
            placeholderTextColor="#666"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!username || !usernameAvailable || !displayName) && styles.disabled,
            ]}
            onPress={handleProfileNext}
            disabled={!username || !usernameAvailable || !displayName}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Preferences step (genres + languages)
  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>3 of 3</Text>
        <Text style={styles.stepTitle}>Your Preferences</Text>
        <Text style={styles.stepSubtitle}>
          Pick genres and languages you enjoy
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Genres</Text>
      <View style={styles.chipGrid}>
        {GENRE_OPTIONS.map((genre) => {
          const selected = selectedGenres.includes(genre.id);
          return (
            <TouchableOpacity
              key={genre.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleGenre(genre.id)}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {genre.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Languages</Text>
      <View style={styles.chipGrid}>
        {LANGUAGE_OPTIONS.map((lang) => {
          const selected = selectedLanguages.includes(lang.code);
          return (
            <TouchableOpacity
              key={lang.code}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleLanguage(lang.code)}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {lang.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.primaryButton, { marginTop: 24 }]}
        onPress={handleFinish}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Get Started</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    padding: 24,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 48,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepNumber: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#a0a0b0',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    gap: 14,
  },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  otpInput: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  primaryButton: {
    backgroundColor: '#e94560',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 4,
  },
  linkText: {
    color: '#a0a0b0',
    fontSize: 14,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
  },
  availabilityHint: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    marginLeft: 4,
  },
  sectionLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  chipSelected: {
    backgroundColor: 'rgba(233,69,96,0.25)',
    borderColor: '#e94560',
  },
  chipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
});

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { useAuthStore } from '../../src/stores/authStore';
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

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [selectedGenres, setSelectedGenres] = useState<number[]>(
    profile?.preferred_genres ?? []
  );
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    profile?.preferred_languages ?? ['en']
  );
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const link = `moviematcher.app/u/${profile?.username}`;

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          preferred_genres: selectedGenres,
          preferred_languages: selectedLanguages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      await fetchProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error('Profile save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
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

  if (!profile) return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.display_name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.phone_verified && (
          <Text style={styles.verifiedBadge}>Phone Verified</Text>
        )}
      </View>

      {/* Shareable link */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Link</Text>
        <TouchableOpacity style={styles.linkBox} onPress={copyLink}>
          <Text style={styles.linkText}>{link}</Text>
          <Text style={styles.copyHint}>
            {copied ? 'Copied!' : 'Tap to copy'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Display name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor="#666"
        />
      </View>

      {/* Preferred genres */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferred Genres</Text>
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
      </View>

      {/* Preferred languages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferred Languages</Text>
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
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>
            {saved ? 'Saved!' : 'Save Changes'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  content: {
    padding: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  username: {
    color: '#a0a0b0',
    fontSize: 16,
    fontWeight: '600',
  },
  verifiedBadge: {
    color: '#4ecdc4',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  linkBox: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e94560',
    alignItems: 'center',
  },
  linkText: {
    color: '#e94560',
    fontSize: 15,
    fontWeight: '600',
  },
  copyHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  saveButton: {
    backgroundColor: '#e94560',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  signOutButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
});

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
  Linking,
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

function ChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: { id: string | number; label: string }[];
  selected: (string | number)[];
  onToggle: (val: any) => void;
}) {
  return (
    <View style={styles.chipGrid}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.id);
        return (
          <TouchableOpacity
            key={String(opt.id)}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onToggle(opt.id)}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CollapsibleSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <TouchableOpacity style={styles.settingsRow} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.settingsRowLabel}>{title}</Text>
        <View style={styles.settingsRowRight}>
          <Text style={styles.settingsRowValue} numberOfLines={1}>
            {summary}
          </Text>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {expanded && <View style={styles.chipContainer}>{children}</View>}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<number[]>(
    profile?.preferred_genres ?? []
  );
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    profile?.preferred_languages ?? ['en']
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty =
    displayName !== (profile?.display_name ?? '') ||
    JSON.stringify(selectedGenres.slice().sort()) !==
      JSON.stringify((profile?.preferred_genres ?? []).slice().sort()) ||
    JSON.stringify(selectedLanguages.slice().sort()) !==
      JSON.stringify((profile?.preferred_languages ?? ['en']).slice().sort());

  const link = `moviematcher.app/u/${profile?.username}`;

  const genreSummary =
    selectedGenres.length === 0
      ? 'None selected'
      : GENRE_OPTIONS.filter((g) => selectedGenres.includes(g.id))
          .slice(0, 3)
          .map((g) => g.name)
          .join(', ') + (selectedGenres.length > 3 ? ` +${selectedGenres.length - 3}` : '');

  const languageSummary =
    selectedLanguages.length === 0
      ? 'None selected'
      : LANGUAGE_OPTIONS.filter((l) => selectedLanguages.includes(l.code))
          .slice(0, 2)
          .map((l) => l.label)
          .join(', ') +
        (selectedLanguages.length > 2 ? ` +${selectedLanguages.length - 2}` : '');

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Check your connection.')), 10000)
      );

      const save = supabase
        .from('profiles')
        .update({
          display_name: displayName,
          preferred_genres: selectedGenres,
          preferred_languages: selectedLanguages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      const { error } = await Promise.race([save, timeout]);
      if (error) throw error;

      await fetchProfile();
      setSaved(true);
      setEditingName(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    try {
      await Clipboard.setStringAsync(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setSaveError('Could not copy to clipboard');
      setTimeout(() => setSaveError(null), 3000);
    }
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.display_name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.heroName}>{profile.display_name}</Text>
          <View style={styles.heroBadgeRow}>
            <Text style={styles.heroUsername}>@{profile.username}</Text>
            {profile.phone_verified && (
              <>
                <Text style={styles.badgeDot}>·</Text>
                <Text style={styles.verifiedBadge}>✓ Verified</Text>
              </>
            )}
          </View>
        </View>

        {/* Profile Card */}
        <Text style={styles.sectionLabel}>PROFILE</Text>
        <View style={styles.card}>
          {/* Display Name Row */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => setEditingName((v) => !v)}
          >
            <Text style={styles.settingsRowLabel}>Display Name</Text>
            {!editingName && (
              <View style={styles.settingsRowRight}>
                <Text style={styles.settingsRowValue}>{displayName}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            )}
          </TouchableOpacity>
          {editingName && (
            <View style={styles.inlineEdit}>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor="#666"
                autoFocus
              />
            </View>
          )}

          <View style={styles.divider} />

          {/* Invite Link Row */}
          <TouchableOpacity style={styles.settingsRow} onPress={copyLink}>
            <Text style={styles.settingsRowLabel}>Invite Link</Text>
            <View style={styles.settingsRowRight}>
              <Text style={[styles.settingsRowValue, styles.linkValue]} numberOfLines={1}>
                {link}
              </Text>
              <Text style={styles.copyIcon}>{copied ? '✓' : '⎘'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Preferences Card */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.card}>
          <CollapsibleSection title="Genres" summary={genreSummary}>
            <ChipGrid
              options={GENRE_OPTIONS.map((g) => ({ id: g.id, label: g.name }))}
              selected={selectedGenres}
              onToggle={toggleGenre}
            />
          </CollapsibleSection>

          <View style={styles.divider} />

          <CollapsibleSection title="Languages" summary={languageSummary}>
            <ChipGrid
              options={LANGUAGE_OPTIONS.map((l) => ({ id: l.code, label: l.label }))}
              selected={selectedLanguages}
              onToggle={toggleLanguage}
            />
          </CollapsibleSection>
        </View>

        {/* Support Card */}
        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => Linking.openURL('https://docs.google.com/document/d/1VgA24itUDU89guhxNlrnlDN53MPU0DY4fomAYOASF0E/edit?usp=sharing')}
          >
            <Text style={styles.settingsRowLabel}>Terms & Conditions</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => Linking.openURL('https://docs.google.com/document/d/1E94939sWQfrIeEwwrCatSN35PpXqRMp9TK_mauxrtK0/edit?usp=sharing')}
          >
            <Text style={styles.settingsRowLabel}>Privacy Policy</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => Linking.openURL('mailto:hello@moviematcher.app?subject=Contact Us')}
          >
            <Text style={styles.settingsRowLabel}>Contact Us</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() =>
              Linking.openURL(
                'mailto:hello@moviematcher.app?subject=Bug Report&body=Describe the bug here...'
              )
            }
          >
            <Text style={styles.settingsRowLabel}>Report a Bug</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Account Card — always last */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingsRow} onPress={handleSignOut}>
            <Text style={styles.destructiveLabel}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: isDirty ? 100 : 48 }} />
      </ScrollView>

      {/* Floating Save Button — only visible when changes pending */}
      {isDirty && (
        <View style={styles.floatingBar}>
          {saveError && (
            <Text style={styles.saveError}>{saveError}</Text>
          )}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>{saved ? 'Saved!' : 'Save Changes'}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1917',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '800',
  },
  heroName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroUsername: {
    color: '#a8a29e',
    fontSize: 15,
    fontWeight: '500',
  },
  badgeDot: {
    color: '#a8a29e',
    fontSize: 15,
  },
  verifiedBadge: {
    color: '#4ecdc4',
    fontSize: 13,
    fontWeight: '700',
  },

  // Section label (iOS Settings style)
  sectionLabel: {
    color: '#78716c',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 6,
    marginTop: 24,
  },

  // Card
  card: {
    backgroundColor: '#292524',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },

  // Settings rows
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  settingsRowLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  settingsRowValue: {
    color: '#a8a29e',
    fontSize: 15,
    maxWidth: 160,
    textAlign: 'right',
  },
  linkValue: {
    color: '#e94560',
    fontSize: 13,
  },
  chevron: {
    color: '#78716c',
    fontSize: 14,
    marginLeft: 2,
  },
  copyIcon: {
    color: '#4ecdc4',
    fontSize: 18,
    fontWeight: '700',
  },
  destructiveLabel: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 16,
  },

  // Inline name edit
  inlineEdit: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  input: {
    backgroundColor: '#1f1e1b',
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(233,69,96,0.4)',
  },

  // Chips
  chipContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
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
    borderColor: 'rgba(255,255,255,0.12)',
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

  // Floating save bar
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    paddingTop: 12,
    backgroundColor: 'rgba(28,25,23,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  saveButton: {
    backgroundColor: '#e94560',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  saveError: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
});

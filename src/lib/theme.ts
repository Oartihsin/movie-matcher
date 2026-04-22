// Centralized design tokens — Pinterest-inspired warm dark theme.
// Import from here instead of hardcoding hex values in StyleSheet.

export const colors = {
  // Surfaces (warm darks — Tailwind stone palette)
  bg: '#1c1917',
  card: '#292524',
  cardAlt: '#1f1e1b',
  input: '#292524',

  // Accent
  primary: '#e94560',
  primaryMuted: 'rgba(233,69,96,0.15)',
  primaryHover: 'rgba(233,69,96,0.2)',

  // Feedback
  like: '#4ecdc4',
  likeMuted: 'rgba(78,205,196,0.12)',
  nope: '#ff6b6b',
  nopeMuted: 'rgba(255,107,107,0.12)',

  // Text (warm, not pure white)
  textPrimary: '#fafaf9',
  textSecondary: '#a8a29e',
  textMuted: '#78716c',

  // Borders (warm transparency)
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',

  // Overlay
  overlay: 'rgba(0,0,0,0.65)',

  // Status
  success: '#4ecdc4',
  error: '#ff6b6b',
  warning: '#f59e0b',

  // Web
  webOuter: '#0c0a09',
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

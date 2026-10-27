/**
 * Semantic design tokens for the mobile app.
 *
 * Light and dark palettes share the same token names so `useColors()` can
 * switch between them from the device appearance setting.
 */

const light = {
  // Legacy aliases (kept for backward compatibility)
  text: '#172920',
  tint: '#126447',

  // Core surfaces
  background: '#F4F0E5',
  backgroundElevated: '#FFFDF8',
  foreground: '#172920',

  // Cards / elevated surfaces
  card: '#FFFEFA',
  cardForeground: '#172920',
  cardMuted: '#F0F1E8',

  // Primary action color (buttons, links, active states)
  primary: '#0B6048',
  primaryForeground: '#FFFFFF',
  primarySoft: '#DFEEE4',

  // Secondary / less-emphasis interactive surfaces
  secondary: '#E9EEE3',
  secondaryForeground: '#244B3B',

  // Muted / subdued elements (dividers, timestamps, placeholders)
  muted: '#EFEEE6',
  mutedForeground: '#6D766E',

  // Accent highlights (badges, selected items, focus rings)
  accent: '#F0E5CB',
  accentForeground: '#5A4726',

  // Destructive actions (delete, error states)
  destructive: '#A94C43',
  destructiveForeground: '#FFFFFF',

  // Borders and input outlines
  border: '#DEDCCF',
  borderStrong: '#C7C4B5',
  input: '#DEDCCF',

  // Fatwa brand accents
  forest: '#082F23',
  forestDeep: '#05261C',
  green: '#0E7151',
  teal: '#559878',
  mint: '#E5F0E5',
  gold: '#A8782E',
  goldSoft: '#F3E8CF',
  coral: '#C45E53',
  coralSoft: '#F8E7E1',
  blue: '#4C9BC0',
  purple: '#8F72BE',
  pink: '#CE6791',
  orange: '#BE7048',
  slate: '#586B61',
  ivory: '#FBF9F1',

  // Effects
  shadow: '#1B382B',
  overlay: 'rgba(8, 38, 29, 0.52)',
  onHero: '#FFFFFF',
  onHeroMuted: '#DDE9DF',
};

const dark: typeof light = {
  text: '#EAF1EB',
  tint: '#78CBA2',

  background: '#0B1511',
  backgroundElevated: '#111F19',
  foreground: '#EAF1EB',

  card: '#14231B',
  cardForeground: '#EAF1EB',
  cardMuted: '#172820',

  primary: '#69C299',
  primaryForeground: '#08271B',
  primarySoft: '#17372A',

  secondary: '#1A3025',
  secondaryForeground: '#D2E7D8',

  muted: '#1B2D23',
  mutedForeground: '#9AAC9F',

  accent: '#20392B',
  accentForeground: '#C2E4CE',

  destructive: '#E0706A',
  destructiveForeground: '#1A0B0A',

  border: '#293D31',
  borderStrong: '#3A5243',
  input: '#293D31',

  forest: '#102D21',
  forestDeep: '#0A2118',
  green: '#2E8B68',
  teal: '#65AF91',
  mint: '#19372A',
  gold: '#D4B36E',
  goldSoft: '#302817',
  coral: '#E08A73',
  coralSoft: '#38251F',
  blue: '#63B2D4',
  purple: '#A48CD1',
  pink: '#E084AB',
  orange: '#D0855C',
  slate: '#A1B6A8',
  ivory: '#0B1511',

  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.62)',
  onHero: '#FFFFFF',
  onHeroMuted: '#D5E7DB',
};

const colors = {
  light,
  dark,

  // Border radius (in px). Applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;

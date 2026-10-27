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
  background: '#F7F7F1',
  backgroundElevated: '#FFFFFF',
  foreground: '#172920',

  // Cards / elevated surfaces
  card: '#FFFFFF',
  cardForeground: '#172920',
  cardMuted: '#F5F7F2',

  // Primary action color (buttons, links, active states)
  primary: '#126447',
  primaryForeground: '#FFFFFF',
  primarySoft: '#E6F1E9',

  // Secondary / less-emphasis interactive surfaces
  secondary: '#EDF3EC',
  secondaryForeground: '#244B3B',

  // Muted / subdued elements (dividers, timestamps, placeholders)
  muted: '#F1F3EE',
  mutedForeground: '#748078',

  // Accent highlights (badges, selected items, focus rings)
  accent: '#E6F0E6',
  accentForeground: '#16533C',

  // Destructive actions (delete, error states)
  destructive: '#A94C43',
  destructiveForeground: '#FFFFFF',

  // Borders and input outlines
  border: '#E4E8DE',
  borderStrong: '#CDD8CD',
  input: '#E4E8DE',

  // Fatwa brand accents
  forest: '#0C3327',
  forestDeep: '#08261D',
  green: '#167153',
  teal: '#6FA78F',
  mint: '#E7F2E9',
  gold: '#B38A41',
  goldSoft: '#F6F0E4',
  coral: '#C66D61',
  blue: '#4C9BC0',
  purple: '#8F72BE',
  pink: '#CE6791',
  orange: '#BE7048',
  slate: '#586B61',
  ivory: '#FDFDF9',

  // Effects
  shadow: '#213A2D',
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

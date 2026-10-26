/**
 * Semantic design tokens for the mobile app.
 *
 * Light and dark palettes share the same token names so `useColors()` can
 * switch between them from the device appearance setting.
 */

const light = {
  // Legacy aliases (kept for backward compatibility)
  text: '#0B1F1A',
  tint: '#0B6B53',

  // Core surfaces
  background: '#F4F8F5',
  backgroundElevated: '#FFFFFF',
  foreground: '#0B1F1A',

  // Cards / elevated surfaces
  card: '#FFFFFF',
  cardForeground: '#0B1F1A',
  cardMuted: '#F8FBF9',

  // Primary action color (buttons, links, active states)
  primary: '#0B6B53',
  primaryForeground: '#FFFFFF',
  primarySoft: '#E3F2EC',

  // Secondary / less-emphasis interactive surfaces
  secondary: '#EAF4F0',
  secondaryForeground: '#12463A',

  // Muted / subdued elements (dividers, timestamps, placeholders)
  muted: '#EEF4F1',
  mutedForeground: '#6E817B',

  // Accent highlights (badges, selected items, focus rings)
  accent: '#DCEEE7',
  accentForeground: '#08503F',

  // Destructive actions (delete, error states)
  destructive: '#C0453F',
  destructiveForeground: '#FFFFFF',

  // Borders and input outlines
  border: '#DFE9E4',
  borderStrong: '#C9DAD3',
  input: '#DFE9E4',

  // Fatwa brand accents
  forest: '#04382D',
  forestDeep: '#02261F',
  green: '#0E7A5F',
  teal: '#3E9C8C',
  mint: '#E1F3ED',
  gold: '#C99A3F',
  goldSoft: '#F6EBD6',
  coral: '#D98066',
  blue: '#4C9BC0',
  purple: '#8F72BE',
  pink: '#CE6791',
  orange: '#BE7048',
  slate: '#4F6E65',
  ivory: '#FBFDFB',

  // Effects
  shadow: '#0B2E24',
  overlay: 'rgba(4, 32, 25, 0.55)',
  onHero: '#FFFFFF',
  onHeroMuted: '#DCEFE7',
};

const dark: typeof light = {
  text: '#EAF3EF',
  tint: '#4FC3A1',

  background: '#07120F',
  backgroundElevated: '#0D1C18',
  foreground: '#EAF3EF',

  card: '#0F2019',
  cardForeground: '#EAF3EF',
  cardMuted: '#122620',

  primary: '#3FB08D',
  primaryForeground: '#04231B',
  primarySoft: '#11332A',

  secondary: '#153029',
  secondaryForeground: '#C9E6DB',

  muted: '#132924',
  mutedForeground: '#8AA69D',

  accent: '#17352D',
  accentForeground: '#B9E2D3',

  destructive: '#E0706A',
  destructiveForeground: '#1A0B0A',

  border: '#1D3730',
  borderStrong: '#2A4A41',
  input: '#1D3730',

  forest: '#0B2A22',
  forestDeep: '#051B16',
  green: '#2E9C7C',
  teal: '#4FB3A1',
  mint: '#12332A',
  gold: '#D9B264',
  goldSoft: '#2C2415',
  coral: '#E08C72',
  blue: '#63B2D4',
  purple: '#A48CD1',
  pink: '#E084AB',
  orange: '#D0855C',
  slate: '#8FB0A7',
  ivory: '#07120F',

  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.62)',
  onHero: '#FFFFFF',
  onHeroMuted: '#CFE7DE',
};

const colors = {
  light,
  dark,

  // Border radius (in px). Applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;

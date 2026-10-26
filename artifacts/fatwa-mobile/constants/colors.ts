/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#0a0a0a',
    tint: '#08785F',

    // Core surfaces
    background: '#F7FAF8',
    foreground: '#142522',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#142522',

    // Primary action color (buttons, links, active states)
    primary: '#08785F',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#EAF4F0',
    secondaryForeground: '#17483D',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EFF4F1',
    mutedForeground: '#71817B',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#DDF3EA',
    accentForeground: '#075E4B',

    // Destructive actions (delete, error states)
    destructive: '#C84C4C',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#E1EAE5',
    input: '#E1EAE5',

    // Fatwa brand accents
    forest: '#064C3D',
    forestDeep: '#03392F',
    green: '#12876B',
    teal: '#4EA99B',
    mint: '#E1F3ED',
    gold: '#D8A85D',
    coral: '#E98A72',
    blue: '#5BA8C7',
    purple: '#9A7BC5',
    pink: '#D66F9A',
    orange: '#C97851',
    slate: '#53736A',
    ivory: '#F7FAF8',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 16,
};

export default colors;

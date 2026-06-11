// FlickTV Design System — Netflix/Prime Video inspired dark theme
// v2.0 — richer palette, semantic tokens, consistent accent usage

export const theme = {
  colors: {
    // ── Core backgrounds ──────────────────────────────────────────
    background:    '#0A0A0F',   // Deepest black — main app bg
    surface:       '#121218',   // Elevated surfaces (cards, modals)
    surfaceHover:  '#1A1A24',   // Hover state for surfaces
    card:          '#16161E',   // Channel cards
    cardHover:     '#1E1E28',   // Card hover
    border:        '#2A2A36',   // Default border
    borderLight:   '#3A3A48',   // Lighter border for emphasis
    borderFocus:   '#00E676',   // Focused/active border

    // ── Accent system ─────────────────────────────────────────────
    accent:        '#00E676',   // Primary green — CTAs, active states
    accentLight:   '#69F0AE',   // Lighter green — highlights
    accentDim:     '#00C853',   // Darker green — pressed states
    accentGlow:    '#00E67633', // Accent with 20% opacity — glow effects
    accentSubtle:  '#00E67612', // Accent with 7% opacity — subtle bg

    // ── Text hierarchy ────────────────────────────────────────────
    text:          '#FFFFFF',   // Primary text
    textSecondary: '#B8B8C0',   // Secondary text
    textMuted:     '#6B6B7A',   // Muted/placeholder text
    textDisabled:  '#3D3D4A',   // Disabled text

    // ── Semantic colors ───────────────────────────────────────────
    error:         '#FF5252',   // Errors, destructive actions
    errorDim:      '#FF525220', // Error background tint
    warning:       '#FFD740',   // Warnings
    warningDim:    '#FFD74020', // Warning background tint
    success:       '#00E676',   // Success (same as accent)
    info:          '#448AFF',   // Info blue

    // ── Live / status ─────────────────────────────────────────────
    live:          '#FF1744',   // Live indicator red
    liveGlow:      '#FF174440', // Live glow
    hd:            '#448AFF',   // HD badge blue
    k4:            '#FFD740',   // 4K badge gold

    // ── Overlays ──────────────────────────────────────────────────
    overlay:       'rgba(0,0,0,0.85)',
    overlayLight:  'rgba(0,0,0,0.5)',
    scrim:         'rgba(10,10,15,0.75)',  // Hero/banner scrim
    gradientTop:   'rgba(10,10,15,0)',     // Gradient start
    gradientBot:   'rgba(10,10,15,1)',     // Gradient end

    // ── Skeleton / shimmer ────────────────────────────────────────
    skeleton:      '#1E1E28',
    skeletonShine: '#2A2A36',
  },

  // ── Spacing scale ────────────────────────────────────────────────
  spacing: {
    xs:  4,
    sm:  8,
    md:  16,
    lg:  24,
    xl:  32,
    xxl: 48,
  },

  // ── Border radius ───────────────────────────────────────────────
  radius: {
    sm:   6,
    md:   10,
    lg:   14,
    xl:   20,
    xxl:  28,
    full: 9999,
  },

  // ── Typography ──────────────────────────────────────────────────
  fontSize: {
    xs:   10,
    sm:   12,
    md:   14,
    lg:   16,
    xl:   20,
    xxl:  26,
    xxxl: 34,
  },

  // ── Shadows (web) ───────────────────────────────────────────────
  shadow: {
    sm: '0 2px 8px rgba(0,0,0,0.3)',
    md: '0 4px 16px rgba(0,0,0,0.4)',
    lg: '0 8px 32px rgba(0,0,0,0.5)',
    glow: '0 0 20px rgba(0,230,118,0.15)',
  },

  // ── Animation timings ───────────────────────────────────────────
  animation: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
};

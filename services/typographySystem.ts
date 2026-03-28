// ═══════════════════════════════════════════════════
// Typography System — Based on world-class design research
// Golden Ratio (1.618) type scale, 8px spacing grid
// ═══════════════════════════════════════════════════

// ── Font Pairings ──
export interface FontPairing {
  id: string;
  name: string;
  heading: {
    family: string;
    googleFont: string;        // Google Fonts URL-safe name
    weight: number;
    letterSpacing: number;     // em
    textTransform: 'none' | 'uppercase';
    lineHeight: number;
  };
  body: {
    family: string;
    googleFont: string;
    weight: number;
    letterSpacing: number;
    lineHeight: number;
  };
  mood: string;
  bestFor: string[];
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'bebas-inter',
    name: 'Bebas Neue + Inter',
    heading: {
      family: '"Bebas Neue", sans-serif',
      googleFont: 'Bebas+Neue',
      weight: 400, // Bebas Neue only has 400 but looks bold
      letterSpacing: 0.04,
      textTransform: 'uppercase',
      lineHeight: 1.05,
    },
    body: {
      family: '"Inter", sans-serif',
      googleFont: 'Inter:wght@400;500;600;700',
      weight: 400,
      letterSpacing: 0,
      lineHeight: 1.5,
    },
    mood: 'Bold & Energetic',
    bestFor: ['Teknoloji', 'Spor', 'E-ticaret', 'Kampanya'],
  },
  {
    id: 'playfair-montserrat',
    name: 'Playfair Display + Montserrat',
    heading: {
      family: '"Playfair Display", serif',
      googleFont: 'Playfair+Display:wght@700;800;900',
      weight: 800,
      letterSpacing: -0.02,
      textTransform: 'none',
      lineHeight: 1.1,
    },
    body: {
      family: '"Montserrat", sans-serif',
      googleFont: 'Montserrat:wght@400;500;600;700',
      weight: 500,
      letterSpacing: 0,
      lineHeight: 1.5,
    },
    mood: 'Sophisticated & Classic',
    bestFor: ['Lüks', 'Moda', 'Gastronomi', 'Otel'],
  },
  {
    id: 'dmserif-inter',
    name: 'DM Serif Display + Inter',
    heading: {
      family: '"DM Serif Display", serif',
      googleFont: 'DM+Serif+Display',
      weight: 400,
      letterSpacing: -0.01,
      textTransform: 'none',
      lineHeight: 1.15,
    },
    body: {
      family: '"Inter", sans-serif',
      googleFont: 'Inter:wght@400;500;600;700',
      weight: 400,
      letterSpacing: 0,
      lineHeight: 1.5,
    },
    mood: 'Clean & Authoritative',
    bestFor: ['Kurumsal', 'SaaS', 'Eğitim', 'Finans'],
  },
  {
    id: 'abril-lato',
    name: 'Abril Fatface + Lato',
    heading: {
      family: '"Abril Fatface", serif',
      googleFont: 'Abril+Fatface',
      weight: 400,
      letterSpacing: -0.02,
      textTransform: 'none',
      lineHeight: 1.1,
    },
    body: {
      family: '"Lato", sans-serif',
      googleFont: 'Lato:wght@400;700',
      weight: 400,
      letterSpacing: 0,
      lineHeight: 1.5,
    },
    mood: 'Dramatic & Elegant',
    bestFor: ['Moda', 'Sanat', 'Editöryal', 'Kozmetik'],
  },
  {
    id: 'montserrat-opensans',
    name: 'Montserrat + Open Sans',
    heading: {
      family: '"Montserrat", sans-serif',
      googleFont: 'Montserrat:wght@700;800;900',
      weight: 800,
      letterSpacing: -0.01,
      textTransform: 'none',
      lineHeight: 1.15,
    },
    body: {
      family: '"Open Sans", sans-serif',
      googleFont: 'Open+Sans:wght@400;600',
      weight: 400,
      letterSpacing: 0,
      lineHeight: 1.5,
    },
    mood: 'Modern & Friendly',
    bestFor: ['Startup', 'Sağlık', 'Eğitim', 'Genel'],
  },
  {
    id: 'poppins-inter',
    name: 'Poppins + Inter',
    heading: {
      family: '"Poppins", sans-serif',
      googleFont: 'Poppins:wght@600;700;800',
      weight: 700,
      letterSpacing: -0.01,
      textTransform: 'none',
      lineHeight: 1.2,
    },
    body: {
      family: '"Inter", sans-serif',
      googleFont: 'Inter:wght@400;500;600',
      weight: 400,
      letterSpacing: 0,
      lineHeight: 1.5,
    },
    mood: 'Friendly & Clean',
    bestFor: ['Çocuk', 'Eğitim', 'Oyun', 'Sosyal'],
  },
  {
    id: 'spacegrotesk-dmsans',
    name: 'Space Grotesk + DM Sans',
    heading: {
      family: '"Space Grotesk", sans-serif',
      googleFont: 'Space+Grotesk:wght@500;600;700',
      weight: 700,
      letterSpacing: -0.02,
      textTransform: 'none',
      lineHeight: 1.1,
    },
    body: {
      family: '"DM Sans", sans-serif',
      googleFont: 'DM+Sans:wght@400;500;700',
      weight: 400,
      letterSpacing: 0,
      lineHeight: 1.5,
    },
    mood: 'Tech & Contemporary',
    bestFor: ['Teknoloji', 'AI', 'Kripto', 'Startup'],
  },
  {
    id: 'lora-nunito',
    name: 'Lora + Nunito',
    heading: {
      family: '"Lora", serif',
      googleFont: 'Lora:wght@600;700',
      weight: 700,
      letterSpacing: 0,
      textTransform: 'none',
      lineHeight: 1.2,
    },
    body: {
      family: '"Nunito", sans-serif',
      googleFont: 'Nunito:wght@400;600;700',
      weight: 400,
      letterSpacing: 0.01,
      lineHeight: 1.5,
    },
    mood: 'Warm & Personal',
    bestFor: ['Yaşam Tarzı', 'Yemek', 'Seyahat', 'Blog'],
  },
];

// ── Type Scale — Golden Ratio (1.618) ──

export const TYPE_SCALE_RATIO = 1.618;

// Base sizes for each format (px on 1080px wide canvas)
export const TYPE_SCALES: Record<string, {
  base: number;
  heading: number;
  subheading: number;
  body: number;
  caption: number;
  safeZone: number;
}> = {
  '1:1': {
    base: 24,
    heading: 64,      // base * ratio^2 ≈ 63 → 64
    subheading: 40,    // base * ratio ≈ 39 → 40
    body: 24,
    caption: 18,
    safeZone: 60,
  },
  '4:5': {
    base: 28,
    heading: 72,
    subheading: 44,
    body: 28,
    caption: 20,
    safeZone: 60,
  },
  '9:16': {
    base: 36,
    heading: 96,
    subheading: 60,
    body: 36,
    caption: 28,
    safeZone: 65,
  },
};

// ── Spacing Grid (8px base) ──

export const SPACING = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
} as const;

// ── Text Readability ──

export const TEXT_READABILITY = {
  // WCAG AA minimum contrast ratios
  contrastMinNormal: 4.5,
  contrastMinLarge: 3.0,

  // Background overlay opacity for text on images
  overlayOpacity: {
    light: 0.4,
    medium: 0.55,
    heavy: 0.7,
  },

  // Text shadow for text on images (no overlay)
  textShadow: {
    subtle: '0 1px 3px rgba(0,0,0,0.4)',
    medium: '0 2px 6px rgba(0,0,0,0.6)',
    strong: '0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.4)',
  },

  // Frosted glass effect
  frostedGlass: {
    blur: 12,
    bgOpacity: 0.25,
    bgColor: '#FFFFFF',
  },
} as const;

// ── Slide Layout Presets ──

export interface SlideLayoutPreset {
  id: string;
  name: string;
  description: string;
  overlays: {
    role: 'headline' | 'body' | 'cta' | 'brand' | 'slide-number';
    x: number;
    y: number;
    fontSizeKey: 'heading' | 'subheading' | 'body' | 'caption';
    fontWeight: 'normal' | 'bold' | 'extrabold';
    textAlign: 'left' | 'center' | 'right';
    maxWidth: number;
    useHeadingFont: boolean;
    bgStyle?: 'pill' | 'banner' | 'frosted' | 'none';
  }[];
}

export const SLIDE_LAYOUT_PRESETS: SlideLayoutPreset[] = [
  {
    id: 'centered-bold',
    name: 'Merkez — Bold',
    description: 'Başlık ortada, body altında, CTA en altta',
    overlays: [
      { role: 'headline', x: 50, y: 38, fontSizeKey: 'heading', fontWeight: 'extrabold', textAlign: 'center', maxWidth: 85, useHeadingFont: true },
      { role: 'body', x: 50, y: 55, fontSizeKey: 'body', fontWeight: 'normal', textAlign: 'center', maxWidth: 75, useHeadingFont: false },
      { role: 'cta', x: 50, y: 80, fontSizeKey: 'caption', fontWeight: 'bold', textAlign: 'center', maxWidth: 50, useHeadingFont: false, bgStyle: 'pill' },
    ],
  },
  {
    id: 'left-editorial',
    name: 'Sol Hizalı — Editöryal',
    description: 'Sol tarafta metin grubu, dergi tarzı',
    overlays: [
      { role: 'headline', x: 12, y: 35, fontSizeKey: 'heading', fontWeight: 'extrabold', textAlign: 'left', maxWidth: 70, useHeadingFont: true },
      { role: 'body', x: 12, y: 55, fontSizeKey: 'body', fontWeight: 'normal', textAlign: 'left', maxWidth: 65, useHeadingFont: false },
      { role: 'cta', x: 12, y: 78, fontSizeKey: 'caption', fontWeight: 'bold', textAlign: 'left', maxWidth: 40, useHeadingFont: false, bgStyle: 'pill' },
    ],
  },
  {
    id: 'top-bottom',
    name: 'Üst-Alt',
    description: 'Başlık üstte, CTA altta — görsel ortada',
    overlays: [
      { role: 'headline', x: 50, y: 15, fontSizeKey: 'heading', fontWeight: 'extrabold', textAlign: 'center', maxWidth: 85, useHeadingFont: true },
      { role: 'body', x: 50, y: 75, fontSizeKey: 'body', fontWeight: 'normal', textAlign: 'center', maxWidth: 80, useHeadingFont: false },
      { role: 'cta', x: 50, y: 88, fontSizeKey: 'caption', fontWeight: 'bold', textAlign: 'center', maxWidth: 45, useHeadingFont: false, bgStyle: 'pill' },
    ],
  },
  {
    id: 'bottom-card',
    name: 'Alt Kart',
    description: 'Metin alt bölgede frosted kart içinde',
    overlays: [
      { role: 'headline', x: 50, y: 68, fontSizeKey: 'subheading', fontWeight: 'extrabold', textAlign: 'center', maxWidth: 85, useHeadingFont: true, bgStyle: 'frosted' },
      { role: 'body', x: 50, y: 80, fontSizeKey: 'body', fontWeight: 'normal', textAlign: 'center', maxWidth: 80, useHeadingFont: false },
      { role: 'cta', x: 50, y: 90, fontSizeKey: 'caption', fontWeight: 'bold', textAlign: 'center', maxWidth: 40, useHeadingFont: false, bgStyle: 'pill' },
    ],
  },
  {
    id: 'minimal-center',
    name: 'Minimal Merkez',
    description: 'Sadece başlık, büyük ve cesur',
    overlays: [
      { role: 'headline', x: 50, y: 50, fontSizeKey: 'heading', fontWeight: 'extrabold', textAlign: 'center', maxWidth: 80, useHeadingFont: true },
    ],
  },
  {
    id: 'story-stack',
    name: 'Story Stack',
    description: 'Dikey akış: numara, başlık, body, CTA',
    overlays: [
      { role: 'slide-number', x: 50, y: 20, fontSizeKey: 'heading', fontWeight: 'extrabold', textAlign: 'center', maxWidth: 30, useHeadingFont: true },
      { role: 'headline', x: 50, y: 38, fontSizeKey: 'subheading', fontWeight: 'extrabold', textAlign: 'center', maxWidth: 85, useHeadingFont: true },
      { role: 'body', x: 50, y: 55, fontSizeKey: 'body', fontWeight: 'normal', textAlign: 'center', maxWidth: 80, useHeadingFont: false },
      { role: 'cta', x: 50, y: 82, fontSizeKey: 'caption', fontWeight: 'bold', textAlign: 'center', maxWidth: 50, useHeadingFont: false, bgStyle: 'pill' },
    ],
  },
];

// ── Helper: Generate Google Fonts URL ──

export function getGoogleFontsUrl(pairing: FontPairing): string {
  const fonts = [pairing.heading.googleFont, pairing.body.googleFont];
  const unique = [...new Set(fonts)];
  return `https://fonts.googleapis.com/css2?${unique.map(f => `family=${f}`).join('&')}&display=swap`;
}

// ── Helper: Get type size for format ──

export function getTypeSize(aspectRatio: string, role: 'heading' | 'subheading' | 'body' | 'caption'): number {
  const scale = TYPE_SCALES[aspectRatio] || TYPE_SCALES['1:1'];
  return scale[role];
}

// ── Helper: Scale font size from % of canvas to px ──
// The overlay system uses % for position, but canvas rendering needs px
export function scaleFontForCanvas(fontSizePx: number, canvasWidth: number): number {
  // Font sizes in TYPE_SCALES are calibrated for 1080px width
  return (fontSizePx / 1080) * canvasWidth;
}

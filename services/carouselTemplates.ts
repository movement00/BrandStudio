// ═══════════════════════════════════════════════════════════════════
// Carousel Templates — Professional slide layouts
// Each template defines exact element positions for pixel-perfect rendering
// ═══════════════════════════════════════════════════════════════════

export interface TemplateElement {
  role: 'headline' | 'body' | 'cta-button' | 'slide-number' | 'brand-name' | 'brand-logo'
    | 'category-badge' | 'swipe-arrow' | 'progress-bar' | 'footer-info' | 'slide-dots'
    | 'icon-placeholder' | 'divider-line' | 'accent-shape' | 'quote-mark' | 'subtitle';
  // Position as % of canvas
  x: number;
  y: number;
  anchor: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  // Size as % of canvas
  maxWidth: number;
  // Typography
  fontType: 'heading' | 'body' | 'accent';
  fontSize: 'display' | 'heading' | 'subheading' | 'body' | 'caption' | 'tiny';
  fontWeight: 300 | 400 | 500 | 600 | 700 | 800 | 900;
  // Color
  colorType: 'primary' | 'secondary' | 'accent' | 'white' | 'dark' | 'muted' | 'brand-dominant' | 'brand-accent';
  // Optional
  textAlign?: 'left' | 'center' | 'right';
  textTransform?: 'uppercase' | 'none';
  letterSpacing?: number; // em
  lineHeight?: number;
  opacity?: number;
  // Background
  bgColorType?: 'brand-dominant' | 'brand-accent' | 'dark-overlay' | 'light-overlay' | 'none';
  bgPadding?: number; // px
  bgRadius?: number;  // px
  // Conditional
  showOnSlides?: 'all' | 'first' | 'middle' | 'last' | 'not-last' | 'not-first';
}

export interface CarouselTemplate {
  id: string;
  name: string;
  category: 'hook' | 'content' | 'numbered' | 'quote' | 'split' | 'cta' | 'summary' | 'comparison';
  description: string;
  // Background style
  background: {
    type: 'solid' | 'gradient-linear' | 'gradient-radial' | 'user-image' | 'ai-generated';
    // For solid/gradient: which brand color to use
    primaryColorType: 'brand-dominant' | 'brand-secondary' | 'brand-accent' | 'dark' | 'light' | 'white';
    secondaryColorType?: 'brand-dominant' | 'brand-secondary' | 'brand-accent' | 'dark' | 'light';
    gradientAngle?: number; // degrees
    overlayOpacity?: number; // for user-image/ai backgrounds
  };
  // Decorative elements
  decorations: {
    type: 'accent-bar-top' | 'accent-bar-left' | 'corner-shapes' | 'dot-grid' | 'diagonal-line'
      | 'circle-accent' | 'bottom-wave' | 'side-stripe' | 'none';
    colorType: 'brand-accent' | 'brand-dominant' | 'white' | 'muted';
    opacity: number;
  }[];
  // Elements
  elements: TemplateElement[];
}

// ═══════════════════════════════════════════════════
// FONT SIZE MAP (px on 1080px canvas)
// ═══════════════════════════════════════════════════
export const TEMPLATE_FONT_SIZES: Record<string, Record<string, number>> = {
  '1:1': { display: 96, heading: 64, subheading: 40, body: 28, caption: 20, tiny: 14 },
  '4:5': { display: 108, heading: 72, subheading: 44, body: 32, caption: 22, tiny: 16 },
  '9:16': { display: 128, heading: 96, subheading: 56, body: 36, caption: 28, tiny: 18 },
};

// ═══════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [

  // ─── 1. BOLD HOOK ───
  {
    id: 'bold-hook',
    name: 'Bold Hook',
    category: 'hook',
    description: 'Cesur başlık, koyu arka plan — dikkat çekici açılış',
    background: { type: 'solid', primaryColorType: 'dark' },
    decorations: [
      { type: 'accent-bar-left', colorType: 'brand-dominant', opacity: 1 },
    ],
    elements: [
      { role: 'brand-logo', x: 7, y: 6, anchor: 'top-left', maxWidth: 15, fontType: 'heading', fontSize: 'caption', fontWeight: 700, colorType: 'white', showOnSlides: 'all' },
      { role: 'category-badge', x: 93, y: 6, anchor: 'top-right', maxWidth: 25, fontType: 'body', fontSize: 'tiny', fontWeight: 600, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 10, bgRadius: 20, textTransform: 'uppercase', letterSpacing: 0.08, showOnSlides: 'all' },
      { role: 'headline', x: 7, y: 38, anchor: 'top-left', maxWidth: 86, fontType: 'heading', fontSize: 'display', fontWeight: 900, colorType: 'white', lineHeight: 1.05, showOnSlides: 'first' },
      { role: 'subtitle', x: 7, y: 68, anchor: 'top-left', maxWidth: 75, fontType: 'body', fontSize: 'body', fontWeight: 400, colorType: 'muted', lineHeight: 1.5, showOnSlides: 'first' },
      { role: 'swipe-arrow', x: 93, y: 92, anchor: 'bottom-right', maxWidth: 12, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 14, bgRadius: 50, showOnSlides: 'not-last' },
      { role: 'progress-bar', x: 0, y: 100, anchor: 'bottom-left', maxWidth: 100, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
    ],
  },

  // ─── 2. NUMBERED POINT ───
  {
    id: 'numbered-point',
    name: 'Numaralı Madde',
    category: 'numbered',
    description: 'Büyük numara + başlık + açıklama — eğitici içerik',
    background: { type: 'solid', primaryColorType: 'dark' },
    decorations: [
      { type: 'accent-bar-top', colorType: 'brand-dominant', opacity: 1 },
    ],
    elements: [
      { role: 'brand-logo', x: 7, y: 6, anchor: 'top-left', maxWidth: 15, fontType: 'heading', fontSize: 'caption', fontWeight: 700, colorType: 'white', showOnSlides: 'all' },
      { role: 'category-badge', x: 93, y: 6, anchor: 'top-right', maxWidth: 25, fontType: 'body', fontSize: 'tiny', fontWeight: 600, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 10, bgRadius: 20, textTransform: 'uppercase', letterSpacing: 0.08, showOnSlides: 'all' },
      { role: 'slide-number', x: 7, y: 25, anchor: 'top-left', maxWidth: 20, fontType: 'heading', fontSize: 'display', fontWeight: 900, colorType: 'brand-dominant', opacity: 0.2, showOnSlides: 'middle' },
      { role: 'headline', x: 7, y: 40, anchor: 'top-left', maxWidth: 86, fontType: 'heading', fontSize: 'heading', fontWeight: 800, colorType: 'white', lineHeight: 1.15, showOnSlides: 'all' },
      { role: 'divider-line', x: 7, y: 58, anchor: 'top-left', maxWidth: 15, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
      { role: 'body', x: 7, y: 63, anchor: 'top-left', maxWidth: 86, fontType: 'body', fontSize: 'body', fontWeight: 400, colorType: 'muted', lineHeight: 1.6, showOnSlides: 'all' },
      { role: 'swipe-arrow', x: 93, y: 92, anchor: 'bottom-right', maxWidth: 12, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 14, bgRadius: 50, showOnSlides: 'not-last' },
      { role: 'progress-bar', x: 0, y: 100, anchor: 'bottom-left', maxWidth: 100, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
      { role: 'footer-info', x: 7, y: 94, anchor: 'bottom-left', maxWidth: 50, fontType: 'body', fontSize: 'tiny', fontWeight: 500, colorType: 'muted', textTransform: 'uppercase', letterSpacing: 0.08, showOnSlides: 'all' },
    ],
  },

  // ─── 3. ICON + TEXT CARD ───
  {
    id: 'icon-text-card',
    name: 'İkon + Metin',
    category: 'content',
    description: 'Merkezi ikon, başlık ve açıklama — temiz ve net',
    background: { type: 'gradient-linear', primaryColorType: 'dark', secondaryColorType: 'brand-secondary', gradientAngle: 135 },
    decorations: [
      { type: 'corner-shapes', colorType: 'brand-dominant', opacity: 0.08 },
    ],
    elements: [
      { role: 'brand-logo', x: 7, y: 6, anchor: 'top-left', maxWidth: 15, fontType: 'heading', fontSize: 'caption', fontWeight: 700, colorType: 'white', showOnSlides: 'all' },
      { role: 'category-badge', x: 93, y: 6, anchor: 'top-right', maxWidth: 25, fontType: 'body', fontSize: 'tiny', fontWeight: 600, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 10, bgRadius: 20, textTransform: 'uppercase', letterSpacing: 0.08, showOnSlides: 'all' },
      { role: 'icon-placeholder', x: 50, y: 30, anchor: 'center', maxWidth: 15, fontType: 'heading', fontSize: 'display', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
      { role: 'headline', x: 50, y: 48, anchor: 'top-center', maxWidth: 80, fontType: 'heading', fontSize: 'heading', fontWeight: 800, colorType: 'white', textAlign: 'center', lineHeight: 1.15, showOnSlides: 'all' },
      { role: 'body', x: 50, y: 65, anchor: 'top-center', maxWidth: 75, fontType: 'body', fontSize: 'body', fontWeight: 400, colorType: 'muted', textAlign: 'center', lineHeight: 1.6, showOnSlides: 'all' },
      { role: 'swipe-arrow', x: 93, y: 92, anchor: 'bottom-right', maxWidth: 12, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 14, bgRadius: 50, showOnSlides: 'not-last' },
      { role: 'progress-bar', x: 0, y: 100, anchor: 'bottom-left', maxWidth: 100, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
    ],
  },

  // ─── 4. QUOTE / CALLOUT ───
  {
    id: 'quote-callout',
    name: 'Alıntı / Vurgu',
    category: 'quote',
    description: 'Büyük tırnak işareti ile güçlü alıntı',
    background: { type: 'solid', primaryColorType: 'brand-dominant' },
    decorations: [],
    elements: [
      { role: 'brand-logo', x: 7, y: 6, anchor: 'top-left', maxWidth: 15, fontType: 'heading', fontSize: 'caption', fontWeight: 700, colorType: 'white', showOnSlides: 'all' },
      { role: 'quote-mark', x: 7, y: 25, anchor: 'top-left', maxWidth: 15, fontType: 'heading', fontSize: 'display', fontWeight: 900, colorType: 'white', opacity: 0.3, showOnSlides: 'all' },
      { role: 'headline', x: 10, y: 38, anchor: 'top-left', maxWidth: 80, fontType: 'heading', fontSize: 'subheading', fontWeight: 700, colorType: 'white', lineHeight: 1.4, showOnSlides: 'all' },
      { role: 'body', x: 10, y: 72, anchor: 'top-left', maxWidth: 60, fontType: 'body', fontSize: 'caption', fontWeight: 500, colorType: 'white', opacity: 0.7, showOnSlides: 'all' },
      { role: 'swipe-arrow', x: 93, y: 92, anchor: 'bottom-right', maxWidth: 12, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'brand-dominant', bgColorType: 'light-overlay', bgPadding: 14, bgRadius: 50, showOnSlides: 'not-last' },
      { role: 'progress-bar', x: 0, y: 100, anchor: 'bottom-left', maxWidth: 100, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'white', showOnSlides: 'all' },
    ],
  },

  // ─── 5. CTA SLIDE ───
  {
    id: 'cta-closing',
    name: 'CTA Kapanış',
    category: 'cta',
    description: 'Aksiyon çağrısı — son slide',
    background: { type: 'solid', primaryColorType: 'dark' },
    decorations: [
      { type: 'accent-bar-top', colorType: 'brand-dominant', opacity: 1 },
      { type: 'accent-bar-left', colorType: 'brand-dominant', opacity: 0.3 },
    ],
    elements: [
      { role: 'brand-logo', x: 50, y: 25, anchor: 'center', maxWidth: 20, fontType: 'heading', fontSize: 'subheading', fontWeight: 700, colorType: 'white', showOnSlides: 'last' },
      { role: 'headline', x: 50, y: 42, anchor: 'top-center', maxWidth: 80, fontType: 'heading', fontSize: 'heading', fontWeight: 800, colorType: 'white', textAlign: 'center', lineHeight: 1.2, showOnSlides: 'last' },
      { role: 'cta-button', x: 50, y: 62, anchor: 'center', maxWidth: 50, fontType: 'body', fontSize: 'body', fontWeight: 700, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 16, bgRadius: 12, textAlign: 'center', showOnSlides: 'last' },
      { role: 'footer-info', x: 50, y: 80, anchor: 'top-center', maxWidth: 60, fontType: 'body', fontSize: 'caption', fontWeight: 500, colorType: 'muted', textAlign: 'center', lineHeight: 1.8, showOnSlides: 'last' },
    ],
  },

  // ─── 6. FULL IMAGE + TEXT OVERLAY ───
  {
    id: 'image-overlay',
    name: 'Görsel + Overlay',
    category: 'content',
    description: 'Tam ekran arka plan görseli, alt bölgede metin overlay',
    background: { type: 'user-image', primaryColorType: 'dark', overlayOpacity: 0.55 },
    decorations: [],
    elements: [
      { role: 'brand-logo', x: 7, y: 6, anchor: 'top-left', maxWidth: 15, fontType: 'heading', fontSize: 'caption', fontWeight: 700, colorType: 'white', showOnSlides: 'all' },
      { role: 'headline', x: 7, y: 62, anchor: 'top-left', maxWidth: 86, fontType: 'heading', fontSize: 'heading', fontWeight: 800, colorType: 'white', lineHeight: 1.15, showOnSlides: 'all' },
      { role: 'body', x: 7, y: 78, anchor: 'top-left', maxWidth: 80, fontType: 'body', fontSize: 'body', fontWeight: 400, colorType: 'white', opacity: 0.85, lineHeight: 1.5, showOnSlides: 'all' },
      { role: 'swipe-arrow', x: 93, y: 92, anchor: 'bottom-right', maxWidth: 12, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 14, bgRadius: 50, showOnSlides: 'not-last' },
      { role: 'progress-bar', x: 0, y: 100, anchor: 'bottom-left', maxWidth: 100, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
    ],
  },

  // ─── 7. SPLIT PANEL ───
  {
    id: 'split-panel',
    name: 'Bölünmüş Panel',
    category: 'split',
    description: 'Sol renk bloğu + sağ içerik alanı',
    background: { type: 'solid', primaryColorType: 'white' },
    decorations: [
      { type: 'side-stripe', colorType: 'brand-dominant', opacity: 1 },
    ],
    elements: [
      { role: 'slide-number', x: 6, y: 50, anchor: 'center', maxWidth: 8, fontType: 'heading', fontSize: 'heading', fontWeight: 900, colorType: 'white', textAlign: 'center', showOnSlides: 'middle' },
      { role: 'headline', x: 18, y: 30, anchor: 'top-left', maxWidth: 75, fontType: 'heading', fontSize: 'heading', fontWeight: 800, colorType: 'dark', lineHeight: 1.15, showOnSlides: 'all' },
      { role: 'divider-line', x: 18, y: 52, anchor: 'top-left', maxWidth: 12, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
      { role: 'body', x: 18, y: 57, anchor: 'top-left', maxWidth: 75, fontType: 'body', fontSize: 'body', fontWeight: 400, colorType: 'muted', lineHeight: 1.6, showOnSlides: 'all' },
      { role: 'brand-logo', x: 18, y: 6, anchor: 'top-left', maxWidth: 15, fontType: 'heading', fontSize: 'caption', fontWeight: 700, colorType: 'dark', showOnSlides: 'all' },
      { role: 'swipe-arrow', x: 93, y: 92, anchor: 'bottom-right', maxWidth: 12, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'white', bgColorType: 'brand-dominant', bgPadding: 14, bgRadius: 50, showOnSlides: 'not-last' },
      { role: 'progress-bar', x: 0, y: 100, anchor: 'bottom-left', maxWidth: 100, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
      { role: 'footer-info', x: 18, y: 94, anchor: 'bottom-left', maxWidth: 50, fontType: 'body', fontSize: 'tiny', fontWeight: 500, colorType: 'muted', textTransform: 'uppercase', letterSpacing: 0.08, showOnSlides: 'all' },
    ],
  },

  // ─── 8. MINIMAL CENTER ───
  {
    id: 'minimal-center',
    name: 'Minimal Merkez',
    category: 'content',
    description: 'Temiz, merkezi layout — az eleman, güçlü etki',
    background: { type: 'gradient-linear', primaryColorType: 'dark', secondaryColorType: 'brand-secondary', gradientAngle: 180 },
    decorations: [],
    elements: [
      { role: 'brand-logo', x: 50, y: 8, anchor: 'top-center', maxWidth: 12, fontType: 'heading', fontSize: 'caption', fontWeight: 700, colorType: 'white', showOnSlides: 'all' },
      { role: 'headline', x: 50, y: 40, anchor: 'center', maxWidth: 80, fontType: 'heading', fontSize: 'heading', fontWeight: 800, colorType: 'white', textAlign: 'center', lineHeight: 1.2, showOnSlides: 'all' },
      { role: 'body', x: 50, y: 60, anchor: 'top-center', maxWidth: 70, fontType: 'body', fontSize: 'body', fontWeight: 400, colorType: 'muted', textAlign: 'center', lineHeight: 1.6, showOnSlides: 'all' },
      { role: 'swipe-arrow', x: 93, y: 92, anchor: 'bottom-right', maxWidth: 12, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 14, bgRadius: 50, showOnSlides: 'not-last' },
      { role: 'slide-dots', x: 50, y: 95, anchor: 'center', maxWidth: 30, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
    ],
  },

  // ─── 9. BEFORE-AFTER / COMPARISON ───
  {
    id: 'comparison',
    name: 'Karşılaştırma',
    category: 'comparison',
    description: 'Yanlış vs Doğru — iki panel',
    background: { type: 'solid', primaryColorType: 'dark' },
    decorations: [],
    elements: [
      { role: 'brand-logo', x: 7, y: 6, anchor: 'top-left', maxWidth: 15, fontType: 'heading', fontSize: 'caption', fontWeight: 700, colorType: 'white', showOnSlides: 'all' },
      { role: 'headline', x: 50, y: 15, anchor: 'top-center', maxWidth: 80, fontType: 'heading', fontSize: 'subheading', fontWeight: 800, colorType: 'white', textAlign: 'center', showOnSlides: 'all' },
      // Left panel (wrong)
      { role: 'subtitle', x: 25, y: 30, anchor: 'top-center', maxWidth: 40, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'accent', textAlign: 'center', textTransform: 'uppercase', showOnSlides: 'all' },
      // Right panel (correct)
      { role: 'body', x: 75, y: 30, anchor: 'top-center', maxWidth: 40, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'brand-dominant', textAlign: 'center', textTransform: 'uppercase', showOnSlides: 'all' },
      { role: 'swipe-arrow', x: 93, y: 92, anchor: 'bottom-right', maxWidth: 12, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 14, bgRadius: 50, showOnSlides: 'not-last' },
      { role: 'progress-bar', x: 0, y: 100, anchor: 'bottom-left', maxWidth: 100, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
    ],
  },

  // ─── 10. SUMMARY GRID ───
  {
    id: 'summary-grid',
    name: 'Özet',
    category: 'summary',
    description: 'Tüm maddelerin kısa özeti — son öncesi slide',
    background: { type: 'solid', primaryColorType: 'dark' },
    decorations: [
      { type: 'accent-bar-top', colorType: 'brand-dominant', opacity: 1 },
    ],
    elements: [
      { role: 'brand-logo', x: 7, y: 6, anchor: 'top-left', maxWidth: 15, fontType: 'heading', fontSize: 'caption', fontWeight: 700, colorType: 'white', showOnSlides: 'all' },
      { role: 'headline', x: 50, y: 15, anchor: 'top-center', maxWidth: 80, fontType: 'heading', fontSize: 'subheading', fontWeight: 800, colorType: 'white', textAlign: 'center', showOnSlides: 'all' },
      { role: 'body', x: 50, y: 30, anchor: 'top-center', maxWidth: 85, fontType: 'body', fontSize: 'caption', fontWeight: 400, colorType: 'muted', textAlign: 'center', lineHeight: 2.2, showOnSlides: 'all' },
      { role: 'swipe-arrow', x: 93, y: 92, anchor: 'bottom-right', maxWidth: 12, fontType: 'body', fontSize: 'caption', fontWeight: 700, colorType: 'dark', bgColorType: 'brand-dominant', bgPadding: 14, bgRadius: 50, showOnSlides: 'not-last' },
      { role: 'progress-bar', x: 0, y: 100, anchor: 'bottom-left', maxWidth: 100, fontType: 'body', fontSize: 'tiny', fontWeight: 400, colorType: 'brand-dominant', showOnSlides: 'all' },
    ],
  },
];

// ═══════════════════════════════════════════════════
// Template selection logic per slide position
// ═══════════════════════════════════════════════════
export function selectTemplateForSlide(
  slideIndex: number,
  totalSlides: number,
  carouselType: string,
  allTemplates: CarouselTemplate[] = CAROUSEL_TEMPLATES
): CarouselTemplate {
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === totalSlides - 1;
  const isSecondToLast = slideIndex === totalSlides - 2;

  // First slide: always hook
  if (isFirst) return allTemplates.find(t => t.id === 'bold-hook')!;

  // Last slide: always CTA
  if (isLast) return allTemplates.find(t => t.id === 'cta-closing')!;

  // Second to last: summary (if enough slides)
  if (isSecondToLast && totalSlides >= 6) return allTemplates.find(t => t.id === 'summary-grid')!;

  // Content slides: rotate through content templates
  const contentTemplates = allTemplates.filter(t =>
    t.category === 'numbered' || t.category === 'content' || t.category === 'quote' || t.category === 'split'
  );

  // For numbered/educational: prefer numbered template
  if (['educational', 'tips-tricks'].includes(carouselType)) {
    return allTemplates.find(t => t.id === 'numbered-point')!;
  }

  // For comparison: use comparison template
  if (carouselType === 'before-after') {
    return allTemplates.find(t => t.id === 'comparison')!;
  }

  // For testimonial/quote: use quote template
  if (['testimonial', 'motivation'].includes(carouselType)) {
    return allTemplates.find(t => t.id === 'quote-callout')!;
  }

  // Rotate content templates for variety
  const idx = (slideIndex - 1) % contentTemplates.length;
  return contentTemplates[idx];
}

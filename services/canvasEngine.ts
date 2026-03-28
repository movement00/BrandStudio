// ═══════════════════════════════════════════════════════════════════
// Canvas Render Engine v3 — Professional grade
// Rich backgrounds, text effects, proper spacing, brand consistency
// ═══════════════════════════════════════════════════════════════════

import { Brand, CarouselType } from '../types';
import { FontPairing } from './typographySystem';
import { CarouselTemplate, TemplateElement, TEMPLATE_FONT_SIZES, selectTemplateForSlide } from './carouselTemplates';

// ── Types ──

export interface SlideRenderInput {
  slideIndex: number;
  totalSlides: number;
  headline: string;
  bodyText: string;
  ctaText?: string;
  iconEmoji?: string;
  slideNumber?: string;
  subtitleText?: string;
}

export interface CarouselRenderConfig {
  brand: Brand;
  fontPairing: FontPairing;
  aspectRatio: string;
  carouselType: CarouselType;
  categoryLabel: string;
  slides: SlideRenderInput[];
  backgroundImages?: (string | null)[];
  globalBackgroundImage?: string;
}

const ASPECT_DIMS: Record<string, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
};

// ── Color Helpers ──

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - amount;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.min(255, Math.round(r + (255 - r) * amount))}, ${Math.min(255, Math.round(g + (255 - g) * amount))}, ${Math.min(255, Math.round(b + (255 - b) * amount))})`;
}

function resolveColor(ct: string, brand: Brand, bc: { dominant: string; secondary: string; accent: string }): string {
  switch (ct) {
    case 'white': return '#FFFFFF';
    case 'dark': return '#0F0F1A';
    case 'muted': return '#9CA3AF';
    case 'primary': case 'brand-dominant': return bc.dominant;
    case 'secondary': case 'brand-secondary': return bc.secondary;
    case 'accent': return '#EF4444';
    case 'brand-accent': return bc.accent || bc.dominant;
    case 'light': return '#F5F5F0';
    default: return '#FFFFFF';
  }
}

function shouldShow(rule: string | undefined, idx: number, total: number): boolean {
  if (!rule || rule === 'all') return true;
  if (rule === 'first') return idx === 0;
  if (rule === 'last') return idx === total - 1;
  if (rule === 'middle') return idx > 0 && idx < total - 1;
  if (rule === 'not-last') return idx < total - 1;
  if (rule === 'not-first') return idx > 0;
  return true;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else { line = test; }
  }
  if (line) lines.push(line);
  return lines;
}

// ═══════════════════════════════════════════════════
// PROFESSIONAL BACKGROUND RENDERING
// ═══════════════════════════════════════════════════

function drawProfessionalBackground(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  template: CarouselTemplate,
  bc: { dominant: string; secondary: string; accent: string },
  slideIndex: number,
  totalSlides: number
) {
  const bgType = template.background.primaryColorType;
  const isDark = ['dark', 'brand-dominant', 'brand-secondary'].includes(bgType);

  // Base color
  const baseColor = resolveColor(bgType, {} as Brand, bc);

  // Multi-stop gradient for depth
  if (template.background.type === 'gradient-linear' || template.background.type === 'solid') {
    const angle = template.background.gradientAngle || 145;
    const rad = (angle * Math.PI) / 180;
    const grad = ctx.createLinearGradient(
      w / 2 - Math.cos(rad) * w, h / 2 - Math.sin(rad) * h,
      w / 2 + Math.cos(rad) * w, h / 2 + Math.sin(rad) * h
    );

    if (isDark) {
      grad.addColorStop(0, '#0A0A14');
      grad.addColorStop(0.3, '#0F0F1E');
      grad.addColorStop(0.7, darken(bc.dominant, 0.85));
      grad.addColorStop(1, '#0A0A14');
    } else {
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.5, '#F8F9FA');
      grad.addColorStop(1, lighten(bc.dominant, 0.92));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Quote template: brand color background
  if (template.category === 'quote') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, bc.dominant);
    grad.addColorStop(1, darken(bc.dominant, 0.3));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Subtle noise texture (dots pattern)
  if (isDark) {
    ctx.save();
    ctx.globalAlpha = 0.03;
    for (let nx = 0; nx < w; nx += 4) {
      for (let ny = 0; ny < h; ny += 4) {
        if (Math.random() > 0.5) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(nx, ny, 1, 1);
        }
      }
    }
    ctx.restore();
  }

  // Ambient glow from brand color
  ctx.save();
  const glowX = w * (0.3 + slideIndex * 0.1);
  const glowY = h * 0.3;
  const glowR = w * 0.6;
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR);
  const { r, g, b } = hexToRgb(bc.dominant);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.08)`);
  glow.addColorStop(0.5, `rgba(${r},${g},${b},0.03)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Secondary glow (bottom)
  ctx.save();
  const glow2 = ctx.createRadialGradient(w * 0.7, h * 0.8, 0, w * 0.7, h * 0.8, w * 0.5);
  const { r: r2, g: g2, b: b2 } = hexToRgb(bc.secondary);
  glow2.addColorStop(0, `rgba(${r2},${g2},${b2},0.05)`);
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ═══════════════════════════════════════════════════
// PROFESSIONAL DECORATIONS
// ═══════════════════════════════════════════════════

function drawProfessionalDecorations(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  template: CarouselTemplate,
  bc: { dominant: string; secondary: string; accent: string }
) {
  for (const deco of template.decorations) {
    const color = resolveColor(deco.colorType as any, {} as Brand, bc);
    ctx.save();
    ctx.globalAlpha = deco.opacity;

    switch (deco.type) {
      case 'accent-bar-top': {
        // Gradient bar instead of solid
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, color);
        grad.addColorStop(0.5, lighten(color, 0.2));
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, 4);
        break;
      }
      case 'accent-bar-left': {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color);
        grad.addColorStop(0.5, lighten(color, 0.3));
        grad.addColorStop(1, darken(color, 0.3));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 4, h);
        break;
      }
      case 'side-stripe': {
        const stripeW = w * 0.12;
        const grad = ctx.createLinearGradient(0, 0, stripeW, 0);
        grad.addColorStop(0, color);
        grad.addColorStop(1, darken(color, 0.2));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, stripeW, h);
        break;
      }
      case 'corner-shapes': {
        // Top-left soft circle
        const r1 = w * 0.18;
        const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, r1);
        g1.addColorStop(0, `${color}`);
        g1.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, r1 * 2, r1 * 2);
        // Bottom-right
        const r2 = w * 0.12;
        const g2 = ctx.createRadialGradient(w, h, 0, w, h, r2);
        g2.addColorStop(0, `${color}`);
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(w - r2 * 2, h - r2 * 2, r2 * 2, r2 * 2);
        break;
      }
      case 'dot-grid': {
        ctx.fillStyle = color;
        for (let gx = 80; gx < w - 80; gx += 40) {
          for (let gy = 80; gy < h - 80; gy += 40) {
            ctx.beginPath();
            ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
    }
    ctx.restore();
  }

  // Always draw subtle grid lines for professional feel
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 0.5;
  // Horizontal lines
  for (let ly = h * 0.2; ly < h * 0.9; ly += h * 0.15) {
    ctx.beginPath();
    ctx.moveTo(w * 0.06, ly);
    ctx.lineTo(w * 0.94, ly);
    ctx.stroke();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════
// MAIN RENDER FUNCTION
// ═══════════════════════════════════════════════════

export async function renderCarouselSlide(
  config: CarouselRenderConfig,
  slideInput: SlideRenderInput,
  template: CarouselTemplate
): Promise<string> {
  const dims = ASPECT_DIMS[config.aspectRatio] || ASPECT_DIMS['4:5'];
  const canvas = document.createElement('canvas');
  canvas.width = dims.w;
  canvas.height = dims.h;
  const ctx = canvas.getContext('2d')!;
  const fontSizes = TEMPLATE_FONT_SIZES[config.aspectRatio] || TEMPLATE_FONT_SIZES['4:5'];
  const { w, h } = dims;

  const bc = config.brand.palette.length >= 3
    ? { dominant: config.brand.palette[0].hex, secondary: config.brand.palette[1].hex, accent: config.brand.palette[2].hex }
    : { dominant: config.brand.primaryColor, secondary: config.brand.secondaryColor, accent: config.brand.primaryColor };

  // ── 1. Background ──
  const bgImage = config.backgroundImages?.[slideInput.slideIndex] || config.globalBackgroundImage;

  if (bgImage) {
    try {
      const img = await loadImage(bgImage);
      const ir = img.width / img.height;
      const cr = w / h;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (ir > cr) { sw = img.height * cr; sx = (img.width - sw) / 2; }
      else { sh = img.width / cr; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      // Dark overlay for text readability
      const ov = template.background.overlayOpacity || 0.5;
      ctx.fillStyle = `rgba(0,0,0,${ov})`;
      ctx.fillRect(0, 0, w, h);
    } catch {
      drawProfessionalBackground(ctx, w, h, template, bc, slideInput.slideIndex, slideInput.totalSlides);
    }
  } else {
    drawProfessionalBackground(ctx, w, h, template, bc, slideInput.slideIndex, slideInput.totalSlides);
  }

  // ── 2. Decorations ──
  drawProfessionalDecorations(ctx, w, h, template, bc);

  // ── 3. Elements ──
  for (const el of template.elements) {
    if (!shouldShow(el.showOnSlides, slideInput.slideIndex, slideInput.totalSlides)) continue;

    const color = resolveColor(el.colorType, config.brand, bc);
    const fontSize = fontSizes[el.fontSize] || 28;
    const maxW = (el.maxWidth / 100) * w;
    const fp = el.fontType === 'heading' ? config.fontPairing.heading : config.fontPairing.body;
    const weight = el.fontWeight || fp.weight;
    const lineH = el.lineHeight || (el.fontType === 'heading' ? fp.lineHeight : 1.5);

    // Resolve content
    let content = '';
    switch (el.role) {
      case 'headline': content = slideInput.headline; break;
      case 'body': content = slideInput.bodyText; break;
      case 'subtitle': content = slideInput.subtitleText || slideInput.bodyText; break;
      case 'cta-button': content = slideInput.ctaText || 'Daha Fazla'; break;
      case 'slide-number': content = slideInput.slideNumber || String(slideInput.slideIndex + 1).padStart(2, '0'); break;
      case 'brand-name': case 'brand-logo': content = config.brand.name; break;
      case 'category-badge': content = config.categoryLabel; break;
      case 'swipe-arrow': content = '→'; break;
      case 'footer-info': content = config.brand.website || (config.brand.instagram ? `@${config.brand.instagram}` : config.brand.name); break;
      case 'icon-placeholder': content = slideInput.iconEmoji || '💡'; break;
      case 'quote-mark': content = '\u201C'; break;
      default: content = '';
    }

    if (!content) continue;
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;

    // ── Special: Progress Bar ──
    if (el.role === 'progress-bar') {
      const progress = (slideInput.slideIndex + 1) / slideInput.totalSlides;
      const barH = 4;
      const barY = h - barH;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, barY, w, barH);
      const grad = ctx.createLinearGradient(0, 0, w * progress, 0);
      grad.addColorStop(0, bc.dominant);
      grad.addColorStop(1, lighten(bc.dominant, 0.2));
      ctx.fillStyle = grad;
      ctx.fillRect(0, barY, w * progress, barH);
      ctx.restore();
      continue;
    }

    // ── Special: Divider Line ──
    if (el.role === 'divider-line') {
      const dx = (el.x / 100) * w;
      const dy = (el.y / 100) * h;
      const grad = ctx.createLinearGradient(dx, dy, dx + maxW, dy);
      grad.addColorStop(0, bc.dominant);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(dx, dy, maxW, 3);
      ctx.restore();
      continue;
    }

    // ── Special: Slide Dots ──
    if (el.role === 'slide-dots') {
      const dotR = 5;
      const dotGap = 14;
      const total = slideInput.totalSlides;
      const totalW = total * dotR * 2 + (total - 1) * dotGap;
      const startX = (w - totalW) / 2;
      const dotY = (el.y / 100) * h;
      for (let d = 0; d < total; d++) {
        const dx = startX + d * (dotR * 2 + dotGap) + dotR;
        ctx.beginPath();
        ctx.arc(dx, dotY, d === slideInput.slideIndex ? dotR + 1 : dotR, 0, Math.PI * 2);
        ctx.fillStyle = d === slideInput.slideIndex ? bc.dominant : 'rgba(255,255,255,0.15)';
        ctx.fill();
      }
      ctx.restore();
      continue;
    }

    // ── Special: Brand Logo Image ──
    if (el.role === 'brand-logo' && config.brand.logo) {
      try {
        const logoImg = await loadImage(config.brand.logo);
        const maxLH = fontSize * 2.2;
        const maxLW = maxW;
        const ratio = Math.min(maxLW / logoImg.width, maxLH / logoImg.height);
        const lw = logoImg.width * ratio;
        const lh = logoImg.height * ratio;
        const rawX = (el.x / 100) * w;
        const rawY = (el.y / 100) * h;
        let px = rawX, py = rawY;
        if (el.anchor.includes('center')) px -= lw / 2;
        if (el.anchor.includes('right')) px -= lw;
        ctx.drawImage(logoImg, px, py, lw, lh);
      } catch {
        // Fallback to text
      }
      ctx.restore();
      continue;
    }

    // ── Standard Text Elements ──
    const transform = el.textTransform === 'uppercase' ? content.toUpperCase() : content;
    ctx.font = `${weight} ${fontSize}px ${fp.family}`;

    const lines = wrapText(ctx, transform, maxW);
    const totalTextH = lines.length * fontSize * lineH;
    const rawX = (el.x / 100) * w;
    const rawY = (el.y / 100) * h;

    // Position calculation
    let textBlockX = rawX;
    let textBlockY = rawY;
    const align = el.textAlign || 'left';

    if (el.anchor.includes('center') && !el.anchor.includes('top') && !el.anchor.includes('bottom')) {
      textBlockY -= totalTextH / 2;
    }
    if (el.anchor.includes('bottom')) textBlockY -= totalTextH;
    if (el.anchor.includes('right') || (el.anchor === 'top-right')) textBlockX -= maxW;
    if (el.anchor === 'top-center' || el.anchor === 'center' || el.anchor === 'bottom-center') textBlockX -= maxW / 2;

    // Background pill/box
    if (el.bgColorType && el.bgColorType !== 'none') {
      const bgColor = resolveColor(el.bgColorType, config.brand, bc);
      const pad = el.bgPadding || 12;
      const rad = el.bgRadius || 8;
      const maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
      const pillW = maxLineW + pad * 2;
      const pillH = totalTextH + pad * 1.5;

      let pillX = textBlockX;
      if (align === 'center') pillX = rawX - pillW / 2;
      else if (align === 'right') pillX = rawX - pillW;

      // Pill shadow
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(pillX, textBlockY - pad * 0.3, pillW, pillH, rad);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Text inside pill
      ctx.fillStyle = color;
      ctx.textAlign = align as CanvasTextAlign;
      ctx.textBaseline = 'top';
      const tX = align === 'center' ? pillX + pillW / 2 : align === 'right' ? pillX + pillW - pad : pillX + pad;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], tX, textBlockY + pad * 0.3 + i * fontSize * lineH);
      }
    } else {
      // No background — text with shadows for readability
      ctx.textAlign = align as CanvasTextAlign;
      ctx.textBaseline = 'top';

      const tX = align === 'center' ? textBlockX + maxW / 2 :
                 align === 'right' ? textBlockX + maxW : textBlockX;

      // Text glow/shadow for dark backgrounds
      if (['white', 'brand-dominant'].includes(el.colorType)) {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
      }

      ctx.fillStyle = color;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], tX, textBlockY + i * fontSize * lineH);
      }

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  return canvas.toDataURL('image/png').split(',')[1];
}

// ═══════════════════════════════════════════════════
// RENDER ALL SLIDES
// ═══════════════════════════════════════════════════

export async function renderAllCarouselSlides(config: CarouselRenderConfig): Promise<string[]> {
  const results: string[] = [];
  for (const slideInput of config.slides) {
    const template = selectTemplateForSlide(slideInput.slideIndex, slideInput.totalSlides, config.carouselType);
    const rendered = await renderCarouselSlide(config, slideInput, template);
    results.push(rendered);
  }
  return results;
}

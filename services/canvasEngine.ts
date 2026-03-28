// ═══════════════════════════════════════════════════════════════════
// Canvas Render Engine v2 — Template-based pixel-perfect rendering
// AI = brain (content), Canvas = body (rendering)
// ═══════════════════════════════════════════════════════════════════

import { Brand, CarouselContentPlan, CarouselType } from '../types';
import { FontPairing } from './typographySystem';
import { CarouselTemplate, TemplateElement, TEMPLATE_FONT_SIZES, selectTemplateForSlide } from './carouselTemplates';

// ── Types ──

export interface SlideRenderInput {
  slideIndex: number;
  totalSlides: number;
  headline: string;
  bodyText: string;
  ctaText?: string;
  iconEmoji?: string;         // Emoji or unicode icon
  slideNumber?: string;       // "01", "02", etc.
  quoteText?: string;
  subtitleText?: string;
}

export interface CarouselRenderConfig {
  brand: Brand;
  fontPairing: FontPairing;
  aspectRatio: string;
  carouselType: CarouselType;
  categoryLabel: string;
  slides: SlideRenderInput[];
  backgroundImages?: (string | null)[];  // Per-slide base64 backgrounds (user upload or AI)
  globalBackgroundImage?: string;         // Single background for all slides
}

// ── Dimension Maps ──

const ASPECT_DIMS: Record<string, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
};

// ── Color Resolution ──

function resolveColor(
  colorType: TemplateElement['colorType'],
  brand: Brand,
  brandColors: { dominant: string; secondary: string; accent: string }
): string {
  switch (colorType) {
    case 'white': return '#FFFFFF';
    case 'dark': return '#1A1A2E';
    case 'muted': return '#9CA3AF';
    case 'primary': return brandColors.dominant;
    case 'secondary': return brandColors.secondary;
    case 'accent': return '#EF4444'; // Red for errors/wrong
    case 'brand-dominant': return brandColors.dominant;
    case 'brand-accent': return brandColors.accent || brandColors.dominant;
    default: return '#FFFFFF';
  }
}

function resolveBgColor(
  bgType: TemplateElement['bgColorType'],
  brandColors: { dominant: string; secondary: string; accent: string }
): string {
  switch (bgType) {
    case 'brand-dominant': return brandColors.dominant;
    case 'brand-accent': return brandColors.accent || brandColors.dominant;
    case 'dark-overlay': return '#000000';
    case 'light-overlay': return '#FFFFFF';
    default: return 'transparent';
  }
}

function resolveBackgroundColor(
  type: string,
  brandColors: { dominant: string; secondary: string; accent: string }
): string {
  switch (type) {
    case 'brand-dominant': return brandColors.dominant;
    case 'brand-secondary': return brandColors.secondary;
    case 'brand-accent': return brandColors.accent;
    case 'dark': return '#0F0F1A';
    case 'light': return '#F5F5F0';
    case 'white': return '#FFFFFF';
    default: return '#0F0F1A';
  }
}

// ── Should element show on this slide? ──

function shouldShow(rule: TemplateElement['showOnSlides'], idx: number, total: number): boolean {
  if (!rule || rule === 'all') return true;
  if (rule === 'first') return idx === 0;
  if (rule === 'last') return idx === total - 1;
  if (rule === 'middle') return idx > 0 && idx < total - 1;
  if (rule === 'not-last') return idx < total - 1;
  if (rule === 'not-first') return idx > 0;
  return true;
}

// ── Compute position ──

function computePosition(
  el: TemplateElement,
  canvasW: number,
  canvasH: number,
  textW: number,
  textH: number
): { x: number; y: number } {
  const rawX = (el.x / 100) * canvasW;
  const rawY = (el.y / 100) * canvasH;

  let x = rawX;
  let y = rawY;

  switch (el.anchor) {
    case 'top-left': break;
    case 'top-center': x = rawX - textW / 2; break;
    case 'top-right': x = rawX - textW; break;
    case 'center': x = rawX - textW / 2; y = rawY - textH / 2; break;
    case 'bottom-left': y = rawY - textH; break;
    case 'bottom-center': x = rawX - textW / 2; y = rawY - textH; break;
    case 'bottom-right': x = rawX - textW; y = rawY - textH; break;
  }

  return { x, y };
}

// ── Text wrapping ──

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ── Load image helper ──

function loadImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  });
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

  const brandColors = config.brand.palette.length >= 3
    ? { dominant: config.brand.palette[0].hex, secondary: config.brand.palette[1].hex, accent: config.brand.palette[2].hex }
    : { dominant: config.brand.primaryColor, secondary: config.brand.secondaryColor, accent: config.brand.primaryColor };

  // ── 1. Draw Background ──
  const bgImage = config.backgroundImages?.[slideInput.slideIndex] || config.globalBackgroundImage;

  if (bgImage) {
    // User-uploaded or AI-generated background
    try {
      const img = await loadImage(bgImage);
      // Cover-fit
      const imgRatio = img.width / img.height;
      const canvasRatio = dims.w / dims.h;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgRatio > canvasRatio) {
        sw = img.height * canvasRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dims.w, dims.h);

      // Overlay
      if (template.background.overlayOpacity) {
        ctx.fillStyle = `rgba(0,0,0,${template.background.overlayOpacity})`;
        ctx.fillRect(0, 0, dims.w, dims.h);
      }
    } catch {
      // Fallback to solid
      ctx.fillStyle = resolveBackgroundColor(template.background.primaryColorType, brandColors);
      ctx.fillRect(0, 0, dims.w, dims.h);
    }
  } else if (template.background.type === 'gradient-linear') {
    const angle = template.background.gradientAngle || 135;
    const rad = (angle * Math.PI) / 180;
    const x1 = dims.w / 2 - Math.cos(rad) * dims.w;
    const y1 = dims.h / 2 - Math.sin(rad) * dims.h;
    const x2 = dims.w / 2 + Math.cos(rad) * dims.w;
    const y2 = dims.h / 2 + Math.sin(rad) * dims.h;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, resolveBackgroundColor(template.background.primaryColorType, brandColors));
    grad.addColorStop(1, resolveBackgroundColor(template.background.secondaryColorType || 'dark', brandColors));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dims.w, dims.h);
  } else {
    ctx.fillStyle = resolveBackgroundColor(template.background.primaryColorType, brandColors);
    ctx.fillRect(0, 0, dims.w, dims.h);
  }

  // ── 2. Draw Decorations ──
  for (const deco of template.decorations) {
    const decoColor = resolveColor(deco.colorType as any, config.brand, brandColors);
    ctx.save();
    ctx.globalAlpha = deco.opacity;
    ctx.fillStyle = decoColor;

    switch (deco.type) {
      case 'accent-bar-top':
        ctx.fillRect(0, 0, dims.w, 5);
        break;
      case 'accent-bar-left':
        ctx.fillRect(0, 0, 5, dims.h);
        break;
      case 'side-stripe':
        ctx.fillRect(0, 0, dims.w * 0.12, dims.h);
        break;
      case 'corner-shapes':
        ctx.beginPath();
        ctx.arc(0, 0, dims.w * 0.15, 0, Math.PI * 0.5);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dims.w, dims.h, dims.w * 0.1, Math.PI, Math.PI * 1.5);
        ctx.fill();
        break;
      case 'dot-grid': {
        const dotR = 2;
        const gap = 30;
        for (let gx = 60; gx < dims.w - 60; gx += gap) {
          for (let gy = 60; gy < dims.h - 60; gy += gap) {
            ctx.beginPath();
            ctx.arc(gx, gy, dotR, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
    }
    ctx.restore();
  }

  // ── 3. Draw Elements ──
  for (const el of template.elements) {
    if (!shouldShow(el.showOnSlides, slideInput.slideIndex, slideInput.totalSlides)) continue;

    const color = resolveColor(el.colorType, config.brand, brandColors);
    const fontSize = fontSizes[el.fontSize] || 28;
    const maxW = (el.maxWidth / 100) * dims.w;
    const fp = el.fontType === 'heading' ? config.fontPairing.heading : config.fontPairing.body;
    const fontFamily = fp.family;
    const weight = el.fontWeight || fp.weight;
    const lineH = el.lineHeight || (el.fontType === 'heading' ? fp.lineHeight : 1.5);

    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;

    // Resolve content for this element
    let content = '';
    switch (el.role) {
      case 'headline': content = slideInput.headline; break;
      case 'body': content = slideInput.bodyText; break;
      case 'subtitle': content = slideInput.subtitleText || slideInput.bodyText; break;
      case 'cta-button': content = slideInput.ctaText || 'Daha Fazla'; break;
      case 'slide-number': content = slideInput.slideNumber || String(slideInput.slideIndex + 1).padStart(2, '0'); break;
      case 'brand-name': content = config.brand.name; break;
      case 'brand-logo': content = config.brand.name; break; // Fallback text, logo image handled below
      case 'category-badge': content = config.categoryLabel; break;
      case 'swipe-arrow': content = '→'; break;
      case 'footer-info': content = config.brand.website || (config.brand.instagram ? `@${config.brand.instagram}` : config.brand.name); break;
      case 'icon-placeholder': content = slideInput.iconEmoji || '💡'; break;
      case 'divider-line': content = '___DIVIDER___'; break;
      case 'progress-bar': content = '___PROGRESS___'; break;
      case 'slide-dots': content = '___DOTS___'; break;
      case 'quote-mark': content = '"'; break;
    }

    // ── Special elements ──

    if (el.role === 'divider-line') {
      const divX = (el.x / 100) * dims.w;
      const divY = (el.y / 100) * dims.h;
      const divW = maxW;
      ctx.fillStyle = color;
      ctx.fillRect(divX, divY, divW, 3);
      ctx.restore();
      continue;
    }

    if (el.role === 'progress-bar') {
      const progress = (slideInput.slideIndex + 1) / slideInput.totalSlides;
      const barH = 4;
      const barY = dims.h - barH;
      // Background
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, barY, dims.w, barH);
      // Fill
      ctx.fillStyle = color;
      ctx.fillRect(0, barY, dims.w * progress, barH);
      ctx.restore();
      continue;
    }

    if (el.role === 'slide-dots') {
      const dotR = 5;
      const dotGap = 16;
      const totalW = slideInput.totalSlides * (dotR * 2) + (slideInput.totalSlides - 1) * dotGap;
      const startX = (dims.w - totalW) / 2;
      const dotY = (el.y / 100) * dims.h;
      for (let d = 0; d < slideInput.totalSlides; d++) {
        const dx = startX + d * (dotR * 2 + dotGap) + dotR;
        ctx.beginPath();
        ctx.arc(dx, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = d === slideInput.slideIndex ? color : 'rgba(150,150,150,0.3)';
        ctx.fill();
      }
      ctx.restore();
      continue;
    }

    if (el.role === 'brand-logo' && config.brand.logo) {
      // Draw actual logo image
      try {
        const logoImg = await loadImage(config.brand.logo);
        const maxLogoH = fontSize * 2.5;
        const maxLogoW = maxW;
        const ratio = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height);
        const lw = logoImg.width * ratio;
        const lh = logoImg.height * ratio;
        const pos = computePosition(el, dims.w, dims.h, lw, lh);
        ctx.drawImage(logoImg, pos.x, pos.y, lw, lh);
      } catch {
        // Fallback: draw brand name text
        drawTextElement(ctx, config.brand.name, el, fontSize, fontFamily, weight, color, maxW, lineH, dims, brandColors);
      }
      ctx.restore();
      continue;
    }

    // ── Standard text elements ──
    if (content) {
      drawTextElement(ctx, content, el, fontSize, fontFamily, weight, color, maxW, lineH, dims, brandColors);
    }

    ctx.restore();
  }

  return canvas.toDataURL('image/png').split(',')[1];
}

// ── Draw Text Element ──

function drawTextElement(
  ctx: CanvasRenderingContext2D,
  content: string,
  el: TemplateElement,
  fontSize: number,
  fontFamily: string,
  weight: number,
  color: string,
  maxW: number,
  lineH: number,
  dims: { w: number; h: number },
  brandColors: { dominant: string; secondary: string; accent: string }
) {
  const transform = el.textTransform === 'uppercase' ? content.toUpperCase() : content;

  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
  if (el.letterSpacing) {
    (ctx as any).letterSpacing = `${el.letterSpacing}em`;
  }

  const lines = wrapText(ctx, transform, maxW);
  const totalTextH = lines.length * fontSize * lineH;

  // Background pill/box
  if (el.bgColorType && el.bgColorType !== 'none') {
    const bgColor = resolveBgColor(el.bgColorType, brandColors);
    const pad = el.bgPadding || 10;
    const rad = el.bgRadius || 8;

    // Measure width for pill
    const maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const bgW = maxLineW + pad * 2;
    const bgH = totalTextH + pad * 2;

    const pos = computePosition(el, dims.w, dims.h, bgW, bgH);

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(pos.x, pos.y, bgW, bgH, rad);
    ctx.fill();

    // Draw text inside pill
    ctx.fillStyle = color;
    ctx.textAlign = (el.textAlign || 'center') as CanvasTextAlign;
    ctx.textBaseline = 'top';
    const textX = el.textAlign === 'left' ? pos.x + pad :
                  el.textAlign === 'right' ? pos.x + bgW - pad :
                  pos.x + bgW / 2;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textX, pos.y + pad + i * fontSize * lineH, maxW);
    }
  } else {
    // No background — just text
    const pos = computePosition(el, dims.w, dims.h, maxW, totalTextH);

    // Text shadow for readability
    if (el.colorType === 'white') {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
    }

    ctx.fillStyle = color;
    ctx.textAlign = (el.textAlign || 'left') as CanvasTextAlign;
    ctx.textBaseline = 'top';

    const textX = el.textAlign === 'center' ? pos.x + maxW / 2 :
                  el.textAlign === 'right' ? pos.x + maxW :
                  pos.x;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textX, pos.y + i * fontSize * lineH, maxW);
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // Reset letter spacing
  (ctx as any).letterSpacing = '0px';
}

// ═══════════════════════════════════════════════════
// RENDER ALL SLIDES
// ═══════════════════════════════════════════════════

export async function renderAllCarouselSlides(config: CarouselRenderConfig): Promise<string[]> {
  const results: string[] = [];

  for (const slideInput of config.slides) {
    const template = selectTemplateForSlide(
      slideInput.slideIndex,
      slideInput.totalSlides,
      config.carouselType
    );

    const rendered = await renderCarouselSlide(config, slideInput, template);
    results.push(rendered);
  }

  return results;
}

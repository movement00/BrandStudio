// ═══════════════════════════════════════════════════════════════════
// Canvas Render Engine — Programmatic slide composition
// AI generates background only, everything else rendered via Canvas API
// ═══════════════════════════════════════════════════════════════════

import { Brand, CarouselSlide, CarouselContentPlan, CarouselType } from '../types';
import { FontPairing, TYPE_SCALES } from './typographySystem';

// ── Types ──

export interface SlideRenderConfig {
  brand: Brand;
  slide: CarouselSlide;
  slideContent: CarouselContentPlan['slideContents'][0];
  fontPairing: FontPairing;
  aspectRatio: string;
  slideIndex: number;
  totalSlides: number;
  carouselType: CarouselType;
  canvasWidth?: number;
}

interface CanvasContext {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  scale: number; // typeScale multiplier relative to 1080
  safeZone: number;
  brandColors: { dominant: string; secondary: string; accent: string };
}

// ── Dimension Maps ──

const ASPECT_DIMENSIONS: Record<string, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
};

// ── Main Render Function ──

export async function renderSlideWithOverlays(config: SlideRenderConfig): Promise<string> {
  const dims = ASPECT_DIMENSIONS[config.aspectRatio] || ASPECT_DIMENSIONS['1:1'];
  const canvasW = config.canvasWidth || dims.w;
  const canvasH = Math.round(canvasW * (dims.h / dims.w));

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  const typeScale = TYPE_SCALES[config.aspectRatio] || TYPE_SCALES['1:1'];
  const scale = canvasW / 1080;
  const safeZone = typeScale.safeZone * scale;

  const brandColors = config.brand.palette.length >= 3
    ? { dominant: config.brand.palette[0].hex, secondary: config.brand.palette[1].hex, accent: config.brand.palette[2].hex }
    : { dominant: config.brand.primaryColor, secondary: config.brand.secondaryColor, accent: config.brand.primaryColor };

  const cc: CanvasContext = { ctx, w: canvasW, h: canvasH, scale, safeZone, brandColors };

  // 1. Draw AI-generated background
  if (config.slide.imageBase64) {
    await drawBackground(cc, config.slide.imageBase64);
  } else {
    // Fallback: solid brand color background
    ctx.fillStyle = brandColors.dominant;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // 2. Draw brand logo (top-left)
  if (config.brand.logo) {
    await drawLogo(cc, config.brand.logo);
  } else {
    drawBrandName(cc, config.brand.name, config.fontPairing);
  }

  // 3. Draw category badge (top-right)
  drawBadge(cc, config.carouselType, config.brand, config.fontPairing);

  // 4. Draw main content (headline + body)
  drawMainContent(cc, config.slideContent, config.fontPairing, config.slideIndex, config.totalSlides, typeScale, config.carouselType);

  // 5. Draw footer (website + swipe arrow)
  drawFooter(cc, config.brand, config.fontPairing, config.slideIndex, config.totalSlides);

  // 6. Draw slide number indicator (dots)
  drawSlideIndicator(cc, config.slideIndex, config.totalSlides, brandColors);

  return canvas.toDataURL('image/png').split(',')[1];
}

// ── Background ──

async function drawBackground(cc: CanvasContext, base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cc.ctx.drawImage(img, 0, 0, cc.w, cc.h);
      resolve();
    };
    img.onerror = reject;
    img.src = `data:image/png;base64,${base64}`;
  });
}

// ── Brand Logo ──

async function drawLogo(cc: CanvasContext, logoBase64: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxH = 48 * cc.scale;
      const maxW = 160 * cc.scale;
      let w = img.width;
      let h = img.height;
      const ratio = Math.min(maxW / w, maxH / h);
      w *= ratio;
      h *= ratio;
      const x = cc.safeZone;
      const y = cc.safeZone;
      cc.ctx.drawImage(img, x, y, w, h);
      resolve();
    };
    img.onerror = () => resolve(); // Skip if logo fails
    img.src = logoBase64.startsWith('data:') ? logoBase64 : `data:image/png;base64,${logoBase64}`;
  });
}

// ── Brand Name (when no logo) ──

function drawBrandName(cc: CanvasContext, name: string, fp: FontPairing) {
  const { ctx } = cc;
  const fontSize = 22 * cc.scale;

  ctx.save();
  ctx.font = `${fp.heading.weight} ${fontSize}px ${fp.heading.family}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Background pill
  const metrics = ctx.measureText(name);
  const px = 10 * cc.scale;
  const py = 6 * cc.scale;
  const pillX = cc.safeZone;
  const pillY = cc.safeZone;
  const pillW = metrics.width + px * 2;
  const pillH = fontSize + py * 2;
  const pillR = 10 * cc.scale;

  ctx.fillStyle = cc.brandColors.dominant;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillR);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(name, pillX + px, pillY + py);
  ctx.restore();
}

// ── Category Badge (top-right) ──

function drawBadge(cc: CanvasContext, carouselType: CarouselType, brand: Brand, fp: FontPairing) {
  const { ctx } = cc;

  const badgeLabels: Record<CarouselType, string> = {
    'campaign': 'KAMPANYA',
    'product-launch': 'YENİ ÜRÜN',
    'educational': 'BİLGİ',
    'announcement': 'DUYURU',
    'congratulations': 'KUTLAMA',
    'brand-story': 'HİKAYEMİZ',
    'tips-tricks': 'İPUÇLARI',
    'before-after': 'KARŞILAŞTIR',
    'testimonial': 'YORUMLAR',
    'event': 'ETKİNLİK',
    'motivation': 'İLHAM',
    'custom': brand.industry.split(' ')[0].toUpperCase(),
  };

  const label = badgeLabels[carouselType] || brand.industry.split(' ')[0].toUpperCase();
  const fontSize = 14 * cc.scale;
  const px = 14 * cc.scale;
  const py = 8 * cc.scale;
  const radius = 20 * cc.scale;

  ctx.save();
  ctx.font = `600 ${fontSize}px ${fp.body.family}`;
  const metrics = ctx.measureText(label);
  const badgeW = metrics.width + px * 2;
  const badgeH = fontSize + py * 2;
  const badgeX = cc.w - cc.safeZone - badgeW;
  const badgeY = cc.safeZone;

  // Badge background (brand accent color)
  ctx.fillStyle = cc.brandColors.accent || cc.brandColors.dominant;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, radius);
  ctx.fill();

  // Badge text
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, badgeX + badgeW / 2, badgeY + badgeH / 2);
  ctx.restore();
}

// ── Main Content (Headline + Body + Icon area) ──

function drawMainContent(
  cc: CanvasContext,
  content: CarouselContentPlan['slideContents'][0],
  fp: FontPairing,
  slideIndex: number,
  totalSlides: number,
  typeScale: typeof TYPE_SCALES['1:1'],
  carouselType: CarouselType
) {
  const { ctx, w, h, scale, safeZone } = cc;

  // ── Slide number (for tips/educational/story types) ──
  const showNumber = ['tips-tricks', 'educational', 'brand-story', 'before-after'].includes(carouselType);
  let contentStartY = h * 0.22;

  if (showNumber && slideIndex > 0 && slideIndex < totalSlides - 1) {
    const numSize = typeScale.heading * scale * 1.8;
    ctx.save();
    ctx.font = `900 ${numSize}px ${fp.heading.family}`;
    ctx.fillStyle = cc.brandColors.dominant;
    ctx.globalAlpha = 0.15;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const numText = String(slideIndex).padStart(2, '0');
    ctx.fillText(numText, safeZone, contentStartY - numSize * 0.2);
    ctx.restore();
  }

  // ── Headline ──
  const headlineSize = typeScale.heading * scale;
  ctx.save();
  ctx.font = `${fp.heading.weight} ${headlineSize}px ${fp.heading.family}`;
  if (fp.heading.textTransform === 'uppercase') {
    // Already handled by text content
  }
  ctx.fillStyle = '#1A1A1A'; // Near-black for readability
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const headlineText = fp.heading.textTransform === 'uppercase'
    ? content.headline.toUpperCase()
    : content.headline;

  const headlineMaxW = w - safeZone * 2;
  const headlineLines = wrapText(ctx, headlineText, headlineMaxW);
  const headlineLineHeight = headlineSize * fp.heading.lineHeight;
  let y = contentStartY;

  // Text shadow for depth
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 2 * scale;
  ctx.shadowOffsetY = 1 * scale;

  for (const line of headlineLines) {
    ctx.fillText(line, safeZone, y, headlineMaxW);
    y += headlineLineHeight;
  }
  ctx.restore();

  y += 16 * scale; // Gap between headline and body

  // ── Body Text ──
  if (content.bodyText) {
    const bodySize = typeScale.body * scale;
    ctx.save();
    ctx.font = `${fp.body.weight} ${bodySize}px ${fp.body.family}`;
    ctx.fillStyle = '#444444';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const bodyMaxW = w - safeZone * 2 - 20 * scale;
    const bodyLines = wrapText(ctx, content.bodyText, bodyMaxW);
    const bodyLineHeight = bodySize * fp.body.lineHeight;

    for (const line of bodyLines) {
      ctx.fillText(line, safeZone, y, bodyMaxW);
      y += bodyLineHeight;
    }
    ctx.restore();
  }

  // ── CTA Button (if provided, for last slide or campaign) ──
  if (content.ctaText && (slideIndex === totalSlides - 1 || carouselType === 'campaign')) {
    y += 24 * scale;
    drawCTAButton(cc, content.ctaText, fp, y);
  }
}

// ── CTA Button ──

function drawCTAButton(cc: CanvasContext, text: string, fp: FontPairing, y: number) {
  const { ctx, scale, safeZone } = cc;
  const fontSize = 16 * scale;
  const px = 24 * scale;
  const py = 12 * scale;
  const radius = 8 * scale;

  ctx.save();
  ctx.font = `600 ${fontSize}px ${fp.body.family}`;
  const metrics = ctx.measureText(text);
  const btnW = metrics.width + px * 2;
  const btnH = fontSize + py * 2;

  // Button background
  ctx.fillStyle = cc.brandColors.dominant;
  ctx.beginPath();
  ctx.roundRect(safeZone, y, btnW, btnH, radius);
  ctx.fill();

  // Button text
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, safeZone + btnW / 2, y + btnH / 2);
  ctx.restore();
}

// ── Footer (Website + Swipe Arrow) ──

function drawFooter(cc: CanvasContext, brand: Brand, fp: FontPairing, slideIndex: number, totalSlides: number) {
  const { ctx, w, h, scale, safeZone } = cc;
  const isLastSlide = slideIndex === totalSlides - 1;
  const footerY = h - safeZone - 30 * scale;

  // ── Website / Contact (bottom-left) ──
  const infoText = brand.website || brand.instagram ? `@${brand.instagram}` : brand.name.toLowerCase() + '.com';
  const infoSize = 14 * scale;

  ctx.save();
  ctx.font = `500 ${infoSize}px ${fp.body.family}`;
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(infoText.toUpperCase(), safeZone, footerY + 20 * scale);
  ctx.restore();

  // ── Swipe Arrow (bottom-right) — not on last slide ──
  if (!isLastSlide) {
    drawSwipeArrow(cc, fp);
  } else {
    // Last slide: show contact info instead
    drawLastSlideContact(cc, brand, fp);
  }
}

// ── Swipe Arrow (→) ──

function drawSwipeArrow(cc: CanvasContext, fp: FontPairing) {
  const { ctx, w, h, scale, safeZone } = cc;
  const arrowY = h - safeZone - 10 * scale;
  const arrowX = w - safeZone;

  // "KAYDIR" text
  const textSize = 12 * scale;
  ctx.save();
  ctx.font = `600 ${textSize}px ${fp.body.family}`;
  ctx.fillStyle = cc.brandColors.dominant;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.letterSpacing = `${0.08}em`;

  // Arrow pill background
  const pillW = 100 * scale;
  const pillH = 32 * scale;
  const pillX = arrowX - pillW;
  const pillY = arrowY - pillH;
  const pillR = pillH / 2;

  ctx.fillStyle = cc.brandColors.dominant;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillR);
  ctx.fill();

  // Arrow icon (→)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${18 * scale}px ${fp.body.family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('→', pillX + pillW / 2, pillY + pillH / 2);
  ctx.restore();
}

// ── Last Slide Contact Block ──

function drawLastSlideContact(cc: CanvasContext, brand: Brand, fp: FontPairing) {
  const { ctx, w, h, scale, safeZone } = cc;
  const contactItems: string[] = [];
  if (brand.instagram) contactItems.push(`@${brand.instagram}`);
  if (brand.phone) contactItems.push(brand.phone);
  if (brand.website) contactItems.push(brand.website);

  if (contactItems.length === 0) return;

  const fontSize = 14 * scale;
  let y = h - safeZone - contactItems.length * (fontSize * 1.8);

  ctx.save();
  ctx.font = `500 ${fontSize}px ${fp.body.family}`;
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';

  for (const item of contactItems) {
    ctx.fillText(item, w - safeZone, y);
    y += fontSize * 1.8;
  }
  ctx.restore();
}

// ── Slide Indicator Dots ──

function drawSlideIndicator(cc: CanvasContext, activeIndex: number, total: number, colors: { dominant: string }) {
  const { ctx, w, h, scale } = cc;
  const dotSize = 5 * scale;
  const gap = 8 * scale;
  const totalW = total * (dotSize * 2) + (total - 1) * gap;
  const startX = (w - totalW) / 2;
  const y = h - 24 * scale;

  ctx.save();
  for (let i = 0; i < total; i++) {
    const x = startX + i * (dotSize * 2 + gap) + dotSize;
    ctx.beginPath();
    ctx.arc(x, y, dotSize, 0, Math.PI * 2);
    if (i === activeIndex) {
      ctx.fillStyle = colors.dominant;
    } else {
      ctx.fillStyle = 'rgba(150,150,150,0.3)';
    }
    ctx.fill();
  }
  ctx.restore();
}

// ── Text Wrap Helper ──

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const testLine = line + (line ? ' ' : '') + word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ── Export All Slides ──

export async function renderAllSlides(
  slides: CarouselSlide[],
  carouselPlan: CarouselContentPlan,
  brand: Brand,
  fontPairing: FontPairing,
  aspectRatio: string,
  carouselType: CarouselType
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const content = carouselPlan.slideContents[i];
    if (!slide || !content) continue;

    const rendered = await renderSlideWithOverlays({
      brand,
      slide,
      slideContent: content,
      fontPairing,
      aspectRatio,
      slideIndex: i,
      totalSlides: slides.length,
      carouselType,
    });
    results.push(rendered);
  }

  return results;
}

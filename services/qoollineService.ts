import { Brand, QoollineCampaign, QoollineCountryTheme, CopyVariant, QoollineQcResult, DesignBlueprint, BlueprintLayer } from '../types';
import { getApiKey } from './geminiService';
import { GoogleGenAI } from '@google/genai';

// ═══ Qoolline brand colors ═══
const QOOLLINE_COLORS = {
  yellow: '#F8BE00',
  black: '#201C1D',
  purple: '#6B63FF',
  grey: '#737485',
  yellowLight10: '#FFFAEA',
  yellowLight8: '#FEF5D7',
  purpleTint: '#E9E8FF',
  green: '#00CC9B',
};

const QOOLLINE_ALLOWED_COLORS = Object.values(QOOLLINE_COLORS);

// ═══ BLUEPRINT PREPROCESSOR — Enforce 13 rules at data level ═══
export function preprocessBlueprintForQoolline(
  blueprint: DesignBlueprint,
  campaign: QoollineCampaign
): DesignBlueprint {
  const bp = JSON.parse(JSON.stringify(blueprint)) as DesignBlueprint; // deep clone

  // ─── KURAL 3: Force brand colors in color system ───
  bp.colorSystem.dominant = QOOLLINE_COLORS.yellow;
  bp.colorSystem.secondary = QOOLLINE_COLORS.black;
  bp.colorSystem.accent = QOOLLINE_COLORS.green;
  bp.colorSystem.textPrimary = '#FFFFFF';
  bp.colorSystem.textSecondary = QOOLLINE_COLORS.grey;

  // ─── KURAL 3: Force canvas background to brand color ───
  bp.canvas.backgroundColor = QOOLLINE_COLORS.black;

  // ─── Process layers ───
  const processedLayers: BlueprintLayer[] = [];
  let hasCtaButton = false;
  let mainMessageCount = 0;

  for (const layer of bp.layers) {
    const l = { ...layer, style: { ...layer.style } };

    // ─── KURAL 2: Logo layer — force high contrast ───
    if (l.type === 'logo') {
      // Ensure logo has high contrast: white/yellow text on dark bg, or dark on light bg
      l.style.color = '#FFFFFF';
      l.style.backgroundColor = QOOLLINE_COLORS.black;
      l.style.opacity = '100%';
      // Remove any gradient that might reduce contrast
      l.style.gradient = undefined;
      l.style.blur = undefined;
      l.content = `Qoolline — HIGH CONTRAST, sharp, clearly readable logo on solid ${QOOLLINE_COLORS.black} background. NO gradient behind logo.`;
      processedLayers.push(l);
      continue;
    }

    // ─── KURAL 4: Find CTA layer and force button format ───
    if (l.type === 'text' && !hasCtaButton) {
      const isCta = l.content.toLowerCase().includes('cta') ||
                    l.content.toLowerCase().includes('get esim') ||
                    l.content.toLowerCase().includes('download') ||
                    l.content.toLowerCase().includes('explore') ||
                    l.content.toLowerCase().includes('buy') ||
                    l.style.borderRadius === 'full' ||
                    l.style.borderRadius === 'lg';

      if (isCta) {
        // Force button format
        l.content = campaign.cta;
        l.style.backgroundColor = QOOLLINE_COLORS.green;
        l.style.color = '#FFFFFF';
        l.style.borderRadius = 'lg';
        l.style.fontWeight = 'bold';
        l.style.fontSize = l.style.fontSize || 'md';
        l.style.textAlign = 'center';
        hasCtaButton = true;
        processedLayers.push(l);
        continue;
      }
    }

    // ─── KURAL 8: Remove unnecessary decorations ───
    if (l.type === 'decoration') {
      const isUseful = l.content.toLowerCase().includes('line') ||
                       l.content.toLowerCase().includes('divider') ||
                       l.content.toLowerCase().includes('border');
      if (!isUseful) {
        // Skip this layer — remove decorative clutter
        continue;
      }
    }

    // ─── KURAL 1: Limit text layers for single message ───
    if (l.type === 'text') {
      mainMessageCount++;
      if (mainMessageCount > 4) {
        // Skip excessive text layers — enforce single message rule
        continue;
      }
    }

    // ─── KURAL 3: Force brand colors on all layers ───
    if (l.style.color && !QOOLLINE_ALLOWED_COLORS.includes(l.style.color) && l.style.color !== '#FFFFFF' && l.style.color !== '#000000') {
      // Replace off-brand color with nearest Qoolline color
      l.style.color = QOOLLINE_COLORS.yellow;
    }
    if (l.style.backgroundColor && !QOOLLINE_ALLOWED_COLORS.includes(l.style.backgroundColor) && l.style.backgroundColor !== '#FFFFFF' && l.style.backgroundColor !== '#000000' && l.style.backgroundColor !== 'transparent') {
      l.style.backgroundColor = QOOLLINE_COLORS.black;
    }

    // ─── KURAL 5: Enforce minimum readable font size ───
    if (l.type === 'text' && l.style.fontSize === 'xs') {
      l.style.fontSize = 'sm'; // Upgrade tiny text to readable
    }

    // ─── KURAL 10: Ensure text-background contrast ───
    if (l.type === 'text') {
      const bgColor = l.style.backgroundColor || bp.canvas.backgroundColor;
      const isDarkBg = bgColor === QOOLLINE_COLORS.black || bgColor === '#000000' || bgColor === '#201C1D';
      if (isDarkBg && (l.style.color === QOOLLINE_COLORS.black || l.style.color === '#000000')) {
        l.style.color = '#FFFFFF'; // Fix: dark text on dark bg
      }
      if (!isDarkBg && l.style.color === '#FFFFFF') {
        l.style.color = QOOLLINE_COLORS.black; // Fix: white text on light bg
      }
    }

    processedLayers.push(l);
  }

  // ─── KURAL 4: If no CTA button found, inject one ───
  if (!hasCtaButton) {
    processedLayers.push({
      id: 'qoolline-cta-injected',
      type: 'text',
      content: campaign.cta,
      position: { x: 'center', y: '85%', anchor: 'center' },
      size: { width: '50%', height: 'auto' },
      style: {
        fontWeight: 'bold',
        fontSize: 'md',
        textAlign: 'center',
        color: '#FFFFFF',
        backgroundColor: QOOLLINE_COLORS.green,
        borderRadius: 'lg',
      },
      zIndex: 90,
    });
  }

  bp.layers = processedLayers;

  // ─── KURAL 5 & 11: Typography enforcement ───
  bp.typography.headingStyle = 'Bold, clean sans-serif (Inter/Montserrat), large size, high contrast, mobile-readable';
  bp.typography.bodyStyle = 'Regular weight, clean sans-serif, md size minimum, high contrast';
  bp.typography.accentStyle = 'Bold, inside rounded-rectangle button, high contrast color';

  return bp;
}

function getAI(): GoogleGenAI {
  const key = getApiKey();
  if (!key) throw new Error('API_KEY_MISSING');
  return new GoogleGenAI({ apiKey: key });
}

// ═══ OPENAI API KEY MANAGEMENT ═══
const OPENAI_KEY_STORAGE = 'qoolline_openai_api_key';
export function getOpenAIKey(): string {
  try { return localStorage.getItem(OPENAI_KEY_STORAGE) || ''; } catch { return ''; }
}
export function setOpenAIKey(key: string) {
  try { localStorage.setItem(OPENAI_KEY_STORAGE, key); } catch {}
}
export function hasOpenAIKey(): boolean {
  return getOpenAIKey().length > 0;
}

// ═══ FAL AI Nano Banana Pro — Blueprint-based generation with reference ═══
const FAL_KEY = '729373d1-5cb9-43ae-bac2-f298a5101cb6:b78570140f86fdc36f4915d8614edf4c';

export const generateWithOpenAI = async (
  referenceImageBase64: string,
  editPrompt: string,
  aspectRatio: string,
): Promise<string> => {
  // Resize reference image to reduce payload size
  const canvas = document.createElement('canvas');
  const img = new Image();
  await new Promise<void>((resolve) => {
    img.onload = () => {
      const maxSize = 800;
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve();
    };
    img.src = `data:image/jpeg;base64,${referenceImageBase64}`;
  });
  const smallBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

  // Fal AI sync endpoint
  let submitRes: Response;
  try {
    submitRes = await fetch('https://fal.run/fal-ai/nano-banana-pro/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: editPrompt,
        image_urls: [`data:image/jpeg;base64,${smallBase64}`],
        aspect_ratio: aspectRatio,
        resolution: '2K',
        num_images: 1,
      }),
    });
  } catch (fetchErr: any) {
    throw new Error(`Fal AI baglanti hatasi: ${fetchErr.message}`);
  }

  const responseText = await submitRes.text();
  if (!responseText) throw new Error(`Fal AI bos yanit (status: ${submitRes.status})`);

  let resultData: any;
  try {
    resultData = JSON.parse(responseText);
  } catch {
    throw new Error(`Fal AI JSON parse hatasi: ${responseText.slice(0, 200)}`);
  }

  if (!submitRes.ok) throw new Error(`Fal AI hata (${submitRes.status}): ${resultData.detail || responseText.slice(0, 200)}`);

  const imageUrl = resultData.images?.[0]?.url;
  if (!imageUrl) throw new Error('Gorsel URL bulunamadi');

  const imgRes = await fetch(imageUrl);
  const imgBlob = await imgRes.blob();
  const buf = await imgBlob.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
};

// ═══ SIMPLE GENERATE — 8 layer style analysis + reference image + texts ═══
export const generateFromStyleAnalysis = async (
  styleJson: string,
  referenceImageBase64: string,
  aspectRatio: string,
  brandName: string,
  texts: { headline: string; supporting: string; cta: string; extra: string },
  logoBase64?: string | null,
): Promise<string> => {
  const ai = getAI();

  const parts: any[] = [];

  parts.push({ text: "REFERANS GÖRSEL:" });
  parts.push({ inlineData: { mimeType: 'image/png', data: referenceImageBase64 } });

  if (logoBase64) {
    parts.push({ text: "MARKA LOGOSU:" });
    parts.push({ inlineData: { mimeType: 'image/png', data: logoBase64 } });
  }

  parts.push({ text: `Bu görselin aynısını oluştur. Yazıları değiştir:
- Başlık: "${texts.headline}"
- Destek: "${texts.supporting}"
- CTA: "${texts.cta}"
- Ekstra: "${texts.extra}"
- Logo: ${brandName}

STİL ANALİZİ:
${styleJson}` });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: '2K',
      },
    },
  });

  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error('Yanıt alınamadı.');
  const imagePart = candidate.content?.parts?.find((p: any) => p.inlineData);
  if (!imagePart?.inlineData) throw new Error('Görsel oluşturulamadı.');
  return imagePart.inlineData.data;
};

// ═══ CAMPAIGN TEMPLATES ═══
export const QOOLLINE_CAMPAIGNS: QoollineCampaign[] = [
  {
    id: 'value_conversion',
    type: 'Value / Conversion',
    core: 'Stop Paying Roaming Fees',
    supporting: 'Instant eSIM activation',
    cta: 'Get eSIM',
    extra: 'Fast & Reliable Data',
    notes: 'Clear problem-solution framing. CTA should push toward transaction.',
  },
  {
    id: 'brand_awareness',
    type: 'Brand / Awareness',
    core: 'Seamless Connectivity for Modern Travellers',
    supporting: 'Coverage across 175+ destinations',
    cta: 'Explore Plans',
    extra: 'Easy Set Up & Activation',
    notes: 'Strong brand promise & scale proof. CTA should not be aggressive. Store logos should be removed.',
  },
  {
    id: 'product_performance',
    type: 'Product / Performance',
    core: 'Travel connected. Your eSIM, ready in minutes',
    supporting: 'No roaming fees abroad',
    cta: 'Get eSIM',
    extra: 'Instant eSIM Activation',
    notes: 'Balances emotional travel feel with a concrete benefit.',
  },
  {
    id: 'awareness_app',
    type: 'Awareness / App',
    core: 'The World at Your Fingertips, Wherever You Travel',
    supporting: 'Instant eSIM, Reliable Coverage',
    cta: 'Download',
    extra: 'Simple App for Travel Data',
    notes: 'Brand-led and aspirational. Best for upper funnel or retargeting. Use Download CTA with store logos.',
  },
  {
    id: 'promo_app',
    type: 'Promo / App or Web',
    core: 'Welcome to Seamless Travel Connectivity',
    supporting: 'Use code WELCOME',
    cta: 'Get eSIM',
    extra: 'Easy Set Up',
    notes: 'Clear incentive. CTA must reflect whether the goal is install or purchase.',
  },
  {
    id: 'direct_conversion',
    type: 'Direct Conversion',
    core: '10% off your Travel eSIM',
    supporting: 'Use code WELCOME at checkout',
    cta: 'Explore Plans',
    extra: 'No Roaming Fees / Fast Data',
    notes: 'Pure performance creative. Discount must be the hero, CTA must be transactional.',
  },
];

// ═══ COUNTRY THEMES ═══
export const QOOLLINE_COUNTRIES: QoollineCountryTheme[] = [
  {
    id: 'uk',
    country: 'United Kingdom',
    emoji: '🇬🇧',
    localizedMessage: 'Stay connected across Europe from the UK',
    visualKeywords: ['Big Ben', 'London skyline', 'red phone booth', 'Tower Bridge', 'British flag'],
    targetScenario: 'UK to Europe travelers — emphasize easy roaming-free travel to EU countries',
  },
  {
    id: 'switzerland',
    country: 'Switzerland',
    emoji: '🇨🇭',
    localizedMessage: 'Explore Switzerland without roaming fees',
    visualKeywords: ['Swiss Alps', 'Zurich cityscape', 'Swiss train', 'lake', 'mountains'],
    targetScenario: 'Travelers visiting Switzerland — highlight non-EU connectivity solution',
  },
  {
    id: 'turkey',
    country: 'Turkey',
    emoji: '🇹🇷',
    localizedMessage: 'Connect instantly when you land in Turkey',
    visualKeywords: ['Istanbul skyline', 'Bosphorus bridge', 'hot air balloons Cappadocia', 'bazaar'],
    targetScenario: 'International visitors to Turkey — instant activation on arrival',
  },
  {
    id: 'usa',
    country: 'United States',
    emoji: '🇺🇸',
    localizedMessage: 'Travel the USA without roaming charges',
    visualKeywords: ['New York skyline', 'Golden Gate Bridge', 'Route 66', 'Times Square'],
    targetScenario: 'International travelers visiting US — emphasize coverage and simplicity',
  },
  {
    id: 'japan',
    country: 'Japan',
    emoji: '🇯🇵',
    localizedMessage: 'Stay connected across Japan',
    visualKeywords: ['Tokyo neon streets', 'Mount Fuji', 'cherry blossoms', 'bullet train', 'temples'],
    targetScenario: 'Travelers to Japan — instant data without language barrier of local SIM',
  },
];

// ═══ QC AGENT — Qoolline-specific 13-rule quality check ═══
export const qoollineQualityCheck = async (
  imageBase64: string,
  campaignType: string,
  campaignNotes: string,
): Promise<QoollineQcResult> => {
  const ai = getAI();

  const parts: any[] = [
    {
      inlineData: { mimeType: 'image/png', data: imageBase64 }
    },
    {
      text: `You are a strict creative quality reviewer for Qoolline (international eSIM & travel connectivity brand).
Campaign type: "${campaignType}"
Campaign notes: "${campaignNotes}"

Review this generated banner against ALL 13 mandatory Qoolline brand rules:

1. SINGLE MESSAGE: ONE clear main message. Multiple competing messages = fail.
2. LOGO VISIBILITY: Logo must be high-contrast, clearly readable. Logo on gradient or low-contrast = fail.
3. BRAND COLORS: Must use Qoolline colors (Yellow #F8BE00, Black #201C1D, Purple #6B63FF, Green #00CC9B). Off-brand = issue.
4. CTA FORMAT: CTA must be in BUTTON format (rounded rectangle). Plain text CTA = issue.
5. MOBILE READABILITY: All text readable on mobile phone. Tiny or low-contrast text = fail.
6. NO AI ARTIFACTS: No distorted hands, faces, text, objects. Must look professional, not AI-generated. = fail.
7. TEXT ACCURACY: All text spelled correctly. No placeholder, gibberish, broken words = fail.
8. NO DECORATION CLUTTER: No dots, waves, abstract shapes that don't serve the message = issue.
9. PRODUCT VISIBILITY: App interface or product must be clearly shown = issue.
10. TEXT-BACKGROUND CONTRAST: Sufficient contrast for all text = fail.
11. SIMPLE STRUCTURE: Short text blocks, easy to scan. No long fragmented text = issue.
12. HUMAN-PRODUCT INTERACTION: When applicable, show real usage scenario = note.
13. FORMAT CONSISTENCY: Design must work if adapted to other aspect ratios = note.

SCORING:
- 9-10: Perfect, ready to publish
- 7-8: Good, minor issues
- 5-6: Needs revision
- 1-4: Major problems, unusable

Respond in JSON:
{
  "score": <number 1-10>,
  "passed": <true if score >= 7>,
  "issues": ["issue 1", ...],
  "rulesChecked": ["SINGLE MESSAGE: OK", "LOGO: FAIL - low contrast", ...],
  "revisionInstruction": "<specific instruction to fix ALL issues, or null if passed>"
}

Be STRICT. Text errors or AI artifacts = score LOW.
ONLY return JSON.`
    }
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: { responseMimeType: 'application/json' }
  });

  try {
    const parsed = JSON.parse(response.text || '{}');
    return {
      score: parsed.score || 5,
      passed: parsed.passed ?? (parsed.score >= 7),
      issues: parsed.issues || [],
      rulesChecked: parsed.rulesChecked || [],
      revisionInstruction: parsed.revisionInstruction || null,
    };
  } catch {
    return { score: 5, passed: false, issues: ['QC parse failed'], rulesChecked: [], revisionInstruction: null };
  }
};

// ═══ COPYWRITING AGENT — Generate A/B copy variants ═══
export const generateCopyVariants = async (
  campaign: QoollineCampaign,
  count: number = 3,
  countryContext?: string,
): Promise<CopyVariant[]> => {
  const ai = getAI();

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [{
        text: `You are a senior copywriter for Qoolline, an international eSIM provider.

BRAND VOICE: Innovative, Global, Tech-forward, Fast, User-friendly, Premium yet Accessible.
LANGUAGE: English only.
COPYWRITING PILLARS: No Roaming Fees, Instant Activation, Seamless Connectivity, Trust & Reliability, Global Coverage (175+ destinations).

BASE CAMPAIGN:
- Type: ${campaign.type}
- Core: "${campaign.core}"
- Supporting: "${campaign.supporting}"
- CTA: "${campaign.cta}"
- Extra: "${campaign.extra}"
- Notes: ${campaign.notes}
${countryContext ? `\nCOUNTRY CONTEXT: ${countryContext}` : ''}

Generate ${count} ALTERNATIVE copy variants. Each variant should:
- Keep the same campaign intent and tone
- Vary the wording, angle, or emphasis
- Be suitable for social media banners (short, punchy)
- Headlines max 40 chars, supporting max 60 chars, CTA max 15 chars
- Include reasoning for why this variant works

Return JSON array:
[
  {
    "headline": "...",
    "supporting": "...",
    "cta": "...",
    "extra": "...",
    "reasoning": "..."
  }
]

ONLY return JSON array.`
      }]
    },
    config: { responseMimeType: 'application/json' }
  });

  try {
    const parsed = JSON.parse(response.text || '[]');
    return parsed.map((v: any, i: number) => ({
      id: `copy-${campaign.id}-${i}-${Date.now()}`,
      campaignType: campaign.type,
      headline: v.headline || campaign.core,
      supporting: v.supporting || campaign.supporting,
      cta: v.cta || campaign.cta,
      extra: v.extra || campaign.extra,
      reasoning: v.reasoning || '',
    }));
  } catch {
    return [];
  }
};

// ═══ COUNTRY CONTENT AGENT — Generate country-themed prompt ═══
export const generateCountryPrompt = async (
  country: QoollineCountryTheme,
  campaign: QoollineCampaign,
  brand: Brand,
): Promise<string> => {
  const ai = getAI();

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [{
        text: `You are an expert creative director for Qoolline (international eSIM brand).

Create a detailed image generation prompt for a ${campaign.type} banner featuring ${country.country}.

CAMPAIGN:
- Headline: "${campaign.core}"
- Supporting: "${campaign.supporting}"
- CTA: "${campaign.cta}"
- Notes: ${campaign.notes}

COUNTRY: ${country.country}
Visual elements to incorporate: ${country.visualKeywords.join(', ')}
Target scenario: ${country.targetScenario}
Localized message angle: ${country.localizedMessage}

BRAND RULES:
- Colors: Yellow #F8BE00 (primary), Black #201C1D (secondary), Purple #6B63FF, Green #00CC9B
- Logo must be high-contrast, never on gradients
- CTA must be a button (rounded rectangle)
- Single clear message — no competing messages
- Mobile-first readability
- Show Qoolline app UI or phone with app
- Professional design quality, NOT AI-looking
- No decorative clutter (dots, waves, abstract shapes)

Write a comprehensive image generation prompt (200-300 words) that combines the country theme with the campaign message. The result should look like a professional social media ad.

Return ONLY the prompt text, nothing else.`
      }]
    }
  });

  return response.text || '';
};

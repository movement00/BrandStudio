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

// ═══ CAMPAIGN TEMPLATE GENERATOR AGENT ═══
export const generateCampaignTemplates = async (
  brand: Brand,
  count: number = 6,
  existingCampaigns: QoollineCampaign[] = [],
  style?: string,
): Promise<QoollineCampaign[]> => {
  const ai = getAI();

  const existingList = existingCampaigns.length > 0
    ? `\nMEVCUT KAMPANYALAR (bunlardan esinlen ama KOPYALAMA, farkli acilar bul):\n${existingCampaigns.map(c => `- ${c.type}: "${c.core}" / "${c.supporting}" / CTA: "${c.cta}"`).join('\n')}`
    : '';

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [{
        text: `Sen ${brand.name} markasi icin dunya capinda kampanya stratejisti ve kreatif direktorsun.

MARKA:
- Ad: ${brand.name}
- Sektor: ${brand.industry}
- Aciklama: ${brand.description || ''}
- Ton: ${brand.tone}
- Dil: ${brand.outputLanguage === 'tr' ? 'Turkce' : 'Ingilizce'}
${existingList}
${style ? `\nISTENEN STIL: ${style}` : ''}

${count} adet FARKLI kampanya sablonu olustur. Her biri:
- Farkli bir aci, farkli bir duygu, farkli bir hedef kitleye hitap etmeli
- Klas, kurumsal ama ince mesajlar icermeli
- Kisa, vurucu, akilda kalici basliklar
- Destekleyici metin ana mesaji guclendirmeli
- CTA net ve aksiyona yonlendirici olmali

Kampanya tipleri cesiitli olsun: Performance, Branding, Awareness, Seasonal, Emotional, Trust, Social Proof, FOMO, Educational, Lifestyle gibi.

JSON array olarak don:
[
  {
    "type": "kampanya tipi",
    "core": "ana baslik",
    "supporting": "destek metin",
    "cta": "CTA butonu",
    "extra": "ekstra bilgi",
    "notes": "kreatif yonlendirme notu"
  }
]

SADECE JSON array don, baska bir sey yazma.`
      }]
    },
    config: { responseMimeType: 'application/json' }
  });

  try {
    const parsed = JSON.parse(response.text || '[]');
    return parsed.map((c: any, i: number) => ({
      id: `generated-${Date.now()}-${i}`,
      type: c.type || 'Custom',
      core: c.core || '',
      supporting: c.supporting || '',
      cta: c.cta || 'Learn More',
      extra: c.extra || '',
      notes: c.notes || '',
    }));
  } catch {
    return [];
  }
};

// ═══ TYPOGRAPHY AGENT — Decides emphasis, colors, sizes for each campaign ═══
export const analyzeTypography = async (
  campaign: QoollineCampaign,
  brand: Brand,
  blueprintLayers: any[],
  referenceImageBase64?: string,
): Promise<string> => {
  const ai = getAI();

  const textLayers = blueprintLayers.filter((l: any) => l.type === 'text' || l.type === 'logo');

  const parts: any[] = [];

  // Send reference image so agent can SEE the visual
  if (referenceImageBase64) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: referenceImageBase64 } });
  }

  parts.push({ text: `Sen Paula Scher (Pentagram) ve Stefan Sagmeister seviyesinde bir tipografi direktörüsün. Dünyanın en iyi reklam ajanslarındaki gibi tipografi kararları alıyorsun.

BU GÖRSELE BAK ve tipografi kararını görselin havasına, renklerine ve boş alanlarına göre ver.

MARKA: ${brand.name}
RENK PALETİ: ${brand.palette.map(c => `${c.name}: ${c.hex}`).join(', ')}
TON: ${brand.tone}

KAMPANYA:
- Başlık: "${campaign.core}"
- Destek: "${campaign.supporting}"
- CTA: "${campaign.cta}"

MEVCUT TEXT KATMANLARI:
${textLayers.map(l => `- [${l.type}] "${l.content}" (${l.position?.anchor || ''})`).join('\n')}

TEMEL İLKELERİN:
- 3 ODAK NOKTASI KURALI: Görselde max 3 tipografik eleman. Fazla ikon, kutucuk, dekorasyon EKLEME.
- HİYERARŞİ: Hook (başlık) en büyük, Context (destek) başlığın %50-60'ı, Action (CTA) izole.
- QUIET LUXURY: Az eleman, çok boşluk, ince ama güçlü. Kalabalık değil, nefes alan.
- FONT MIX: Script/handwritten, heritage serif, bold sans-serif, thin elegant — kampanyaya uygun olanı seç.
- BOYUT: Her seferinde farklı yaklaşım. Bazen devasa vurgu + küçük destek, bazen komple minimal eşit boyut, bazen sadece ince elegant tipografi. Tekrara düşme.
- RENK: Max 2 renk metin için. Vurgu rengi marka paletinden.
- ÇEŞİTLİLİK: Görselin havasına göre en uygun tipografi yaklaşımını seç. Seçeneklerin:
  * Paula Scher: agresif bold, devasa tek kelime, katmanlı, tipografik olarak baskın
  * Sagmeister: deneysel, beklenmedik yerleşim, duygu odaklı, script vurgu
  * Vignelli: grid-temelli, minimal, eşit boyutlu, temiz swiss style
  * Luxury serif: ince heritage serif, zarif, sessiz güç, çok boşluk
  * Modern sans: thin/light sans-serif, ultra minimal, nefes alan
  * Kontrast: bir kelime devasa bold, geri kalan çok küçük thin
  * Retro/vintage: klasik serif, nostaljik hava, sıcak tonlar
  * Brutalist: ham, çiğ, güçlü, büyük blok harfler, siyah-beyaz
  * Geometric: düzgün açılar, grid hizalı, yapısal, Bauhaus esinli
  * Organic/flowing: akıcı, yumuşak, script + thin sans birleşimi
  * Layered: katmanlı metin, gölgeli, derinlikli, 3D his
  * Monospace/tech: kod fontu hissi, teknik, modern, dijital
  * Neon/glow: parlak, ışıklı metin efekti, karanlık arka plan
  * Gradient text: metin içinde renk geçişi, modern, dikkat çekici
  * Outline/kontur: içi boş harfler, ince çizgi, zarif ve hafif
  * Cutout/kolaj: kesme stili, farklı boyut-renk parçalar, dinamik
- YERLEŞİM KARARI: Görseldeki boş alanlara göre metinlerin NEREYE yerleşeceğine karar ver:
  * Üst boşluk varsa → başlık üstte
  * Alt boşluk varsa → başlık altta, CTA en altta
  * Sol/sağ boşluk → dikey yerleşim
  * Merkez boşluk → ortalanmış tipografi
  * Objelerin üzerine metin KOYMA — boş alanlari kullan
- YERLESTIRME: Ana mesaj üstte. CTA aşağıda veya sağda, boşlukla izole.
- CTA ZORUNLU BUTON: CTA her zaman yuvarlak köşeli dikdörtgen BUTON formatında olmalı. Marka renklerinden biri arka plan, kontrast metin. Düz metin CTA YASAK.

KARAR VER (3-4 cümle, kısa ve net):
1. Görselin havasına göre tipografi yaklaşımı (hangi stil?)
2. Başlık: hangi kelime vurgulu, font stili, renk
3. Destek metin + CTA buton stili
4. YERLEŞİM: Metinler görselde nereye yerleşecek (üst/alt/sol/sağ/merkez) — boş alanlara göre

Ekstra ikon, kutucuk, dekorasyon ÖNERME. Sadece tipografi ve yerleşim.

SADECE talimatı yaz.` });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts }
  });

  return response.text || '';
};

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
  logoBase64?: string | null,
): Promise<string> => {
  // Build image array — reference + optional logo
  const imageUrls = [`data:image/jpeg;base64,${referenceImageBase64}`];
  if (logoBase64) {
    imageUrls.push(`data:image/png;base64,${logoBase64}`);
  }

  // Fal AI sync endpoint
  let submitRes: Response;
  try {
    submitRes = await fetch('https://fal.run/fal-ai/nano-banana-2/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: editPrompt + (logoBase64 ? '\n\nİkinci görsel marka logosudur. Bu logoyu görsele yerleştir.' : ''),
        image_urls: imageUrls,
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
  // Convert blob to base64 without stack overflow
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(imgBlob);
  });
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

// ═══ QOOLLINE PRICING DATA (scraped from qoolline.com) ═══
export const QOOLLINE_PRICING = [
  { country: 'Türkiye', code: 'TR', from: '$1.95', emoji: '🇹🇷', scenario: 'Yabanci turistler icin ucuz veri' },
  { country: 'United Kingdom', code: 'UK', from: '$2.45', emoji: '🇬🇧', scenario: 'UK→EU seyahat, roaming yok' },
  { country: 'United States', code: 'US', from: '$3.45', emoji: '🇺🇸', scenario: 'ABD ziyaretcileri icin veri' },
  { country: 'Japan', code: 'JP', from: '$3.45', emoji: '🇯🇵', scenario: 'Japonya gezginleri icin' },
  { country: 'France', code: 'FR', from: '$2.45', emoji: '🇫🇷', scenario: 'Fransa/Avrupa seyahati' },
  { country: 'Germany', code: 'DE', from: '$2.45', emoji: '🇩🇪', scenario: 'Almanya is seyahati' },
  { country: 'Spain', code: 'ES', from: '$2.45', emoji: '🇪🇸', scenario: 'Ispanya tatili' },
  { country: 'Italy', code: 'IT', from: '$2.45', emoji: '🇮🇹', scenario: 'Italya kultur turu' },
  { country: 'Switzerland', code: 'CH', from: '$2.45', emoji: '🇨🇭', scenario: 'Isvicre non-EU baglanti' },
  { country: 'Thailand', code: 'TH', from: '$3.45', emoji: '🇹🇭', scenario: 'Guneydogu Asya tatili' },
  { country: 'Egypt', code: 'EG', from: '$5.45', emoji: '🇪🇬', scenario: 'Misir tarihi gezi' },
  { country: 'Saudi Arabia', code: 'SA', from: '$4.45', emoji: '🇸🇦', scenario: 'Umre/is seyahati' },
];

// ═══ WEB CAMPAIGN GENERATOR — Price-based campaigns per country ═══
export const generateWebCampaigns = async (
  brand: Brand,
  selectedCountries: string[],
): Promise<QoollineCampaign[]> => {
  const ai = getAI();
  const countries = QOOLLINE_PRICING.filter(p => selectedCountries.includes(p.code));

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [{
        text: `Sen ${brand.name} markasi icin fiyat odakli kampanya stratejisti sin.

MARKA: ${brand.name} — International eSIM provider
FIYATLAR:
${countries.map(c => `- ${c.emoji} ${c.country}: ${c.from}'den baslayan fiyatlar. Senaryo: ${c.scenario}`).join('\n')}

Her ulke icin 1 adet FIYAT ODAKLI kampanya sablonu olustur:
- Fiyati ON PLANA cikar
- Ulkeye ozel mesajlasma
- Klas ama aksiyon odakli
- CTA net ve transactional

JSON array olarak don:
[{"type":"ulke adi","core":"baslik","supporting":"destek","cta":"CTA","extra":"ekstra","notes":"not"}]

SADECE JSON don.`
      }]
    },
    config: { responseMimeType: 'application/json' }
  });

  try {
    const parsed = JSON.parse(response.text || '[]');
    return parsed.map((c: any, i: number) => ({
      id: `web-${Date.now()}-${i}`,
      type: c.type || 'Web Campaign',
      core: c.core || '',
      supporting: c.supporting || '',
      cta: c.cta || 'Get eSIM',
      extra: c.extra || '',
      notes: c.notes || '',
    }));
  } catch { return []; }
};

// ═══ PRICING CAMPAIGN AGENT — Special approach for price-focused visuals ═══
export const analyzePricingTypography = async (
  campaign: QoollineCampaign,
  brand: Brand,
): Promise<string> => {
  const ai = getAI();

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [{
        text: `Sen fiyat odakli reklam kampanyasi uzmanissin. E-ticaret ve performance marketing gorsellerinde fiyatin ON PLANDA oldugu tasarimlar yaratiyorsun.

MARKA: ${brand.name}
RENK PALETİ: ${brand.palette.map(c => `${c.name}: ${c.hex}`).join(', ')}

KAMPANYA: ${campaign.type}
- Baslik: "${campaign.core}"
- Destek: "${campaign.supporting}"
- CTA: "${campaign.cta}"
- Extra: "${campaign.extra}"

FIYAT ODAKLI TASARIM KURALLARI:
- Fiyat/indirim rakamı EN BÜYÜK eleman — görselin %40'ını kaplamalı
- Fiyat rengi dikkat çekici olmalı (marka paletinden en parlak renk)
- Currency işareti ($, €) fiyattan küçük ama yanında
- "From" / "Starting at" / "Only" gibi tetikleyici kelime fiyatın üstünde küçük
- CTA butonu urgency hissi vermeli (parlak renk, büyük)
- Ülke adı/bayrağı varsa küçük badge olarak
- Destek metin kısa, net, fiyatın altında
- Arka plan temiz — fiyat ve CTA dışında minimum eleman

KARAR VER (3-4 cümle):
1. Fiyat nasıl gösterilecek? Boyut, renk, yerleşim
2. Tetikleyici kelime ne? (From/Only/Starting at/Just)
3. CTA butonu stili — urgency hissi nasıl verilecek?
4. Genel yerleşim — fiyat nerede, CTA nerede?

SADECE talimati yaz.`
      }]
    }
  });

  return response.text || '';
};

// ═══ REVISE ORCHESTRATOR — Analyzes revision request and re-runs relevant agents ═══
export const orchestrateRevision = async (
  revisionPrompt: string,
  campaign: QoollineCampaign,
  brand: Brand,
  blueprintLayers: any[],
): Promise<string> => {
  const ai = getAI();

  // Step 1: Classify the revision request
  const classifyRes = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [{
        text: `Bu revize talebini analiz et ve hangi kategoriye girdigini belirle:

TALEP: "${revisionPrompt}"

KATEGORILER:
- typography: yazi stili, font, boyut, renk vurgusu, baslik degisikligi
- pricing: fiyat gosterimi, fiyat boyutu, indirim vurgusu
- layout: yerlestirme, pozisyon, hizalama degisikligi
- color: renk degisikligi, arka plan, marka renkleri
- content: metin icerigi degisikligi, farkli kelimeler
- general: genel revize, birden fazla kategori

Sadece kategori adini yaz, baska bir sey yazma.`
      }]
    }
  });

  const category = (classifyRes.text || 'general').trim().toLowerCase();

  // Step 2: Re-run relevant agent based on category
  let agentDirective = '';

  if (category.includes('typography') || category.includes('font') || category.includes('yazi')) {
    agentDirective = await analyzeTypography(campaign, brand, blueprintLayers);
    agentDirective = `YENI TIPOGRAFI KARARI:\n${agentDirective}`;
  } else if (category.includes('pricing') || category.includes('fiyat')) {
    agentDirective = await analyzePricingTypography(campaign, brand);
    agentDirective = `YENI FIYAT YERLESIMI:\n${agentDirective}`;
  } else if (category.includes('typography') && category.includes('pricing')) {
    const [typo, pricing] = await Promise.all([
      analyzeTypography(campaign, brand, blueprintLayers),
      analyzePricingTypography(campaign, brand),
    ]);
    agentDirective = `YENI TIPOGRAFI:\n${typo}\n\nYENI FIYAT:\n${pricing}`;
  }

  // Step 3: Combine user request + agent directive
  const enhancedPrompt = agentDirective
    ? `${revisionPrompt}\n\n${agentDirective}`
    : revisionPrompt;

  return enhancedPrompt;
};

// ═══ PEXELS IMAGE SEARCH — Free stock photo API ═══
const PEXELS_KEY = 'mZfqRoctg93r2Du147oojllm97yGK6lXuwCVZTUKrxITlTPlR7qPeJ2Y';

export const searchPexelsImages = async (
  query: string,
  count: number = 5,
): Promise<{ url: string; photographer: string; src: string }[]> => {
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`, {
    headers: { 'Authorization': PEXELS_KEY },
  });
  const data = await res.json();
  return (data.photos || []).map((p: any) => ({
    url: p.url,
    photographer: p.photographer,
    src: p.src?.large || p.src?.medium || p.src?.original,
  }));
};

// Download image from URL to base64
export const downloadImageAsBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

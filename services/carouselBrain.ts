// ═══════════════════════════════════════════════════════════════════
// Carousel Brain — AI generates CONTENT ONLY (no images)
// Texts, icon selections, narrative arc, color strategy
// ═══════════════════════════════════════════════════════════════════

import { GoogleGenAI, Type } from "@google/genai";
import { Brand, CarouselType, CarouselContentPlan } from '../types';
import { getApiKey } from './geminiService';

function getAI(): GoogleGenAI {
  const key = getApiKey();
  if (!key) throw new Error('API_KEY_MISSING');
  return new GoogleGenAI({ apiKey: key });
}

// ── Carousel Type Labels ──
const TYPE_LABELS: Record<CarouselType, string> = {
  'campaign': 'Kampanya / İndirim',
  'product-launch': 'Ürün Lansmanı',
  'educational': 'Eğitici / Bilgilendirici',
  'announcement': 'Duyuru',
  'congratulations': 'Tebrik / Kutlama',
  'brand-story': 'Marka Hikayesi',
  'tips-tricks': 'İpuçları / Liste',
  'before-after': 'Önce-Sonra / Karşılaştırma',
  'testimonial': 'Müşteri Yorumu',
  'event': 'Etkinlik / Davet',
  'motivation': 'Motivasyon / İlham',
  'custom': 'Serbest',
};

// ═══════════════════════════════════════════════════
// Generate Full Carousel Content Plan
// ═══════════════════════════════════════════════════

export interface CarouselSlideContent {
  slideIndex: number;
  headline: string;
  bodyText: string;
  ctaText?: string;
  iconEmoji: string;           // Emoji for the slide's visual
  narrativeRole: string;
  visualDirection: string;
}

export interface CarouselBrainOutput {
  theme: string;
  categoryLabel: string;        // Badge text (e.g. "EĞİTİM", "KAMPANYA")
  slides: CarouselSlideContent[];
  colorFlow: string;
  visualThread: string;
}

export async function generateCarouselBrainContent(
  brand: Brand,
  topic: string,
  slideCount: number,
  carouselType: CarouselType,
  creativeTone?: string
): Promise<CarouselBrainOutput> {
  const ai = getAI();
  const isEnglish = brand.outputLanguage === 'en';
  const typeLabel = TYPE_LABELS[carouselType];

  const prompt = `
    Sen dünyanın en iyi sosyal medya kreatif direktörüsün. Instagram carousel tasarımında uzmanlaşmışsın.

    GÖREV: ${slideCount} slide'lık bir carousel için YALIN İÇERİK PLANI oluştur.
    Sen sadece METİN ve İÇERİK üreteceksin — görsel üretimi ayrıca yapılacak.

    ═══════════════════════════════════════════════════════════
    MARKA
    ═══════════════════════════════════════════════════════════
    İsim: ${brand.name}
    Sektör: ${brand.industry}
    ${brand.description ? `Açıklama: ${brand.description}` : ''}
    Ton: ${brand.tone}
    ${brand.slogans?.length ? `Sloganlar: ${brand.slogans.join(' | ')}` : ''}
    ${brand.instagram ? `Instagram: @${brand.instagram}` : ''}
    ${brand.phone ? `Telefon: ${brand.phone}` : ''}
    ${brand.website ? `Website: ${brand.website}` : ''}

    ═══════════════════════════════════════════════════════════
    CAROUSEL DETAYLARI
    ═══════════════════════════════════════════════════════════
    Konu: ${topic}
    Tip: ${typeLabel}
    Slide Sayısı: ${slideCount}
    ${creativeTone ? `Kreatif Yaklaşım: ${creativeTone}` : ''}

    ═══════════════════════════════════════════════════════════
    ANLATIM YAPISI KURALLARI
    ═══════════════════════════════════════════════════════════

    Slide 1 (HOOK — dikkat çekici açılış):
    - Max 3-6 kelime başlık
    - Merak uyandıran, kaydırmaya zorlayan
    - Rakam + Fayda: "5 Hata", "3 Adımda" gibi
    - Body: kısa teaser (max 10 kelime)

    Slide 2 (BAĞLAM — problem/neden):
    - Neden bu konu önemli?
    - Okuyucuyu konuya bağla
    - Empati kur

    Slide 3 - ${slideCount - 2} (DEĞER — asıl içerik):
    - Her slide'da TEK BİR MADDE
    - Başlık: kısa, vurucu (max 8 kelime)
    - Body: açıklama (max 25 kelime)
    - Her slide bir öncekinin devamı

    Slide ${slideCount - 1} (ÖZET — varsa):
    - Tüm maddelerin kısa tekrarı
    - "Özetle..." tarzı kapanış

    Slide ${slideCount} (CTA — aksiyon):
    - Net tek CTA: "Kaydet", "Paylaş", "Takip Et"
    - Marka bilgileri (Instagram, telefon, website)
    - Güçlü kapanış cümlesi

    ═══════════════════════════════════════════════════════════
    HER SLIDE İÇİN ÜRETECEKLERİN
    ═══════════════════════════════════════════════════════════
    - headline: Kısa, vurucu başlık (max 8 kelime)
    - bodyText: Açıklama (max 30 kelime)
    - ctaText: CTA metni (sadece son slide'da gerekli)
    - iconEmoji: Bu slide'ın konusunu temsil eden TEK emoji
    - narrativeRole: 'hook' | 'context' | 'value' | 'summary' | 'cta'
    - visualDirection: Slide'ın görsel yönlendirmesi (ikon tarzı, renk vurgusu)

    ═══════════════════════════════════════════════════════════
    EK ÇIKTILAR
    ═══════════════════════════════════════════════════════════
    - theme: Carousel'in genel teması (1 cümle)
    - categoryLabel: Sağ üst badge metni (max 12 karakter, BÜYÜK HARF)
      Örnekler: "EĞİTİM", "KAMPANYA", "YENİ ÜRÜN", "İPUÇLARI", "DUYURU"
    - colorFlow: Renklerin slide'lar arasında nasıl akacağı
    - visualThread: Tüm slide'ları birbirine bağlayan görsel ipucu

    DİL: ${isEnglish ? 'İNGİLİZCE — tüm metinler İngilizce' : 'TÜRKÇE — tüm metinler Türkçe'}

    KRİTİK: Klişe ifadelerden kaçın. Özgün, akılda kalıcı, marka tonuna uygun ol.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          categoryLabel: { type: Type.STRING },
          colorFlow: { type: Type.STRING },
          visualThread: { type: Type.STRING },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                slideIndex: { type: Type.INTEGER },
                headline: { type: Type.STRING },
                bodyText: { type: Type.STRING },
                ctaText: { type: Type.STRING },
                iconEmoji: { type: Type.STRING },
                narrativeRole: { type: Type.STRING },
                visualDirection: { type: Type.STRING },
              },
              required: ['slideIndex', 'headline', 'bodyText', 'iconEmoji', 'narrativeRole', 'visualDirection'],
            },
          },
        },
        required: ['theme', 'categoryLabel', 'slides', 'colorFlow', 'visualThread'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Carousel içerik planı oluşturulamadı.');
  return JSON.parse(text) as CarouselBrainOutput;
}

// ═══════════════════════════════════════════════════
// Generate Topic Suggestions
// ═══════════════════════════════════════════════════

export async function generateCarouselTopicSuggestions(
  brand: Brand,
  carouselType: CarouselType,
  count: number = 5
): Promise<string[]> {
  const ai = getAI();
  const isEnglish = brand.outputLanguage === 'en';
  const typeLabel = TYPE_LABELS[carouselType];

  const prompt = `
    ${brand.name} markası (${brand.industry}) için ${typeLabel} tipinde ${count} adet carousel konusu öner.
    Marka tonu: ${brand.tone}
    ${brand.description || ''}

    Kurallar:
    1. Her konu carousel formatına uygun (adım adım anlatılabilir)
    2. Somut ve spesifik ol
    3. Marka sektörüne özgü
    4. 1-2 cümle
    DİL: ${isEnglish ? 'İNGİLİZCE' : 'TÜRKÇE'}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topics: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['topics'],
      },
    },
  });

  const text = response.text;
  if (!text) return [];
  return (JSON.parse(text).topics || []).slice(0, count);
}

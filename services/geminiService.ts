
import { GoogleGenAI, Type } from "@google/genai";
import { Brand, StyleAnalysis, DesignBlueprint, BlueprintLayer, BrandAsset, BrandPricing } from "../types";

// Content plan: AI-generated text AND visual replacements for each layer
export interface ContentPlan {
  layerContents: {
    layerId: string;
    originalContent: string;
    newContent: string;
    reasoning: string;
  }[];
  // Visual object replacements for image/icon/illustration layers
  visualReplacements: {
    layerId: string;
    originalDescription: string;  // "a clock on a desk"
    newDescription: string;       // "a brain with lightning bolts"
    reasoning: string;            // "topic is about mental focus"
  }[];
  headline: string;
  subheadline: string;
  ctaText: string;
  brandMessage: string;
}

// ═══ API Key Management ═══
// Key stored in localStorage (persists) — user enters via UI modal
// Never bundled into build, never sent to our servers
const API_KEY_STORAGE = 'lumina_gemini_api_key';

export function getApiKey(): string {
  // User-provided key from localStorage
  try { return localStorage.getItem(API_KEY_STORAGE) || ''; } catch { return ''; }
}

export function setApiKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return;
  try { localStorage.setItem(API_KEY_STORAGE, trimmed); } catch {}
}

export function clearApiKey() {
  try { localStorage.removeItem(API_KEY_STORAGE); } catch {}
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export function getMaskedApiKey(): string {
  const key = getApiKey();
  if (key.length < 8) return key ? '****' : '';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

function getAI(): GoogleGenAI {
  const key = getApiKey();
  if (!key) throw new Error('API_KEY_MISSING');
  return new GoogleGenAI({ apiKey: key });
}

// Helper to convert file to base64 for API
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to resize image for storage optimization (Max 500px)
export const resizeImageToRawBase64 = (file: File, maxWidth: number = 500): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
             height = Math.round((height * maxWidth) / width);
             width = maxWidth;
          } else {
             width = Math.round((width * maxWidth) / height);
             height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
           reject(new Error("Canvas context not available"));
           return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Get data url
        const dataUrl = canvas.toDataURL('image/png');
        // Return raw base64 (remove prefix)
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      if (e.target && typeof e.target.result === 'string') {
          img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  });
};

// 1. Analyze Style (Gemini 3 Pro)
export const analyzeImageStyle = async (imageBase64: string): Promise<StyleAnalysis> => {
  const ai = getAI();
  
  const prompt = `
    Sen ödüllü bir sanat yönetmenisin ve teknik görsel analistisin. Bu görseli REPLİKA üretimi için analiz et.
    
    ÇOK ÖNEMLİ DETAY: Görseldeki sadece ana objeye odaklanma. Arka plandaki "görünmez" gibi duran detayları yakalamalısın.
    Şunlara özellikle dikkat et ve raporda belirt:
    1. ARKA PLAN GRADYANLARI: Düz renk gibi görünse bile çok hafif ton geçişleri var mı?
    2. ŞEFFAF İKONLAR/DESENLER: Arka planda opacity (saydamlık) değeri düşürülmüş geometrik şekiller, ikonlar, logolar veya watermark benzeri desenler var mı?
    3. FLU ŞEKİLLER: Arka planda bokeh efekti veya blur verilmiş renkli ışık hüzmeleri var mı?

    Aşağıdaki JSON formatında teknik bir analiz çıkar.
    
    Analiz Kriterleri:
    - composition: Görselin yerleşimi, ızgara yapısı.
    - lighting: Işık kaynağı, gölgeler.
    - colorPaletteDescription: Renk atmosferi.
    - mood: Duygu.
    - textureDetails: Materyal detayları.
    - cameraAngle: Kamera açısı.
    - artisticStyle: Sanatsal akım.
    - backgroundDetails: (KRİTİK) Arka plandaki şeffaf öğeler, gradyanlar, desenler, dokular ve flu şekillerin detaylı tarifi.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          composition: { type: Type.STRING },
          lighting: { type: Type.STRING },
          colorPaletteDescription: { type: Type.STRING },
          mood: { type: Type.STRING },
          textureDetails: { type: Type.STRING },
          cameraAngle: { type: Type.STRING },
          artisticStyle: { type: Type.STRING },
          backgroundDetails: { type: Type.STRING },
        },
        required: ['composition', 'lighting', 'colorPaletteDescription', 'mood', 'textureDetails', 'cameraAngle', 'artisticStyle', 'backgroundDetails']
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Analiz yapılamadı.");
  return JSON.parse(text) as StyleAnalysis;
};

// ══════════════════════════════════════════════════════════════
// 1.1 Blueprint Decomposition — Full JSON breakdown of reference
// ══════════════════════════════════════════════════════════════
export const decomposeToBlueprint = async (imageBase64: string): Promise<DesignBlueprint> => {
  const ai = getAI();

  const prompt = `
    Sen dünyanın en deneyimli UI/UX tasarımcısı ve grafik tasarım mühendisisin.
    Bu görseli bir tasarım programındaki (Figma/Photoshop) gibi KATMAN KATMAN, PİKSEL PİKSEL
    JSON formatında ayrıştır.

    GÖREV: Görseli tersine mühendislik ile tam bir "Design Blueprint" JSON'a dönüştür.
    Bu blueprint ile başka bir AI, görselin BİREBİR AYNISINI farklı içerikle üretebilmeli.

    HER KATMANI TESPİT ET:
    1. ARKA PLAN: Düz renk mi, gradient mı, doku mu? Tam hex kodları ve yön.
    2. METİNLER: Her metin bloğu ayrı katman. İçerik, font stili, boyut, ağırlık, renk, konum.
    3. GÖRSELLER/FOTOĞRAFLAR: Ana görsel, ikon, illüstrasyon — her biri ayrı katman.
    4. ŞEKİLLER: Dikdörtgen, daire, çizgi — her dekoratif öğe ayrı.
    5. LOGO: Varsa konumu ve boyutu.
    6. OVERLAY/EFEKTLER: Şeffaf katmanlar, blur, gölge.
    7. DEKORASYON: Şeffaf ikonlar, watermark desenler, geometrik süsler.

    POZİSYONLAR: Yüzde olarak ver (sol üst köşe = "0%", "0%").
    "center" gibi anahtar kelimeler de kullanabilirsin.

    BOYUTLAR: Canvas genişliğinin yüzdesi olarak ver.

    KRİTİK:
    - Boş alan bırakma — gördüğün HER öğeyi bir katman olarak listele
    - Metinlerin TAM İÇERİĞİNİ yaz (kısaltma)
    - Renkleri HEX kod olarak ver
    - Katmanları z-index sırasıyla alt'tan üst'e sırala
    - Her format için (kare, dikey, yatay, story) yerleşimin nasıl değişeceğini belirt
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          canvas: {
            type: Type.OBJECT,
            properties: {
              aspectRatio: { type: Type.STRING },
              backgroundColor: { type: Type.STRING },
              backgroundGradient: { type: Type.STRING },
              backgroundTexture: { type: Type.STRING },
              mood: { type: Type.STRING },
              style: { type: Type.STRING },
            },
            required: ['aspectRatio', 'backgroundColor', 'mood', 'style'],
          },
          layout: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              alignment: { type: Type.STRING },
              padding: { type: Type.STRING },
              gutterSize: { type: Type.STRING },
              visualFlow: { type: Type.STRING },
            },
            required: ['type', 'alignment', 'padding', 'visualFlow'],
          },
          layers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                content: { type: Type.STRING },
                position: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.STRING },
                    y: { type: Type.STRING },
                    anchor: { type: Type.STRING },
                  },
                  required: ['x', 'y', 'anchor'],
                },
                size: {
                  type: Type.OBJECT,
                  properties: {
                    width: { type: Type.STRING },
                    height: { type: Type.STRING },
                  },
                  required: ['width', 'height'],
                },
                style: {
                  type: Type.OBJECT,
                  properties: {
                    fontFamily: { type: Type.STRING },
                    fontSize: { type: Type.STRING },
                    fontWeight: { type: Type.STRING },
                    textAlign: { type: Type.STRING },
                    lineHeight: { type: Type.STRING },
                    letterSpacing: { type: Type.STRING },
                    textTransform: { type: Type.STRING },
                    color: { type: Type.STRING },
                    backgroundColor: { type: Type.STRING },
                    borderRadius: { type: Type.STRING },
                    opacity: { type: Type.STRING },
                    shadow: { type: Type.STRING },
                    gradient: { type: Type.STRING },
                    blur: { type: Type.STRING },
                  },
                  required: ['color'],
                },
                zIndex: { type: Type.INTEGER },
                rotation: { type: Type.STRING },
                effects: { type: Type.STRING },
              },
              required: ['id', 'type', 'content', 'position', 'size', 'style', 'zIndex'],
            },
          },
          typography: {
            type: Type.OBJECT,
            properties: {
              headingStyle: { type: Type.STRING },
              bodyStyle: { type: Type.STRING },
              accentStyle: { type: Type.STRING },
              hierarchy: { type: Type.STRING },
            },
            required: ['headingStyle', 'bodyStyle', 'hierarchy'],
          },
          colorSystem: {
            type: Type.OBJECT,
            properties: {
              dominant: { type: Type.STRING },
              secondary: { type: Type.STRING },
              accent: { type: Type.STRING },
              textPrimary: { type: Type.STRING },
              textSecondary: { type: Type.STRING },
              distribution: { type: Type.STRING },
            },
            required: ['dominant', 'secondary', 'accent', 'textPrimary', 'textSecondary'],
          },
          compositionNotes: { type: Type.STRING },
          formatAdjustments: {
            type: Type.OBJECT,
            properties: {
              square: { type: Type.STRING },
              portrait: { type: Type.STRING },
              story: { type: Type.STRING },
              landscape: { type: Type.STRING },
            },
          },
        },
        required: ['canvas', 'layout', 'layers', 'typography', 'colorSystem', 'compositionNotes'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Blueprint oluşturulamadı.");
  return JSON.parse(text) as DesignBlueprint;
};

// ══════════════════════════════════════════════════════════════
// 1.2 Reconstruct from Blueprint — Generate image from JSON blueprint
//     Now accepts ContentPlan + full DesignDirectives
// ══════════════════════════════════════════════════════════════
export const reconstructFromBlueprint = async (
  blueprint: DesignBlueprint,
  brand: Brand,
  topic: string,
  aspectRatio: string,
  referenceImageBase64: string | null,
  productImageBase64: string | null,
  contentPlan?: ContentPlan | null,
  directives?: DesignDirectives | null,
  assetPlan?: AssetPlanResult | null,
  carouselPrevSlideBase64?: string | null,
  mandatoryRules?: string | null,
): Promise<string> => {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) throw new Error("API_KEY_MISSING");
  }

  const ai = getAI();

  // Map brand colors to blueprint color roles
  const brandColors = brand.palette.length >= 3
    ? { dominant: brand.palette[0].hex, secondary: brand.palette[1].hex, accent: brand.palette[2].hex }
    : { dominant: brand.primaryColor, secondary: brand.secondaryColor, accent: brand.primaryColor };

  // Remap layers: replace content with AI-planned content and brand colors
  const remappedLayers = blueprint.layers.map(layer => {
    const l = { ...layer, style: { ...layer.style } };

    // Inject content plan into text layers
    if (contentPlan && (l.type === 'text' || l.type === 'logo')) {
      const planned = contentPlan.layerContents.find(c => c.layerId === l.id);
      if (planned) {
        l.content = planned.newContent;
      }
    }

    // Inject visual replacements for image/icon/decoration layers
    if (contentPlan?.visualReplacements && (l.type === 'image' || l.type === 'icon' || l.type === 'decoration')) {
      const visualPlan = contentPlan.visualReplacements.find(v => v.layerId === l.id);
      if (visualPlan) {
        l.content = visualPlan.newDescription;
      }
    }

    // Remap colors to brand palette
    if (l.type === 'background') {
      l.style.color = brandColors.dominant;
      if (l.style.gradient) {
        l.style.gradient = l.style.gradient + ` (MARKA RENKLERİYLE: ${brandColors.dominant} → ${brandColors.secondary})`;
      }
    }
    return l;
  });

  // Format-specific adjustments
  const formatKey = aspectRatio === '1:1' ? 'square' : aspectRatio === '4:5' ? 'portrait' : aspectRatio === '9:16' ? 'story' : 'landscape';
  const formatNote = blueprint.formatAdjustments?.[formatKey] || '';

  const blueprintJSON = JSON.stringify({
    canvas: { ...blueprint.canvas, backgroundColor: brandColors.dominant },
    layout: blueprint.layout,
    layers: remappedLayers,
    typography: blueprint.typography,
    colorSystem: {
      dominant: brandColors.dominant,
      secondary: brandColors.secondary,
      accent: brandColors.accent,
      textPrimary: brand.palette.find(c => c.name.toLowerCase().includes('beyaz') || c.name.toLowerCase().includes('white'))?.hex || '#FFFFFF',
      textSecondary: brandColors.secondary,
      distribution: blueprint.colorSystem.distribution,
    },
  }, null, 2);

  // Build the comprehensive prompt
  const prompt = `
    GÖREV: Aşağıdaki tasarım blueprint'ini kullanarak profesyonel bir görsel üret.
    Blueprint bir referans görselden çıkarıldı. Aynı yapıyı birebir koruyarak
    marka içeriğiyle yeniden oluştur.

    ═══════════════════════════════════════════════════════════
    MARKA KİMLİĞİ
    ═══════════════════════════════════════════════════════════
    İsim: ${brand.name}
    Sektör: ${brand.industry}
    ${brand.description ? `Açıklama: ${brand.description}` : ''}
    Ton: ${brand.tone}
    ${brand.instagram ? `Instagram: @${brand.instagram}` : ''}
    ${brand.phone ? `Telefon: ${brand.phone}` : ''}

    KONU: ${topic}
    FORMAT: ${aspectRatio}

    ═══════════════════════════════════════════════════════════
    TASARIM BLUEPRINT (BU YAPIYA BİREBİR UY)
    ═══════════════════════════════════════════════════════════
    ${blueprintJSON}

    ═══════════════════════════════════════════════════════════
    METİN İÇERİKLERİ (KESİNLİKLE BU METİNLERİ KULLAN)
    ═══════════════════════════════════════════════════════════
    ${contentPlan ? contentPlan.layerContents.map(lc =>
      `• Katman "${lc.layerId}": "${lc.newContent}"`
    ).join('\n    ') : `Konu "${topic}" için markanın tonuna uygun metin oluştur.`}
    ${contentPlan ? `
    Ana Başlık: "${contentPlan.headline}"
    Alt Başlık: "${contentPlan.subheadline}"
    CTA: "${contentPlan.ctaText}"
    Marka Mesajı: "${contentPlan.brandMessage}"` : ''}

    ${contentPlan?.visualReplacements?.length ? `
    ═══════════════════════════════════════════════════════════
    GÖRSEL DEĞİŞİMLERİ (OBJELERİ DEĞİŞTİR)
    ═══════════════════════════════════════════════════════════
    Aşağıdaki görsel katmanlardaki objeleri DEĞİŞTİR — aynı konum, boyut ve stilde ama FARKLI obje:
    ${contentPlan.visualReplacements.map(vr =>
      `• Katman "${vr.layerId}": "${vr.originalDescription}" → "${vr.newDescription}" (${vr.reasoning})`
    ).join('\n    ')}
    ÖNEMLİ: Objelerin STİLİ aynı kalmalı (aynı çizim tarzı, aynı renk tonu, aynı detay seviyesi).
    Sadece objenin KENDİSİ değişmeli.
    ` : ''}

    ═══════════════════════════════════════════════════════════
    RENK PALETİ (SADECE BU RENKLERİ KULLAN)
    ═══════════════════════════════════════════════════════════
    ${brand.palette.map(c => `• ${c.name}: ${c.hex}`).join('\n    ')}
    ${directives ? `
    Renk Dağılımı:
    ${directives.colorStrategy}` : `
    Dominant (%60): ${brandColors.dominant}
    İkincil (%30): ${brandColors.secondary}
    Vurgu (%10): ${brandColors.accent}`}

    ${mandatoryRules ? `
    ███████████████████████████████████████████████████████████
    ⚠️  ZORUNLU MARKA KURALLARI — BU KURALLAR HER ŞEYDEN ÖNCELİKLİ
    ███████████████████████████████████████████████████████████
    Aşağıdaki kurallar KESİNLİKLE uygulanmalıdır. Bu kuralları ihlal eden
    herhangi bir tasarım REDDEDİLECEKTİR. Her bir kuralı tek tek kontrol et:

    ${mandatoryRules}

    ███████████████████████████████████████████████████████████
    ` : ''}

    ═══════════════════════════════════════════════════════════
    KRİTİK KURALLAR
    ═══════════════════════════════════════════════════════════
    1. LAYOUT BİREBİR AYNI:
       - Her katmanın konumu, boyutu ve hizalaması blueprint'teki gibi
       - Metin sol'da ise sol'da kalsın, merkez ise merkez
       - Padding, margin ve boşluklar aynı oranda

    2. METİN İÇERİĞİ:
       - Yukarıdaki "METİN İÇERİKLERİ" bölümündeki metinleri KELİMESİ KELİMESİNE yaz
       - Font boyutu, ağırlığı ve stili blueprint'teki gibi
       - Metinler OKUNAKLI ve NET olmalı — bulanık veya bozuk metin YASAK
       - DİL: Tüm metinler ${brand.outputLanguage === 'en' ? 'İNGİLİZCE' : 'TÜRKÇE'} olmalı

    3. RENKLER:
       - Referans görselin orijinal renklerini KULLANMA
       - Sadece yukarıdaki marka paletini kullan
       - Arka plan, metin, buton, dekorasyon — HEPSİ marka renginde

    4. SEKTÖR UYARLAMASI:
       - Görseldeki nesneleri ${brand.industry} sektörüne uygun hale getir
       - Karakterler, nesneler, ikonlar sektöre uygun olmalı

    5. ${brand.logo ? 'LOGO: Verilen marka logosunu blueprint\'teki logo konumuna net ve okunabilir yerleştir.' : `MARKA ADI: "${brand.name}" yazısını logo konumuna estetik bir şekilde yerleştir.`}

    ${formatNote ? `6. FORMAT (${aspectRatio}): ${formatNote}` : ''}

    ${directives ? `
    ═══════════════════════════════════════════════════════════
    KREATİF DİREKTÖR TALİMATLARI (MUTLAKA UYGULA)
    ═══════════════════════════════════════════════════════════
    TİPOGRAFİ:
    ${directives.typographyRules}

    KOMPOZİSYON:
    ${directives.compositionGuide}

    HİYERARŞİ:
    ${directives.hierarchyPlan}

    GENEL DİREKTİF:
    ${directives.fullDirective}
    ` : ''}

    ${assetPlan && assetPlan.decisions.some(d => d.shouldUse) ? `
    ═══════════════════════════════════════════════════════════
    MARKA VARLIKLARİ (AŞAĞIDAKİ ASSET'LERİ GÖRSELE EKLE)
    ═══════════════════════════════════════════════════════════
    ${assetPlan.decisions.filter(d => d.shouldUse).map(d => {
      const asset = brand.assets?.find(a => a.id === d.assetId);
      return asset ? `• ${asset.name} (${asset.category}) → Konum: ${d.placement}
        Neden: ${d.reason}` : '';
    }).filter(Boolean).join('\n    ')}
    ${assetPlan.pricingToShow ? (() => {
      const plan = brand.pricing?.find(p => p.id === assetPlan.pricingToShow);
      return plan ? `
    FİYATLANDIRMA BİLGİSİ (görsele ekle):
    • Plan: ${plan.name}
    • Fiyat: ${plan.price}
    • Özellikler: ${plan.features.join(' | ')}` : '';
    })() : ''}
    ${assetPlan.sloganToUse ? `
    SLOGAN (görsele ekle): "${assetPlan.sloganToUse}"` : ''}
    Asset Stratejisi: ${assetPlan.overallStrategy}
    ` : ''}

    KALİTE: 4K, profesyonel reklam ajansı kalitesinde.

    ${carouselPrevSlideBase64 ? `
    ═══════════════════════════════════════════════════════════
    CAROUSEL TUTARLILIK (ÖNCEKİ SLIDE VERİLDİ)
    ═══════════════════════════════════════════════════════════
    Bu görselin bir carousel serisinin PARÇASI olduğunu unutma.
    Önceki slide görseli verildi. Şunlara DİKKAT ET:
    - İkon stili ve boyutu AYNI olmalı (flat icon ise flat, outlined ise outlined)
    - Sayfa numarası / slide göstergesi varsa AYNI konumda AYNI stilde devam et
    - Dekoratif elementler (çizgiler, noktalar, şekiller) AYNI stilde
    - Renk dağılımı ve tonlama UYUMLU olmalı
    - Logo konumu ve boyutu ÖNCEKİ ile AYNI
    - Genel layout grid'i UYUMLU (ama birebir aynı olmak zorunda değil)
    Bu bir SERİ — her slide farklı ama AYNI dili konuşmalı.
    ` : ''}
  `;

  const parts: any[] = [];

  // Carousel consistency: previous slide as visual reference
  if (carouselPrevSlideBase64) {
    parts.push({ text: "ÖNCEKİ CAROUSEL SLIDE (ikon stili, sayfa numarası, dekoratif elementler, logo konumu AYNI kalmalı — seri tutarlılığı):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: carouselPrevSlideBase64 } });
  }

  // Inject approved brand assets as images
  if (assetPlan) {
    const approvedAssets = assetPlan.decisions.filter(d => d.shouldUse);
    for (const decision of approvedAssets) {
      const asset = brand.assets?.find(a => a.id === decision.assetId);
      if (asset?.imageBase64) {
        parts.push({ text: `MARKA ASSET — ${asset.name} (${decision.placement} konumuna yerleştir):` });
        parts.push({ inlineData: { mimeType: 'image/png', data: asset.imageBase64 } });
      }
    }
  }

  if (referenceImageBase64) {
    parts.push({ text: "REFERANS GÖRSEL (yapı ve layout kaynağı — renkleri DEĞİL, sadece yapıyı kopyala):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: referenceImageBase64 } });
  }

  if (productImageBase64) {
    parts.push({ text: "ÜRÜN GÖRSELİ (sahneye uygun şekilde entegre et):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: productImageBase64 } });
  }

  if (brand.logo) {
    parts.push({ text: "MARKA LOGOSU (net ve okunabilir yerleştir):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: brand.logo } });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: "2K"
      }
    }
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) throw new Error("Görsel oluşturulamadı.");

  const contentParts = candidates[0].content.parts;
  const imagePart = contentParts.find((p: any) => p.inlineData);

  if (!imagePart || !imagePart.inlineData) {
    throw new Error("Yanıtta görsel verisi bulunamadı.");
  }

  return imagePart.inlineData.data;
};

// ══════════════════════════════════════════════════════════════
// 1.3 Adapt Master to Different Format — Pixel-perfect reformat
// ══════════════════════════════════════════════════════════════
export const adaptMasterToFormat = async (
  masterImageBase64: string,
  blueprint: DesignBlueprint,
  brand: Brand,
  topic: string,
  targetAspectRatio: string,
  masterAspectRatio: string,
  productImageBase64: string | null
): Promise<string> => {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) throw new Error("API_KEY_MISSING");
  }

  const ai = getAI();

  const brandColors = brand.palette.length >= 3
    ? { dominant: brand.palette[0].hex, secondary: brand.palette[1].hex, accent: brand.palette[2].hex }
    : { dominant: brand.primaryColor, secondary: brand.secondaryColor, accent: brand.primaryColor };

  const formatKey = targetAspectRatio === '1:1' ? 'square' : targetAspectRatio === '4:5' ? 'portrait' : targetAspectRatio === '9:16' ? 'story' : 'landscape';
  const formatNote = blueprint.formatAdjustments?.[formatKey] || '';

  // Build a concise layer inventory from the master so AI knows exactly what exists
  const layerInventory = blueprint.layers.map(l => {
    if (l.type === 'text') return `• [${l.type}] "${l.content}" — font: ${l.style.fontSize || 'md'} ${l.style.fontWeight || 'regular'}, color: ${l.style.color}, align: ${l.style.textAlign || 'left'}`;
    if (l.type === 'background') return `• [${l.type}] color: ${l.style.color}${l.style.gradient ? `, gradient: ${l.style.gradient}` : ''}`;
    return `• [${l.type}] "${l.content}" — pos: ${l.position.x},${l.position.y}, size: ${l.size.width}×${l.size.height}`;
  }).join('\n');

  const prompt = `
    GÖREV: Verilen MASTER görseli ${masterAspectRatio} formatından ${targetAspectRatio} formatına ADAPT ET.

    ██████████████████████████████████████████████████████████████
    ██  BU BİR YENİDEN BOYUTLANDIRMA — YENİ TASARIM DEĞİL!    ██
    ██████████████████████████████████████████████████████████████

    MASTER görseli dikkatlice incele. Şimdi TAMAMEN AYNI görseli ${targetAspectRatio} formatında üret.

    DEĞİŞMEYECEK ŞEYLERİN LİSTESİ (HİÇBİRİ DEĞİŞMEMELİ):
    ┌─────────────────────────────────────────────┐
    │ ✗ Font ailesi DEĞİŞMEZ                     │
    │ ✗ Font boyut oranları DEĞİŞMEZ             │
    │ ✗ Font ağırlığı (bold/regular) DEĞİŞMEZ    │
    │ ✗ Yazı renkleri DEĞİŞMEZ                   │
    │ ✗ Arka plan rengi/gradyanı DEĞİŞMEZ        │
    │ ✗ Metin içeriği (kelimeler) DEĞİŞMEZ       │
    │ ✗ Logo/ikon DEĞİŞMEZ                       │
    │ ✗ Görsel elementler DEĞİŞMEZ               │
    │ ✗ Dekoratif öğeler DEĞİŞMEZ                │
    │ ✗ Renk paleti DEĞİŞMEZ                     │
    │ ✗ Genel stil/mood DEĞİŞMEZ                 │
    └─────────────────────────────────────────────┘

    SADECE DEĞİŞECEK ŞEYLER:
    ┌─────────────────────────────────────────────┐
    │ ✓ Kanvas boyut oranı: ${masterAspectRatio} → ${targetAspectRatio}     │
    │ ✓ Elementlerin konumu (yeni boyuta sığması) │
    │ ✓ Boşluk/padding oranları (boyuta uyum)     │
    └─────────────────────────────────────────────┘

    MASTER GÖRSELDEKİ KATMANLAR:
    ${layerInventory}

    MARKA RENKLERİ (bunları koru):
    Dominant: ${brandColors.dominant}
    İkincil: ${brandColors.secondary}
    Vurgu: ${brandColors.accent}

    ${formatNote ? `FORMAT NOTU: ${formatNote}` : ''}

    HİZALAMA KURALLARI (${targetAspectRatio}):
    ${targetAspectRatio === '9:16' ? `
    - Dikey format — daha fazla dikey alan var
    - Elementleri dikey olarak dağıt, yatay sıkıştırma
    - Metin blokları arasında daha fazla dikey boşluk bırak
    - Ana görseli merkeze veya üst yarıya al` : ''}
    ${targetAspectRatio === '1:1' ? `
    - Kare format — dengeli dağılım
    - Merkez ağırlıklı yerleşim
    - Tüm elementler simetrik olmalı` : ''}
    ${targetAspectRatio === '4:5' ? `
    - Hafif dikey — Instagram post boyutu
    - Elementleri hafifçe dikey olarak yeniden düzenle
    - 1:1'e çok yakın, minimal değişiklik gerekli` : ''}
    ${targetAspectRatio === '16:9' ? `
    - Yatay format — daha fazla yatay alan
    - Elementleri yatay olarak dağıt
    - Metin ve görsel yan yana gelebilir` : ''}

    KONU: ${topic}

    KALİTE: 4K, profesyonel.
    TEKRAR: BU YENİ BİR TASARIM DEĞİL. MASTER İLE BİREBİR AYNI, SADECE BOYUT DEĞİŞİYOR.
  `;

  const parts: any[] = [];

  parts.push({ text: "MASTER GÖRSEL — bunu bire bir kopyala, sadece boyutu değiştir:" });
  parts.push({ inlineData: { mimeType: 'image/png', data: masterImageBase64 } });

  if (productImageBase64) {
    parts.push({ text: "ÜRÜN GÖRSELİ (master'daki ile aynı şekilde yerleştir):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: productImageBase64 } });
  }

  if (brand.logo) {
    parts.push({ text: "MARKA LOGOSU (master'daki ile aynı):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: brand.logo } });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: targetAspectRatio,
        imageSize: "2K"
      }
    }
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) throw new Error("Format adaptasyonu başarısız.");

  const contentParts = candidates[0].content.parts;
  const imagePart = contentParts.find((p: any) => p.inlineData);

  if (!imagePart || !imagePart.inlineData) {
    throw new Error("Yanıtta görsel verisi bulunamadı.");
  }

  return imagePart.inlineData.data;
};

// ══════════════════════════════════════════════════════════════
// 1.4 Content Brain — Generate smart text for every blueprint layer
// ══════════════════════════════════════════════════════════════
export const generateContentPlan = async (
  blueprint: DesignBlueprint,
  brand: Brand,
  topic: string,
  directives: DesignDirectives,
  creativeTone?: string
): Promise<ContentPlan> => {
  const ai = getAI();

  const textLayers = blueprint.layers.filter(l => l.type === 'text' || l.type === 'logo');
  const visualLayers = blueprint.layers.filter(l => l.type === 'image' || l.type === 'icon' || l.type === 'decoration');

  const layerDescriptions = textLayers.map((l, i) => {
    return `Katman ${i + 1} (ID: ${l.id}, Tip: ${l.type}):
    - Orijinal İçerik: "${l.content}"
    - Font: ${l.style.fontSize || 'md'} ${l.style.fontWeight || 'regular'}
    - Konum: ${l.position.x}, ${l.position.y}
    - Hizalama: ${l.style.textAlign || 'left'}
    - Maksimum karakter tahmini: ${l.style.fontSize === 'xl' ? '25 karakter' : l.style.fontSize === 'lg' ? '40 karakter' : l.style.fontSize === 'md' ? '60 karakter' : '80 karakter'}`;
  }).join('\n\n');

  const visualLayerDescriptions = visualLayers.map((l, i) => {
    return `Görsel Katman ${i + 1} (ID: ${l.id}, Tip: ${l.type}):
    - Orijinal İçerik/Açıklama: "${l.content}"
    - Konum: ${l.position.x}, ${l.position.y}
    - Boyut: ${l.size.width} x ${l.size.height}`;
  }).join('\n\n');

  const prompt = `
    Sen ${brand.industry} sektöründe uzmanlaşmış, ödüllü bir kreatif direktörsün.
    Aşağıdaki tasarım şablonundaki METİN ve GÖRSEL katmanları için YENİ İÇERİK belirlemen gerekiyor.

    MARKA:
    - İsim: ${brand.name}
    - Sektör: ${brand.industry}
    ${brand.description ? `- Açıklama: ${brand.description}` : ''}
    - Ton: ${brand.tone}
    ${brand.instagram ? `- Instagram: ${brand.instagram}` : ''}
    ${brand.phone ? `- Telefon: ${brand.phone}` : ''}

    KONU: "${topic}"

    TASARIM DİREKTİFLERİ:
    - Tipografi: ${directives.typographyRules}
    - Hiyerarşi: ${directives.hierarchyPlan}

    MEVCUT METİN KATMANLARI:
    ${layerDescriptions}

    ${visualLayers.length > 0 ? `
    MEVCUT GÖRSEL KATMANLAR (ikon, illüstrasyon, fotoğraf):
    ${visualLayerDescriptions}

    GÖRSEL DEĞİŞİM KURALLARI:
    - Her görsel katman için KONUYA UYGUN yeni bir görsel açıklaması yaz
    - Aynı boyut, konum ve stil kalmalı — sadece İÇERİK değişmeli
    - Örnek: Orijinal "saat" → Konu "stres yönetimi" ise → "meditasyon yapan kişi silueti"
    - Örnek: Orijinal "kitap" → Konu "teknoloji" ise → "laptop ve kod ekranı"
    - Sektöre uygun, markanın tonuyla uyumlu görseller öner
    ` : ''}

    KURALLAR:
    1. Her metin katmanı için MARKA TONUNA uygun, KONUYLA İLGİLİ yeni içerik yaz
    2. Orijinal metnin ROLÜNÜ koru:
       - Eğer orijinal bir BAŞLIK ise, yeni de BAŞLIK olsun (kısa, güçlü, dikkat çekici)
       - Eğer orijinal bir ALT BAŞLIK ise, yeni de ALT BAŞLIK olsun (açıklayıcı)
       - Eğer orijinal bir CTA ise, yeni de CTA olsun (aksiyon çağrısı)
       - Eğer bir tarih/saat ise, güncel bir bilgi yaz
       - Eğer bir iletişim bilgisi ise, markanın gerçek bilgilerini kullan
    3. KARAKTER SINIRI: Her katmanın tahmini maksimum karakter sayısını aşma
       - Çok uzun metinler tasarımı bozar
       - Başlıklar kısa ve vurucu olsun
    4. DİL: ${brand.outputLanguage === 'en' ? 'İNGİLİZCE — tüm metinler İngilizce olmalı' : 'TÜRKÇE — tüm metinler Türkçe olmalı'}
    5. LOGO katmanı varsa: Marka adını "${brand.name}" olarak yaz
    6. Klişe ifadelerden kaçın — özgün, akılda kalıcı olsun
    7. Sektöre özgü terminoloji kullan (${brand.industry})
    ${creativeTone ? `8. KREATİF YAKLAŞIM: ${creativeTone === 'kurumsal' ? 'KURUMSAL — profesyonel, güven veren dil. Resmi ama sıcak. Net ve doğrudan mesajlar.' : creativeTone === 'esprili' ? 'ESPRİLİ — şakacı, zekice mizah. Kelime oyunları, çift anlamlı ifadeler, gülümseten metinler.' : creativeTone === 'eglenceli' ? 'EĞLENCELİ — enerjik, neşeli, coşkulu. Dinamik ifadeler, ünlemler, heyecan verici dil.' : creativeTone === 'samimi' ? 'SAMİMİ — sıcak, arkadaşça, içten. "Sen" hitabı, konuşma dili, empati kuran ifadeler.' : creativeTone === 'luks' ? 'LÜX/PREMİUM — sofistike, zarif, seçkin. Minimal kelime, güçlü anlam. Az söz, çok etki.' : creativeTone === 'genc' ? 'GENÇ/DİNAMİK — trend dili, cesur ifadeler, kısa ve vurucu. Sosyal medya jargonu.' : creativeTone}. TÜM METİNLER bu yaklaşıma uygun yazılmalı.` : ''}

    Ayrıca genel bir headline, subheadline, ctaText ve brandMessage üret.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          layerContents: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                layerId: { type: Type.STRING },
                originalContent: { type: Type.STRING },
                newContent: { type: Type.STRING },
                reasoning: { type: Type.STRING },
              },
              required: ['layerId', 'originalContent', 'newContent', 'reasoning'],
            },
          },
          visualReplacements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                layerId: { type: Type.STRING },
                originalDescription: { type: Type.STRING },
                newDescription: { type: Type.STRING },
                reasoning: { type: Type.STRING },
              },
              required: ['layerId', 'originalDescription', 'newDescription', 'reasoning'],
            },
          },
          headline: { type: Type.STRING },
          subheadline: { type: Type.STRING },
          ctaText: { type: Type.STRING },
          brandMessage: { type: Type.STRING },
        },
        required: ['layerContents', 'visualReplacements', 'headline', 'subheadline', 'ctaText', 'brandMessage'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("İçerik planı oluşturulamadı.");
  return JSON.parse(text) as ContentPlan;
};

// ══════════════════════════════════════════════════════════════
// 1.6 Asset Decision Agent — decides which brand assets to use
// ══════════════════════════════════════════════════════════════
export interface AssetDecision {
  assetId: string;
  shouldUse: boolean;
  placement: string;      // Where in the design: "bottom-right", "center", "badge area"
  reason: string;         // Why use/skip this asset
}

export interface AssetPlanResult {
  decisions: AssetDecision[];
  pricingToShow: string | null;  // Which pricing plan to highlight (id or null)
  sloganToUse: string | null;    // Which slogan to use (or null)
  overallStrategy: string;       // Brief explanation of asset strategy
}

export const decideAssetUsage = async (
  brand: Brand,
  topic: string,
  blueprint: DesignBlueprint | null
): Promise<AssetPlanResult> => {
  const ai = getAI();

  const assets = brand.assets || [];
  const pricing = brand.pricing || [];
  const slogans = brand.slogans || [];

  if (assets.length === 0 && pricing.length === 0 && slogans.length === 0) {
    return { decisions: [], pricingToShow: null, sloganToUse: null, overallStrategy: 'No brand assets available.' };
  }

  const assetList = assets.map((a, i) => `Asset ${i + 1} (ID: ${a.id}):
  - Category: ${a.category}
  - Name: ${a.name}
  - Description: ${a.description}
  - Usage Rule: ${a.usageRule}`).join('\n\n');

  const pricingList = pricing.map((p, i) => `Plan ${i + 1} (ID: ${p.id}):
  - Name: ${p.name}
  - Price: ${p.price}
  - Features: ${p.features.join(', ')}
  - Highlighted: ${p.highlighted ? 'YES' : 'no'}`).join('\n\n');

  const sloganList = slogans.map((s, i) => `${i + 1}. "${s}"`).join('\n');

  const layerInfo = blueprint ? `Blueprint has ${blueprint.layers.length} layers. Layout: ${blueprint.layout.type}, Style: ${blueprint.canvas.style}` : 'No blueprint available.';

  const prompt = `
    Sen bir Kıdemli Sanat Yönetmensin. Marka kreatifi için varlık (asset) kararları veriyorsun.

    MARKA: ${brand.name} (${brand.industry})
    KONU: "${topic}"
    TASARIM BİLGİSİ: ${layerInfo}

    MEVCUT MARKA VARLIKLARI:
    ${assetList || 'Yok'}

    FİYATLANDIRMA PLANLARI:
    ${pricingList || 'Yok'}

    SLOGANLAR:
    ${sloganList || 'Yok'}

    GÖREV: Bu kreatif için hangi varlıkların, fiyat bilgilerinin ve sloganların kullanılacağına karar ver.

    KARAR KURALLARI:
    1. QR kodlar → SADECE uygulama indirme, kayıt olma veya "tara ve al" konularında kullan
    2. App Store / Play Store rozetleri → Mobil uygulama tanıtımı konularında kullan
    3. Ürün fotoğrafları → Belirli bir ürün sergilendiğinde kullan
    4. Fiyatlandırma → Teklif, plan veya karşılaştırma konularında kullan
    5. Sloganlar → Bu konunun ruh haline en uygun olanı seç
    6. Tasarımı KALABALIKLAŞTIRMA — kreatif başına maksimum 2-3 varlık
    7. Tasarım layout'unu düşün — varlıkların sığacak fiziksel alana ihtiyacı var
    8. Uygulama ikonu → Konu uygulama odaklıysa kullan
    9. Güven rozetleri → Güvenilirlik konularında kullan (yorumlar, ödüller, sertifikalar)

    Her varlık için tasarımdaki bir yerleşim alanı öner.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          decisions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                assetId: { type: Type.STRING },
                shouldUse: { type: Type.BOOLEAN },
                placement: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ['assetId', 'shouldUse', 'placement', 'reason'],
            },
          },
          pricingToShow: { type: Type.STRING },
          sloganToUse: { type: Type.STRING },
          overallStrategy: { type: Type.STRING },
        },
        required: ['decisions', 'overallStrategy'],
      },
    },
  });

  const text = response.text;
  if (!text) return { decisions: [], pricingToShow: null, sloganToUse: null, overallStrategy: 'Decision failed.' };
  return JSON.parse(text) as AssetPlanResult;
};

// 1.5 Smart Matching Logic
export const matchTopicsToStyles = async (
  topics: string[], 
  analyzedStyles: { id: string, analysis: StyleAnalysis }[]
): Promise<{ topicIndex: number, styleId: string }[]> => {
  const ai = getAI();

  // Create a summary of available styles for the prompt
  const styleDescriptions = analyzedStyles.map((s, index) => {
    return `Style ID: ${s.id} -> Mood: ${s.analysis.mood}, Composition: ${s.analysis.composition}, Style: ${s.analysis.artisticStyle}`;
  }).join('\n');

  const topicList = topics.map((t, i) => `Topic Index ${i}: "${t}"`).join('\n');

  const prompt = `
    GÖREV: Elimde bir dizi içerik konusu (Topics) ve bir dizi görsel stil analizi (Styles) var.
    Her konu için en uygun görsel stilini eşleştirmen gerekiyor.

    KURALLAR:
    1. Her 'Topic Index' için mutlaka bir 'Style ID' seçmelisin.
    2. Konunun duygusuna ve bağlamına en uygun stili seç.
    3. Eğer konu sayısı stil sayısından fazlaysa, stilleri tekrar kullanabilirsin.
    4. Sadece JSON formatında cevap ver.

    TOPICS:
    ${topicList}

    AVAILABLE STYLES:
    ${styleDescriptions}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', // Faster model is enough for matching logic
    contents: { text: prompt },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topicIndex: { type: Type.INTEGER },
            styleId: { type: Type.STRING }
          },
          required: ['topicIndex', 'styleId']
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Eşleştirme yapılamadı.");
  return JSON.parse(text);
};


// 2. Generate Image (Nano Banana Pro / Gemini 3 Pro Image)
export const generateBrandedImage = async (
  brand: Brand,
  style: StyleAnalysis,
  referenceImageBase64: string | null,
  productImageBase64: string | null,
  contextDescription: string,
  aspectRatio: string = "1:1",
  designDirective?: string
): Promise<string> => {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
           throw new Error("API_KEY_MISSING");
      }
  }

  const ai = getAI();

  // Construct color palette string from the enhanced brand profile
  let colorInstruction = "";
  if (brand.palette && brand.palette.length > 0) {
    colorInstruction = `
      KESİN RENK KURALLARI (BU KODLARI KULLAN):
      ${brand.palette.map(c => `- ${c.name}: ${c.hex}`).join('\n')}
      
      Yalnızca ve yalnızca yukarıdaki marka renk paletini kullan. Başka renkler ekleme.
    `;
  } else {
    colorInstruction = `RENKLER: ${brand.primaryColor}, ${brand.secondaryColor}`;
  }

  // --- INDUSTRY & FORMAT SPECIFIC RULES ---
  const isEducation = brand.industry.toLowerCase().includes('eğitim') || 
                      brand.industry.toLowerCase().includes('okul') || 
                      brand.industry.toLowerCase().includes('kolej') ||
                      brand.industry.toLowerCase().includes('kurs');
  
  const isStory = aspectRatio === "9:16";

  let ctaInstruction = "Eğer metin veya buton gerekiyorsa, estetik ve minimalist bir şekilde yerleştir.";
  
  if (isEducation && isStory) {
    ctaInstruction = `
      KRİTİK HİKAYE (STORY) KURALI: 
      Bu bir sosyal medya hikayesi olduğu için ASLA 'Kaydır', 'Tıkla', 'Keşfet', 'Web Sitesine Git' gibi web yönlendirme (link) CTA butonları KULLANMA.
      Bunun yerine, sadece SINAV ve BAŞARI ODAKLI MOTİVASYON butonları veya etiketleri kullan.
      
      Kullanılabilecek Örnek İfadeler:
      - "Başarabilirsin"
      - "Hedefine Odaklan"
      - "Asla Pes Etme"
      - "Gelecek Senin"
      - "Zamanı İyi Kullan"
    `;
  }

  // Sophisticated prompt instructing to ADAPT the subject matter based on industry
  const finalPrompt = `
    GÖREV: Yaratıcı bir Sanat Yönetmeni olarak hareket et. Referans görselin kompozisyonunu ve stilini al, ancak RENKLERİ ve KONUYU markanın kimliğine uyarla.

    HEDEF MARKA KİMLİĞİ:
    İsim: ${brand.name}
    Sektör: ${brand.industry}
    ${brand.description ? `Marka Açıklaması: ${brand.description}` : ''}
    Ton: ${brand.tone}
    
    ${colorInstruction}
    
    İSTENEN İÇERİK BAĞLAMI: ${contextDescription}

    REFERANS GÖRSEL ANALİZİ (Sadece Kompozisyon ve Tarz için kullan):
    Stil: ${style.artisticStyle}
    Kompozisyon: ${style.composition}
    Işık: ${style.lighting}
    Arka Plan Yapısı: ${style.backgroundDetails}
    
    *** KRİTİK ADAPTASYON TALİMATLARI ***:
    1. KONUYU DÖNÜŞTÜR: Referans görseldeki ana karakteri veya nesneyi, doğrudan kopyalamak yerine, MARKANIN SEKTÖRÜNE (${brand.industry}) uygun hale getir.
       - ÖRNEK: Eğer referans görselde "Pelerinli bir çocuk süper kahraman" varsa ve Marka "E-Sim / Teknoloji" sektöründeyse; karakteri koru ama eline kılıç yerine akıllı telefon ver, pelerinini dijital bir veri akışına dönüştür veya kostümünü fütüristik teknolojiyle güncelle.
       
    2. RENK DEVRİMİ (ÖNEMLİ): 
       - Referans görselin renklerini KULLANMA. 
       - Arka plan rengini ve genel renk atmosferini YUKARIDAKİ MARKA RENK PALETİNE göre değiştir.
       - Eğer analizde belirli bir renk (örn: "mavi arka plan") belirtilmişse bile bunu marka rengiyle (örn: "turuncu arka plan") değiştir.
       
    3. STİLİ KORU: Işıklandırma, gölgelendirme, kamera açısı ve çizim tekniği referans görselle aynı kalmalı.

    4. LOGO VE METİN: 
    ${brand.logo ? 'Referans görseldeki en uygun boş alana veya logonun olduğu yere EKLENECEK MARKA LOGOSU\'nu net bir şekilde yerleştir.' : 'Marka ismini estetik bir şekilde tasarıma yedir.'}

    5. CTA VE BUTONLAR:
    ${ctaInstruction}

    6. KALİTE: Fotoğraf gerçekçiliğinde (photorealistic) veya referansın stilinde, 4K kalite.

    ${designDirective ? `
    *** PROFESYONEL TASARIM DİREKTİFLERİ (KRİTİK - MUTLAKA UYGULA) ***
    Aşağıdaki direktifler dünya çapında ödüllü bir Kreatif Direktör tarafından hazırlandı.
    Bu kurallara harfiyen uy:

    ${designDirective}
    ` : ''}
  `;

  // Construct parts array properly handling multiple images
  const parts: any[] = [];
  
  // 1. Reference Image
  if (referenceImageBase64) {
    parts.push({ text: "REFERANS GÖRSEL (Stil, ışık ve kompozisyon kaynağı):" });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: referenceImageBase64
      }
    });
  }

  // 2. Product Image
  if (productImageBase64) {
    parts.push({ text: "EKLENECEK ÜRÜN GÖRSELİ (Bunu sahneye, sektörel bağlama uygun şekilde yerleştir):" });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: productImageBase64
      }
    });
  }

  // 3. Brand Logo
  if (brand.logo) {
    parts.push({ text: "EKLENECEK MARKA LOGOSU (Tasarımda net ve okunabilir şekilde kullan):" });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: brand.logo
      }
    });
  }

  parts.push({ text: finalPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: "2K"
      }
    }
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) throw new Error("Görsel oluşturulamadı.");
  
  const contentParts = candidates[0].content.parts;
  const imagePart = contentParts.find(p => p.inlineData);

  if (!imagePart || !imagePart.inlineData) {
     throw new Error("Yanıtta görsel verisi bulunamadı.");
  }

  return imagePart.inlineData.data;
};


// 3. Revise Generated Image
export const reviseGeneratedImage = async (
  originalImageBase64: string,
  revisionPrompt: string,
  revisionImageBase64: string | null,
  aspectRatio?: string,
  logoBase64?: string
): Promise<string> => {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
           throw new Error("API_KEY_MISSING");
      }
  }

  const ai = getAI();

  const aspectRatioInstruction = aspectRatio
    ? `\n    4. ÇIKTI BOYUT ORANI MUTLAKA ${aspectRatio} OLMALIDIR. Referans görselin boyut oranı farklı olabilir — onu sadece stil/içerik referansı olarak kullan, boyut oranını KESİNLİKLE değiştirme. Orijinal görselin ${aspectRatio} oranını koru.`
    : '';

  const logoInstruction = logoBase64
    ? `\n    5. LOGO: Görseldeki marka logosunu KESİNLİKLE orijinal haliyle koru. Logoyu yeniden çizme, yeniden yazma veya kendi hayal ettiğin bir logo koyma — verilen ORİJİNAL MARKA LOGOSU görselini aynen kullan. Tasarım diline göre sadece renk uyarlaması yapılabilir.`
    : '';

  const prompt = `
    GÖREV: Bu görseli aşağıdaki talimatlara göre REVIZE ET (DÜZENLE).

    REVİZE TALİMATI: ${revisionPrompt}

    KURALLAR:
    1. Görselin orijinal stilini, kompozisyonunu ve kalitesini KORU. Sadece talimat verilen kısımları değiştir.
    2. Eğer ek bir referans görsel verildiyse, o görseldeki ilgili değişiklikleri/stili bu görsele uygula — ama referans görselin BOYUT ORANINI ALMA, orijinal görselin boyut oranını koru.
    3. Sonuç yine yüksek kaliteli ve fotogerçekçi olmalıdır.${aspectRatioInstruction}${logoInstruction}
  `;

  const parts: any[] = [];

  // Original Generated Image (Source)
  parts.push({ text: "DÜZENLENECEK GÖRSEL:" });
  parts.push({
    inlineData: {
      mimeType: 'image/png',
      data: originalImageBase64
    }
  });

  // Optional Revision Reference Image
  if (revisionImageBase64) {
    parts.push({ text: "STİL/İÇERİK REFERANSI (sadece değişiklikleri uygula, boyut oranını KOPYALAMA):" });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: revisionImageBase64
      }
    });
  }

  // Brand logo — must be preserved as-is
  if (logoBase64) {
    parts.push({ text: "ORİJİNAL MARKA LOGOSU — bunu aynen koru, kendi logonu çizme:" });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: logoBase64
      }
    });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        imageSize: "2K",
        ...(aspectRatio ? { aspectRatio } : {})
      }
    }
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) throw new Error("Revize işlemi başarısız.");

  const contentParts = candidates[0].content.parts;
  const imagePart = contentParts.find(p => p.inlineData);

  if (!imagePart || !imagePart.inlineData) {
     throw new Error("Yanıtta görsel verisi bulunamadı.");
  }

  return imagePart.inlineData.data;
};

// ══════════════════════════════════════════════════
// 4b. Adapt revised image to different aspect ratio (for group revision consistency)
// ══════════════════════════════════════════════════
export const adaptRevisedToFormat = async (
  revisedMasterBase64: string,
  targetAspectRatio: string,
  masterAspectRatio: string,
  logoBase64?: string
): Promise<string> => {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) throw new Error("API_KEY_MISSING");
  }

  const ai = getAI();

  const prompt = `
    GÖREV: Verilen görseli ${masterAspectRatio} formatından ${targetAspectRatio} formatına ADAPT ET.

    ██████████████████████████████████████████████████████████████
    ██  BU BİR YENİDEN BOYUTLANDIRMA — YENİ TASARIM DEĞİL!    ██
    ██████████████████████████████████████████████████████████████

    Kaynak görseli dikkatlice incele. TAMAMEN AYNI görseli ${targetAspectRatio} formatında üret.

    DEĞİŞMEYECEK ŞEYLERİN LİSTESİ (HİÇBİRİ DEĞİŞMEMELİ):
    ┌─────────────────────────────────────────────┐
    │ ✗ Font ailesi DEĞİŞMEZ                     │
    │ ✗ Font boyut oranları DEĞİŞMEZ             │
    │ ✗ Font ağırlığı (bold/regular) DEĞİŞMEZ    │
    │ ✗ Yazı renkleri DEĞİŞMEZ                   │
    │ ✗ Arka plan rengi/gradyanı DEĞİŞMEZ        │
    │ ✗ Metin içeriği (kelimeler) DEĞİŞMEZ       │
    │ ✗ Logo — ORİJİNAL LOGOYU KULLAN             │
    │ ✗ Görsel elementler DEĞİŞMEZ               │
    │ ✗ Dekoratif öğeler DEĞİŞMEZ                │
    │ ✗ Renk paleti DEĞİŞMEZ                     │
    │ ✗ Genel stil/mood DEĞİŞMEZ                 │
    └─────────────────────────────────────────────┘

    SADECE DEĞİŞECEK ŞEYLER:
    ┌─────────────────────────────────────────────┐
    │ ✓ Kanvas boyut oranı: ${masterAspectRatio} → ${targetAspectRatio}     │
    │ ✓ Elementlerin konumu (yeni boyuta sığması) │
    │ ✓ Boşluk/padding oranları (boyuta uyum)     │
    └─────────────────────────────────────────────┘

    ${targetAspectRatio === '9:16' ? 'HİZALAMA: Dikey format — elementleri dikey dağıt, yatay sıkıştırma, metin blokları arası dikey boşluk.' : ''}
    ${targetAspectRatio === '1:1' ? 'HİZALAMA: Kare format — merkez ağırlıklı simetrik yerleşim.' : ''}
    ${targetAspectRatio === '4:5' ? 'HİZALAMA: Hafif dikey — Instagram post, minimal değişiklik.' : ''}
    ${targetAspectRatio === '16:9' ? 'HİZALAMA: Yatay format — elementleri yatay dağıt.' : ''}

    KALİTE: 4K, profesyonel.
    TEKRAR: BU YENİ BİR TASARIM DEĞİL. KAYNAK İLE BİREBİR AYNI, SADECE BOYUT DEĞİŞİYOR.
  `;

  const parts: any[] = [];

  parts.push({ text: "KAYNAK GÖRSEL — bunu birebir kopyala, sadece boyutu değiştir:" });
  parts.push({ inlineData: { mimeType: 'image/png', data: revisedMasterBase64 } });

  if (logoBase64) {
    parts.push({ text: "ORİJİNAL MARKA LOGOSU — bunu aynen koru, yeniden çizme:" });
    parts.push({ inlineData: { mimeType: 'image/png', data: logoBase64 } });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: targetAspectRatio,
        imageSize: "2K"
      }
    }
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) throw new Error("Format adaptasyonu başarısız.");

  const contentParts = candidates[0].content.parts;
  const imagePart = contentParts.find(p => p.inlineData);

  if (!imagePart || !imagePart.inlineData) {
    throw new Error("Yanıtta görsel verisi bulunamadı.");
  }

  return imagePart.inlineData.data;
};

// ══════════════════════════════════════════════════
// 5. Smart Scout: Generate search queries for brand
// ══════════════════════════════════════════════════
export const generateSmartSearchQueries = async (brand: Brand): Promise<string[]> => {
  const ai = getAI();

  const prompt = `
    Sen dünya çapında bir sosyal medya tasarım uzmanısın. Aşağıdaki marka için Pinterest, Google ve Dribbble'da arama yaparak en iyi sosyal medya gönderi tasarımlarını bulmak istiyorum.

    MARKA BİLGİSİ:
    - İsim: ${brand.name}
    - Sektör: ${brand.industry}
    - Açıklama: ${brand.description || 'Yok'}
    - Ton: ${brand.tone}
    - Renkler: ${brand.palette.map(c => `${c.name} (${c.hex})`).join(', ')}

    GÖREV: Bu markanın sosyal medya içeriklerinde kullanabileceği EN İYİ referans tasarımları bulmak için İngilizce arama sorguları üret.

    KURALLAR:
    1. Sektöre özel, kaliteli tasarım bulmaya odaklan
    2. Genel "social media" aramaları YAPMA - çok spesifik ol
    3. Farklı içerik türleri için sorgular üret (tanıtım, kampanya, bilgi, motivasyon, ürün)
    4. Dribbble/Behance kalitesinde tasarımları hedefle
    5. Her sorgu İngilizce olmalı
    6. 8-12 sorgu üret

    Örnek kötü sorgu: "social media post design" (çok genel)
    Örnek iyi sorgu: "esim travel promotion instagram story premium design" (spesifik)
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          queries: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          reasoning: { type: Type.STRING },
        },
        required: ['queries'],
      },
    },
  });

  const text = response.text;
  if (!text) return [];
  const parsed = JSON.parse(text);
  return parsed.queries || [];
};

// ══════════════════════════════════════════════════
// 6. Smart Scout: Score images by design quality + brand relevance
// ══════════════════════════════════════════════════
export const scoreDesignQuality = async (
  imagesBase64: string[],
  brand: Brand
): Promise<{ scores: number[]; reasons: string[] }> => {
  const ai = getAI();

  const parts: any[] = [];

  imagesBase64.forEach((img, i) => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: img } });
    parts.push({ text: `[Görsel ${i + 1}]` });
  });

  parts.push({
    text: `
    Sen profesyonel bir sanat yönetmeni ve sosyal medya tasarım uzmanısın.
    Yukarıdaki ${imagesBase64.length} görseli aşağıdaki MARKA için değerlendir.

    MARKA: ${brand.name}
    SEKTÖR: ${brand.industry}
    TON: ${brand.tone}

    HER GÖRSELİ ŞU KRİTERLERE GÖRE 0-100 ARASI PUANLA:

    1. TASARIM KALİTESİ (40 puan):
       - Profesyonel kompozisyon ve layout
       - Tipografi kalitesi
       - Renk uyumu ve kontrast
       - Görsel hiyerarşi
       - Genel estetik

    2. MARKA UYUMU (30 puan):
       - Bu sektöre uygunluk (${brand.industry})
       - Markanın tonuna yakınlık (${brand.tone})
       - Hedef kitleye hitap etme
       - Uyarlanabilirlik potansiyeli

    3. TREND & GÜNCELLIK (15 puan):
       - Modern tasarım trendlerine uyum
       - 2024-2025 sosyal medya estetiği
       - Dikkat çekicilik

    4. TEKNİK KALİTE (15 puan):
       - Çözünürlük ve netlik
       - Profesyonel üretim kalitesi
       - Stok fotoğraf DEĞİL, özgün tasarım olması

    DÜŞÜK PUAN VER: Stok fotoğraflar, düşük kaliteli tasarımlar, sektörle alakasız görseller, amatör çalışmalar.
    YÜKSEK PUAN VER: Dribbble/Behance kalitesinde, sektöre uygun, modern, ilham verici tasarımlar.
  `,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          evaluations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                imageIndex: { type: Type.NUMBER },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ['imageIndex', 'score', 'reason'],
            },
          },
        },
        required: ['evaluations'],
      },
    },
  });

  const text = response.text;
  if (!text) return { scores: imagesBase64.map(() => 50), reasons: imagesBase64.map(() => 'Değerlendirilemedi') };

  const parsed = JSON.parse(text);
  const evals = parsed.evaluations || [];

  const scores = imagesBase64.map((_, i) => {
    const ev = evals.find((e: any) => e.imageIndex === i);
    return ev?.score ?? 50;
  });
  const reasons = imagesBase64.map((_, i) => {
    const ev = evals.find((e: any) => e.imageIndex === i);
    return ev?.reason ?? '';
  });

  return { scores, reasons };
};

// ══════════════════════════════════════════════════
// 7. Pipeline: AI-powered topic generation for brand (reference-image-aware)
// ══════════════════════════════════════════════════
export const generatePipelineTopics = async (
  brand: Brand,
  count: number,
  aspectRatio: string,
  referenceImages?: { base64: string; name: string }[],
  creativeTone?: string
): Promise<string[]> => {
  const ai = getAI();

  const isEnglish = brand.outputLanguage === 'en';

  const formatMap: Record<string, string> = {
    '1:1': 'Instagram kare post',
    '4:5': 'Instagram portre post',
    '9:16': 'Instagram/TikTok Story',
    '16:9': 'YouTube thumbnail / LinkedIn banner',
  };
  const format = formatMap[aspectRatio] || 'sosyal medya gönderi';

  const today = new Date();
  const aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const currentMonth = aylar[today.getMonth()];
  const currentYear = today.getFullYear();

  const toneDescriptions: Record<string, string> = {
    'kurumsal': 'Profesyonel, güven veren, ciddi ama sıcak. Kurumsal dil, net mesajlar.',
    'esprili': 'Şakacı, zekice, mizahi. Kelime oyunları, esprili yaklaşım, dikkat çekici.',
    'eglenceli': 'Enerjik, canlı, neşeli. Dinamik ifadeler, ünlem işaretleri, coşkulu.',
    'samimi': 'Sıcak, arkadaşça, içten. Konuşma dili, "biz" ve "sen" hitabı.',
    'luks': 'Sofistike, zarif, seçkin. Minimal ifadeler, premium hissiyat, az söz çok anlam.',
    'genc': 'Trend, cesur, enerjik. Güncel jargon, kısa ve vurucu, sosyal medya dili.',
  };
  const toneGuide = creativeTone ? (toneDescriptions[creativeTone] || '') : '';

  const hasRefs = referenceImages && referenceImages.length > 0;

  const prompt = `
    Sen Cannes Lions, D&AD ve One Show ödüllü, dünyanın en iyi reklam ajanslarında çalışmış
    bir Kreatif Direktör ve Sosyal Medya Stratejistisin.

    MARKA BİLGİSİ:
    - İsim: ${brand.name}
    - Sektör: ${brand.industry}
    - Açıklama: ${brand.description || 'Belirtilmemiş'}
    - Marka Tonu: ${brand.tone}
    - Renk Paleti: ${brand.palette.map(c => `${c.name} (${c.hex})`).join(', ')}
    ${brand.instagram ? `- Instagram: @${brand.instagram}` : ''}

    TARİH: ${currentMonth} ${currentYear}
    FORMAT: ${format} (${aspectRatio})

    ${toneGuide ? `KREATİF YAKLAŞIM: ${toneGuide}
    Tüm konu önerileri bu yaklaşıma uygun olmalı.` : ''}

    ${hasRefs ? `
    KRİTİK — REFERANS GÖRSELLER YÜKLENDI:
    ${referenceImages!.length} adet referans görsel yüklendi. Bunlar replike etmek istediğimiz
    görsel stili ve layout'u gösteren TASARIM REFERANSLARI.

    HER REFERANS GÖRSELİ dikkatlice analiz et ve şu konularda uyumlu konular üret:
    1. Her referansın görsel teması/mood'u ile EŞLEŞ (yemek fotoğrafı varsa → yemekle ilgili konular)
    2. Layout yapısına UY (büyük başlık + küçük altmetin varsa → vurucu başlık fikriyle gel)
    3. Referansın estetiğini TAMAMLA (minimalist → temiz konu, cesur → enerjik konu)
    4. Birbirinden FARKLI olsunlar — her referans benzersiz konulara ilham versin
    5. Konu sayısı referanstan fazlaysa, eşit dağıt ve varyasyonlar üret
    ` : `
    Referans görsel yüklenmedi — konuları tamamen marka kimliğinden üret.
    `}

    GÖREV: Bu marka için TAM OLARAK ${count} ADET REKLAM GÖRSELİ KONUSU üret.
    Her konu bir tasarımcıya brief olarak verilecek — görsel olarak tasarlanabilir,
    somut ve spesifik olmalı.

    ÖNEMLİ KURALLAR:
    1. Her konu bir REKLAM GÖRSELİ temasıdır (poster, banner, sosyal medya görseli)
    2. SOMUT ol, soyut olma: "Yaz kampanyası" yerine "${brand.name} Yaz İndirimi — Seçili Ürünlerde %40'a Varan İndirim" yaz
    3. Her konu ${brand.industry} sektörüne özgü bir ürün/hizmet/değer önerisi içermeli
    4. Konu çeşitliliği sağla:
       - Ürün/hizmet vitrin görseli (en az 2)
       - Kampanya/indirim/teklif görseli (en az 1)
       - Motivasyonel/ilham verici paylaşım (en az 1)
       - Sezonluk/güncel etkinlik (${currentMonth} ${currentYear} için uygun)
       - Müşteri güveni/sosyal kanıt (referans, başarı hikayesi)
       - Eğitici/bilgilendirici içerik (sektör ipucu, nasıl yapılır)
    5. Her konu 1-2 cümle olsun
    6. Her konuda ana mesaj/slogan önerisi bulunsun
    7. Marka tonuna sadık kal (${brand.tone})
    8. Konular BENZERSİZ olmalı — tekrar yok
    9. Gerçek bir markanın gerçekten paylaşacağı profesyonel konular olmalı

    ÇIKTI DİLİ: ${isEnglish ? 'İngilizce — tüm konular İngilizce yazılmalı.' : 'Türkçe — tüm konular Türkçe yazılmalı.'}
  `;

  const parts: any[] = [];

  // Attach reference images if available
  if (hasRefs) {
    referenceImages!.forEach((img, i) => {
      parts.push({ text: `REFERENCE IMAGE ${i + 1} (${img.name}):` });
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: img.base64 } });
    });
  }

  parts.push({ text: prompt });

  const contents = hasRefs ? { parts } : { text: prompt };

  const response = await ai.models.generateContent({
    model: hasRefs ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['topics'],
      },
    },
  });

  const text = response.text;
  if (!text) return [];
  const parsed = JSON.parse(text);
  return (parsed.topics || []).slice(0, count);
};

// ══════════════════════════════════════════════════
// 8. Design Directives Agent - Pre-generation quality boost
// Generates detailed design instructions BEFORE image generation
// ══════════════════════════════════════════════════
export interface DesignDirectives {
  typographyRules: string;
  colorStrategy: string;
  compositionGuide: string;
  hierarchyPlan: string;
  fullDirective: string; // Combined directive to inject into generation prompt
}

export const generateDesignDirectives = async (
  brand: Brand,
  topic: string,
  style: StyleAnalysis,
  aspectRatio: string,
  creativeTone?: string
): Promise<DesignDirectives> => {
  const ai = getAI();

  const formatMap: Record<string, string> = {
    '1:1': 'Instagram kare post (1080x1080)',
    '4:5': 'Instagram portre post (1080x1350)',
    '9:16': 'Instagram/TikTok Story (1080x1920)',
    '16:9': 'YouTube thumbnail / LinkedIn banner (1920x1080)',
  };
  const format = formatMap[aspectRatio] || 'sosyal medya gönderi';

  const prompt = `
    Sen Cannes Lions, D&AD ve One Show ödüllü, dünyanın en iyi reklam ajanslarında çalışmış
    bir Kreatif Direktörsün. Şimdi bir AI görsel üretim modeline verilecek TASARIM DİREKTİFLERİ yazıyorsun.

    MARKA: ${brand.name}
    SEKTÖR: ${brand.industry}
    ${brand.description ? `AÇIKLAMA: ${brand.description}` : ''}
    TON: ${brand.tone}
    RENK PALETİ: ${brand.palette.map(c => `${c.name}: ${c.hex}`).join(', ')}
    ${creativeTone ? `KREATİF YAKLAŞIM: ${creativeTone === 'kurumsal' ? 'Kurumsal — profesyonel, güven veren, ciddi ama sıcak tonda' : creativeTone === 'esprili' ? 'Esprili — şakacı, zekice, mizahi, kelime oyunlarıyla dikkat çekici' : creativeTone === 'eglenceli' ? 'Eğlenceli — enerjik, canlı, neşeli, dinamik ve coşkulu' : creativeTone === 'samimi' ? 'Samimi — sıcak, arkadaşça, içten, konuşma dili' : creativeTone === 'luks' ? 'Lüks/Premium — sofistike, zarif, seçkin, minimal ifadeler' : creativeTone === 'genc' ? 'Genç/Dinamik — trend, cesur, güncel jargon, kısa ve vurucu' : creativeTone}. Tüm tasarım direktifleri bu yaklaşıma uygun olmalı.` : ''}

    KONU: ${topic}
    FORMAT: ${format} (${aspectRatio})

    REFERANS STİL:
    - Kompozisyon: ${style.composition}
    - Işık: ${style.lighting}
    - Artistik Stil: ${style.artisticStyle}
    - Arka Plan: ${style.backgroundDetails}

    Aşağıdaki 4 alan için SON DERECE SPESİFİK ve UYGULANABILIR tasarım direktifleri yaz.
    Bu direktifler doğrudan bir görsel üretim AI'ına verilecek — o yüzden "yap", "kullan", "yerleştir" gibi
    emir kipiyle yaz. Soyut tavsiye değil, somut talimat ver.

    1. TİPOGRAFİ KURALLARI:
       - Başlık fontu stili (sans-serif bold, serif elegant, vb.) ve yaklaşık boyut oranı
       - Alt metin stili ve boyut oranı
       - Metin rengi (marka paletinden spesifik hex kodu belirt)
       - Metin konumu (üst/orta/alt, sağ/sol/merkez)
       - Okunabilirlik için minimum kontrast oranı
       - Maksimum kelime sayısı (başlık: X kelime, alt metin: Y kelime)

    2. RENK STRATEJİSİ:
       - 60-30-10 kuralına göre: hangi renk %60 (dominant), %30 (ikincil), %10 (vurgu)
       - Arka plan rengi (spesifik hex)
       - Metin üzerinde kontrast sağlayacak zemin rengi
       - Gradient kullanılacaksa yönü ve renkleri
       - Hangi öğeler hangi renkte olacak

    3. KOMPOZİSYON REHBERİ:
       - Göz akış paterni (Z-pattern, F-pattern, merkezi odak, vb.)
       - Ana odak noktası nerede olmalı (üçte bir kuralı vb.)
       - Boşluk (whitespace) dengesi — kenar boşlukları yüzde olarak
       - Logo konumu ve boyutu (köşe + yaklaşık %X alan)
       - Öğelerin hizalama ekseni

    4. HİYERARŞİ PLANI:
       - Görsel hiyerarşi sırası: 1. göz çekecek öğe, 2. ana mesaj, 3. detaylar, 4. CTA/logo
       - Her öğenin relatif boyutu (en büyük → en küçük)
       - Dikkat çekici element ne olmalı (illüstrasyon, fotoğraf, tipografi, ikon?)
       - CTA butonu varsa: metin, şekil, renk, konum

    SON OLARAK: Yukarıdaki 4 bölümü tek bir akıcı paragraf halinde birleştirerek
    "fullDirective" alanına yaz. Bu paragraf doğrudan prompt'a enjekte edilecek.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          typographyRules: { type: Type.STRING },
          colorStrategy: { type: Type.STRING },
          compositionGuide: { type: Type.STRING },
          hierarchyPlan: { type: Type.STRING },
          fullDirective: { type: Type.STRING },
        },
        required: ['typographyRules', 'colorStrategy', 'compositionGuide', 'hierarchyPlan', 'fullDirective'],
      },
    },
  });

  const text = response.text;
  if (!text) {
    return {
      typographyRules: '',
      colorStrategy: '',
      compositionGuide: '',
      hierarchyPlan: '',
      fullDirective: '',
    };
  }

  return JSON.parse(text);
};

// ══════════════════════════════════════════════════════════════
// 9. CAROUSEL — AI-powered carousel planning & consistent generation
// ══════════════════════════════════════════════════════════════

import { CarouselContentPlan, CarouselType } from '../types';

// ── Carousel Type Design Intelligence ──
const CAROUSEL_TYPE_DIRECTIVES: Record<CarouselType, string> = {
  'campaign': `KAMPANYA / İNDİRİM GÖRSELİ:
    - Enerji ve aciliyet hissi veren dinamik kompozisyon
    - Patlayan renkler, radyal gradyanlar, ışık efektleri
    - İndirim yüzdeleri için büyük negatif alan bırak (metin kullanıcı ekleyecek)
    - Konfeti, yıldız, patlama efektleri uygun slide'larda
    - Ürün fotoğrafı varsa vitrin alanı ayır`,

  'product-launch': `ÜRÜN LANSMANI / TANITIM:
    - Premium, clean, minimalist arka plan
    - Ürün spot ışığı altında — dramatik aydınlatma
    - Gradyan zemin: markanın dominant renginden koyu tonuna
    - Derinlik efekti: blur, gölge, 3D hissi
    - Her slide'da ürünün farklı açısı/özelliği için alan`,

  'educational': `EĞİTİCİ / BİLGİLENDİRİCİ:
    - Temiz, organize, grid bazlı layout
    - İkon ve infografik alanları
    - Numaralı adımlar için net bölümler
    - Açık/pastel arka plan, okunabilirlik öncelikli
    - Ok ve bağlantı çizgileri ile akış hissi`,

  'announcement': `DUYURU / HABER:
    - Dikkat çekici, cesur renk kullanımı
    - Merkezi odak noktası — büyük negatif alan
    - Kurumsal ve güvenilir his
    - Dalga, çizgi gibi dinamik şekiller
    - Alt slide'larda detay için kartlar/bölümler`,

  'congratulations': `TEBRİK / KUTLAMA / BAYRAM:
    - Şenlikli, neşeli atmosfer
    - Altın/gümüş aksan detayları, parıltı efektleri
    - Konfeti, balon, yıldız gibi kutlama elementleri
    - Sıcak ve samimi renk tonları
    - Zarif çerçeveler ve süsleme motifleri`,

  'brand-story': `MARKA HİKAYESİ / HAKKIMIZDA:
    - Sinematik, geniş açı hissi
    - Film strip / timeline görsel dili
    - Duygusal renk geçişleri (sıcaktan soğuğa veya tersi)
    - Her slide farklı bir "sahne" — ama aynı film estetiği
    - Derinlik ve perspektif kullan`,

  'tips-tricks': `İPUÇLARI / LİSTELER:
    - Temiz kartlar ve bölümler
    - Her slide bir numara/tip için ayrılmış alan
    - İkon placeholder alanları (yuvarlak veya kare iç çerçeveler)
    - Tutarlı grid: her slide aynı layout yapısında
    - Geçiş elementleri (ok, çizgi, nokta) slide'lar arası`,

  'before-after': `ÖNCE-SONRA / KARŞILAŞTIRMA:
    - Bölünmüş ekran kompozisyonu (dikey veya çapraz)
    - Kontrast renk alanları (kırmızı/yeşil, koyu/açık)
    - Karşılaştırma çizgisi veya geçiş efekti
    - Her slide bir kriter/özellik karşılaştırması için
    - Net ayrım çizgileri ve ikonlar için alan`,

  'testimonial': `MÜŞTERİ YORUMLARI / SOSYAL KANIT:
    - Sıcak, güvenilir tonlarda arka plan
    - Tırnak işareti / quote grafik elementi
    - Yuvarlak profil fotoğrafı için placeholder
    - Yıldız rating için alan
    - Zarif, soft gradyanlar, kağıt/doku hissi`,

  'event': `ETKİNLİK / DAVİYE:
    - Elegance ve heyecan dengesi
    - Tarih/saat bilgisi için belirgin alan
    - Harita/lokasyon ikonu alanı
    - Premium kart hissi — çerçeve ve bordür
    - Spotlight/sahne ışığı efekti`,

  'motivation': `MOTİVASYON / İLHAM:
    - Güçlü, dramatik ışıklandırma
    - Doğa, gökyüzü, dağ gibi güçlü görsel metaforlar
    - Geniş negatif alan (büyük metin için)
    - Gradient overlay ile derinlik
    - Cesur, bold renk kullanımı`,

  'custom': `SERBEST TASARIM:
    - Markanın renk paletine sadık kal
    - Profesyonel, yüksek kaliteli arka plan
    - Metin için geniş negatif alan bırak
    - Tutarlı görsel dil tüm slide'larda`,
};

/**
 * Plans the full carousel: narrative arc, slide contents, visual consistency rules.
 */
export const planCarouselContent = async (
  brand: Brand,
  topic: string,
  slideCount: number,
  styleAnalysis: StyleAnalysis | null,
  blueprint: DesignBlueprint | null,
  creativeTone?: string,
  pastCarouselThemes?: string[]
): Promise<CarouselContentPlan> => {
  const ai = getAI();
  const isEnglish = brand.outputLanguage === 'en';

  const prompt = `
    Sen dünyanın en iyi sosyal medya kreatif direktörüsün. Instagram carousel tasarımlarında uzmanlaşmışsın.
    GÖREV: Verilen marka ve konu için ${slideCount} slide'lık bir CAROUSEL İÇERİK PLANI oluştur.

    ═══════════════════════════════════════════════════════════
    MARKA
    ═══════════════════════════════════════════════════════════
    İsim: ${brand.name}
    Sektör: ${brand.industry}
    ${brand.description ? `Açıklama: ${brand.description}` : ''}
    Ton: ${brand.tone}
    Renk Paleti: ${brand.palette.map(c => `${c.name}: ${c.hex}`).join(', ')}
    ${brand.slogans?.length ? `Sloganlar: ${brand.slogans.join(' | ')}` : ''}

    ═══════════════════════════════════════════════════════════
    KONU
    ═══════════════════════════════════════════════════════════
    ${topic}

    ${styleAnalysis ? `
    ═══════════════════════════════════════════════════════════
    REFERANS STİL
    ═══════════════════════════════════════════════════════════
    Kompozisyon: ${styleAnalysis.composition}
    Mood: ${styleAnalysis.mood}
    Artistik Stil: ${styleAnalysis.artisticStyle}
    Arka Plan: ${styleAnalysis.backgroundDetails}
    ` : ''}

    ${blueprint ? `
    BLUEPRINT STİLİ:
    Canvas: ${blueprint.canvas.style}, Mood: ${blueprint.canvas.mood}
    Layout: ${blueprint.layout.type}, Alignment: ${blueprint.layout.alignment}
    Tipografi: Heading → ${blueprint.typography.headingStyle}, Body → ${blueprint.typography.bodyStyle}
    Renkler: Dominant ${blueprint.colorSystem.dominant}, Secondary ${blueprint.colorSystem.secondary}, Accent ${blueprint.colorSystem.accent}
    ` : `
    MARKA KİTİNDEN PLANLA (referans yok):
    Marka renk paleti ve sektör bilgisine göre profesyonel carousel planı oluştur.
    `}

    ${creativeTone ? `KREATİF YAKLAŞIM: ${creativeTone}` : ''}
    ${pastCarouselThemes?.length ? `GEÇMİŞ CAROUSEL TEMALARI (bunlardan farklı ol): ${pastCarouselThemes.join(', ')}` : ''}

    ═══════════════════════════════════════════════════════════
    CAROUSEL PLANI KURALLARI
    ═══════════════════════════════════════════════════════════
    1. ANLATIM AKİŞİ (Narrative Arc):
       - Slide 1: HOOK — dikkat çekici, kaydırmaya ikna eden açılış
       - Slide 2-${slideCount - 2}: İÇERİK — problem, çözüm, özellikler, fayda, sosyal kanıt
       - Slide ${slideCount - 1}: SON — CTA (call to action) veya kapanış
       - Her slide bir öncekiyle mantıksal bağlantılı olmalı

    2. GÖRSEL TUTARLILIK:
       - Tüm slide'lar AYNI arka plan stili, AYNI renk dağılımı, AYNI tipografi kuralları
       - "colorFlow": Renklerin slide'lar arasında nasıl akacağını belirt
       - "typographyConsistency": Font kurallarını tüm slide'lar için sabit tut
       - "visualThread": Tüm slide'ları birbirine bağlayan görsel ipucu (tekrarlayan element, ikon, border, gradient vb.)

    3. HER SLIDE İÇİN:
       - headline: Kısa, vurucu (maks 6 kelime)
       - bodyText: Açıklayıcı (maks 15 kelime)
       - ctaText: Varsa CTA metni
       - visualDirection: Bu slide'da ne olmalı (ikon, ürün fotoğrafı, grafik vb.)
       - narrativeRole: 'hook' | 'problem' | 'solution' | 'feature' | 'social-proof' | 'cta'

    DİL: ${isEnglish ? 'İNGİLİZCE' : 'TÜRKÇE'}

    Çıktı JSON formatında olmalı.
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
          slideContents: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                slideOrder: { type: Type.INTEGER },
                headline: { type: Type.STRING },
                bodyText: { type: Type.STRING },
                ctaText: { type: Type.STRING },
                visualDirection: { type: Type.STRING },
                narrativeRole: { type: Type.STRING },
              },
              required: ['slideOrder', 'headline', 'bodyText', 'visualDirection', 'narrativeRole'],
            },
          },
          colorFlow: { type: Type.STRING },
          typographyConsistency: { type: Type.STRING },
          visualThread: { type: Type.STRING },
        },
        required: ['theme', 'slideContents', 'colorFlow', 'typographyConsistency', 'visualThread'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Carousel planı oluşturulamadı.');
  return JSON.parse(text) as CarouselContentPlan;
};

/**
 * Generates a single carousel slide image with full consistency context.
 */
export const generateCarouselSlide = async (
  brand: Brand,
  slideContent: CarouselContentPlan['slideContents'][0],
  carouselPlan: CarouselContentPlan,
  styleAnalysis: StyleAnalysis | null,
  blueprint: DesignBlueprint | null,
  referenceImageBase64: string | null,
  productImageBase64: string | null,
  aspectRatio: string,
  slideIndex: number,
  totalSlides: number,
  previousSlideBase64?: string | null,
  carouselType: CarouselType = 'custom'
): Promise<string> => {
  const ai = getAI();

  const brandColors = brand.palette.length >= 3
    ? { dominant: brand.palette[0].hex, secondary: brand.palette[1].hex, accent: brand.palette[2].hex }
    : { dominant: brand.primaryColor, secondary: brand.secondaryColor, accent: brand.primaryColor };

  const hasReference = !!styleAnalysis && !!blueprint;
  const typeDirective = CAROUSEL_TYPE_DIRECTIVES[carouselType] || CAROUSEL_TYPE_DIRECTIVES['custom'];
  const isFirstSlide = slideIndex === 0;
  const isLastSlide = slideIndex === totalSlides - 1;

  // ── First slide: generate the MASTER template ──
  // ── Subsequent slides: CLONE the master, only change specific content ──

  const prompt = isFirstSlide ? `
    Sen dünyanın en iyi reklam ajanslarında çalışmış senior bir sanat yönetmenisin.
    GÖREV: ${totalSlides} slide'lık bir Instagram carousel serisinin İLK SLIDE'ını (MASTER ŞABLON) tasarla.

    Bu slide, serinin tüm görsel dilini belirleyecek. Sonraki tüm slide'lar bunun BİREBİR KOPYASI olacak.

    ═══════════════════════════════════════════════════════════
    MARKA
    ═══════════════════════════════════════════════════════════
    İsim: ${brand.name}
    Sektör: ${brand.industry}
    ${brand.description ? `Açıklama: ${brand.description}` : ''}
    Ton: ${brand.tone}
    ${brand.instagram ? `Instagram: @${brand.instagram}` : ''}

    ═══════════════════════════════════════════════════════════
    CAROUSEL TİPİ
    ═══════════════════════════════════════════════════════════
    ${typeDirective}

    ═══════════════════════════════════════════════════════════
    İÇERİK (bu slide'ın metinleri)
    ═══════════════════════════════════════════════════════════
    Tema: ${carouselPlan.theme}
    Başlık: "${slideContent.headline}"
    Açıklama: "${slideContent.bodyText}"
    ${slideContent.ctaText ? `CTA: "${slideContent.ctaText}"` : ''}
    Görsel Yön: ${slideContent.visualDirection}

    ${hasReference ? `
    REFERANS STİL DNA:
    Kompozisyon: ${styleAnalysis!.composition}
    Mood: ${styleAnalysis!.mood}
    Artistik Stil: ${styleAnalysis!.artisticStyle}
    Arka Plan: ${styleAnalysis!.backgroundDetails}
    Layout: ${blueprint!.canvas.style}, ${blueprint!.layout.type}
    ` : `
    MARKA KİTİNDEN TASARLA (referans yok):
    - Dominant renk: ${brandColors.dominant}
    - İkincil renk: ${brandColors.secondary}
    - Vurgu rengi: ${brandColors.accent}
    - ${brand.industry} sektörüne özgü profesyonel tasarım
    - Modern gradyanlar, geometrik şekiller, yüksek kalite
    `}

    ═══════════════════════════════════════════════════════════
    RENK PALETİ (YALNIZCA BUNLAR)
    ═══════════════════════════════════════════════════════════
    ${brand.palette.map(c => `- ${c.name}: ${c.hex}`).join('\n    ')}

    ═══════════════════════════════════════════════════════════
    MASTER ŞABLON TASARIM KURALLARI
    ═══════════════════════════════════════════════════════════
    Bu ilk slide, serinin DNA'sını oluşturacak. Şunları MUTLAKA içermeli:

    1. SABIT LAYOUT YAPISI:
       - Sol üst: ${brand.logo ? 'Logo alanı' : `"${brand.name}" marka adı`} (küçük, zarif)
       - Sağ üst: Etiket alanı (küçük rounded badge, marka vurgu renginde)
       - Orta bölge: Ana içerik alanı (başlık + açıklama için)
       - Alt bölge: Web sitesi/instagram ve "kaydır →" alanı
       Bu layout TÜM slide'larda BİREBİR AYNI kalacak.

    2. TUTARLILIK ELEMENTLERİ:
       - Arka plan: Tek tip doku/renk/gradient (tüm slide'larda aynı)
       - Dekoratif elementler: Geometrik şekiller, çizgiler, dot pattern vb. (hep aynı)
       - İkon/illüstrasyon alanı: Orta bölgede, her slide'da farklı ikon olacak alan
       - Alt sağ köşe: Kaydır oku (→) — HER slide'da AYNI stil, AYNI konum, AYNI boyut

    3. TİPOGRAFİ:
       - Metinler NET ve OKUNABIILIR olmalı
       - Başlık: Büyük, bold, marka renginde veya siyah
       - Açıklama: Daha küçük, regular weight
       - DİL: ${brand.outputLanguage === 'en' ? 'İNGİLİZCE' : 'TÜRKÇE'}

    FORMAT: ${aspectRatio}
    KALİTE: 4K, profesyonel, yüksek çözünürlük.
  `

  // ── Subsequent slides: own blueprint but with carousel consistency ──
  : `
    Sen dünyanın en iyi reklam ajanslarında çalışmış senior bir sanat yönetmenisin.
    GÖREV: ${totalSlides} slide'lık bir carousel serisinin ${slideIndex + 1}. slide'ını üret.

    ═══════════════════════════════════════════════════════════
    MARKA
    ═══════════════════════════════════════════════════════════
    İsim: ${brand.name}
    Sektör: ${brand.industry}
    ${brand.description ? `Açıklama: ${brand.description}` : ''}
    Ton: ${brand.tone}

    ═══════════════════════════════════════════════════════════
    CAROUSEL TİPİ
    ═══════════════════════════════════════════════════════════
    ${typeDirective}

    ═══════════════════════════════════════════════════════════
    İÇERİK (bu slide'ın metinleri)
    ═══════════════════════════════════════════════════════════
    Tema: ${carouselPlan.theme}
    Slide ${slideIndex + 1}/${totalSlides} — Rolü: ${slideContent.narrativeRole}
    Başlık: "${slideContent.headline}"
    Açıklama: "${slideContent.bodyText}"
    ${slideContent.ctaText ? `CTA: "${slideContent.ctaText}"` : ''}
    Görsel Yön: ${slideContent.visualDirection}

    ${hasReference && styleAnalysis ? `
    STİL DNA (bu slide'ın kendi referansından):
    Kompozisyon: ${styleAnalysis.composition}
    Mood: ${styleAnalysis.mood}
    Artistik Stil: ${styleAnalysis.artisticStyle}
    ` : ''}

    ═══════════════════════════════════════════════════════════
    RENK PALETİ
    ═══════════════════════════════════════════════════════════
    ${brand.palette.map(c => `- ${c.name}: ${c.hex}`).join('\n    ')}

    ═══════════════════════════════════════════════════════════
    CAROUSEL SERİ TUTARLILIĞI
    ═══════════════════════════════════════════════════════════
    ${previousSlideBase64 ? `
    ÖNCEKİ SLIDE GÖRSELİ VERİLDİ. Bu bir SERİ — şunlara dikkat et:
    - İkon stili: Önceki slide'daki ikon stiliyle AYNI (flat/outlined/filled)
    - Sayfa numarası / gösterge: Varsa AYNI konumda, AYNI stilde devam et
    - Dekoratif elementler: Çizgiler, noktalar, şekiller AYNI stilde
    - Logo: AYNI konum ve boyut
    - Renk dağılımı: UYUMLU (aynı palet)
    - Genel hissiyat: Serinin devamı olduğu AÇIKÇA anlaşılmalı
    Ama bu slide'ın KENDİ referans görselinin layout'unu kullan.
    ` : 'Bu serinin ilk slide\'ı — tasarım dilini belirle.'}

    ${isLastSlide ? `
    SON SLIDE:
    - CTA odaklı kapanış
    - ${brand.instagram ? `@${brand.instagram}` : ''} ${brand.phone || ''} ${brand.website || ''}
    ` : ''}

    DİL: ${brand.outputLanguage === 'en' ? 'İNGİLİZCE' : 'TÜRKÇE'}
    FORMAT: ${aspectRatio}
    KALİTE: 4K, profesyonel, yüksek çözünürlük.
  `;

  const parts: any[] = [];

  if (!isFirstSlide && previousSlideBase64) {
    // Previous slide for CONSISTENCY reference (not cloning)
    parts.push({ text: "ÖNCEKİ CAROUSEL SLIDE (seri tutarlılığı için — ikon stili, dekorasyon, sayfa göstergesi AYNI kalmalı, ama bu slide'ın kendi layout'unu kullan):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: previousSlideBase64 } });
  }

  if (referenceImageBase64) {
    // THIS slide's own reference
    parts.push({ text: "BU SLIDE'IN REFERANS GÖRSELİ (bu görselin layout ve yapısını baz al):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: referenceImageBase64 } });
  }

  if (productImageBase64) {
    parts.push({ text: "ÜRÜN GÖRSELİ:" });
    parts.push({ inlineData: { mimeType: 'image/png', data: productImageBase64 } });
  }

  if (brand.logo) {
    parts.push({ text: "MARKA LOGOSU (her slide'da AYNI konumda, AYNI boyutta yerleştir):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: brand.logo } });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: "2K"
      }
    }
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) throw new Error(`Slide ${slideIndex + 1} oluşturulamadı.`);

  const contentParts = candidates[0].content.parts;
  const imagePart = contentParts.find((p: any) => p.inlineData);

  if (!imagePart || !imagePart.inlineData) {
    throw new Error(`Slide ${slideIndex + 1} yanıtında görsel verisi bulunamadı.`);
  }

  return imagePart.inlineData.data;
};

/**
 * Generates carousel topic suggestions for a brand.
 */
export const generateCarouselTopics = async (
  brand: Brand,
  count: number = 5,
  referenceImages?: { base64: string; name: string }[]
): Promise<string[]> => {
  const ai = getAI();
  const isEnglish = brand.outputLanguage === 'en';

  const prompt = `
    Sen sosyal medya stratejisti ve carousel uzmanısın.
    GÖREV: ${brand.name} markası için ${count} adet CAROUSEL KONUSU öner.

    MARKA:
    - İsim: ${brand.name}
    - Sektör: ${brand.industry}
    - ${brand.description || ''}
    - Ton: ${brand.tone}

    KURALLAR:
    1. Her konu bir carousel serisi (5-10 slide) için uygun olmalı
    2. Konular hikaye anlatımına uygun, adım adım açıklanabilir olmalı
    3. Çeşitlilik: eğitici, ilham verici, ürün/hizmet tanıtımı, nasıl yapılır, karşılaştırma
    4. Her konu 1-2 cümle
    5. Gerçek markaların Instagram'da paylaşacağı profesyonel konular

    DİL: ${isEnglish ? 'İNGİLİZCE' : 'TÜRKÇE'}
  `;

  const parts: any[] = [];
  if (referenceImages?.length) {
    referenceImages.forEach((img, i) => {
      parts.push({ text: `Referans ${i + 1}:` });
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: img.base64 } });
    });
  }
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: referenceImages?.length ? { parts } : { text: prompt },
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
  const parsed = JSON.parse(text);
  return (parsed.topics || []).slice(0, count);
};

// ══════════════════════════════════════════════════════════════
// 10. HYBRID CAROUSEL — Strip text, regenerate clean background
// ══════════════════════════════════════════════════════════════

export const generateCleanBackground = async (
  blueprint: DesignBlueprint,
  brand: Brand,
  referenceImageBase64: string,
  aspectRatio: string,
  topic: string,
  slideIndex: number,
  totalSlides: number,
  previousCleanBgBase64?: string | null
): Promise<string> => {
  const ai = getAI();

  const visualLayers = blueprint.layers.filter(l =>
    l.type === 'background' || l.type === 'shape' || l.type === 'decoration' ||
    l.type === 'overlay' || l.type === 'image'
  );
  const textLayers = blueprint.layers.filter(l =>
    l.type === 'text' || l.type === 'logo' || l.type === 'icon'
  );

  const bc = brand.palette.length >= 3
    ? { dominant: brand.palette[0].hex, secondary: brand.palette[1].hex, accent: brand.palette[2].hex }
    : { dominant: brand.primaryColor, secondary: brand.secondaryColor, accent: brand.primaryColor };

  const vizJSON = JSON.stringify({
    canvas: { ...blueprint.canvas, backgroundColor: bc.dominant },
    layout: blueprint.layout,
    layers: visualLayers.map(l => ({
      ...l,
      style: {
        ...l.style,
        color: l.type === 'background' ? bc.dominant : l.style.color,
        gradient: l.style.gradient ? l.style.gradient + ` (${bc.dominant} -> ${bc.secondary})` : undefined,
      },
    })),
    colorSystem: { dominant: bc.dominant, secondary: bc.secondary, accent: bc.accent },
  }, null, 2);

  const emptyAreas = textLayers.map(l =>
    `(${l.position.x},${l.position.y}) ${l.size.width}x${l.size.height}: BOS BIRAK`
  ).join('; ');

  const prompt = `
    Referans gorselin SADECE GORSEL KATMANLARINI (arka plan, sekiller, dekorasyon) yeniden uret.
    METIN alanlarini BOS BIRAK - metin programatik eklenecek.
    HICBIR METIN/YAZI/HARF/RAKAM/LOGO YAZISI URETME.

    GORSEL BLUEPRINT: ${vizJSON}
    BOS ALANLAR: ${emptyAreas}

    MARKA: ${brand.name} | RENKLER: ${brand.palette.map(c => c.hex).join(', ')}
    Dominant %60: ${bc.dominant} | Ikincil %30: ${bc.secondary} | Vurgu %10: ${bc.accent}
    Slide ${slideIndex + 1}/${totalSlides} | Konu: ${topic}
    ${previousCleanBgBase64 ? 'ONCEKI SLIDE VERILDI - ayni arka plan stili koru.' : ''}
    FORMAT: ${aspectRatio} | KALITE: 4K
  `;

  const parts: any[] = [];
  if (previousCleanBgBase64) {
    parts.push({ text: "ONCEKI SLIDE BG - ayni stili koru:" });
    parts.push({ inlineData: { mimeType: 'image/png', data: previousCleanBgBase64 } });
  }
  parts.push({ text: "REFERANS - gorsel katmanlari uret, METIN URETME:" });
  parts.push({ inlineData: { mimeType: 'image/png', data: referenceImageBase64 } });
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: { imageConfig: { aspectRatio, imageSize: "2K" } }
  });

  const candidates = response.candidates;
  if (!candidates?.[0]) throw new Error(`Temiz arka plan olusturulamadi (slide ${slideIndex + 1}).`);
  const imagePart = candidates[0].content.parts.find((p: any) => p.inlineData);
  if (!imagePart?.inlineData) throw new Error(`Slide ${slideIndex + 1} gorsel verisi bulunamadi.`);
  return imagePart.inlineData.data;
};

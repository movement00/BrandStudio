import React, { useState, useEffect, useRef } from 'react';
import {
  Layers, Upload, Sparkles, Play, ChevronLeft, ChevronRight, Download, Trash2,
  Loader2, Palette, CheckCircle2, XCircle, RotateCcw, Wand2, Plus, Image as ImageIcon
} from 'lucide-react';
import { Brand, CarouselType, PipelineImage, GeneratedAsset } from '../types';
import { fileToGenerativePart } from '../services/geminiService';
import { FONT_PAIRINGS, FontPairing, getGoogleFontsUrl } from '../services/typographySystem';
import { renderAllCarouselSlides, CarouselRenderConfig, SlideRenderInput } from '../services/canvasEngine';
import { generateCarouselBrainContent, generateCarouselTopicSuggestions, CarouselBrainOutput } from '../services/carouselBrain';
import { downloadBase64Image, downloadMultipleImages } from '../services/downloadService';

interface CarouselGeneratorProps {
  brands: Brand[];
  addToHistory: (asset: GeneratedAsset) => void;
}

const ASPECT_RATIOS = [
  { value: '4:5', label: '4:5', desc: 'Instagram Feed' },
  { value: '1:1', label: '1:1', desc: 'Kare Post' },
  { value: '9:16', label: '9:16', desc: 'Story/Reels' },
];

const SLIDE_COUNTS = [4, 5, 6, 7, 8, 10];

const CAROUSEL_TYPES: { value: CarouselType; label: string; icon: string }[] = [
  { value: 'educational', label: 'Egitici', icon: '📚' },
  { value: 'campaign', label: 'Kampanya', icon: '🔥' },
  { value: 'product-launch', label: 'Ürün', icon: '🚀' },
  { value: 'announcement', label: 'Duyuru', icon: '📢' },
  { value: 'congratulations', label: 'Kutlama', icon: '🎉' },
  { value: 'brand-story', label: 'Hikaye', icon: '📖' },
  { value: 'tips-tricks', label: 'İpuçları', icon: '💡' },
  { value: 'before-after', label: 'Karşılaştır', icon: '🔄' },
  { value: 'testimonial', label: 'Yorum', icon: '⭐' },
  { value: 'event', label: 'Etkinlik', icon: '📅' },
  { value: 'motivation', label: 'Motivasyon', icon: '💪' },
  { value: 'custom', label: 'Serbest', icon: '✨' },
];

const BG_MODES = [
  { value: 'gradient', label: 'Gradient', desc: 'Marka renklerinden' },
  { value: 'upload', label: 'Görsel Yükle', desc: 'Kendi arka planın' },
  { value: 'ai', label: 'AI Üret', desc: 'AI arka plan üretir' },
];

type BackgroundMode = 'gradient' | 'upload' | 'ai';

const CarouselGenerator: React.FC<CarouselGeneratorProps> = ({ brands, addToHistory }) => {
  // ── Config State ──
  const [brandId, setBrandId] = useState(brands[0]?.id || '');
  const [topic, setTopic] = useState('');
  const [carouselType, setCarouselType] = useState<CarouselType>('educational');
  const [aspectRatio, setAspectRatio] = useState('4:5');
  const [slideCount, setSlideCount] = useState(6);
  const [fontPairing, setFontPairing] = useState<FontPairing>(FONT_PAIRINGS[0]);
  const [bgMode, setBgMode] = useState<BackgroundMode>('gradient');
  const [bgImages, setBgImages] = useState<(string | null)[]>([]);
  const [globalBgImage, setGlobalBgImage] = useState<string | null>(null);

  // ── Generation State ──
  const [brainOutput, setBrainOutput] = useState<CarouselBrainOutput | null>(null);
  const [renderedSlides, setRenderedSlides] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [currentPreview, setCurrentPreview] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  // ── Topic Suggestions ──
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const bgGlobalInputRef = useRef<HTMLInputElement>(null);

  const brand = brands.find(b => b.id === brandId);

  // Load Google Fonts
  useEffect(() => {
    const url = getGoogleFontsUrl(fontPairing);
    let link = document.getElementById('carousel-fonts') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.id = 'carousel-fonts'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    link.href = url;
  }, [fontPairing]);

  // Auto-scroll logs
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const log = (msg: string) => setLogs(prev => [...prev, msg]);

  // ── Background Upload ──
  const handleBgUpload = async (files: FileList | null, slideIdx?: number) => {
    if (!files || files.length === 0) return;
    const base64 = await fileToGenerativePart(files[0]);
    if (slideIdx !== undefined) {
      setBgImages(prev => { const n = [...prev]; n[slideIdx] = base64; return n; });
    } else {
      setGlobalBgImage(base64);
    }
  };

  // ── Topic Suggestions ──
  const handleSuggestTopics = async () => {
    if (!brand) return;
    setIsLoadingTopics(true);
    try {
      const topics = await generateCarouselTopicSuggestions(brand, carouselType, 5);
      setSuggestedTopics(topics);
    } catch (e) { console.error(e); }
    finally { setIsLoadingTopics(false); }
  };

  // ── GENERATE CAROUSEL ──
  const handleGenerate = async () => {
    if (!brand || !topic.trim()) return;
    setIsGenerating(true);
    setRenderedSlides([]);
    setBrainOutput(null);
    setLogs([]);
    setCurrentPreview(0);

    try {
      // Step 1: AI Brain — content planning
      log('[BEYIN] İçerik planı oluşturuluyor...');
      const brain = await generateCarouselBrainContent(brand, topic.trim(), slideCount, carouselType);
      setBrainOutput(brain);
      log(`[BEYIN] Plan hazır: "${brain.theme}" — ${brain.slides.length} slide`);
      brain.slides.forEach((s, i) => {
        log(`  Slide ${i + 1}: ${s.iconEmoji} ${s.headline} (${s.narrativeRole})`);
      });

      // Step 2: Canvas Render — pixel-perfect slides
      log('[RENDER] Canvas render başlatılıyor...');
      setIsRendering(true);

      const slideInputs: SlideRenderInput[] = brain.slides.map((s, i) => ({
        slideIndex: i,
        totalSlides: brain.slides.length,
        headline: s.headline,
        bodyText: s.bodyText,
        ctaText: s.ctaText,
        iconEmoji: s.iconEmoji,
        slideNumber: String(i + 1).padStart(2, '0'),
        subtitleText: s.bodyText,
      }));

      const renderConfig: CarouselRenderConfig = {
        brand,
        fontPairing,
        aspectRatio,
        carouselType,
        categoryLabel: brain.categoryLabel,
        slides: slideInputs,
        backgroundImages: bgMode === 'upload' ? bgImages : undefined,
        globalBackgroundImage: bgMode === 'upload' ? (globalBgImage || undefined) : undefined,
      };

      const rendered = await renderAllCarouselSlides(renderConfig);
      setRenderedSlides(rendered);
      log(`[RENDER] ${rendered.length} slide render edildi!`);

      // Add to history
      rendered.forEach((base64, i) => {
        addToHistory({
          id: `carousel_${Date.now()}_${i}`,
          url: base64,
          promptUsed: `Carousel: ${topic} — Slide ${i + 1}`,
          brandId,
          createdAt: Date.now(),
        });
      });

      log('[TAMAMLANDI] Carousel hazır!');
    } catch (err: any) {
      log(`[HATA] ${err.message}`);
    } finally {
      setIsGenerating(false);
      setIsRendering(false);
    }
  };

  // ── RE-RENDER (font/bg change) ──
  const handleReRender = async () => {
    if (!brainOutput || !brand) return;
    setIsRendering(true);
    try {
      const slideInputs: SlideRenderInput[] = brainOutput.slides.map((s, i) => ({
        slideIndex: i, totalSlides: brainOutput.slides.length,
        headline: s.headline, bodyText: s.bodyText, ctaText: s.ctaText,
        iconEmoji: s.iconEmoji, slideNumber: String(i + 1).padStart(2, '0'), subtitleText: s.bodyText,
      }));

      const rendered = await renderAllCarouselSlides({
        brand, fontPairing, aspectRatio, carouselType,
        categoryLabel: brainOutput.categoryLabel, slides: slideInputs,
        backgroundImages: bgMode === 'upload' ? bgImages : undefined,
        globalBackgroundImage: bgMode === 'upload' ? (globalBgImage || undefined) : undefined,
      });
      setRenderedSlides(rendered);
    } catch (e) { console.error(e); }
    finally { setIsRendering(false); }
  };

  // ── Download All ──
  const handleDownloadAll = async () => {
    const items = renderedSlides.map((b64, i) => ({
      base64: b64, filename: `${brand?.name || 'carousel'}_slide_${i + 1}.png`,
    }));
    await downloadMultipleImages(items);
  };

  // ── Reset ──
  const handleReset = () => {
    setBrainOutput(null); setRenderedSlides([]); setTopic(''); setLogs([]);
    setSuggestedTopics([]); setBgImages([]); setGlobalBgImage(null); setCurrentPreview(0);
  };

  const canGenerate = brand && topic.trim() && !isGenerating;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-serif text-white flex items-center gap-3">
            <Layers className="text-lumina-gold" size={28} />
            Carousel Stüdyosu
          </h2>
          <p className="text-sm text-slate-400 mt-1">AI beyin + piksel-perfect canvas render</p>
        </div>
        {renderedSlides.length > 0 && (
          <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-lumina-800 text-slate-400 hover:text-white hover:bg-lumina-900 transition-all text-sm">
            <RotateCcw size={16} /> Yeni
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ LEFT: Configuration ═══ */}
        <div className="lg:col-span-1 space-y-4">

          {/* Brand */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Marka</label>
            <select value={brandId} onChange={e => setBrandId(e.target.value)} disabled={isGenerating}
              className="w-full bg-lumina-950 border border-lumina-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lumina-gold/50">
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {brand && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {brand.palette.slice(0, 5).map((c, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border border-lumina-800" style={{ backgroundColor: c.hex }} title={c.name} />
                ))}
              </div>
            )}
          </div>

          {/* Carousel Type */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Carousel Tipi</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CAROUSEL_TYPES.map(ct => (
                <button key={ct.value} onClick={() => setCarouselType(ct.value)} disabled={isGenerating}
                  className={`text-center py-1.5 rounded-lg border text-[10px] transition-all ${
                    carouselType === ct.value
                      ? 'border-lumina-gold/50 bg-lumina-gold/10 text-lumina-gold'
                      : 'border-lumina-800 text-slate-500 hover:border-lumina-gold/20'
                  }`}>
                  <span className="block text-sm">{ct.icon}</span>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 uppercase tracking-wider">Konu <span className="text-lumina-gold">*</span></label>
              <button onClick={handleSuggestTopics} disabled={isLoadingTopics || isGenerating}
                className="flex items-center gap-1 text-xs text-lumina-gold hover:text-amber-400 transition-all disabled:opacity-40">
                {isLoadingTopics ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} AI Öner
              </button>
            </div>
            <textarea value={topic} onChange={e => setTopic(e.target.value)} disabled={isGenerating}
              placeholder="Carousel konusunu yazın..." rows={3}
              className="w-full bg-lumina-950 border border-lumina-800 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-lumina-gold/50" />
            {suggestedTopics.length > 0 && (
              <div className="space-y-1 mt-2">
                {suggestedTopics.map((t, i) => (
                  <button key={i} onClick={() => { setTopic(t); setSuggestedTopics([]); }}
                    className="w-full text-left text-xs text-slate-300 bg-lumina-950 border border-lumina-800 rounded-lg px-3 py-2 hover:border-lumina-gold/40 transition-all line-clamp-2">
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4 space-y-3">
            {/* Format */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Format</label>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map(ar => (
                  <button key={ar.value} onClick={() => setAspectRatio(ar.value)} disabled={isGenerating}
                    className={`flex-1 text-center py-2 rounded-xl border text-xs transition-all ${
                      aspectRatio === ar.value ? 'border-lumina-gold/50 bg-lumina-gold/10 text-lumina-gold' : 'border-lumina-800 text-slate-400'
                    }`}>
                    {ar.label}<div className="text-[9px] opacity-60">{ar.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Slide Count */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Slide Sayısı</label>
              <div className="flex gap-2 flex-wrap">
                {SLIDE_COUNTS.map(c => (
                  <button key={c} onClick={() => setSlideCount(c)} disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      slideCount === c ? 'bg-lumina-gold/20 text-lumina-gold border border-lumina-gold/50' : 'bg-lumina-950 text-slate-400 border border-lumina-800'
                    }`}>{c}</button>
                ))}
              </div>
            </div>

            {/* Background Mode */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Arka Plan</label>
              <div className="grid grid-cols-3 gap-2">
                {BG_MODES.map(bg => (
                  <button key={bg.value} onClick={() => setBgMode(bg.value as BackgroundMode)} disabled={isGenerating}
                    className={`text-center py-2 rounded-xl border text-[10px] transition-all ${
                      bgMode === bg.value ? 'border-lumina-gold/50 bg-lumina-gold/10 text-lumina-gold' : 'border-lumina-800 text-slate-400'
                    }`}>
                    {bg.label}<div className="text-[9px] opacity-60">{bg.desc}</div>
                  </button>
                ))}
              </div>

              {bgMode === 'upload' && (
                <div className="mt-2 space-y-2">
                  <input ref={bgGlobalInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleBgUpload(e.target.files)} />
                  <button onClick={() => bgGlobalInputRef.current?.click()}
                    className="w-full border border-dashed border-lumina-800 rounded-lg py-2 text-xs text-slate-500 hover:border-lumina-gold/40 transition-all">
                    <Upload size={14} className="inline mr-1" /> {globalBgImage ? 'Arka plan yüklendi ✓' : 'Tüm slide\'lar için arka plan yükle'}
                  </button>
                  {globalBgImage && (
                    <img src={`data:image/png;base64,${globalBgImage}`} className="w-full h-20 object-cover rounded-lg border border-lumina-800" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Typography */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Tipografi</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {FONT_PAIRINGS.map(fp => (
                <button key={fp.id} onClick={() => { setFontPairing(fp); if (renderedSlides.length) handleReRender(); }} disabled={isGenerating}
                  className={`w-full text-left p-2 rounded-xl border transition-all ${
                    fontPairing.id === fp.id ? 'border-lumina-gold/50 bg-lumina-gold/5' : 'border-lumina-800 hover:border-lumina-gold/20'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white font-medium">{fp.name}</span>
                    {fontPairing.id === fp.id && <CheckCircle2 size={12} className="text-lumina-gold" />}
                  </div>
                  <span className="text-[9px] text-lumina-gold">{fp.mood}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button onClick={handleGenerate} disabled={!canGenerate}
            className={`w-full py-3.5 rounded-2xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
              canGenerate
                ? 'bg-gradient-to-r from-lumina-gold to-amber-500 text-black hover:from-amber-500 hover:to-lumina-gold'
                : 'bg-lumina-800 text-slate-500 cursor-not-allowed'
            }`}>
            {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Üretiliyor...</> : <><Sparkles size={18} /> Carousel Üret</>}
          </button>
        </div>

        {/* ═══ RIGHT: Preview & Results ═══ */}
        <div className="lg:col-span-2 space-y-4">

          {/* Content Plan Preview */}
          {brainOutput && (
            <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-lumina-gold" /> {brainOutput.theme}
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
                {brainOutput.slides.map((s, i) => (
                  <button key={i} onClick={() => setCurrentPreview(i)}
                    className={`text-left p-2 rounded-lg border transition-all ${
                      currentPreview === i ? 'border-lumina-gold/50 bg-lumina-gold/5' : 'border-lumina-800'
                    }`}>
                    <span className="text-sm">{s.iconEmoji}</span>
                    <p className="text-[10px] text-white font-medium truncate">{s.headline}</p>
                    <p className="text-[8px] text-slate-500">{s.narrativeRole}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rendered Slides Preview */}
          {renderedSlides.length > 0 ? (
            <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  Slide {currentPreview + 1} / {renderedSlides.length}
                </h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPreview(Math.max(0, currentPreview - 1))} disabled={currentPreview === 0}
                    className="p-1.5 rounded-lg border border-lumina-800 text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setCurrentPreview(Math.min(renderedSlides.length - 1, currentPreview + 1))} disabled={currentPreview >= renderedSlides.length - 1}
                    className="p-1.5 rounded-lg border border-lumina-800 text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                    <ChevronRight size={16} />
                  </button>
                  <button onClick={handleReRender} disabled={isRendering}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-lumina-800 text-slate-300 text-xs hover:bg-lumina-700 transition-all disabled:opacity-40">
                    {isRendering ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Re-render
                  </button>
                  <button onClick={handleDownloadAll}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-lumina-gold/20 text-lumina-gold text-xs hover:bg-lumina-gold/30 transition-all">
                    <Download size={14} /> Tümünü İndir
                  </button>
                </div>
              </div>

              {/* Main Preview */}
              <div className="relative rounded-xl overflow-hidden border border-lumina-800 mb-3">
                <img src={`data:image/png;base64,${renderedSlides[currentPreview]}`} className="w-full block" />
                <button onClick={() => downloadBase64Image(renderedSlides[currentPreview], `${brand?.name}_slide_${currentPreview + 1}.png`)}
                  className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-all">
                  <Download size={16} />
                </button>
              </div>

              {/* Thumbnail Strip */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {renderedSlides.map((b64, i) => (
                  <button key={i} onClick={() => setCurrentPreview(i)}
                    className={`flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      currentPreview === i ? 'border-lumina-gold' : 'border-lumina-800 hover:border-lumina-gold/30'
                    }`}>
                    <img src={`data:image/png;base64,${b64}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : !isGenerating ? (
            /* Empty State */
            <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-12 text-center">
              <Layers size={48} className="mx-auto text-lumina-800 mb-4" />
              <h3 className="text-white font-serif text-xl mb-2">Carousel Stüdyosu</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                AI içerik planlar, Canvas piksel-perfect render eder. Marka seç, tip belirle, konuyu yaz — anında profesyonel carousel.
              </p>
              <div className="grid grid-cols-4 gap-4 max-w-sm mx-auto">
                {[
                  { icon: <Palette size={20} />, label: 'Marka Seç' },
                  { icon: <Layers size={20} />, label: 'Tip Belirle' },
                  { icon: <Wand2 size={20} />, label: 'Konu Yaz' },
                  { icon: <Sparkles size={20} />, label: 'Üret' },
                ].map((s, i) => (
                  <div key={i} className="text-lumina-gold">
                    <div className="mx-auto mb-1">{s.icon}</div>
                    <p className="text-[10px] text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Generation Progress */}
          {isGenerating && (
            <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Loader2 size={16} className="text-lumina-gold animate-spin" /> Üretim Devam Ediyor
              </h3>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-lumina-950 border border-lumina-800 rounded-2xl p-4 max-h-48 overflow-y-auto">
              <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">İşlem Günlüğü</h4>
              <div className="space-y-1 font-mono text-[11px]">
                {logs.map((l, i) => (
                  <div key={i} className={
                    l.includes('[HATA]') ? 'text-red-400' :
                    l.includes('[TAMAMLANDI]') ? 'text-emerald-400' :
                    l.includes('[RENDER]') ? 'text-blue-400' :
                    l.includes('[BEYIN]') ? 'text-lumina-gold' :
                    'text-slate-500'
                  }>{l}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CarouselGenerator;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layers, Upload, Sparkles, Play, ChevronLeft, ChevronRight, Download, Trash2,
  Loader2, Image as ImageIcon, Palette, CheckCircle2, XCircle, RotateCcw,
  Wand2, Plus, FolderOpen, Clock, AlertCircle, ImagePlus, GalleryHorizontalEnd
} from 'lucide-react';
import { Brand, CarouselProject, CarouselSlide, CarouselContentPlan, PipelineImage, GeneratedAsset, SlideTextOverlay, CarouselType } from '../types';
import { fileToGenerativePart } from '../services/geminiService';
import { generateCarouselTopics } from '../services/geminiService';
import { FONT_PAIRINGS, FontPairing, getGoogleFontsUrl, SLIDE_LAYOUT_PRESETS, TYPE_SCALES } from '../services/typographySystem';
import { renderSlideWithOverlays, renderAllSlides } from '../services/canvasEngine';

// ═══════════════════════════════════════════════════
// Text Overlay Editor Sub-component
// ═══════════════════════════════════════════════════

interface TextOverlayEditorProps {
  slide: CarouselSlide;
  brand: Brand;
  fontPairing: FontPairing;
  onUpdate: (overlays: SlideTextOverlay[]) => void;
  onExport: (slideId: string) => void;
}

const TextOverlayEditor: React.FC<TextOverlayEditorProps> = ({ slide, brand, fontPairing, onUpdate, onExport }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTextPanel, setShowTextPanel] = useState(true);

  const overlays = slide.textOverlays || [];

  const updateOverlay = (id: string, changes: Partial<SlideTextOverlay>) => {
    const updated = overlays.map(o => o.id === id ? { ...o, ...changes } : o);
    onUpdate(updated);
  };

  const addOverlay = () => {
    const newOverlay: SlideTextOverlay = {
      id: `${slide.id}_custom_${Date.now()}`,
      text: 'Yeni metin',
      x: 50, y: 60,
      fontSize: 20,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
      maxWidth: 80,
    };
    onUpdate([...overlays, newOverlay]);
    setEditingId(newOverlay.id);
  };

  const removeOverlay = (id: string) => {
    onUpdate(overlays.filter(o => o.id !== id));
    if (editingId === id) setEditingId(null);
  };

  return (
    <div className="relative">
      {/* Slide with Text Overlays */}
      <div className="relative rounded-xl overflow-hidden border border-lumina-800" style={{ aspectRatio: 'auto' }}>
        {slide.imageBase64 && (
          <img
            src={`data:image/png;base64,${slide.imageBase64}`}
            className="w-full block"
            alt={`Slide ${slide.order + 1}`}
          />
        )}

        {/* Text Overlay Layers */}
        {overlays.map(overlay => (
          <div
            key={overlay.id}
            onClick={() => setEditingId(overlay.id)}
            className={`absolute cursor-pointer transition-all ${
              editingId === overlay.id ? 'ring-2 ring-lumina-gold ring-offset-1 ring-offset-transparent' : 'hover:ring-1 hover:ring-white/30'
            }`}
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              transform: 'translate(-50%, -50%)',
              maxWidth: `${overlay.maxWidth}%`,
              textAlign: overlay.textAlign,
              fontFamily: overlay.fontSize >= 36 ? fontPairing.heading.family : fontPairing.body.family,
              fontSize: `${overlay.fontSize}px`,
              fontWeight: overlay.fontWeight === 'extrabold' ? 800 : overlay.fontWeight === 'bold' ? 700 : 400,
              letterSpacing: `${overlay.fontSize >= 36 ? fontPairing.heading.letterSpacing : fontPairing.body.letterSpacing}em`,
              textTransform: (overlay.fontSize >= 36 ? fontPairing.heading.textTransform : 'none') as any,
              color: overlay.color,
              backgroundColor: overlay.bgColor ? `${overlay.bgColor}${Math.round((overlay.bgOpacity || 0) * 255).toString(16).padStart(2, '0')}` : 'transparent',
              padding: overlay.bgColor ? '6px 16px' : '0',
              borderRadius: overlay.bgColor ? '8px' : '0',
              lineHeight: overlay.fontSize >= 36 ? fontPairing.heading.lineHeight : fontPairing.body.lineHeight,
              textShadow: !overlay.bgColor ? '0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.4)' : 'none',
              userSelect: 'none',
            }}
          >
            {overlay.text}
          </div>
        ))}
      </div>

      {/* Text Controls Panel */}
      {showTextPanel && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Metin Katmanlari</span>
            <div className="flex gap-1">
              <button
                onClick={addOverlay}
                className="text-xs px-2 py-1 rounded-lg bg-lumina-gold/20 text-lumina-gold hover:bg-lumina-gold/30 transition-all flex items-center gap-1"
              >
                <Plus size={12} /> Metin Ekle
              </button>
              <button
                onClick={() => onExport(slide.id)}
                className="text-xs px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all flex items-center gap-1"
              >
                <Download size={12} /> Kaydet
              </button>
            </div>
          </div>

          {overlays.map(overlay => (
            <div
              key={overlay.id}
              className={`bg-lumina-950 border rounded-xl p-2.5 transition-all ${
                editingId === overlay.id ? 'border-lumina-gold/50' : 'border-lumina-800'
              }`}
              onClick={() => setEditingId(overlay.id)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <input
                  value={overlay.text}
                  onChange={e => updateOverlay(overlay.id, { text: e.target.value })}
                  className="flex-1 bg-transparent text-sm text-white border-none outline-none"
                  placeholder="Metin..."
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removeOverlay(overlay.id); }}
                  className="p-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {editingId === overlay.id && (
                <div className="space-y-2 pt-2 border-t border-lumina-800">
                  {/* Font Size & Weight */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 block mb-0.5">Boyut</label>
                      <input
                        type="range"
                        min="10" max="64" value={overlay.fontSize}
                        onChange={e => updateOverlay(overlay.id, { fontSize: Number(e.target.value) })}
                        className="w-full accent-lumina-gold h-1"
                      />
                      <span className="text-[10px] text-slate-500">{overlay.fontSize}px</span>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Kalinlik</label>
                      <div className="flex gap-1">
                        {(['normal', 'bold', 'extrabold'] as const).map(w => (
                          <button
                            key={w}
                            onClick={() => updateOverlay(overlay.id, { fontWeight: w })}
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              overlay.fontWeight === w ? 'bg-lumina-gold/20 text-lumina-gold' : 'text-slate-500 hover:text-white'
                            }`}
                          >
                            {w === 'normal' ? 'N' : w === 'bold' ? 'B' : 'XB'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Position */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 block mb-0.5">Yatay: {overlay.x}%</label>
                      <input
                        type="range" min="5" max="95" value={overlay.x}
                        onChange={e => updateOverlay(overlay.id, { x: Number(e.target.value) })}
                        className="w-full accent-lumina-gold h-1"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 block mb-0.5">Dikey: {overlay.y}%</label>
                      <input
                        type="range" min="5" max="95" value={overlay.y}
                        onChange={e => updateOverlay(overlay.id, { y: Number(e.target.value) })}
                        className="w-full accent-lumina-gold h-1"
                      />
                    </div>
                  </div>

                  {/* Colors */}
                  <div className="flex gap-2 items-end">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Yazi Rengi</label>
                      <div className="flex gap-1">
                        <input
                          type="color" value={overlay.color}
                          onChange={e => updateOverlay(overlay.id, { color: e.target.value })}
                          className="w-6 h-6 rounded border border-lumina-800 cursor-pointer"
                        />
                        {brand.palette.slice(0, 4).map(c => (
                          <button
                            key={c.hex}
                            onClick={() => updateOverlay(overlay.id, { color: c.hex })}
                            className="w-6 h-6 rounded border border-lumina-800 hover:border-lumina-gold/50"
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                          />
                        ))}
                        <button
                          onClick={() => updateOverlay(overlay.id, { color: '#FFFFFF' })}
                          className="w-6 h-6 rounded border border-lumina-800 bg-white hover:border-lumina-gold/50"
                          title="Beyaz"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Arka Plan</label>
                      <div className="flex gap-1 items-center">
                        <input
                          type="color" value={overlay.bgColor || '#000000'}
                          onChange={e => updateOverlay(overlay.id, { bgColor: e.target.value, bgOpacity: overlay.bgOpacity || 0.5 })}
                          className="w-6 h-6 rounded border border-lumina-800 cursor-pointer"
                        />
                        <button
                          onClick={() => updateOverlay(overlay.id, { bgColor: undefined, bgOpacity: undefined })}
                          className="text-[10px] px-1.5 py-0.5 rounded text-slate-500 hover:text-white bg-lumina-800"
                        >
                          Yok
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map(a => (
                        <button
                          key={a}
                          onClick={() => updateOverlay(overlay.id, { textAlign: a })}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            overlay.textAlign === a ? 'bg-lumina-gold/20 text-lumina-gold' : 'text-slate-500 bg-lumina-800'
                          }`}
                        >
                          {a === 'left' ? 'Sol' : a === 'center' ? 'Orta' : 'Sag'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
import { CarouselOrchestrator, CarouselEvent, loadCarouselProjects, deleteCarouselProject, loadBrandReferences } from '../services/carouselService';
import { downloadBase64Image, downloadMultipleImages } from '../services/downloadService';

interface CarouselGeneratorProps {
  brands: Brand[];
  addToHistory: (asset: GeneratedAsset) => void;
}

// Canvas helper: word-wrap text
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  const lines: string[] = [];

  for (const word of words) {
    const testLine = line + (line ? ' ' : '') + word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  const totalHeight = lines.length * lineHeight;
  const startY = y - totalHeight / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, startY + i * lineHeight, maxWidth);
  }
}

const ASPECT_RATIOS = [
  { value: '1:1', label: 'Kare (1:1)', desc: 'Instagram Post' },
  { value: '4:5', label: 'Portre (4:5)', desc: 'Instagram Feed' },
  { value: '9:16', label: 'Story (9:16)', desc: 'Instagram/TikTok Story' },
];

const SLIDE_COUNTS = [4, 5, 6, 7, 8, 10];

const CAROUSEL_TYPES: { value: CarouselType; label: string; icon: string }[] = [
  { value: 'educational', label: 'Eğitici / Bilgi', icon: '📚' },
  { value: 'campaign', label: 'Kampanya', icon: '🔥' },
  { value: 'product-launch', label: 'Ürün Tanıtım', icon: '🚀' },
  { value: 'announcement', label: 'Duyuru', icon: '📢' },
  { value: 'congratulations', label: 'Tebrik / Kutlama', icon: '🎉' },
  { value: 'brand-story', label: 'Marka Hikayesi', icon: '📖' },
  { value: 'tips-tricks', label: 'İpuçları', icon: '💡' },
  { value: 'before-after', label: 'Önce-Sonra', icon: '🔄' },
  { value: 'testimonial', label: 'Müşteri Yorumu', icon: '⭐' },
  { value: 'event', label: 'Etkinlik / Davet', icon: '📅' },
  { value: 'motivation', label: 'Motivasyon', icon: '💪' },
  { value: 'custom', label: 'Serbest', icon: '✨' },
];

const CREATIVE_TONES = [
  { value: '', label: 'Varsayılan' },
  { value: 'kurumsal', label: 'Kurumsal' },
  { value: 'esprili', label: 'Esprili' },
  { value: 'eglenceli', label: 'Eglenceli' },
  { value: 'samimi', label: 'Samimi' },
  { value: 'luks', label: 'Lüks/Premium' },
  { value: 'genc', label: 'Genc/Dinamik' },
];

type CarouselMode = 'multi-ref' | 'single-image';

const CarouselGenerator: React.FC<CarouselGeneratorProps> = ({ brands, addToHistory }) => {
  // ── State ──
  const [mode, setMode] = useState<CarouselMode>('single-image');
  const [carouselType, setCarouselType] = useState<CarouselType>('educational');
  const [selectedBrandId, setSelectedBrandId] = useState(brands[0]?.id || '');
  const [topic, setTopic] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [slideCount, setSlideCount] = useState(6);
  const [creativeTone, setCreativeTone] = useState('');
  const [selectedFontPairing, setSelectedFontPairing] = useState<FontPairing>(FONT_PAIRINGS[0]);
  const [referenceImages, setReferenceImages] = useState<PipelineImage[]>([]);
  const [productImages, setProductImages] = useState<PipelineImage[]>([]);

  // Generation state
  const [project, setProject] = useState<CarouselProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentSlidePreview, setCurrentSlidePreview] = useState(0);
  const [renderedSlides, setRenderedSlides] = useState<string[]>([]); // Canvas-rendered final slides
  const [isRendering, setIsRendering] = useState(false);

  // Topic suggestions
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  // Past projects
  const [pastProjects, setPastProjects] = useState<CarouselProject[]>([]);
  const [showPastProjects, setShowPastProjects] = useState(false);

  // Brand memory references
  const [brandRefs, setBrandRefs] = useState<any[]>([]);

  const orchestratorRef = useRef<CarouselOrchestrator | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const selectedBrand = brands.find(b => b.id === selectedBrandId);

  // Load Google Fonts when font pairing changes
  useEffect(() => {
    const url = getGoogleFontsUrl(selectedFontPairing);
    const linkId = 'carousel-google-fonts';
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = url;
  }, [selectedFontPairing]);

  // Load past projects and brand references when brand changes
  useEffect(() => {
    if (selectedBrandId) {
      loadCarouselProjects(selectedBrandId).then(setPastProjects).catch(() => {});
      loadBrandReferences(selectedBrandId).then(setBrandRefs).catch(() => {});
    }
  }, [selectedBrandId]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ── File Handlers ──
  const handleFileUpload = async (files: FileList | null, type: 'reference' | 'product') => {
    if (!files) return;
    const newImages: PipelineImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await fileToGenerativePart(file);
      newImages.push({ id: `${type}_${Date.now()}_${i}`, base64, name: file.name });
    }
    if (type === 'reference') {
      setReferenceImages(prev => [...prev, ...newImages]);
    } else {
      setProductImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (id: string, type: 'reference' | 'product') => {
    if (type === 'reference') {
      setReferenceImages(prev => prev.filter(img => img.id !== id));
    } else {
      setProductImages(prev => prev.filter(img => img.id !== id));
    }
  };

  // ── Topic Suggestions ──
  const handleGenerateTopics = async () => {
    if (!selectedBrand) return;
    setIsLoadingTopics(true);
    try {
      const refs = referenceImages.length > 0
        ? referenceImages.map(r => ({ base64: r.base64, name: r.name }))
        : undefined;
      const topics = await generateCarouselTopics(selectedBrand, 5, refs);
      setSuggestedTopics(topics);
    } catch (e) {
      console.error('Topic suggestion failed:', e);
    } finally {
      setIsLoadingTopics(false);
    }
  };

  // ── Use Brand Reference ──
  const handleUseBrandRef = (ref: any) => {
    const newImg: PipelineImage = {
      id: `brandref_${ref.id}`,
      base64: ref.imageBase64,
      name: `Hafıza: ${ref.tags?.[0] || 'Referans'}`,
    };
    setReferenceImages(prev => [...prev, newImg]);
  };

  // ── Update slide text overlays ──
  const handleUpdateSlideOverlays = (slideOrder: number, overlays: SlideTextOverlay[]) => {
    if (!project) return;
    const updatedSlides = project.slides.map(s =>
      s.order === slideOrder ? { ...s, textOverlays: overlays } : s
    );
    setProject({ ...project, slides: updatedSlides });
  };

  // ── Export slide with text overlay composited via canvas ──
  const handleExportSlide = async (slideId: string) => {
    if (!project) return;
    const slide = project.slides.find(s => s.id === slideId);
    if (!slide?.imageBase64) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw background image
      ctx.drawImage(img, 0, 0);

      // Draw text overlays
      const overlays = slide.textOverlays || [];
      for (const overlay of overlays) {
        const x = (overlay.x / 100) * canvas.width;
        const y = (overlay.y / 100) * canvas.height;
        const scaledFontSize = (overlay.fontSize / 500) * canvas.width; // Scale font to image size
        const maxW = (overlay.maxWidth / 100) * canvas.width;

        ctx.textAlign = overlay.textAlign;
        ctx.textBaseline = 'middle';
        const fontFamily = overlay.fontSize >= 36 ? selectedFontPairing.heading.family : selectedFontPairing.body.family;
        ctx.font = `${overlay.fontWeight === 'extrabold' ? '800' : overlay.fontWeight === 'bold' ? '700' : '400'} ${scaledFontSize}px ${fontFamily}`;

        // Background pill
        if (overlay.bgColor && overlay.bgOpacity) {
          const metrics = ctx.measureText(overlay.text);
          const textW = Math.min(metrics.width, maxW);
          const pad = scaledFontSize * 0.4;
          const bgX = overlay.textAlign === 'center' ? x - textW / 2 - pad :
                      overlay.textAlign === 'right' ? x - textW - pad : x - pad;

          ctx.fillStyle = overlay.bgColor;
          ctx.globalAlpha = overlay.bgOpacity;
          ctx.beginPath();
          ctx.roundRect(bgX, y - scaledFontSize / 2 - pad / 2, textW + pad * 2, scaledFontSize + pad, scaledFontSize * 0.2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Text shadow
        if (!overlay.bgColor) {
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = scaledFontSize * 0.3;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = scaledFontSize * 0.05;
        }

        // Draw text with word wrap
        ctx.fillStyle = overlay.color;
        wrapText(ctx, overlay.text, x, y, maxW, scaledFontSize * 1.3);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      downloadBase64Image(base64, `${selectedBrand?.name || 'carousel'}_slide_${slide.order + 1}.png`);
    };
    img.src = `data:image/png;base64,${slide.imageBase64}`;
  };

  // ── Export ALL slides with overlays ──
  const handleExportAllWithOverlays = async () => {
    if (!project) return;

    // Prefer canvas-rendered slides
    if (renderedSlides.length > 0) {
      const items = renderedSlides.map((base64, i) => ({
        base64,
        filename: `${selectedBrand?.name || 'carousel'}_slide_${i + 1}.png`,
      }));
      await downloadMultipleImages(items);
      return;
    }

    // Fallback: export raw slides
    for (const slide of project.slides.filter(s => s.status === 'completed' && s.imageBase64)) {
      await handleExportSlide(slide.id);
      await new Promise(r => setTimeout(r, 300));
    }
  };

  // ── Canvas Render All Slides ──
  const handleRenderAllSlides = async (proj: CarouselProject) => {
    if (!proj.carouselPlan || !selectedBrand) return;
    const completedWithImages = proj.slides.filter(s => s.status === 'completed' && s.imageBase64);
    if (completedWithImages.length === 0) return;

    setIsRendering(true);
    try {
      const rendered = await renderAllSlides(
        completedWithImages,
        proj.carouselPlan,
        selectedBrand,
        selectedFontPairing,
        proj.aspectRatio,
        proj.carouselType || 'custom'
      );
      setRenderedSlides(rendered);
    } catch (err) {
      console.error('Canvas render hatası:', err);
    } finally {
      setIsRendering(false);
    }
  };

  // ── Re-render when font pairing changes ──
  const handleReRender = async () => {
    if (project && project.carouselPlan) {
      await handleRenderAllSlides(project);
    }
  };

  // ── Start Generation ──
  const handleStartGeneration = async () => {
    if (!selectedBrand || !topic.trim()) return;

    const projectId = `carousel_${Date.now()}`;
    const newProject: CarouselProject = {
      id: projectId,
      brandId: selectedBrandId,
      title: topic.trim(),
      carouselType,
      aspectRatio,
      slideCount,
      slides: [],
      referenceImages,
      productImages,
      creativeTone: creativeTone || undefined,
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setProject(newProject);
    setIsGenerating(true);
    setLogs([]);
    setCurrentSlidePreview(0);

    const orchestrator = new CarouselOrchestrator();
    orchestratorRef.current = orchestrator;

    orchestrator.subscribe((event: CarouselEvent) => {
      setLogs(prev => [...prev, `[${event.type.toUpperCase()}] ${event.message}`]);

      if (event.type === 'slide-update' && event.data && event.slideIndex !== undefined) {
        setCurrentSlidePreview(event.slideIndex);
      }
    });

    try {
      const result = await orchestrator.execute(newProject, selectedBrand, (updated) => {
        setProject({ ...updated });
      });

      // Canvas render: compose final slides with programmatic overlays
      setLogs(prev => [...prev, '[STATUS] Canvas render başlatılıyor...']);
      await handleRenderAllSlides(result);
      setLogs(prev => [...prev, '[COMPLETE] Canvas render tamamlandı!']);

      // Add rendered slides to history
      result.slides.forEach(slide => {
        if (slide.imageBase64) {
          addToHistory({
            id: slide.id,
            url: slide.imageBase64,
            promptUsed: `Carousel: ${topic} — Slide ${slide.order + 1}`,
            brandId: selectedBrandId,
            createdAt: Date.now(),
          });
        }
      });
    } catch (err: any) {
      setLogs(prev => [...prev, `[HATA] ${err.message}`]);
    } finally {
      setIsGenerating(false);
      orchestratorRef.current = null;
    }
  };

  // ── Abort ──
  const handleAbort = () => {
    orchestratorRef.current?.abort();
    setIsGenerating(false);
  };

  // ── Download All ──
  const handleDownloadAll = async () => {
    if (!project) return;
    const items = project.slides
      .filter(s => s.imageBase64)
      .map((s, i) => ({
        base64: s.imageBase64!,
        filename: `${selectedBrand?.name || 'carousel'}_slide_${i + 1}.png`,
      }));
    await downloadMultipleImages(items);
  };

  // ── Load Past Project ──
  const handleLoadPastProject = (p: CarouselProject) => {
    setProject(p);
    setTopic(p.title);
    setCarouselType(p.carouselType || 'custom');
    setAspectRatio(p.aspectRatio);
    setSlideCount(p.slideCount);
    setCreativeTone(p.creativeTone || '');
    setReferenceImages(p.referenceImages);
    setProductImages(p.productImages);
    setShowPastProjects(false);
  };

  // ── Delete Past Project ──
  const handleDeletePastProject = async (id: string) => {
    if (!confirm('Bu carousel projesini silmek istediğinden emin misin?')) return;
    await deleteCarouselProject(id);
    setPastProjects(prev => prev.filter(p => p.id !== id));
  };

  // ── Reset ──
  const handleReset = () => {
    setProject(null);
    setTopic('');
    setReferenceImages([]);
    setProductImages([]);
    setLogs([]);
    setSuggestedTopics([]);
    setCurrentSlidePreview(0);
  };

  // ── Computed ──
  const completedSlides = project?.slides.filter(s => s.status === 'completed') || [];
  const canGenerate = selectedBrand && topic.trim() && !isGenerating; // Referans artık opsiyonel

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl lg:text-3xl font-serif text-white flex items-center gap-3">
            <Layers className="text-lumina-gold" size={28} />
            Carousel Stüdyosu
          </h2>
          <p className="text-sm text-slate-400 mt-1">Tutarlı, profesyonel carousel serileri oluşturun</p>
        </div>
        <div className="flex gap-2">
          {pastProjects.length > 0 && (
            <button
              onClick={() => setShowPastProjects(!showPastProjects)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-lumina-800 text-slate-400 hover:text-white hover:bg-lumina-900 transition-all text-sm"
            >
              <Clock size={16} />
              Gecmis ({pastProjects.length})
            </button>
          )}
          {project && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-lumina-800 text-slate-400 hover:text-white hover:bg-lumina-900 transition-all text-sm"
            >
              <RotateCcw size={16} />
              Yeni
            </button>
          )}
        </div>
      </div>

      {/* Mode Selector */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => { setMode('single-image'); setReferenceImages([]); }}
          disabled={isGenerating}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-medium transition-all ${
            mode === 'single-image'
              ? 'border-lumina-gold/50 bg-lumina-gold/10 text-lumina-gold'
              : 'border-lumina-800 text-slate-400 hover:border-lumina-gold/20 hover:text-slate-300'
          }`}
        >
          <ImagePlus size={18} />
          Tek Görselden Carousel
        </button>
        <button
          onClick={() => { setMode('multi-ref'); setReferenceImages([]); }}
          disabled={isGenerating}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-medium transition-all ${
            mode === 'multi-ref'
              ? 'border-lumina-gold/50 bg-lumina-gold/10 text-lumina-gold'
              : 'border-lumina-800 text-slate-400 hover:border-lumina-gold/20 hover:text-slate-300'
          }`}
        >
          <GalleryHorizontalEnd size={18} />
          Çoklu Referans
        </button>
      </div>

      {/* Past Projects Panel */}
      {showPastProjects && (
        <div className="mb-6 bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <FolderOpen size={16} className="text-lumina-gold" />
            Gecmis Carousel Projeleri
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pastProjects.map(p => (
              <div key={p.id} className="bg-lumina-950 border border-lumina-800 rounded-xl p-3 hover:border-lumina-gold/30 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white text-sm font-medium truncate flex-1">{p.title}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                    p.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {p.status === 'completed' ? 'Tamamlandi' : p.status === 'failed' ? 'Basarisiz' : 'Taslak'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  {p.slideCount} slide | {p.aspectRatio} | {new Date(p.createdAt).toLocaleDateString('tr-TR')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLoadPastProject(p)}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-lumina-800 text-white hover:bg-lumina-700 transition-all"
                  >
                    Yukle
                  </button>
                  <button
                    onClick={() => handleDeletePastProject(p.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Panel: Configuration ── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Brand Selection */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Marka</label>
            <select
              value={selectedBrandId}
              onChange={e => setSelectedBrandId(e.target.value)}
              disabled={isGenerating}
              className="w-full bg-lumina-950 border border-lumina-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lumina-gold/50"
            >
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {selectedBrand && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {selectedBrand.palette.slice(0, 5).map((c, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border border-lumina-800" style={{ backgroundColor: c.hex }} title={c.name} />
                ))}
                <span className="text-xs text-slate-500 self-center ml-1">{selectedBrand.tone}</span>
              </div>
            )}
          </div>

          {/* Reference Images */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
              {mode === 'single-image' ? 'Kaynak Görsel' : 'Referans Görseller'} <span className="text-slate-600">(opsiyonel)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple={mode === 'multi-ref'}
              className="hidden"
              onChange={e => {
                if (mode === 'single-image') {
                  // Single image mode: replace existing
                  setReferenceImages([]);
                  handleFileUpload(e.target.files, 'reference');
                } else {
                  handleFileUpload(e.target.files, 'reference');
                }
              }}
            />

            {mode === 'single-image' && referenceImages.length > 0 ? (
              /* Single Image: Large Preview */
              <div className="relative group">
                <img
                  src={`data:image/png;base64,${referenceImages[0].base64}`}
                  className="w-full aspect-square object-cover rounded-xl border border-lumina-800"
                />
                {!isGenerating && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-lumina-gold text-black text-xs font-medium"
                    >
                      Degistir
                    </button>
                    <button
                      onClick={() => setReferenceImages([])}
                      className="px-3 py-1.5 rounded-lg bg-red-500/80 text-white text-xs font-medium"
                    >
                      Kaldir
                    </button>
                  </div>
                )}
                <div className="mt-2 text-[10px] text-slate-500 text-center">
                  Bu görselin stili ve tonu tüm slide'lara uygulanacak
                </div>
              </div>
            ) : (
              /* Upload Area */
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating}
                  className={`w-full border-2 border-dashed border-lumina-800 rounded-xl ${mode === 'single-image' ? 'py-8' : 'py-4'} text-center hover:border-lumina-gold/40 transition-all group`}
                >
                  {mode === 'single-image' ? (
                    <>
                      <ImagePlus size={28} className="mx-auto text-slate-500 group-hover:text-lumina-gold mb-2" />
                      <span className="text-sm text-slate-400 group-hover:text-slate-200 block">Carousel'e dönüstürülecek görseli yükle</span>
                      <span className="text-[10px] text-slate-600 mt-1 block">AI bu görselin stilini analiz edip tutarli slide'lar üretecek</span>
                    </>
                  ) : (
                    <>
                      <Upload size={20} className="mx-auto text-slate-500 group-hover:text-lumina-gold mb-1" />
                      <span className="text-xs text-slate-500 group-hover:text-slate-300">Görsel yükle</span>
                    </>
                  )}
                </button>

                {/* Multi-ref thumbnails */}
                {mode === 'multi-ref' && referenceImages.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {referenceImages.map(img => (
                      <div key={img.id} className="relative group">
                        <img
                          src={`data:image/png;base64,${img.base64}`}
                          className="w-14 h-14 object-cover rounded-lg border border-lumina-800"
                        />
                        {!isGenerating && (
                          <button
                            onClick={() => removeImage(img.id, 'reference')}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XCircle size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Brand Memory References */}
            {brandRefs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-lumina-800">
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Palette size={12} /> Marka Hafizasi
                </p>
                <div className="flex gap-2 flex-wrap">
                  {brandRefs.slice(0, 6).map((ref: any) => (
                    <button
                      key={ref.id}
                      onClick={() => {
                        if (mode === 'single-image') {
                          setReferenceImages([{ id: `brandref_${ref.id}`, base64: ref.imageBase64, name: `Hafıza: ${ref.tags?.[0] || 'Referans'}` }]);
                        } else {
                          handleUseBrandRef(ref);
                        }
                      }}
                      disabled={isGenerating}
                      className="relative group"
                      title={`Kullanım: ${ref.usageCount} | ${ref.tags?.join(', ')}`}
                    >
                      <img
                        src={`data:image/png;base64,${ref.thumbnailBase64 || ref.imageBase64}`}
                        className="w-12 h-12 object-cover rounded-lg border border-lumina-800 hover:border-lumina-gold/50 transition-all opacity-70 hover:opacity-100"
                      />
                      <span className="absolute bottom-0 right-0 text-[9px] bg-lumina-gold text-black px-1 rounded-tl-md rounded-br-lg font-bold">
                        {ref.usageCount}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Product Images (Optional) */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
              Ürün Görselleri <span className="text-slate-600">(opsiyonel)</span>
            </label>
            <input
              ref={productInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleFileUpload(e.target.files, 'product')}
            />
            <button
              onClick={() => productInputRef.current?.click()}
              disabled={isGenerating}
              className="w-full border border-dashed border-lumina-800 rounded-xl py-3 text-center hover:border-lumina-gold/40 transition-all group"
            >
              <Plus size={16} className="mx-auto text-slate-600 group-hover:text-lumina-gold" />
            </button>

            {productImages.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {productImages.map(img => (
                  <div key={img.id} className="relative group">
                    <img
                      src={`data:image/png;base64,${img.base64}`}
                      className="w-12 h-12 object-cover rounded-lg border border-lumina-800"
                    />
                    {!isGenerating && (
                      <button
                        onClick={() => removeImage(img.id, 'product')}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XCircle size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carousel Type */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Carousel Tipi</label>
            <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {CAROUSEL_TYPES.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => setCarouselType(ct.value)}
                  disabled={isGenerating}
                  className={`text-center py-1.5 px-1 rounded-lg border text-[10px] transition-all ${
                    carouselType === ct.value
                      ? 'border-lumina-gold/50 bg-lumina-gold/10 text-lumina-gold'
                      : 'border-lumina-800 text-slate-500 hover:border-lumina-gold/20 hover:text-slate-300'
                  }`}
                >
                  <span className="block text-sm mb-0.5">{ct.icon}</span>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 uppercase tracking-wider">
                Konu <span className="text-lumina-gold">*</span>
              </label>
              <button
                onClick={handleGenerateTopics}
                disabled={isLoadingTopics || isGenerating || !selectedBrand}
                className="flex items-center gap-1 text-xs text-lumina-gold hover:text-amber-400 transition-all disabled:opacity-40"
              >
                {isLoadingTopics ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                AI Öner
              </button>
            </div>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              disabled={isGenerating}
              placeholder="Carousel konusunu yazin veya AI ile üretin..."
              rows={3}
              className="w-full bg-lumina-950 border border-lumina-800 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-lumina-gold/50"
            />
            {suggestedTopics.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {suggestedTopics.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => { setTopic(t); setSuggestedTopics([]); }}
                    className="w-full text-left text-xs text-slate-300 bg-lumina-950 border border-lumina-800 rounded-lg px-3 py-2 hover:border-lumina-gold/40 hover:text-white transition-all line-clamp-2"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4 space-y-3">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Format</label>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_RATIOS.map(ar => (
                  <button
                    key={ar.value}
                    onClick={() => setAspectRatio(ar.value)}
                    disabled={isGenerating}
                    className={`text-center py-2 rounded-xl border text-xs transition-all ${
                      aspectRatio === ar.value
                        ? 'border-lumina-gold/50 bg-lumina-gold/10 text-lumina-gold'
                        : 'border-lumina-800 text-slate-400 hover:border-lumina-gold/20'
                    }`}
                  >
                    <div className="font-medium">{ar.label}</div>
                    <div className="text-[10px] opacity-60">{ar.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Slide Sayisi</label>
              <div className="flex gap-2 flex-wrap">
                {SLIDE_COUNTS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSlideCount(c)}
                    disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      slideCount === c
                        ? 'bg-lumina-gold/20 text-lumina-gold border border-lumina-gold/50'
                        : 'bg-lumina-950 text-slate-400 border border-lumina-800 hover:border-lumina-gold/20'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Kreatif Ton</label>
              <select
                value={creativeTone}
                onChange={e => setCreativeTone(e.target.value)}
                disabled={isGenerating}
                className="w-full bg-lumina-950 border border-lumina-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lumina-gold/50"
              >
                {CREATIVE_TONES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Typography */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4 space-y-3">
            <label className="text-xs text-slate-400 uppercase tracking-wider block">Tipografi</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {FONT_PAIRINGS.map(fp => (
                <button
                  key={fp.id}
                  onClick={() => setSelectedFontPairing(fp)}
                  disabled={isGenerating}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                    selectedFontPairing.id === fp.id
                      ? 'border-lumina-gold/50 bg-lumina-gold/5'
                      : 'border-lumina-800 hover:border-lumina-gold/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white font-medium">{fp.name}</span>
                    {selectedFontPairing.id === fp.id && <CheckCircle2 size={12} className="text-lumina-gold" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-lumina-gold">{fp.mood}</span>
                    <span className="text-[10px] text-slate-600">|</span>
                    <span className="text-[10px] text-slate-500">{fp.bestFor.slice(0, 2).join(', ')}</span>
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    <span style={{ fontFamily: fp.heading.family, fontWeight: fp.heading.weight }} className="text-sm text-white">
                      Aa
                    </span>
                    <span style={{ fontFamily: fp.body.family, fontWeight: fp.body.weight }} className="text-xs text-slate-400 self-end">
                      Body text
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={isGenerating ? handleAbort : handleStartGeneration}
            disabled={!isGenerating && !canGenerate}
            className={`w-full py-3.5 rounded-2xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
              isGenerating
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : canGenerate
                  ? 'bg-gradient-to-r from-lumina-gold to-amber-500 text-black hover:from-amber-500 hover:to-lumina-gold'
                  : 'bg-lumina-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>
                <XCircle size={18} />
                Durdur
              </>
            ) : (
              <>
                <Play size={18} />
                Carousel Üret ({slideCount} Slide)
              </>
            )}
          </button>
        </div>

        {/* ── Right Panel: Preview & Results ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Carousel Plan Preview */}
          {project?.carouselPlan && (
            <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-lumina-gold" />
                Carousel Plani: {project.carouselPlan.theme}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {project.carouselPlan.slideContents.map((sc, i) => {
                  const slide = project.slides.find(s => s.order === i);
                  const status = slide?.status || 'pending';
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentSlidePreview(i)}
                      className={`text-left p-2 rounded-xl border transition-all ${
                        currentSlidePreview === i
                          ? 'border-lumina-gold/50 bg-lumina-gold/5'
                          : 'border-lumina-800 hover:border-lumina-gold/20'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          status === 'generating' ? 'bg-amber-500/20 text-amber-400' :
                          status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-lumina-800 text-slate-500'
                        }`}>
                          {status === 'completed' ? <CheckCircle2 size={12} /> :
                           status === 'generating' ? <Loader2 size={12} className="animate-spin" /> :
                           status === 'failed' ? <XCircle size={12} /> :
                           i + 1}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase">{sc.narrativeRole}</span>
                      </div>
                      <p className="text-xs text-white font-medium truncate">{sc.headline}</p>
                      <p className="text-[10px] text-slate-500 truncate">{sc.bodyText}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-lumina-800 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                <div><span className="text-lumina-gold">Renk:</span> {project.carouselPlan.colorFlow}</div>
                <div><span className="text-lumina-gold">Font:</span> {project.carouselPlan.typographyConsistency}</div>
                <div><span className="text-lumina-gold">Ipucu:</span> {project.carouselPlan.visualThread}</div>
              </div>
            </div>
          )}

          {/* Slide Preview */}
          {completedSlides.length > 0 ? (
            <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <ImageIcon size={16} className="text-lumina-gold" />
                  Slide {currentSlidePreview + 1} / {project?.slideCount}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentSlidePreview(Math.max(0, currentSlidePreview - 1))}
                    disabled={currentSlidePreview === 0}
                    className="p-1.5 rounded-lg border border-lumina-800 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentSlidePreview(Math.min(completedSlides.length - 1, currentSlidePreview + 1))}
                    disabled={currentSlidePreview >= completedSlides.length - 1}
                    className="p-1.5 rounded-lg border border-lumina-800 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={handleExportAllWithOverlays}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-lumina-gold/20 text-lumina-gold text-xs hover:bg-lumina-gold/30 transition-all"
                  >
                    <Download size={14} />
                    Tümünü Indir
                  </button>
                </div>
              </div>

              {/* Main Preview — Canvas Rendered or Raw */}
              {completedSlides[currentSlidePreview]?.imageBase64 && selectedBrand && (
                <div>
                  {/* Canvas Rendered Preview (priority) */}
                  {renderedSlides[currentSlidePreview] ? (
                    <div className="relative rounded-xl overflow-hidden border border-lumina-800 mb-3">
                      <img
                        src={`data:image/png;base64,${renderedSlides[currentSlidePreview]}`}
                        className="w-full block"
                        alt={`Rendered Slide ${currentSlidePreview + 1}`}
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                        Canvas Render
                      </div>
                      <button
                        onClick={() => downloadBase64Image(renderedSlides[currentSlidePreview], `${selectedBrand?.name}_carousel_slide_${currentSlidePreview + 1}.png`)}
                        className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-all"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  ) : (
                    /* Raw AI Background Preview */
                    <div className="relative rounded-xl overflow-hidden border border-lumina-800 mb-3">
                      <img
                        src={`data:image/png;base64,${completedSlides[currentSlidePreview].imageBase64}`}
                        className="w-full block"
                        alt={`Raw Slide ${currentSlidePreview + 1}`}
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-medium">
                        AI Arka Plan
                      </div>
                    </div>
                  )}

                  {/* Re-render and Font Change Controls */}
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={handleReRender}
                      disabled={isRendering}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/30 transition-all disabled:opacity-40"
                    >
                      {isRendering ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                      Yeniden Render
                    </button>
                    <select
                      value={selectedFontPairing.id}
                      onChange={e => {
                        const fp = FONT_PAIRINGS.find(f => f.id === e.target.value);
                        if (fp) setSelectedFontPairing(fp);
                      }}
                      className="flex-1 bg-lumina-950 border border-lumina-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                    >
                      {FONT_PAIRINGS.map(fp => (
                        <option key={fp.id} value={fp.id}>{fp.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Text Overlay Editor (for fine-tuning raw AI background) */}
                  {!renderedSlides.length && (
                    <TextOverlayEditor
                      slide={completedSlides[currentSlidePreview]}
                      brand={selectedBrand}
                      fontPairing={selectedFontPairing}
                      onUpdate={(overlays) => handleUpdateSlideOverlays(completedSlides[currentSlidePreview].order, overlays)}
                      onExport={handleExportSlide}
                    />
                  )}
                </div>
              )}

              {/* Thumbnail Strip */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {completedSlides.map((slide, i) => (
                  <button
                    key={slide.id}
                    onClick={() => setCurrentSlidePreview(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      currentSlidePreview === i
                        ? 'border-lumina-gold'
                        : 'border-lumina-800 hover:border-lumina-gold/30'
                    }`}
                  >
                    {(renderedSlides[i] || slide.imageBase64) ? (
                      <img
                        src={`data:image/png;base64,${renderedSlides[i] || slide.imageBase64}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-lumina-950 flex items-center justify-center">
                        <Loader2 size={12} className="text-slate-600 animate-spin" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : !isGenerating && !project ? (
            /* Empty State */
            <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-12 text-center">
              {mode === 'single-image' ? (
                <>
                  <ImagePlus size={48} className="mx-auto text-lumina-800 mb-4" />
                  <h3 className="text-white font-serif text-xl mb-2">Tek Görselden Carousel</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto">
                    Bir görsel yükleyin — AI görselin stilini, tonunu ve renklerini analiz edip
                    aynı tasarım dilinde tutarlı bir carousel serisi oluşturacak.
                  </p>
                  <div className="mt-6 grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
                    <div className="text-lumina-gold">
                      <ImagePlus size={20} className="mx-auto mb-1" />
                      <p className="text-[10px] text-slate-500">Görsel Yükle</p>
                    </div>
                    <div className="text-lumina-gold">
                      <Wand2 size={20} className="mx-auto mb-1" />
                      <p className="text-[10px] text-slate-500">AI Planlar</p>
                    </div>
                    <div className="text-lumina-gold">
                      <Sparkles size={20} className="mx-auto mb-1" />
                      <p className="text-[10px] text-slate-500">Carousel Üretilir</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Layers size={48} className="mx-auto text-lumina-800 mb-4" />
                  <h3 className="text-white font-serif text-xl mb-2">Çoklu Referans Carousel</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto">
                    Birden fazla referans görsel yükleyin, marka seçin ve konunuzu yazın.
                    AI, tutarlı ve profesyonel bir carousel serisi oluşturacak.
                  </p>
                  <div className="mt-6 grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
                    <div className="text-lumina-gold">
                      <Upload size={20} className="mx-auto mb-1" />
                      <p className="text-[10px] text-slate-500">Referanslar Yükle</p>
                    </div>
                    <div className="text-lumina-gold">
                      <Wand2 size={20} className="mx-auto mb-1" />
                      <p className="text-[10px] text-slate-500">Konu Belirle</p>
                    </div>
                    <div className="text-lumina-gold">
                      <Sparkles size={20} className="mx-auto mb-1" />
                      <p className="text-[10px] text-slate-500">Üret</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* Generation Progress */}
          {isGenerating && (
            <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-4">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Loader2 size={16} className="text-lumina-gold animate-spin" />
                Üretim Devam Ediyor
              </h3>
              {/* Progress Bar */}
              {project && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{completedSlides.length} / {project.slideCount} slide</span>
                    <span>{Math.round((completedSlides.length / project.slideCount) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-lumina-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-lumina-gold to-amber-500 transition-all duration-500 rounded-full"
                      style={{ width: `${(completedSlides.length / project.slideCount) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-lumina-950 border border-lumina-800 rounded-2xl p-4 max-h-48 overflow-y-auto">
              <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">İşlem Günlüğü</h4>
              <div className="space-y-1 font-mono text-[11px]">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={`${
                      log.includes('[ERROR]') || log.includes('[HATA]') ? 'text-red-400' :
                      log.includes('[COMPLETE]') ? 'text-emerald-400' :
                      log.includes('[SLIDE-UPDATE]') ? 'text-lumina-gold' :
                      'text-slate-500'
                    }`}
                  >
                    {log}
                  </div>
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

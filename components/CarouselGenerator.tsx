import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layers, Upload, Sparkles, Play, ChevronLeft, ChevronRight, Download, Trash2,
  Loader2, Image as ImageIcon, Palette, CheckCircle2, XCircle, RotateCcw,
  Wand2, Plus, FolderOpen, Clock, AlertCircle
} from 'lucide-react';
import { Brand, CarouselProject, CarouselSlide, CarouselContentPlan, PipelineImage, GeneratedAsset } from '../types';
import { fileToGenerativePart } from '../services/geminiService';
import { generateCarouselTopics } from '../services/geminiService';
import { CarouselOrchestrator, CarouselEvent, loadCarouselProjects, deleteCarouselProject, loadBrandReferences } from '../services/carouselService';
import { downloadBase64Image, downloadMultipleImages } from '../services/downloadService';

interface CarouselGeneratorProps {
  brands: Brand[];
  addToHistory: (asset: GeneratedAsset) => void;
}

const ASPECT_RATIOS = [
  { value: '1:1', label: 'Kare (1:1)', desc: 'Instagram Post' },
  { value: '4:5', label: 'Portre (4:5)', desc: 'Instagram Feed' },
  { value: '9:16', label: 'Story (9:16)', desc: 'Instagram/TikTok Story' },
];

const SLIDE_COUNTS = [4, 5, 6, 7, 8, 10];

const CREATIVE_TONES = [
  { value: '', label: 'Varsayılan' },
  { value: 'kurumsal', label: 'Kurumsal' },
  { value: 'esprili', label: 'Esprili' },
  { value: 'eglenceli', label: 'Eglenceli' },
  { value: 'samimi', label: 'Samimi' },
  { value: 'luks', label: 'Lüks/Premium' },
  { value: 'genc', label: 'Genc/Dinamik' },
];

const CarouselGenerator: React.FC<CarouselGeneratorProps> = ({ brands, addToHistory }) => {
  // ── State ──
  const [selectedBrandId, setSelectedBrandId] = useState(brands[0]?.id || '');
  const [topic, setTopic] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [slideCount, setSlideCount] = useState(6);
  const [creativeTone, setCreativeTone] = useState('');
  const [referenceImages, setReferenceImages] = useState<PipelineImage[]>([]);
  const [productImages, setProductImages] = useState<PipelineImage[]>([]);

  // Generation state
  const [project, setProject] = useState<CarouselProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentSlidePreview, setCurrentSlidePreview] = useState(0);

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

  // ── Start Generation ──
  const handleStartGeneration = async () => {
    if (!selectedBrand || !topic.trim() || referenceImages.length === 0) return;

    const projectId = `carousel_${Date.now()}`;
    const newProject: CarouselProject = {
      id: projectId,
      brandId: selectedBrandId,
      title: topic.trim(),
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

      // Add completed slides to history
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
  const canGenerate = selectedBrand && topic.trim() && referenceImages.length > 0 && !isGenerating;

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
              Referans Görseller <span className="text-lumina-gold">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleFileUpload(e.target.files, 'reference')}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating}
              className="w-full border-2 border-dashed border-lumina-800 rounded-xl py-4 text-center hover:border-lumina-gold/40 transition-all group"
            >
              <Upload size={20} className="mx-auto text-slate-500 group-hover:text-lumina-gold mb-1" />
              <span className="text-xs text-slate-500 group-hover:text-slate-300">Görsel yukle</span>
            </button>

            {referenceImages.length > 0 && (
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
                      onClick={() => handleUseBrandRef(ref)}
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
                    onClick={handleDownloadAll}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-lumina-gold/20 text-lumina-gold text-xs hover:bg-lumina-gold/30 transition-all"
                  >
                    <Download size={14} />
                    Tümünü Indir
                  </button>
                </div>
              </div>

              {/* Main Preview Image */}
              {completedSlides[currentSlidePreview]?.imageBase64 && (
                <div className="relative rounded-xl overflow-hidden border border-lumina-800 mb-4">
                  <img
                    src={`data:image/png;base64,${completedSlides[currentSlidePreview].imageBase64}`}
                    className="w-full"
                    alt={`Slide ${currentSlidePreview + 1}`}
                  />
                  <button
                    onClick={() => downloadBase64Image(completedSlides[currentSlidePreview].imageBase64!, `${selectedBrand?.name}_carousel_slide_${currentSlidePreview + 1}.png`)}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-all"
                  >
                    <Download size={16} />
                  </button>
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
                    {slide.imageBase64 ? (
                      <img
                        src={`data:image/png;base64,${slide.imageBase64}`}
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
              <Layers size={48} className="mx-auto text-lumina-800 mb-4" />
              <h3 className="text-white font-serif text-xl mb-2">Carousel Stüdyosuna Hoş Geldiniz</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Marka seçin, referans görsel yükleyin ve konunuzu yazın.
                AI, tutarlı ve profesyonel bir carousel serisi oluşturacak.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
                <div className="text-lumina-gold">
                  <Upload size={20} className="mx-auto mb-1" />
                  <p className="text-[10px] text-slate-500">Referans Yükle</p>
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

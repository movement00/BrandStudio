import { CarouselProject, CarouselSlide, CarouselContentPlan, BrandReference, Brand, StyleAnalysis, DesignBlueprint, PipelineImage, SlideTextOverlay } from '../types';
import {
  analyzeImageStyle, decomposeToBlueprint, planCarouselContent, generateCarouselSlide,
  reconstructFromBlueprint, generateContentPlan, generateDesignDirectives,
  generateCleanBackground, ContentPlan, DesignDirectives
} from './geminiService';
import { TYPE_SCALES, SLIDE_LAYOUT_PRESETS, SlideLayoutPreset } from './typographySystem';

// ═══════════════════════════════════════════════════
// Supabase REST helpers (same pattern as scoutService)
// ═══════════════════════════════════════════════════

const SUPABASE_URL = 'https://yvsvxurquhtzaeuszwtb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2c3Z4dXJxdWh0emFldXN6d3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDE2MjAsImV4cCI6MjA4OTkxNzYyMH0.7xSR9mazaNDOmsTbotldB_yO3utM_UlDHyglOzmF1nI';

const supabaseRest = (table: string, params: string = '') =>
  `${SUPABASE_URL}/rest/v1/${table}${params ? `?${params}` : ''}`;

const headers = (extra: Record<string, string> = {}) => ({
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
  ...extra,
});

// ═══════════════════════════════════════════════════
// Carousel Project CRUD
// ═══════════════════════════════════════════════════

export const saveCarouselProject = async (project: CarouselProject): Promise<void> => {
  const body = {
    id: project.id,
    brand_id: project.brandId,
    title: project.title,
    description: project.description || null,
    aspect_ratio: project.aspectRatio,
    slide_count: project.slideCount,
    style_analysis: project.styleAnalysis || null,
    blueprint: project.blueprint || null,
    carousel_plan: project.carouselPlan || null,
    reference_images: project.referenceImages.map(r => ({ id: r.id, name: r.name })), // Don't store base64 twice
    product_images: project.productImages.map(r => ({ id: r.id, name: r.name })),
    creative_tone: project.creativeTone || null,
    status: project.status,
    updated_at: new Date().toISOString(),
  };

  // Upsert via POST with on_conflict
  await fetch(supabaseRest('carousel_projects', 'on_conflict=id'), {
    method: 'POST',
    headers: headers({ 'Prefer': 'return=representation,resolution=merge-duplicates' }),
    body: JSON.stringify(body),
  });
};

export const loadCarouselProjects = async (brandId?: string): Promise<CarouselProject[]> => {
  const params = brandId
    ? `brand_id=eq.${brandId}&order=created_at.desc`
    : 'order=created_at.desc';

  const resp = await fetch(supabaseRest('carousel_projects', params), {
    headers: headers(),
  });

  if (!resp.ok) return [];
  const rows = await resp.json();

  return rows.map((r: any) => ({
    id: r.id,
    brandId: r.brand_id,
    title: r.title,
    description: r.description,
    aspectRatio: r.aspect_ratio,
    slideCount: r.slide_count,
    styleAnalysis: r.style_analysis,
    blueprint: r.blueprint,
    carouselPlan: r.carousel_plan,
    referenceImages: r.reference_images || [],
    productImages: r.product_images || [],
    creativeTone: r.creative_tone,
    status: r.status,
    slides: [],
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  }));
};

export const saveCarouselSlide = async (carouselId: string, slide: CarouselSlide): Promise<void> => {
  const body = {
    id: slide.id,
    carousel_id: carouselId,
    slide_order: slide.order,
    topic: slide.topic,
    image_base64: slide.imageBase64 || null,
    status: slide.status,
    error: slide.error || null,
  };

  await fetch(supabaseRest('carousel_slides', 'on_conflict=id'), {
    method: 'POST',
    headers: headers({ 'Prefer': 'return=representation,resolution=merge-duplicates' }),
    body: JSON.stringify(body),
  });
};

export const loadCarouselSlides = async (carouselId: string): Promise<CarouselSlide[]> => {
  const resp = await fetch(
    supabaseRest('carousel_slides', `carousel_id=eq.${carouselId}&order=slide_order.asc`),
    { headers: headers() }
  );

  if (!resp.ok) return [];
  const rows = await resp.json();

  return rows.map((r: any) => ({
    id: r.id,
    order: r.slide_order,
    topic: r.topic,
    imageBase64: r.image_base64,
    status: r.status,
    error: r.error,
  }));
};

export const deleteCarouselProject = async (projectId: string): Promise<void> => {
  await fetch(supabaseRest('carousel_projects', `id=eq.${projectId}`), {
    method: 'DELETE',
    headers: headers(),
  });
};

// ═══════════════════════════════════════════════════
// Brand References (Memory) CRUD
// ═══════════════════════════════════════════════════

export const saveBrandReference = async (ref: BrandReference): Promise<void> => {
  const body = {
    id: ref.id,
    brand_id: ref.brandId,
    image_base64: ref.imageBase64,
    thumbnail_base64: ref.thumbnailBase64 || null,
    style_analysis: ref.styleAnalysis || null,
    blueprint: ref.blueprint || null,
    source_type: ref.sourceType,
    tags: ref.tags,
    usage_count: ref.usageCount,
  };

  await fetch(supabaseRest('brand_references', 'on_conflict=id'), {
    method: 'POST',
    headers: headers({ 'Prefer': 'return=representation,resolution=merge-duplicates' }),
    body: JSON.stringify(body),
  });
};

export const loadBrandReferences = async (brandId: string): Promise<BrandReference[]> => {
  const resp = await fetch(
    supabaseRest('brand_references', `brand_id=eq.${brandId}&order=usage_count.desc,created_at.desc`),
    { headers: headers() }
  );

  if (!resp.ok) return [];
  const rows = await resp.json();

  return rows.map((r: any) => ({
    id: r.id,
    brandId: r.brand_id,
    imageBase64: r.image_base64,
    thumbnailBase64: r.thumbnail_base64,
    styleAnalysis: r.style_analysis,
    blueprint: r.blueprint,
    sourceType: r.source_type,
    tags: r.tags || [],
    usageCount: r.usage_count || 0,
    createdAt: r.created_at,
  }));
};

export const incrementReferenceUsage = async (refId: string): Promise<void> => {
  // Read current, increment, patch
  const resp = await fetch(
    supabaseRest('brand_references', `id=eq.${refId}&select=usage_count`),
    { headers: headers() }
  );
  if (!resp.ok) return;
  const rows = await resp.json();
  const current = rows[0]?.usage_count || 0;

  await fetch(supabaseRest('brand_references', `id=eq.${refId}`), {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ usage_count: current + 1 }),
  });
};

export const deleteBrandReference = async (refId: string): Promise<void> => {
  await fetch(supabaseRest('brand_references', `id=eq.${refId}`), {
    method: 'DELETE',
    headers: headers(),
  });
};

// ═══════════════════════════════════════════════════
// Carousel Generation Orchestrator
// ═══════════════════════════════════════════════════

export type CarouselEventType = 'status' | 'slide-update' | 'log' | 'complete' | 'error';

export interface CarouselEvent {
  type: CarouselEventType;
  message: string;
  slideIndex?: number;
  data?: any;
}

type CarouselListener = (event: CarouselEvent) => void;

export class CarouselOrchestrator {
  private listeners: CarouselListener[] = [];
  private aborted = false;

  subscribe(listener: CarouselListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(event: CarouselEvent) {
    this.listeners.forEach(l => l(event));
  }

  abort() {
    this.aborted = true;
  }

  /**
   * Full carousel generation pipeline:
   * 1. Analyze reference style
   * 2. Decompose blueprint
   * 3. Plan carousel content
   * 4. Generate slides sequentially (each gets previous slide for consistency)
   * 5. Save to Supabase
   * 6. Save reference images to brand memory
   */
  async execute(
    project: CarouselProject,
    brand: Brand,
    onProjectUpdate: (project: CarouselProject) => void
  ): Promise<CarouselProject> {
    this.aborted = false;
    let updatedProject = { ...project, status: 'generating' as const, updatedAt: Date.now() };
    onProjectUpdate(updatedProject);

    try {
      const hasReferences = project.referenceImages.length > 0;

      // ── Step 1 & 2: Analyze reference images (if any) ──
      if (!hasReferences) {
        this.emit({ type: 'log', message: 'Referans görsel yok — marka kitinden tasarım yapılacak.' });
      }

      let perRefAnalysis = project.perRefAnalysis || [];

      if (hasReferences && perRefAnalysis.length < project.referenceImages.length) {
        this.emit({ type: 'status', message: `${project.referenceImages.length} referans görsel analiz ediliyor...` });

        for (let r = 0; r < project.referenceImages.length; r++) {
          if (this.aborted) throw new Error('İptal edildi.');

          const refImg = project.referenceImages[r];
          const existing = perRefAnalysis.find(a => a.refId === refImg.id);
          if (existing) {
            this.emit({ type: 'log', message: `Referans ${r + 1} zaten analiz edilmiş, atlanıyor.` });
            continue;
          }

          // Step A: Style Analysis
          this.emit({ type: 'log', message: `Referans ${r + 1}/${project.referenceImages.length} — Stil analizi: ${refImg.name}` });
          const refStyle = await analyzeImageStyle(refImg.base64);
          if (this.aborted) throw new Error('İptal edildi.');
          this.emit({ type: 'log', message: `  ✓ Stil: ${refStyle.artisticStyle} | Mood: ${refStyle.mood}` });

          // Step B: Blueprint Decomposition (katman katman JSON)
          this.emit({ type: 'log', message: `Referans ${r + 1}/${project.referenceImages.length} — Blueprint ayrıştırma (katman katman JSON)...` });
          const refBlueprint = await decomposeToBlueprint(refImg.base64);
          if (this.aborted) throw new Error('İptal edildi.');

          const layerSummary = refBlueprint.layers.map(l => `${l.type}${l.type === 'text' ? `("${l.content.slice(0, 20)}...")` : ''}`).join(', ');
          this.emit({ type: 'log', message: `  ✓ Blueprint: ${refBlueprint.layers.length} katman [${layerSummary}]` });
          this.emit({ type: 'log', message: `  ✓ Layout: ${refBlueprint.layout.type} | Canvas: ${refBlueprint.canvas.style} | Renkler: ${refBlueprint.colorSystem.dominant}/${refBlueprint.colorSystem.secondary}/${refBlueprint.colorSystem.accent}` });

          perRefAnalysis = [...perRefAnalysis, { refId: refImg.id, styleAnalysis: refStyle, blueprint: refBlueprint }];
          updatedProject = { ...updatedProject, perRefAnalysis };
          onProjectUpdate(updatedProject);
        }
      }

      // Primary style & blueprint (from first ref if available)
      const styleAnalysis = perRefAnalysis.length > 0 ? perRefAnalysis[0].styleAnalysis : null;
      const blueprint = perRefAnalysis.length > 0 ? perRefAnalysis[0].blueprint : null;
      updatedProject = { ...updatedProject, styleAnalysis: styleAnalysis || undefined, blueprint: blueprint || undefined, perRefAnalysis };
      onProjectUpdate(updatedProject);

      if (this.aborted) throw new Error('İptal edildi.');

      // ── Step 3: Plan carousel content ──
      this.emit({ type: 'status', message: 'Carousel içerik planı oluşturuluyor...' });

      // Load past carousel themes for variety
      const pastProjects = await loadCarouselProjects(project.brandId);
      const pastThemes = pastProjects
        .filter(p => p.id !== project.id && p.carouselPlan?.theme)
        .map(p => p.carouselPlan!.theme)
        .slice(0, 5);

      let carouselPlan = project.carouselPlan;
      if (!carouselPlan) {
        carouselPlan = await planCarouselContent(
          brand,
          project.title,
          project.slideCount,
          styleAnalysis,
          blueprint,
          project.creativeTone,
          pastThemes
        );
        updatedProject = { ...updatedProject, carouselPlan };
        onProjectUpdate(updatedProject);
        this.emit({ type: 'log', message: `Plan hazır: "${carouselPlan.theme}" — ${carouselPlan.slideContents.length} slide` });
      }

      if (this.aborted) throw new Error('İptal edildi.');

      // ── Step 4: Generate slides — each from its OWN reference blueprint ──
      const useBlueprint = hasReferences && (project.textMode === 'ai');
      this.emit({ type: 'status', message: useBlueprint
        ? 'Blueprint pipeline ile slide\'lar üretiliyor (her slide kendi referansından)...'
        : 'Slide arka planları üretiliyor...'
      });

      const slides: CarouselSlide[] = [];
      let previousSlideBase64: string | null = null; // For consistency reference (not cloning)
      for (let i = 0; i < carouselPlan.slideContents.length; i++) {
        if (this.aborted) throw new Error('İptal edildi.');

        const slideContent = carouselPlan.slideContents[i];
        const slideId = `${project.id}_slide_${i}`;

        // Check if already completed
        const existingSlide = updatedProject.slides.find(s => s.order === i && s.status === 'completed' && s.imageBase64);
        if (existingSlide) {
          slides.push(existingSlide);
          this.emit({ type: 'slide-update', message: `Slide ${i + 1} zaten mevcut, atlanıyor.`, slideIndex: i });
          continue;
        }

        const slide: CarouselSlide = {
          id: slideId,
          order: i,
          topic: slideContent.headline,
          status: 'generating',
        };

        this.emit({ type: 'slide-update', message: `Slide ${i + 1}/${carouselPlan.slideContents.length} üretiliyor...`, slideIndex: i });

        try {
          // Each slide uses its OWN reference image (rotate if fewer refs than slides)
          const refIdx = hasReferences ? i % project.referenceImages.length : -1;
          const refBase64 = hasReferences ? project.referenceImages[refIdx].base64 : null;
          const refId = hasReferences ? project.referenceImages[refIdx].id : null;
          const slideRefAnalysis = refId ? (perRefAnalysis.find(a => a.refId === refId) || perRefAnalysis[0]) : null;
          const productBase64 = project.productImages.length > 0
            ? project.productImages[i % project.productImages.length].base64
            : null;

          let imageBase64: string;

          if (useBlueprint && slideRefAnalysis) {
            // ═══ HYBRID PIPELINE — AI arka plan + Canvas metin ═══
            // 1. Blueprint'ten metin katmanlarını çıkar
            // 2. AI sadece görsel katmanları üret (temiz arka plan)
            // 3. Canvas engine metin/ikon/logo ekleyecek (renderAllCarouselSlides)
            const slideBp = slideRefAnalysis.blueprint;
            const slideTopic = `${slideContent.headline} — ${slideContent.bodyText}`;

            const textCount = slideBp.layers.filter(l => l.type === 'text' || l.type === 'logo' || l.type === 'icon').length;
            const visualCount = slideBp.layers.filter(l => l.type !== 'text' && l.type !== 'logo' && l.type !== 'icon').length;
            this.emit({ type: 'log', message: `Slide ${i + 1}: ${visualCount} görsel katman üretilecek, ${textCount} metin katmanı Canvas'a bırakılacak...` });

            imageBase64 = await generateCleanBackground(
              slideBp,
              brand,
              refBase64!,
              project.aspectRatio,
              slideTopic,
              i,
              carouselPlan.slideContents.length,
              previousSlideBase64
            );
            this.emit({ type: 'log', message: `Slide ${i + 1}: Temiz arka plan hazır — Canvas overlay eklenecek.` });
          } else {
            // ═══ STANDARD PIPELINE (brand-kit veya canvas mode) ═══
            imageBase64 = await generateCarouselSlide(
              brand,
              slideContent,
              carouselPlan,
              slideRefAnalysis?.styleAnalysis || null,
              slideRefAnalysis?.blueprint || null,
              refBase64,              // THIS slide's own reference
              productBase64,
              project.aspectRatio,
              i,
              carouselPlan.slideContents.length,
              previousSlideBase64,    // Previous slide for consistency (not cloning)
              project.carouselType || 'custom'
            );
          }

          slide.imageBase64 = imageBase64;
          slide.status = 'completed';
          previousSlideBase64 = imageBase64; // For next slide's consistency reference

          // Create text overlays for canvas mode
          if (project.textMode === 'canvas') {
            const typeScale = TYPE_SCALES[project.aspectRatio] || TYPE_SCALES['1:1'];
            const layoutId = i === 0 ? 'centered-bold'
              : i === carouselPlan.slideContents.length - 1 ? 'bottom-card'
              : 'story-stack';
            const layout = SLIDE_LAYOUT_PRESETS.find(l => l.id === layoutId) || SLIDE_LAYOUT_PRESETS[0];

            const contentMap: Record<string, string> = {
              'headline': slideContent.headline || '',
              'body': slideContent.bodyText || '',
              'cta': slideContent.ctaText || '',
              'brand': brand.name,
              'slide-number': `${String(i + 1).padStart(2, '0')}`,
            };
            const brandAccent = brand.palette[0]?.hex || '#F8BE00';

            slide.textOverlays = layout.overlays
              .filter(o => contentMap[o.role])
              .map(o => ({
                id: `${slide.id}_${o.role}`,
                text: contentMap[o.role],
                x: o.x, y: o.y,
                fontSize: typeScale[o.fontSizeKey],
                fontWeight: o.fontWeight,
                color: o.bgStyle === 'pill' ? '#000000' : '#FFFFFF',
                bgColor: o.bgStyle === 'pill' ? brandAccent : o.bgStyle === 'frosted' ? '#000000' : undefined,
                bgOpacity: o.bgStyle === 'pill' ? 1 : o.bgStyle === 'frosted' ? 0.35 : undefined,
                textAlign: o.textAlign,
                maxWidth: o.maxWidth,
              }));
          }

          this.emit({ type: 'slide-update', message: `Slide ${i + 1} tamamlandı!`, slideIndex: i, data: imageBase64 });
        } catch (err: any) {
          slide.status = 'failed';
          slide.error = err.message || 'Bilinmeyen hata';
          this.emit({ type: 'error', message: `Slide ${i + 1} başarısız: ${slide.error}`, slideIndex: i });
        }

        slides.push(slide);

        // Update project in real-time
        updatedProject = { ...updatedProject, slides: [...slides] };
        onProjectUpdate(updatedProject);

        // Save slide to Supabase
        try {
          await saveCarouselSlide(project.id, slide);
        } catch (e) {
          console.warn('Slide Supabase kayıt hatası:', e);
        }
      }

      // ── Step 5: Finalize ──
      const allCompleted = slides.every(s => s.status === 'completed');
      updatedProject = {
        ...updatedProject,
        slides,
        status: allCompleted ? 'completed' : 'failed',
        updatedAt: Date.now(),
      };
      onProjectUpdate(updatedProject);

      // Save project to Supabase
      try {
        await saveCarouselProject(updatedProject);
      } catch (e) {
        console.warn('Carousel Supabase kayıt hatası:', e);
      }

      // ── Step 6: Save reference images to brand memory ──
      try {
        for (const refImg of project.referenceImages) {
          const refRecord: BrandReference = {
            id: `ref_${project.brandId}_${refImg.id}`,
            brandId: project.brandId,
            imageBase64: refImg.base64,
            styleAnalysis: styleAnalysis,
            blueprint: blueprint,
            sourceType: 'carousel_ref',
            tags: [project.title, carouselPlan.theme],
            usageCount: 1,
            createdAt: new Date().toISOString(),
          };
          await saveBrandReference(refRecord);
        }
        this.emit({ type: 'log', message: 'Referans görseller marka hafızasına kaydedildi.' });
      } catch (e) {
        console.warn('Brand reference kayıt hatası:', e);
      }

      this.emit({
        type: 'complete',
        message: `Carousel tamamlandı! ${slides.filter(s => s.status === 'completed').length}/${slides.length} slide başarılı.`,
      });

      return updatedProject;

    } catch (err: any) {
      updatedProject = { ...updatedProject, status: 'failed', updatedAt: Date.now() };
      onProjectUpdate(updatedProject);
      this.emit({ type: 'error', message: err.message || 'Carousel üretimi başarısız.' });
      throw err;
    }
  }
}

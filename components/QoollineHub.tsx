import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, Globe, Sparkles, Loader2, Download, Square, FileText, Check, XCircle, Clock, Edit2, Send, ShieldCheck } from 'lucide-react';
import { Brand, GeneratedAsset, QoollineCampaign, QoollineQcResult, QoollineGenerationResult, PipelineImage, StyleAnalysis } from '../types';
import { analyzeImageStyle, generateBrandedImage, reviseGeneratedImage, adaptMasterToFormat, matchTopicsToStyles } from '../services/geminiService';
import { QOOLLINE_CAMPAIGNS, QOOLLINE_COUNTRIES, qoollineQualityCheck } from '../services/qoollineService';
import { downloadBase64Image, downloadMultipleImages } from '../services/downloadService';
import CampaignFactory from './qoolline/CampaignFactory';
import CopywritingPanel from './qoolline/CopywritingPanel';
import CountryThemes from './qoolline/CountryThemes';
import QoollineResults from './qoolline/QoollineResults';

type QoollineTab = 'campaigns' | 'copy' | 'countries';

interface QoollineHubProps {
  brand: Brand;
  addToHistory: (asset: GeneratedAsset) => void;
}

const QoollineHub: React.FC<QoollineHubProps> = ({ brand, addToHistory }) => {
  const [activeTab, setActiveTab] = useState<QoollineTab>('campaigns');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<QoollineGenerationResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Country themes state
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [countryCampaignId, setCountryCampaignId] = useState(QOOLLINE_CAMPAIGNS[0].id);

  // Revision state
  const [revisingIds, setRevisingIds] = useState<Set<string>>(new Set());
  const [expandedRevision, setExpandedRevision] = useState<string | null>(null);
  const [revisionPrompts, setRevisionPrompts] = useState<Record<string, string>>({});

  // QC state
  const [qcResults, setQcResults] = useState<Record<string, QoollineQcResult>>({});
  const [qcRunning, setQcRunning] = useState(false);

  const log = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('tr-TR');
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
  }, []);

  const updateResult = useCallback((id: string, updates: Partial<QoollineGenerationResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // ═══ SIMPLE GENERATION — analyzeImageStyle + generateBrandedImage (like compare-app) ═══
  const handleStartGeneration = useCallback(async (
    campaigns: QoollineCampaign[],
    formats: string[],
    referenceImages: PipelineImage[]
  ) => {
    if (referenceImages.length === 0) {
      alert('En az 1 referans gorsel yukleyin.');
      return;
    }

    setIsRunning(true);
    setLogs([]);
    setQcResults({});

    // Initialize results
    const initialResults: QoollineGenerationResult[] = [];
    campaigns.forEach(campaign => {
      formats.forEach(fmt => {
        initialResults.push({
          id: `${campaign.id}-${fmt}-${Date.now()}`,
          campaignId: campaign.id,
          campaignType: campaign.type,
          topic: `[${campaign.type}] ${campaign.core}`,
          format: fmt,
          status: 'pending',
          qcRetryCount: 0,
        });
      });
    });
    setResults(initialResults);

    const masterFormat = formats[0];
    const adaptFormats = formats.slice(1);
    const totalImages = campaigns.length * formats.length;

    log(`Uretim baslatildi: ${campaigns.length} kampanya x ${formats.length} format = ${totalImages} gorsel`);

    // Step 1: Analyze ALL reference images
    log(`${referenceImages.length} referans gorsel analiz ediliyor...`);
    const styleMap: { id: string; analysis: StyleAnalysis; base64: string }[] = [];

    for (let i = 0; i < referenceImages.length; i++) {
      const ref = referenceImages[i];
      try {
        const analysis = await analyzeImageStyle(ref.base64);
        styleMap.push({ id: ref.id, analysis, base64: ref.base64 });
        log(`  ✓ (${i + 1}/${referenceImages.length}) ${ref.name}: ${analysis.mood}, ${analysis.artisticStyle}`);
      } catch (err: any) {
        log(`  ✗ (${i + 1}/${referenceImages.length}) ${ref.name}: ${err.message}`);
      }
    }

    if (styleMap.length === 0) {
      log('Hicbir referans analiz edilemedi. Durduruluyor.');
      setIsRunning(false);
      return;
    }

    // Step 2: Match campaigns to best reference images
    log('Kampanyalar referanslarla eslestiriliyor...');
    const topics = campaigns.map(c => `[${c.type}] ${c.core} — ${c.notes}`);
    let matches: { topicIndex: number; styleId: string }[];

    if (styleMap.length === 1) {
      matches = campaigns.map((_, i) => ({ topicIndex: i, styleId: styleMap[0].id }));
      log(`  Tek referans — tum kampanyalara atandi.`);
    } else {
      try {
        matches = await matchTopicsToStyles(topics, styleMap.map(s => ({ id: s.id, analysis: s.analysis })));
        log(`  ✓ ${matches.length} eslestirme yapildi.`);
        matches.forEach(m => {
          const refName = referenceImages.find(r => r.id === m.styleId)?.name || m.styleId;
          log(`    → "${campaigns[m.topicIndex].type}" ↔ ${refName}`);
        });
      } catch (err: any) {
        log(`  ✗ Eslestirme hatasi: ${err.message}. Ilk referans kullaniliyor.`);
        matches = campaigns.map((_, i) => ({ topicIndex: i, styleId: styleMap[0].id }));
      }
    }

    // Step 3: Generate each campaign with matched reference
    let completed = 0;
    for (let ci = 0; ci < campaigns.length; ci++) {
      const campaign = campaigns[ci];
      const match = matches.find(m => m.topicIndex === ci) || { topicIndex: ci, styleId: styleMap[0].id };
      const matchedRef = styleMap.find(s => s.id === match.styleId) || styleMap[0];

      const masterResultId = initialResults.find(r => r.campaignId === campaign.id && r.format === masterFormat)?.id;
      if (!masterResultId) continue;

      const refName = referenceImages.find(r => r.id === matchedRef.id)?.name || 'referans';
      updateResult(masterResultId, { status: 'generating' });
      log(`🎨 Uretiliyor: "${campaign.type}" [${masterFormat}] ← ${refName}`);

      const contextDescription = `${campaign.core}. ${campaign.supporting}. CTA: ${campaign.cta}. ${campaign.extra}`;

      let masterImage: string | null = null;

      try {
        masterImage = await generateBrandedImage(
          brand,
          matchedRef.analysis,
          matchedRef.base64,
          null,
          contextDescription,
          masterFormat
        );

        updateResult(masterResultId, { status: 'completed', imageBase64: masterImage });
        completed++;
        log(`  ✓ Master tamamlandi (${completed}/${totalImages})`);
      } catch (err: any) {
        updateResult(masterResultId, { status: 'failed', error: err.message });
        log(`  ✗ Hata: ${err.message}`);
        // Skip adaptations
        adaptFormats.forEach(fmt => {
          const adaptId = initialResults.find(r => r.campaignId === campaign.id && r.format === fmt)?.id;
          if (adaptId) updateResult(adaptId, { status: 'failed', error: 'Master uretilemedi' });
          completed++;
        });
        continue;
      }

      // Adapt to other formats — send MASTER as product image so model sees it
      for (const fmt of adaptFormats) {
        const adaptId = initialResults.find(r => r.campaignId === campaign.id && r.format === fmt)?.id;
        if (!adaptId || !masterImage) continue;

        updateResult(adaptId, { status: 'generating' });
        log(`  📐 Adapt ediliyor: [${masterFormat} → ${fmt}]`);

        try {
          // Send master image as productImage — model sees both reference AND the master
          // This ensures the adaptation matches the master's exact design
          const adaptPrompt = `GÖREV: Bu görselin ${fmt} formatına adaptasyonunu yap.

MASTER GÖRSEL (productImage olarak verildi): Bu görselin BİREBİR AYNISINI ${fmt} formatında yeniden oluştur.
- AYNI renkler, AYNI tipografi, AYNI layout mantığı
- AYNI metin içerikleri: "${campaign.core}", "${campaign.supporting}", CTA: "${campaign.cta}"
- AYNI marka elementleri (logo, ikonlar, butonlar)
- Sadece aspect ratio değişiyor: ${masterFormat} → ${fmt}
- Elementleri ${fmt} formatına göre yeniden konumlandır ama TASARIM DİLİ AYNI kalmalı

Bu bir PAKET üretimi — master ile birebir aynı tasarım dili, farklı boyut.`;

          const adapted = await generateBrandedImage(
            brand,
            matchedRef.analysis,
            matchedRef.base64,
            masterImage,  // Master image as product reference
            adaptPrompt,
            fmt
          );

          updateResult(adaptId, { status: 'completed', imageBase64: adapted });
          completed++;
          log(`  ✓ Adaptasyon tamamlandi [${fmt}] (${completed}/${totalImages})`);
        } catch (err: any) {
          updateResult(adaptId, { status: 'failed', error: err.message });
          log(`  ✗ Adaptasyon hatasi [${fmt}]: ${err.message}`);
          completed++;
        }
      }
    }

    log(`Uretim tamamlandi! ${completed}/${totalImages} gorsel hazir.`);
    setIsRunning(false);

    // Auto QC after completion
    log('🔍 QC baslatiliyor...');
  }, [brand, log, updateResult]);

  // Auto QC when generation finishes
  useEffect(() => {
    if (!isRunning && results.length > 0 && results.some(r => r.status === 'completed') && Object.keys(qcResults).length === 0 && !qcRunning) {
      runQC();
    }
  }, [isRunning, results]);

  const runQC = useCallback(async () => {
    const completedResults = results.filter(r => r.status === 'completed' && r.imageBase64);
    if (completedResults.length === 0) return;

    setQcRunning(true);

    for (let i = 0; i < completedResults.length; i++) {
      const result = completedResults[i];
      const image = result.revisedImageBase64 || result.imageBase64;
      if (!image) continue;

      log(`  Denetleniyor (${i + 1}/${completedResults.length}): "${result.campaignType}"`);

      try {
        const review = await qoollineQualityCheck(image, result.campaignType, '');
        setQcResults(prev => ({ ...prev, [result.id]: review }));
        log(`  → QC ${review.score}/10 ${review.passed ? '✓' : '✗'}`);

        if (!review.passed && review.revisionInstruction) {
          log(`  → Otomatik revizyon...`);
          try {
            const revised = await reviseGeneratedImage(image, review.revisionInstruction, null);
            updateResult(result.id, { revisedImageBase64: revised });
            log(`  → Revize edildi ✓`);
          } catch {
            log(`  → Revizyon basarisiz`);
          }
        }
      } catch (err: any) {
        log(`  → QC hatasi: ${err.message}`);
      }
    }

    setQcRunning(false);
    log('🔍 QC tamamlandi.');
  }, [results, log, updateResult]);

  // ═══ REVISION HANDLER (with optional image) ═══
  const handleRevise = useCallback(async (resultId: string, instruction: string, revisionImageBase64?: string) => {
    const result = results.find(r => r.id === resultId);
    if (!result) return;
    const sourceImage = result.revisedImageBase64 || result.imageBase64;
    if (!sourceImage) return;

    try {
      const revised = await reviseGeneratedImage(sourceImage, instruction, revisionImageBase64 || null);
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, revisedImageBase64: revised } : r));
      log(`✓ Revize edildi: "${result.campaignType}" [${result.format}]`);
    } catch (err: any) {
      console.error('Revision failed:', err);
      log(`✗ Revizyon hatasi: ${err.message}`);
    }
  }, [results, log]);

  // ═══ REGENERATE HANDLER — re-run same campaign with same reference ═══
  const handleRegenerate = useCallback(async (resultId: string) => {
    const result = results.find(r => r.id === resultId);
    if (!result) return;

    updateResult(resultId, { status: 'generating', imageBase64: undefined, revisedImageBase64: undefined });
    log(`🔄 Yeniden uretiliyor: "${result.campaignType}" [${result.format}]`);

    const campaign = QOOLLINE_CAMPAIGNS.find(c => c.id === result.campaignId);
    if (!campaign) return;

    const contextDescription = `Campaign: ${campaign.type}
Headline: "${campaign.core}"
Supporting: "${campaign.supporting}"
CTA Button Text: "${campaign.cta}"
Extra: "${campaign.extra}"
Notes: ${campaign.notes}`;

    try {
      // Find the original reference — use first available style from initial generation
      // For regeneration we use the same brand + context, model generates fresh
      const newImage = await generateBrandedImage(
        brand,
        { composition: '', lighting: '', colorPaletteDescription: '', mood: '', textureDetails: '', cameraAngle: '', artisticStyle: '', backgroundDetails: '' },
        null,
        null,
        contextDescription,
        result.format
      );
      updateResult(resultId, { status: 'completed', imageBase64: newImage });
      log(`  ✓ Yeniden uretildi [${result.format}]`);
    } catch (err: any) {
      updateResult(resultId, { status: 'failed', error: err.message });
      log(`  ✗ Yeniden uretim hatasi: ${err.message}`);
    }
  }, [results, brand, log, updateResult]);

  const handleDownloadAll = () => {
    const items = results
      .filter(r => r.imageBase64 || r.revisedImageBase64)
      .map(r => ({
        base64: (r.revisedImageBase64 || r.imageBase64)!,
        filename: `qoolline-${r.campaignType.replace(/[^a-zA-Z0-9]/g, '-')}-${r.format}.png`
      }));
    downloadMultipleImages(items);
  };

  const tabs = [
    { id: 'campaigns' as QoollineTab, label: 'Kampanya', icon: Zap },
    { id: 'copy' as QoollineTab, label: 'Kopya', icon: Sparkles },
    { id: 'countries' as QoollineTab, label: 'Ulkeler', icon: Globe },
  ];

  // Group results by campaign type
  const resultGroups: Record<string, QoollineGenerationResult[]> = {};
  results.forEach(r => {
    if (!resultGroups[r.campaignType]) resultGroups[r.campaignType] = [];
    resultGroups[r.campaignType].push(r);
  });

  return (
    <div className="p-4 lg:p-6 h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-serif text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F8BE00]/20 flex items-center justify-center">
              <Zap size={18} className="text-[#F8BE00]" />
            </div>
            Qoolline Hub
          </h2>
          <p className="text-sm text-slate-400 mt-1">Referansa sadik kampanya uretimi</p>
        </div>
        <div className="flex items-center gap-2">
          {results.some(r => r.imageBase64) && (
            <button onClick={handleDownloadAll} className="flex items-center gap-2 px-4 py-2 bg-lumina-900 border border-lumina-800 rounded-lg text-xs text-white hover:bg-lumina-800 transition-all">
              <Download size={14} /> Tumunu Indir
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-4">
            <div className="flex gap-1 mb-5 bg-lumina-950 rounded-lg p-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-lumina-gold/10 text-lumina-gold' : 'text-slate-500 hover:text-white'}`}>
                    <Icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'campaigns' && (
              <CampaignFactory brand={brand} onStartGeneration={handleStartGeneration} isRunning={isRunning} />
            )}
            {activeTab === 'copy' && <CopywritingPanel />}
            {activeTab === 'countries' && (
              <div className="space-y-4">
                <CountryThemes
                  selectedCountries={selectedCountries}
                  onToggleCountry={(id) => setSelectedCountries(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
                  selectedCampaignId={countryCampaignId}
                  onCampaignChange={setCountryCampaignId}
                />
                <button disabled={true} className="w-full py-3 bg-[#F8BE00] text-[#201C1D] rounded-xl font-bold text-sm opacity-30 cursor-not-allowed">
                  <Globe size={16} className="inline mr-2" />
                  Yakinda...
                </button>
              </div>
            )}
          </div>

          {/* Status */}
          {(isRunning || qcRunning) && (
            <div className="mt-4 bg-lumina-900 border border-lumina-800 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className={`animate-spin ${qcRunning ? 'text-indigo-400' : 'text-lumina-gold'}`} />
                <span className="text-xs text-white">{qcRunning ? 'QC Denetleniyor...' : 'Uretim devam ediyor...'}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {results.filter(r => r.status === 'completed').length}/{results.length} tamamlandi
              </p>
            </div>
          )}
        </div>

        {/* Right Panel — Results */}
        <div className="col-span-12 lg:col-span-8">
          {results.length > 0 ? (
            <div className="space-y-4">
              <QoollineResults results={results} onRevise={handleRevise} onRegenerate={handleRegenerate} logs={logs} />
            </div>
          ) : (
            <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F8BE00]/10 flex items-center justify-center">
                <Zap size={28} className="text-[#F8BE00]" />
              </div>
              <h3 className="text-lg font-serif text-white mb-2">Qoolline Kampanya Motoru</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Referans gorsel yukle, kampanya sablonlarini sec, boyutlari belirle. Referansa sadik kalarak marka renkleri ve kampanya metinleriyle uretim yapilir.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QoollineHub;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, Globe, Sparkles, Loader2, Download, Square, FileText, RotateCcw, Check, XCircle, Clock, Edit2, Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Brand, GeneratedAsset, QoollineCampaign, QoollineQcResult, PipelineImage, PipelineConfig, PipelineRun, PipelineResult } from '../types';
import { reviseGeneratedImage, adaptRevisedToFormat } from '../services/geminiService';
import { pipelineService } from '../services/pipelineService';
import { QOOLLINE_CAMPAIGNS, QOOLLINE_COUNTRIES, qoollineQualityCheck } from '../services/qoollineService';
import { downloadBase64Image, downloadMultipleImages } from '../services/downloadService';
import CampaignFactory from './qoolline/CampaignFactory';
import CopywritingPanel from './qoolline/CopywritingPanel';
import CountryThemes from './qoolline/CountryThemes';

type QoollineTab = 'campaigns' | 'copy' | 'countries';

interface QoollineHubProps {
  brand: Brand;
  addToHistory: (asset: GeneratedAsset) => void;
}

const QoollineHub: React.FC<QoollineHubProps> = ({ brand, addToHistory }) => {
  const [activeTab, setActiveTab] = useState<QoollineTab>('campaigns');
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<PipelineRun | null>(null);
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
  const [qcProgress, setQcProgress] = useState({ done: 0, total: 0 });

  // Subscribe to pipeline events
  useEffect(() => {
    const unsub = pipelineService.subscribe((event) => {
      if (event.type === 'log') {
        setLogs(prev => [...prev, `[${new Date(event.timestamp).toLocaleTimeString('tr-TR')}] ${event.data.message}`]);
      } else if (event.type === 'run-update') {
        setCurrentRun({ ...event.data.run });
        if (event.data.run.status === 'completed' || event.data.run.status === 'failed' || event.data.run.status === 'paused') {
          setIsRunning(false);
        }
      } else if (event.type === 'step-update') {
        setCurrentRun(prev => prev ? { ...prev, steps: [...event.data.steps] } : null);
      } else if (event.type === 'result-update') {
        setCurrentRun(prev => prev ? { ...prev, results: [...event.data.results] } : null);
      }
    });
    return unsub;
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Save completed results to history
  useEffect(() => {
    if (currentRun?.status === 'completed') {
      currentRun.results.forEach(r => {
        const imgData = r.revisedImageBase64 || r.generatedImageBase64;
        if (imgData) {
          addToHistory({
            id: `qoolline-${r.id}-${Date.now()}`,
            url: imgData,
            promptUsed: r.topic,
            brandId: brand.id,
            createdAt: Date.now(),
          });
        }
      });
    }
  }, [currentRun?.status]);

  // ═══ QOOLLINE QC — Run 13-rule check on completed results, auto-revise ═══
  const runQoollineQC = useCallback(async () => {
    if (!currentRun) return;
    const completedResults = currentRun.results.filter(r => r.generatedImageBase64 && r.status === 'completed');
    if (completedResults.length === 0) return;

    // Only QC master images (first format per topic group)
    const masters = completedResults.filter(r => {
      const baseTopic = r.topic.replace(/\s*\[[\d:]+\]\s*$/, '');
      const group = currentRun.results.filter(gr => gr.topic.replace(/\s*\[[\d:]+\]\s*$/, '') === baseTopic);
      return group[0]?.id === r.id; // first in group = master
    });

    setQcRunning(true);
    setQcProgress({ done: 0, total: masters.length });
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}] 🔍 Qoolline QC başlatılıyor — ${masters.length} master gorsel denetlenecek`]);

    const MAX_RETRIES = 2;

    for (let i = 0; i < masters.length; i++) {
      const result = masters[i];
      let imageToCheck = result.revisedImageBase64 || result.generatedImageBase64;
      if (!imageToCheck) continue;

      const campaignTypeMatch = result.topic.match(/^\[(.+?)\]/);
      const campaignType = campaignTypeMatch ? campaignTypeMatch[1] : 'General';

      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}]   Denetleniyor (${i + 1}/${masters.length}): "${campaignType}"`]);

      let finalQc: QoollineQcResult | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const review = await qoollineQualityCheck(imageToCheck!, campaignType, '');
          finalQc = review;

          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}]   → QC Puan: ${review.score}/10 ${review.passed ? '✓ GEÇTİ' : '✗ KALDI'}`]);
          if (review.issues.length > 0) {
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}]   → Sorunlar: ${review.issues.join(', ')}`]);
          }

          if (review.passed) break;

          if (attempt < MAX_RETRIES && review.revisionInstruction) {
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}]   → Revizyon (${attempt + 1}/${MAX_RETRIES})...`]);
            try {
              const revised = await reviseGeneratedImage(imageToCheck!, review.revisionInstruction, null);
              imageToCheck = revised;
              // Update master
              setCurrentRun(prev => {
                if (!prev) return prev;
                return { ...prev, results: prev.results.map(r => r.id === result.id ? { ...r, revisedImageBase64: revised } : r) };
              });
              // Adapt siblings
              const baseTopic = result.topic.replace(/\s*\[[\d:]+\]\s*$/, '');
              const siblings = currentRun.results.filter(r => r.id !== result.id && r.topic.replace(/\s*\[[\d:]+\]\s*$/, '') === baseTopic && r.generatedImageBase64);
              const masterFmt = result.topic.match(/\[([\d]+:[\d]+)\]/)?.[1];
              for (const sib of siblings) {
                const sibFmt = sib.topic.match(/\[([\d]+:[\d]+)\]/)?.[1];
                try {
                  const adapted = await adaptRevisedToFormat(revised, sibFmt || '9:16', masterFmt || '4:5', brand.logo || undefined);
                  setCurrentRun(prev => {
                    if (!prev) return prev;
                    return { ...prev, results: prev.results.map(r => r.id === sib.id ? { ...r, revisedImageBase64: adapted } : r) };
                  });
                } catch {}
              }
              setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}]   → Revize edildi, tekrar kontrol...`]);
            } catch {
              setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}]   → Revizyon hatası, mevcut korunuyor.`]);
              break;
            }
          }
        } catch (err: any) {
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}]   → QC hatası: ${err.message}`]);
          break;
        }
      }

      if (finalQc) {
        setQcResults(prev => ({ ...prev, [result.id]: finalQc! }));
      }
      setQcProgress({ done: i + 1, total: masters.length });
    }

    setQcRunning(false);
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}] 🔍 Qoolline QC tamamlandı.`]);
  }, [currentRun, brand]);

  // Auto-run QC when pipeline completes
  useEffect(() => {
    if (currentRun?.status === 'completed' && !qcRunning && Object.keys(qcResults).length === 0) {
      runQoollineQC();
    }
  }, [currentRun?.status]);

  // ═══ CAMPAIGN GENERATION — Uses full pipeline (blueprint + brain + reconstruct) ═══
  const handleStartGeneration = useCallback(async (
    campaigns: QoollineCampaign[],
    formats: string[],
    referenceImages: PipelineImage[]
  ) => {
    if (referenceImages.length === 0) {
      alert('En az 1 referans gorsel yukleyin. Pipeline blueprint ayristirma icin referans gerektirir.');
      return;
    }

    setIsRunning(true);
    setLogs([]);
    setCurrentRun(null);

    // Format campaigns as template topics: [Type] Core | Supporting | CTA: cta | Extra
    const topics = campaigns.map(c =>
      `[${c.type}] ${c.core} | ${c.supporting} | CTA: ${c.cta} | ${c.extra}`
    );

    const config: PipelineConfig = {
      id: `qoolline-${Date.now()}`,
      name: `Qoolline Kampanya ${new Date().toLocaleString('tr-TR')}`,
      brandId: brand.id,
      aspectRatio: formats[0],
      aspectRatios: formats,
      topics,
      referenceImages,
      productImages: [],
      autoRevise: true,
      saveAsTemplate: false,
      creativeTone: 'professional, clean, mobile-first',
      createdAt: Date.now(),
    };

    await pipelineService.execute(config, brand);
  }, [brand]);

  // ═══ COUNTRY GENERATION — Also uses pipeline ═══
  const handleStartCountryGeneration = useCallback(async () => {
    if (selectedCountries.size === 0) return;
    alert('Ulke temali uretim icin Kampanya sekmesinden referans gorsel yukleyip pipeline kullanin. Konulara ulke isimlerini ekleyin.');
  }, [selectedCountries]);

  const stopPipeline = () => { pipelineService.abort(); };

  // ═══ REVISION — Revise master then adapt siblings ═══
  const handleRevise = useCallback(async (resultId: string) => {
    const prompt = revisionPrompts[resultId];
    if (!currentRun || !prompt?.trim()) return;

    const result = currentRun.results.find(r => r.id === resultId);
    if (!result) return;
    const sourceImage = result.revisedImageBase64 || result.generatedImageBase64;
    if (!sourceImage) return;

    // Find format from topic
    const fmtMatch = result.topic.match(/\[([\d]+:[\d]+)\]/);
    const aspectRatio = fmtMatch ? fmtMatch[1] : undefined;

    // Find siblings (same base topic, different format)
    const baseTopic = result.topic.replace(/\s*\[.*?\]\s*$/, '');
    const siblings = currentRun.results.filter(r => r.id !== resultId && r.topic.replace(/\s*\[.*?\]\s*$/, '') === baseTopic);

    const allIds = [resultId, ...siblings.map(s => s.id)];
    setRevisingIds(new Set(allIds));

    try {
      const revised = await reviseGeneratedImage(sourceImage, prompt, null, aspectRatio, brand.logo || undefined);
      setCurrentRun(prev => {
        if (!prev) return prev;
        return { ...prev, results: prev.results.map(r => r.id === resultId ? { ...r, revisedImageBase64: revised } : r) };
      });
      setRevisingIds(prev => { const n = new Set(prev); n.delete(resultId); return n; });

      // Adapt siblings
      for (const sibling of siblings) {
        const sibFmt = sibling.topic.match(/\[([\d]+:[\d]+)\]/)?.[1];
        try {
          const adapted = await adaptRevisedToFormat(revised, sibFmt || '9:16', aspectRatio || '4:5', brand.logo || undefined);
          setCurrentRun(prev => {
            if (!prev) return prev;
            return { ...prev, results: prev.results.map(r => r.id === sibling.id ? { ...r, revisedImageBase64: adapted } : r) };
          });
        } catch {}
        setRevisingIds(prev => { const n = new Set(prev); n.delete(sibling.id); return n; });
      }
    } catch (err: any) {
      console.error('Revision failed:', err);
    }

    setRevisingIds(new Set());
    setRevisionPrompts(prev => ({ ...prev, [resultId]: '' }));
    setExpandedRevision(null);
  }, [currentRun, revisionPrompts, brand]);

  const handleDownloadAll = () => {
    if (!currentRun) return;
    const items = currentRun.results
      .filter(r => r.generatedImageBase64 || r.revisedImageBase64)
      .map(r => ({
        base64: (r.revisedImageBase64 || r.generatedImageBase64)!,
        filename: `qoolline-${r.topic.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '-')}.png`
      }));
    downloadMultipleImages(items);
  };

  const tabs = [
    { id: 'campaigns' as QoollineTab, label: 'Kampanya', icon: Zap },
    { id: 'copy' as QoollineTab, label: 'Kopya', icon: Sparkles },
    { id: 'countries' as QoollineTab, label: 'Ulkeler', icon: Globe },
  ];

  // Group results by base topic (strip format label)
  const resultGroups: Record<string, PipelineResult[]> = {};
  if (currentRun) {
    currentRun.results.forEach(r => {
      const base = r.topic.replace(/\s*\[[\d:]+\]\s*$/, '');
      if (!resultGroups[base]) resultGroups[base] = [];
      resultGroups[base].push(r);
    });
  }

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
          <p className="text-sm text-slate-400 mt-1">Kampanya fabrikasi — blueprint + kreatif beyin + kalite kontrol</p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button onClick={stopPipeline} className="flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-500/30 transition-all">
              <Square size={12} /> Durdur
            </button>
          )}
          {currentRun?.results.some(r => r.generatedImageBase64) && (
            <button onClick={handleDownloadAll} className="flex items-center gap-2 px-4 py-2 bg-lumina-900 border border-lumina-800 rounded-lg text-xs text-white hover:bg-lumina-800 transition-all">
              <Download size={14} /> Tumunu Indir
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel — Config */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-4">
            {/* Tabs */}
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
                <button onClick={handleStartCountryGeneration} disabled={isRunning || selectedCountries.size === 0} className="w-full py-3 bg-[#F8BE00] text-[#201C1D] rounded-xl font-bold text-sm hover:bg-[#F8BE00]/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  {isRunning ? 'Uretiliyor...' : `${selectedCountries.size} Ulke Icin Uret`}
                </button>
              </div>
            )}
          </div>

          {/* Pipeline Steps */}
          {currentRun && (
            <div className="mt-4 bg-lumina-900 border border-lumina-800 rounded-xl p-4">
              <h3 className="text-xs font-medium text-white mb-3">Pipeline Adimlari</h3>
              <div className="space-y-2">
                {currentRun.steps.map(step => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${
                      step.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      step.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                      step.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-800 text-slate-600'
                    }`}>
                      {step.status === 'completed' ? <Check size={10} /> :
                       step.status === 'running' ? <Loader2 size={10} className="animate-spin" /> :
                       step.status === 'failed' ? <XCircle size={10} /> :
                       <Clock size={10} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white truncate">{step.name}</p>
                      {step.status === 'running' && step.progress > 0 && (
                        <div className="w-full h-1 bg-lumina-950 rounded-full mt-1">
                          <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${step.progress}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {currentRun.completedItems > 0 && (
                <p className="text-[10px] text-slate-500 mt-2">{currentRun.completedItems}/{currentRun.totalItems} gorsel tamamlandi</p>
              )}

              {/* QC Status */}
              {(qcRunning || Object.keys(qcResults).length > 0) && (
                <div className="mt-3 pt-3 border-t border-lumina-800">
                  <div className="flex items-center gap-2 mb-1">
                    {qcRunning ? <Loader2 size={12} className="text-indigo-400 animate-spin" /> : <ShieldCheck size={12} className="text-emerald-400" />}
                    <span className="text-[11px] text-white font-medium">Qoolline QC (13 Kural)</span>
                  </div>
                  {qcRunning && (
                    <div className="w-full h-1 bg-lumina-950 rounded-full mt-1">
                      <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${qcProgress.total > 0 ? (qcProgress.done / qcProgress.total) * 100 : 0}%` }} />
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">
                    {qcRunning ? `${qcProgress.done}/${qcProgress.total} denetleniyor...` :
                     `${Object.values(qcResults).filter(q => q.passed).length}/${Object.keys(qcResults).length} gecti`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel — Results */}
        <div className="col-span-12 lg:col-span-8">
          {currentRun && currentRun.results.some(r => r.generatedImageBase64 || r.status !== 'pending') ? (
            <div className="space-y-5">
              {Object.entries(resultGroups).map(([baseTopic, group]) => {
                const hasImages = group.some(r => r.generatedImageBase64 || r.revisedImageBase64);
                return (
                  <div key={baseTopic} className="border border-lumina-800 rounded-xl overflow-hidden bg-lumina-950">
                    {/* Group header */}
                    <div className="px-3 py-2.5 bg-lumina-900/50 border-b border-lumina-800 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-white font-medium truncate" title={baseTopic}>{baseTopic}</p>
                        <span className="text-[10px] text-slate-500">{group.length} boyut</span>
                      </div>
                      {hasImages && (
                        <button onClick={() => group.forEach(r => { const img = r.revisedImageBase64 || r.generatedImageBase64; if (img) downloadBase64Image(img, `qoolline-${baseTopic.slice(0, 30)}.png`); })} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                          <Download size={12} />
                        </button>
                      )}
                    </div>

                    {/* Images */}
                    <div className="p-3">
                      <div className="flex gap-3">
                        {group.map(result => {
                          const displayImage = result.revisedImageBase64 || result.generatedImageBase64;
                          const isThisRevising = revisingIds.has(result.id);
                          const isExpanded = expandedRevision === result.id;
                          const fmtMatch = result.topic.match(/\[([\d]+:[\d]+)\]/);
                          const formatLabel = fmtMatch ? fmtMatch[1] : null;
                          const arMatch = formatLabel?.match(/(\d+):(\d+)/);
                          const arW = arMatch ? parseInt(arMatch[1]) : 1;
                          const arH = arMatch ? parseInt(arMatch[2]) : 1;
                          const isVertical = arH > arW;

                          return (
                            <div key={result.id} className="flex-1 min-w-0">
                              <div className="flex items-center justify-center gap-1.5 mb-2">
                                <span className="text-[10px] font-bold text-lumina-gold bg-lumina-gold/10 px-2 py-0.5 rounded-full">{formatLabel || 'Original'}</span>
                              </div>

                              <div className="relative rounded-lg overflow-hidden bg-lumina-900 border border-lumina-800 mx-auto" style={{ aspectRatio: `${arW}/${arH}`, maxHeight: isVertical ? '400px' : '280px' }}>
                                {isThisRevising ? (
                                  <div className="w-full h-full flex items-center justify-center bg-lumina-900/50">
                                    {displayImage && <img src={`data:image/png;base64,${displayImage}`} className="w-full h-full object-cover opacity-30 absolute inset-0" />}
                                    <div className="text-center relative z-10">
                                      <Loader2 size={24} className="text-lumina-gold animate-spin mx-auto" />
                                      <p className="text-xs text-lumina-gold mt-2">Revize ediliyor...</p>
                                    </div>
                                  </div>
                                ) : displayImage ? (
                                  <img src={`data:image/png;base64,${displayImage}`} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    {result.status === 'generating' ? (
                                      <div className="text-center"><Loader2 size={24} className="text-lumina-gold animate-spin mx-auto" /><p className="text-xs text-slate-500 mt-2">Uretiliyor...</p></div>
                                    ) : result.status === 'failed' ? (
                                      <div className="text-center px-3"><XCircle size={24} className="text-red-400 mx-auto" /><p className="text-xs text-red-400 mt-2">{result.error || 'Hata'}</p></div>
                                    ) : (
                                      <Clock size={24} className="text-slate-600" />
                                    )}
                                  </div>
                                )}

                                {result.revisedImageBase64 && !isThisRevising && (
                                  <div className="absolute top-2 left-2 bg-lumina-gold/90 text-lumina-950 text-[9px] font-bold px-1.5 py-0.5 rounded">REVISED</div>
                                )}

                                {/* QC Badge */}
                                {qcResults[result.id] && (
                                  <div className={`absolute ${result.revisedImageBase64 ? 'top-8' : 'top-2'} left-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${qcResults[result.id].passed ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`} title={qcResults[result.id].issues.join(', ')}>
                                    QC {qcResults[result.id].score}/10
                                  </div>
                                )}

                                {displayImage && !isThisRevising && (
                                  <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => downloadBase64Image(displayImage, `qoolline-${result.topic.slice(0, 30)}.png`)} className="bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                                      <Download size={12} /> Indir
                                    </button>
                                    <button onClick={() => setExpandedRevision(isExpanded ? null : result.id)} className="bg-lumina-gold/30 backdrop-blur-sm text-lumina-gold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                                      <Edit2 size={12} /> Revize
                                    </button>
                                  </div>
                                )}
                              </div>

                              {isExpanded && (
                                <div className="mt-2 p-2 bg-lumina-950 rounded-lg border border-lumina-800">
                                  <div className="flex gap-1.5">
                                    <input type="text" value={revisionPrompts[result.id] || ''} onChange={e => setRevisionPrompts(prev => ({ ...prev, [result.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleRevise(result.id)} placeholder="Nasil degissin? (diger boyutlar da uyumlanir)" className="flex-1 bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none placeholder-slate-600" autoFocus />
                                    <button onClick={() => handleRevise(result.id)} disabled={!revisionPrompts[result.id]?.trim()} className="px-2 py-1.5 bg-lumina-gold/20 text-lumina-gold rounded text-[11px] hover:bg-lumina-gold/30 disabled:opacity-30"><Send size={10} /></button>
                                  </div>
                                  {group.length > 1 && <p className="text-[9px] text-slate-600 mt-1">Bu boyut revize edilecek, diger {group.length - 1} boyut da otomatik uyumlanacak</p>}
                                </div>
                              )}

                              <p className="text-[10px] text-slate-500 text-center mt-1">
                                {isThisRevising ? 'Revize ediliyor...' : result.revisedImageBase64 ? 'Revize edildi' : result.status === 'completed' ? 'Tamamlandi' : result.status === 'failed' ? 'Basarisiz' : result.status === 'generating' ? 'Uretiliyor' : 'Bekliyor'}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      {group.length > 1 && hasImages && (
                        <div className="flex items-center justify-center mt-2 gap-2">
                          <div className="h-px flex-1 bg-lumina-800" /><span className="text-[9px] text-slate-600 px-2">ayni tasarim dili</span><div className="h-px flex-1 bg-lumina-800" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Logs */}
              <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-4">
                <h3 className="text-xs text-white font-medium mb-2 flex items-center gap-2"><FileText size={12} className="text-slate-400" /> Pipeline Loglari</h3>
                <div className="bg-lumina-950 rounded-lg p-3 h-40 overflow-y-auto font-mono text-[10px]">
                  {logs.map((log, i) => (
                    <div key={i} className={`py-0.5 ${log.includes('✓') || log.includes('tamamlandı') ? 'text-emerald-400' : log.includes('✗') || log.includes('hata') ? 'text-red-400' : log.includes('Beyin') || log.includes('Direktif') ? 'text-purple-400' : log.includes('Blueprint') ? 'text-blue-400' : 'text-slate-400'}`}>{log}</div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F8BE00]/10 flex items-center justify-center">
                <Zap size={28} className="text-[#F8BE00]" />
              </div>
              <h3 className="text-lg font-serif text-white mb-2">Qoolline Kampanya Motoru</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Soldaki panelden kampanya sablonlarini sec, referans gorselleri yukle, boyutlari belirle ve uretimi baslat. Pipeline tam akisla calisir: Blueprint ayristirma → Kreatif Beyin → Gorsel uretim → Adaptasyon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QoollineHub;

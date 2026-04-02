import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, Globe, Sparkles, Loader2, Download, Square, FileText, Check, XCircle, Clock, Edit2, Send, Upload, RefreshCw } from 'lucide-react';
import { Brand, GeneratedAsset, QoollineCampaign, PipelineImage, PipelineConfig, PipelineRun, PipelineResult } from '../types';
import { reviseGeneratedImage, resizeImageToRawBase64 } from '../services/geminiService';
import { pipelineService } from '../services/pipelineService';
import { QOOLLINE_CAMPAIGNS, QOOLLINE_COUNTRIES } from '../services/qoollineService';
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

  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [countryCampaignId, setCountryCampaignId] = useState(QOOLLINE_CAMPAIGNS[0].id);

  // Revision state
  const [expandedRevision, setExpandedRevision] = useState<string | null>(null);
  const [revisionPrompts, setRevisionPrompts] = useState<Record<string, string>>({});
  const [revisionImages, setRevisionImages] = useState<Record<string, string>>({});
  const [revisingIds, setRevisingIds] = useState<Set<string>>(new Set());

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

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // Save to history on completion
  useEffect(() => {
    if (currentRun?.status === 'completed') {
      currentRun.results.forEach(r => {
        const img = r.revisedImageBase64 || r.generatedImageBase64;
        if (img) addToHistory({ id: `q-${r.id}-${Date.now()}`, url: img, promptUsed: r.topic, brandId: brand.id, createdAt: Date.now() });
      });
    }
  }, [currentRun?.status]);

  // ═══ PIPELINE GENERATION — no extra rules, just campaign texts as topics ═══
  const handleStartGeneration = useCallback(async (
    campaigns: QoollineCampaign[],
    formats: string[],
    referenceImages: PipelineImage[]
  ) => {
    if (referenceImages.length === 0) { alert('En az 1 referans gorsel yukleyin.'); return; }

    setIsRunning(true);
    setLogs([]);
    setCurrentRun(null);

    const topics = campaigns.map(c => `${c.core}. ${c.supporting}. CTA: ${c.cta}. ${c.extra}`);

    const config: PipelineConfig = {
      id: `qoolline-${Date.now()}`,
      name: `Qoolline ${new Date().toLocaleString('tr-TR')}`,
      brandId: brand.id,
      aspectRatio: formats[0],
      aspectRatios: formats,
      topics,
      referenceImages,
      productImages: [],
      autoRevise: true,
      saveAsTemplate: false,
      createdAt: Date.now(),
    };

    await pipelineService.execute(config, brand);
  }, [brand]);

  const stopPipeline = () => { pipelineService.abort(); };

  // ═══ REVISION ═══
  const handleRevise = async (resultId: string) => {
    if (!currentRun) return;
    const prompt = revisionPrompts[resultId];
    if (!prompt?.trim()) return;
    const result = currentRun.results.find(r => r.id === resultId);
    if (!result) return;
    const source = result.revisedImageBase64 || result.generatedImageBase64;
    if (!source) return;

    setRevisingIds(prev => new Set(prev).add(resultId));
    try {
      const revised = await reviseGeneratedImage(source, prompt, revisionImages[resultId] || null);
      setCurrentRun(prev => prev ? { ...prev, results: prev.results.map(r => r.id === resultId ? { ...r, revisedImageBase64: revised } : r) } : null);
    } catch (err: any) { console.error('Revision failed:', err); }
    setRevisingIds(prev => { const n = new Set(prev); n.delete(resultId); return n; });
    setRevisionPrompts(prev => ({ ...prev, [resultId]: '' }));
    setRevisionImages(prev => ({ ...prev, [resultId]: '' }));
    setExpandedRevision(null);
  };

  const handleDownloadAll = () => {
    if (!currentRun) return;
    const items = currentRun.results
      .filter(r => r.generatedImageBase64 || r.revisedImageBase64)
      .map(r => ({ base64: (r.revisedImageBase64 || r.generatedImageBase64)!, filename: `qoolline-${r.topic.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.png` }));
    downloadMultipleImages(items);
  };

  // Group results by base topic
  const resultGroups: Record<string, PipelineResult[]> = {};
  if (currentRun) {
    currentRun.results.forEach(r => {
      const base = r.topic.replace(/\s*\[[\d:]+\]\s*$/, '');
      if (!resultGroups[base]) resultGroups[base] = [];
      resultGroups[base].push(r);
    });
  }

  const tabs = [
    { id: 'campaigns' as QoollineTab, label: 'Kampanya', icon: Zap },
    { id: 'copy' as QoollineTab, label: 'Kopya', icon: Sparkles },
    { id: 'countries' as QoollineTab, label: 'Ulkeler', icon: Globe },
  ];

  return (
    <div className="p-4 lg:p-6 h-screen overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-serif text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F8BE00]/20 flex items-center justify-center"><Zap size={18} className="text-[#F8BE00]" /></div>
            Qoolline Hub
          </h2>
          <p className="text-sm text-slate-400 mt-1">Blueprint + Kreatif Beyin ile kampanya uretimi</p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && <button onClick={stopPipeline} className="flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-xs text-red-400"><Square size={12} /> Durdur</button>}
          {currentRun?.results.some(r => r.generatedImageBase64) && <button onClick={handleDownloadAll} className="flex items-center gap-2 px-4 py-2 bg-lumina-900 border border-lumina-800 rounded-lg text-xs text-white"><Download size={14} /> Tumunu Indir</button>}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-4">
            <div className="flex gap-1 mb-5 bg-lumina-950 rounded-lg p-1">
              {tabs.map(tab => { const Icon = tab.icon; return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-lumina-gold/10 text-lumina-gold' : 'text-slate-500 hover:text-white'}`}>
                  <Icon size={12} />{tab.label}
                </button>
              ); })}
            </div>
            {activeTab === 'campaigns' && <CampaignFactory brand={brand} onStartGeneration={handleStartGeneration} isRunning={isRunning} />}
            {activeTab === 'copy' && <CopywritingPanel />}
            {activeTab === 'countries' && (
              <CountryThemes selectedCountries={selectedCountries} onToggleCountry={(id) => setSelectedCountries(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })} selectedCampaignId={countryCampaignId} onCampaignChange={setCountryCampaignId} />
            )}
          </div>

          {/* Pipeline Steps */}
          {currentRun && (
            <div className="mt-4 bg-lumina-900 border border-lumina-800 rounded-xl p-4">
              <h3 className="text-xs font-medium text-white mb-3">Pipeline</h3>
              <div className="space-y-2">
                {currentRun.steps.map(step => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${step.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : step.status === 'running' ? 'bg-blue-500/20 text-blue-400' : step.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-600'}`}>
                      {step.status === 'completed' ? <Check size={10} /> : step.status === 'running' ? <Loader2 size={10} className="animate-spin" /> : step.status === 'failed' ? <XCircle size={10} /> : <Clock size={10} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white truncate">{step.name}</p>
                      {step.status === 'running' && step.progress > 0 && <div className="w-full h-1 bg-lumina-950 rounded-full mt-1"><div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${step.progress}%` }} /></div>}
                    </div>
                  </div>
                ))}
              </div>
              {currentRun.completedItems > 0 && <p className="text-[10px] text-slate-500 mt-2">{currentRun.completedItems}/{currentRun.totalItems} gorsel</p>}
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-8">
          {currentRun && currentRun.results.some(r => r.generatedImageBase64 || r.status !== 'pending') ? (
            <div className="space-y-4">
              {Object.entries(resultGroups).map(([baseTopic, group]) => (
                <div key={baseTopic} className="border border-lumina-800 rounded-xl overflow-hidden bg-lumina-950">
                  <div className="px-3 py-2.5 bg-lumina-900/50 border-b border-lumina-800 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-white font-medium truncate" title={baseTopic}>{baseTopic}</p>
                      <span className="text-[10px] text-slate-500">{group.length} boyut</span>
                    </div>
                    <button onClick={() => group.forEach(r => { const img = r.revisedImageBase64 || r.generatedImageBase64; if (img) downloadBase64Image(img, `qoolline-${baseTopic.slice(0, 20)}.png`); })} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"><Download size={12} /></button>
                  </div>
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

                        return (
                          <div key={result.id} className="flex-1 min-w-0">
                            {formatLabel && <div className="flex items-center justify-center mb-2"><span className="text-[10px] font-bold text-lumina-gold bg-lumina-gold/10 px-2 py-0.5 rounded-full">{formatLabel}</span></div>}
                            <div className="relative rounded-lg overflow-hidden bg-lumina-900 border border-lumina-800 mx-auto" style={{ aspectRatio: `${arW}/${arH}`, maxHeight: arH > arW ? '400px' : '280px' }}>
                              {isThisRevising ? (
                                <div className="w-full h-full flex items-center justify-center bg-lumina-900/50">
                                  {displayImage && <img src={`data:image/png;base64,${displayImage}`} className="w-full h-full object-cover opacity-30 absolute inset-0" />}
                                  <div className="text-center relative z-10"><Loader2 size={24} className="text-lumina-gold animate-spin mx-auto" /><p className="text-xs text-lumina-gold mt-2">Revize ediliyor...</p></div>
                                </div>
                              ) : displayImage ? (
                                <img src={`data:image/png;base64,${displayImage}`} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {result.status === 'generating' ? <div className="text-center"><Loader2 size={24} className="text-lumina-gold animate-spin mx-auto" /><p className="text-xs text-slate-500 mt-2">Uretiliyor...</p></div>
                                  : result.status === 'failed' ? <div className="text-center px-3"><XCircle size={24} className="text-red-400 mx-auto" /><p className="text-xs text-red-400 mt-2">{result.error || 'Hata'}</p></div>
                                  : <Clock size={24} className="text-slate-600" />}
                                </div>
                              )}
                              {result.revisedImageBase64 && !isThisRevising && <div className="absolute top-2 left-2 bg-lumina-gold/90 text-lumina-950 text-[9px] font-bold px-1.5 py-0.5 rounded">REVISED</div>}
                              {displayImage && !isThisRevising && (
                                <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button onClick={() => downloadBase64Image(displayImage, `qoolline.png`)} className="bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"><Download size={12} /> Indir</button>
                                  <button onClick={() => setExpandedRevision(isExpanded ? null : result.id)} className="bg-lumina-gold/30 backdrop-blur-sm text-lumina-gold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"><Edit2 size={12} /> Revize</button>
                                </div>
                              )}
                            </div>
                            {isExpanded && (
                              <div className="mt-2 p-2 bg-lumina-950 rounded-lg border border-lumina-800 space-y-1.5">
                                <div className="flex gap-1">
                                  <input type="text" value={revisionPrompts[result.id] || ''} onChange={e => setRevisionPrompts(prev => ({ ...prev, [result.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleRevise(result.id)} placeholder="Nasil degissin?" className="flex-1 bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none placeholder-slate-600" autoFocus />
                                  <button onClick={() => handleRevise(result.id)} disabled={!revisionPrompts[result.id]?.trim()} className="px-2 py-1.5 bg-lumina-gold/20 text-lumina-gold rounded disabled:opacity-30"><Send size={10} /></button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1 px-2 py-1 bg-lumina-900 border border-lumina-800 rounded cursor-pointer hover:border-lumina-gold/50 transition-colors">
                                    <Upload size={10} className="text-slate-500" />
                                    <span className="text-[9px] text-slate-500">{revisionImages[result.id] ? 'Gorsel yuklendi ✓' : 'Referans ekle'}</span>
                                    <input type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { const b = await resizeImageToRawBase64(f, 1200); setRevisionImages(prev => ({ ...prev, [result.id]: b })); } catch {} } }} className="hidden" />
                                  </label>
                                  {revisionImages[result.id] && <button onClick={() => setRevisionImages(prev => ({ ...prev, [result.id]: '' }))} className="text-[9px] text-red-400">Kaldir</button>}
                                </div>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-500 text-center mt-1">
                              {isThisRevising ? 'Revize ediliyor...' : result.revisedImageBase64 ? 'Revize edildi' : result.status === 'completed' ? 'Tamamlandi' : result.status === 'failed' ? 'Basarisiz' : result.status === 'generating' ? 'Uretiliyor' : 'Bekliyor'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {group.length > 1 && group.some(r => r.generatedImageBase64) && (
                      <div className="flex items-center justify-center mt-2 gap-2"><div className="h-px flex-1 bg-lumina-800" /><span className="text-[9px] text-slate-600 px-2">ayni tasarim dili</span><div className="h-px flex-1 bg-lumina-800" /></div>
                    )}
                  </div>
                </div>
              ))}

              {/* Logs */}
              <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-4">
                <h3 className="text-xs text-white font-medium mb-2 flex items-center gap-2"><FileText size={12} className="text-slate-400" /> Loglar</h3>
                <div className="bg-lumina-950 rounded-lg p-3 h-40 overflow-y-auto font-mono text-[10px]">
                  {logs.map((log, i) => <div key={i} className={`py-0.5 ${log.includes('✓') ? 'text-emerald-400' : log.includes('✗') || log.includes('hata') ? 'text-red-400' : log.includes('Beyin') ? 'text-purple-400' : log.includes('Blueprint') ? 'text-blue-400' : 'text-slate-400'}`}>{log}</div>)}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F8BE00]/10 flex items-center justify-center"><Zap size={28} className="text-[#F8BE00]" /></div>
              <h3 className="text-lg font-serif text-white mb-2">Qoolline Kampanya Motoru</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">Referans gorsel yukle, kampanya sec, boyut belirle. Pipeline: Blueprint ayristirma → Kreatif Beyin → Gorsel uretim → Adaptasyon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QoollineHub;

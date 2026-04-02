import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, Globe, Sparkles, Loader2, Download, Square, FileText, Check, XCircle, Clock, Edit2, Send, Upload, RefreshCw, Key } from 'lucide-react';
import { Brand, GeneratedAsset, QoollineCampaign, PipelineImage, PipelineRun, PipelineResult } from '../types';
import { decomposeToBlueprint, analyzeImageStyle, matchTopicsToStyles, reviseGeneratedImage, resizeImageToRawBase64 } from '../services/geminiService';
import { QOOLLINE_CAMPAIGNS, QOOLLINE_COUNTRIES, generateWithOpenAI, getOpenAIKey, setOpenAIKey, hasOpenAIKey } from '../services/qoollineService';
import { downloadBase64Image, downloadMultipleImages } from '../services/downloadService';
import CampaignFactory from './qoolline/CampaignFactory';
import CopywritingPanel from './qoolline/CopywritingPanel';
import CountryThemes from './qoolline/CountryThemes';

type QoollineTab = 'campaigns' | 'copy' | 'countries';

interface GeneratedResult {
  id: string;
  campaignId: string;
  campaignType: string;
  format: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  imageBase64?: string;
  error?: string;
}

interface QoollineHubProps {
  brand: Brand;
  addToHistory: (asset: GeneratedAsset) => void;
}

const QoollineHub: React.FC<QoollineHubProps> = ({ brand, addToHistory }) => {
  const [activeTab, setActiveTab] = useState<QoollineTab>('campaigns');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [countryCampaignId, setCountryCampaignId] = useState(QOOLLINE_CAMPAIGNS[0].id);

  const [expandedRevision, setExpandedRevision] = useState<string | null>(null);
  const [revisionPrompts, setRevisionPrompts] = useState<Record<string, string>>({});
  const [revisionImages, setRevisionImages] = useState<Record<string, string>>({});
  const [revisingIds, setRevisingIds] = useState<Set<string>>(new Set());

  const [openaiKey, setOpenaiKeyState] = useState(getOpenAIKey());
  const [showKeyInput, setShowKeyInput] = useState(!hasOpenAIKey());

  const log = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}] ${msg}`]);
  }, []);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // ═══ GEMINI ANALYZE → OPENAI GENERATE → GEMINI ADAPT ═══
  const handleStartGeneration = useCallback(async (
    campaigns: QoollineCampaign[],
    formats: string[],
    referenceImages: PipelineImage[]
  ) => {
    if (referenceImages.length === 0) { alert('En az 1 referans gorsel yukleyin.'); return; }
    if (!hasOpenAIKey()) { setShowKeyInput(true); return; }

    setIsRunning(true);
    setLogs([]);
    setResults([]);

    const masterFormat = formats[0] || '4:5';
    const adaptFormats = formats.slice(1);

    const initResults: GeneratedResult[] = [];
    campaigns.forEach(c => {
      formats.forEach(f => {
        initResults.push({ id: `${c.id}-${f}-${Date.now()}`, campaignId: c.id, campaignType: c.type, format: f, status: 'pending' });
      });
    });
    setResults(initResults);

    log(`Uretim baslatildi: ${campaigns.length} kampanya x ${formats.length} format`);

    // Step 1: Gemini blueprint analiz (tum referanslar)
    log('Gemini ile blueprint ayristiriliyor...');
    const refAnalyses: { id: string; blueprint: any; style: any; base64: string }[] = [];

    for (let i = 0; i < referenceImages.length; i++) {
      const ref = referenceImages[i];
      try {
        const [blueprint, style] = await Promise.all([
          decomposeToBlueprint(ref.base64),
          analyzeImageStyle(ref.base64),
        ]);
        refAnalyses.push({ id: ref.id, blueprint, style, base64: ref.base64 });
        log(`  ✓ (${i + 1}/${referenceImages.length}) ${ref.name}: ${blueprint.layers?.length || 0} katman, ${style.mood}`);
      } catch (err: any) {
        log(`  ✗ (${i + 1}/${referenceImages.length}) ${ref.name}: ${err.message}`);
      }
    }

    if (refAnalyses.length === 0) { log('Hicbir referans analiz edilemedi.'); setIsRunning(false); return; }

    // Step 2: Gemini eslestirme
    log('Kampanyalar referanslarla eslestiriliyor...');
    const topics = campaigns.map(c => `${c.type}: ${c.core}`);
    let matches: { topicIndex: number; styleId: string }[];

    if (refAnalyses.length === 1) {
      matches = campaigns.map((_, i) => ({ topicIndex: i, styleId: refAnalyses[0].id }));
      log('  Tek referans — tum kampanyalara atandi.');
    } else {
      try {
        matches = await matchTopicsToStyles(topics, refAnalyses.map(r => ({ id: r.id, analysis: r.style })));
        log(`  ✓ ${matches.length} eslestirme yapildi.`);
        matches.forEach(m => {
          const refName = referenceImages.find(r => r.id === m.styleId)?.name || m.styleId;
          log(`    → "${campaigns[m.topicIndex].type}" ↔ ${refName}`);
        });
      } catch {
        matches = campaigns.map((_, i) => ({ topicIndex: i, styleId: refAnalyses[0].id }));
      }
    }

    // Step 3: For each campaign — OpenAI master + Gemini adapt
    for (let ci = 0; ci < campaigns.length; ci++) {
      const campaign = campaigns[ci];
      const match = matches.find(m => m.topicIndex === ci) || { topicIndex: ci, styleId: refAnalyses[0].id };
      const ref = refAnalyses.find(r => r.id === match.styleId) || refAnalyses[0];
      const bp = ref.blueprint;

      // Build detailed edit prompt from blueprint
      const textLayers = bp.layers?.filter((l: any) => l.type === 'text' || l.type === 'logo') || [];
      const campaignTexts = [campaign.core, campaign.supporting, campaign.cta, campaign.extra].filter(Boolean);

      let layerEdits = '';
      textLayers.forEach((l: any, i: number) => {
        if (l.type === 'logo') {
          layerEdits += `- "${l.content}" (${l.position?.anchor || l.position?.x || 'logo'}) → "${brand.name}"\n`;
        } else if (i < campaignTexts.length) {
          layerEdits += `- "${l.content}" (${l.position?.anchor || l.position?.y || ''}) → "${campaignTexts[i]}"\n`;
        }
      });

      const editPrompt = `Bu görseli "${brand.name}" markası için düzenle.

BLUEPRINT ANALİZİ:
- Kompozisyon: ${bp.compositionNotes || bp.layout?.type || ''}
- Stil: ${bp.canvas?.style || ''}
- Katman sayısı: ${bp.layers?.length || 0}

METİN DEĞİŞİKLİKLERİ:
${layerEdits}
RENK DEĞİŞİKLİKLERİ:
- Marka renkleri: ${brand.palette.map((c: any) => `${c.name}: ${c.hex}`).join(', ')}
- Objelerin renklerini marka paletine uyarla

KORU:
- Tüm objeler, kişiler, nesneler aynı kalsın (sadece renkleri değişebilir)
- Genel kompozisyon ve yerleşim aynı kalsın
- Arka plan yapısı korunsun`;

      // 4:5 MASTER — OpenAI
      const masterResultId = initResults.find(r => r.campaignId === campaign.id && r.format === masterFormat)?.id;
      if (!masterResultId) continue;

      setResults(prev => prev.map(r => r.id === masterResultId ? { ...r, status: 'generating' } : r));
      log(`🎨 OpenAI master uretiliyor: "${campaign.type}" [${masterFormat}]`);

      let masterImage: string | null = null;
      try {
        masterImage = await generateWithOpenAI(ref.base64, editPrompt, masterFormat);
        setResults(prev => prev.map(r => r.id === masterResultId ? { ...r, status: 'completed', imageBase64: masterImage! } : r));
        log(`  ✓ Master tamamlandi [${masterFormat}]`);
        addToHistory({ id: `q-${masterResultId}`, url: masterImage, promptUsed: campaign.type, brandId: brand.id, createdAt: Date.now() });
      } catch (err: any) {
        setResults(prev => prev.map(r => r.id === masterResultId ? { ...r, status: 'failed', error: err.message } : r));
        log(`  ✗ Master hatasi: ${err.message}`);
        continue;
      }

      // 9:16 ADAPT — Kie AI Nano Banana Pro (master as reference, same prompt, different aspect ratio)
      for (const fmt of adaptFormats) {
        const adaptResultId = initResults.find(r => r.campaignId === campaign.id && r.format === fmt)?.id;
        if (!adaptResultId || !masterImage) continue;

        setResults(prev => prev.map(r => r.id === adaptResultId ? { ...r, status: 'generating' } : r));
        log(`  📐 Kie AI ile adapt ediliyor: [${masterFormat} → ${fmt}]`);

        try {
          const adaptPrompt = `Bu görselin ${fmt} formatına adaptasyonunu yap. BIREBIR AYNI tasarım dili, renkler, metinler, objeler. Sadece aspect ratio değişiyor: ${masterFormat} → ${fmt}.`;
          const adapted = await generateWithOpenAI(masterImage, adaptPrompt, fmt);
          setResults(prev => prev.map(r => r.id === adaptResultId ? { ...r, status: 'completed', imageBase64: adapted } : r));
          log(`  ✓ Adaptasyon tamamlandi [${fmt}]`);
          addToHistory({ id: `q-${adaptResultId}`, url: adapted, promptUsed: campaign.type, brandId: brand.id, createdAt: Date.now() });
        } catch (err: any) {
          setResults(prev => prev.map(r => r.id === adaptResultId ? { ...r, status: 'failed', error: err.message } : r));
          log(`  ✗ Adaptasyon hatasi: ${err.message}`);
        }
      }
    }

    log('Uretim tamamlandi!');
    setIsRunning(false);
  }, [brand, log, addToHistory]);

  // ═══ REVISE ═══
  const handleRevise = async (resultId: string) => {
    const prompt = revisionPrompts[resultId];
    if (!prompt?.trim()) return;
    const result = results.find(r => r.id === resultId);
    if (!result?.imageBase64) return;

    const siblings = results.filter(r => r.id !== resultId && r.campaignId === result.campaignId && r.imageBase64);
    setRevisingIds(new Set([resultId, ...siblings.map(s => s.id)]));

    try {
      const revised = await generateWithOpenAI(result.imageBase64, prompt, result.format);
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, imageBase64: revised } : r));

      for (const sib of siblings) {
        try {
          const sibRevised = await generateWithOpenAI(sib.imageBase64!, prompt, sib.format);
          setResults(prev => prev.map(r => r.id === sib.id ? { ...r, imageBase64: sibRevised } : r));
        } catch {}
        setRevisingIds(prev => { const n = new Set(prev); n.delete(sib.id); return n; });
      }
    } catch (err: any) { console.error('Revision failed:', err); }

    setRevisingIds(new Set());
    setRevisionPrompts(prev => ({ ...prev, [resultId]: '' }));
    setExpandedRevision(null);
  };

  const handleRegenerate = async (resultId: string) => {
    const result = results.find(r => r.id === resultId);
    if (!result?.imageBase64) return;
    setRevisingIds(new Set([resultId]));
    try {
      const regen = await generateWithOpenAI(result.imageBase64, 'Recreate this image with a slightly different composition but keep the same style, colors, texts, and branding.', result.format);
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, imageBase64: regen } : r));
    } catch {}
    setRevisingIds(new Set());
  };

  const handleDownloadAll = () => {
    const items = results.filter(r => r.imageBase64).map(r => ({ base64: r.imageBase64!, filename: `qoolline-${r.campaignType.replace(/[^a-zA-Z0-9]/g, '-')}-${r.format}.png` }));
    downloadMultipleImages(items);
  };

  const groups: Record<string, GeneratedResult[]> = {};
  results.forEach(r => { if (!groups[r.campaignId]) groups[r.campaignId] = []; groups[r.campaignId].push(r); });

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
          <p className="text-sm text-slate-400 mt-1">Gemini analiz + Kie AI Nano Banana Pro uretim</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowKeyInput(!showKeyInput)} className="p-2 rounded-lg bg-lumina-900 border border-lumina-800 text-slate-400 hover:text-white"><Key size={14} /></button>
          {results.some(r => r.imageBase64) && <button onClick={handleDownloadAll} className="flex items-center gap-2 px-4 py-2 bg-lumina-900 border border-lumina-800 rounded-lg text-xs text-white"><Download size={14} /> Tumunu Indir</button>}
        </div>
      </div>

      {showKeyInput && (
        <div className="mb-4 p-4 bg-lumina-900 border border-lumina-800 rounded-xl">
          <p className="text-xs text-white font-medium mb-2">Kie AI API Key</p>
          <div className="flex gap-2">
            <input type="password" value={openaiKey} onChange={e => setOpenaiKeyState(e.target.value)} placeholder="sk-proj-..." className="flex-1 bg-lumina-950 border border-lumina-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50 placeholder-slate-600" />
            <button onClick={() => { setOpenAIKey(openaiKey.trim()); setShowKeyInput(false); }} disabled={!openaiKey.trim()} className="px-4 py-2 bg-lumina-gold/20 text-lumina-gold rounded-lg text-xs font-bold disabled:opacity-30">Kaydet</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-4">
            <div className="flex gap-1 mb-5 bg-lumina-950 rounded-lg p-1">
              {tabs.map(tab => { const Icon = tab.icon; return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-lumina-gold/10 text-lumina-gold' : 'text-slate-500 hover:text-white'}`}>
                  <Icon size={12} />{tab.label}
                </button>); })}
            </div>
            {activeTab === 'campaigns' && <CampaignFactory brand={brand} onStartGeneration={handleStartGeneration} isRunning={isRunning} />}
            {activeTab === 'copy' && <CopywritingPanel />}
            {activeTab === 'countries' && (
              <CountryThemes selectedCountries={selectedCountries} onToggleCountry={(id) => setSelectedCountries(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })} selectedCampaignId={countryCampaignId} onCampaignChange={setCountryCampaignId} />
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          {results.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groups).map(([cId, group]) => (
                <div key={cId} className="border border-lumina-800 rounded-xl overflow-hidden bg-lumina-950">
                  <div className="px-3 py-2.5 bg-lumina-900/50 border-b border-lumina-800 flex items-center justify-between">
                    <div><p className="text-xs text-white font-medium">{group[0]?.campaignType}</p><span className="text-[10px] text-slate-500">{group.length} boyut</span></div>
                    <button onClick={() => group.forEach(r => { if (r.imageBase64) downloadBase64Image(r.imageBase64, `qoolline-${r.campaignType}-${r.format}.png`); })} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"><Download size={12} /></button>
                  </div>
                  <div className="p-3">
                    <div className="flex gap-3">
                      {group.map(result => {
                        const isR = revisingIds.has(result.id);
                        const isExp = expandedRevision === result.id;
                        const am = result.format.match(/(\d+):(\d+)/);
                        const aw = am ? parseInt(am[1]) : 1;
                        const ah = am ? parseInt(am[2]) : 1;
                        return (
                          <div key={result.id} className="flex-1 min-w-0">
                            <div className="flex items-center justify-center mb-2"><span className="text-[10px] font-bold text-lumina-gold bg-lumina-gold/10 px-2 py-0.5 rounded-full">{result.format}</span></div>
                            <div className="relative rounded-lg overflow-hidden bg-lumina-900 border border-lumina-800 mx-auto" style={{ aspectRatio: `${aw}/${ah}`, maxHeight: ah > aw ? '400px' : '280px' }}>
                              {isR ? (
                                <div className="w-full h-full flex items-center justify-center bg-lumina-900/50">
                                  {result.imageBase64 && <img src={`data:image/png;base64,${result.imageBase64}`} className="w-full h-full object-cover opacity-30 absolute inset-0" />}
                                  <div className="text-center relative z-10"><Loader2 size={24} className="text-lumina-gold animate-spin mx-auto" /><p className="text-xs text-lumina-gold mt-2">Isleniyor...</p></div>
                                </div>
                              ) : result.imageBase64 ? (
                                <img src={`data:image/png;base64,${result.imageBase64}`} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {result.status === 'generating' ? <div className="text-center"><Loader2 size={24} className="text-lumina-gold animate-spin mx-auto" /><p className="text-xs text-slate-500 mt-2">Uretiliyor...</p></div>
                                  : result.status === 'failed' ? <div className="text-center px-3"><XCircle size={24} className="text-red-400 mx-auto" /><p className="text-xs text-red-400 mt-2">{result.error}</p></div>
                                  : <Clock size={24} className="text-slate-600" />}
                                </div>
                              )}
                              {result.imageBase64 && !isR && (
                                <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                  <button onClick={() => downloadBase64Image(result.imageBase64!, `qoolline-${result.format}.png`)} className="bg-white/20 backdrop-blur-sm text-white px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1"><Download size={12} /> Indir</button>
                                  <button onClick={() => handleRegenerate(result.id)} className="bg-blue-500/30 backdrop-blur-sm text-blue-300 px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1"><RefreshCw size={12} /> Yeniden</button>
                                  <button onClick={() => setExpandedRevision(isExp ? null : result.id)} className="bg-lumina-gold/30 backdrop-blur-sm text-lumina-gold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1"><Edit2 size={12} /> Revize</button>
                                </div>
                              )}
                            </div>
                            {isExp && (
                              <div className="mt-2 p-2 bg-lumina-950 rounded-lg border border-lumina-800 space-y-1.5">
                                <div className="flex gap-1">
                                  <input type="text" value={revisionPrompts[result.id] || ''} onChange={e => setRevisionPrompts(prev => ({ ...prev, [result.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleRevise(result.id)} placeholder="Nasil degissin?" className="flex-1 bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none placeholder-slate-600" autoFocus />
                                  <button onClick={() => handleRevise(result.id)} disabled={!revisionPrompts[result.id]?.trim()} className="px-2 py-1.5 bg-lumina-gold/20 text-lumina-gold rounded disabled:opacity-30"><Send size={10} /></button>
                                </div>
                                {group.length > 1 && <p className="text-[9px] text-slate-600">Diger boyut da revize edilecek</p>}
                              </div>
                            )}
                            <p className="text-[10px] text-slate-500 text-center mt-1">{isR ? 'Isleniyor...' : result.status === 'completed' ? 'Tamamlandi' : result.status === 'failed' ? 'Basarisiz' : result.status === 'generating' ? 'Uretiliyor' : 'Bekliyor'}</p>
                          </div>
                        );
                      })}
                    </div>
                    {group.length > 1 && group.some(r => r.imageBase64) && (
                      <div className="flex items-center justify-center mt-2 gap-2"><div className="h-px flex-1 bg-lumina-800" /><span className="text-[9px] text-slate-600 px-2">ayni tasarim dili</span><div className="h-px flex-1 bg-lumina-800" /></div>
                    )}
                  </div>
                </div>
              ))}
              <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-4">
                <h3 className="text-xs text-white font-medium mb-2 flex items-center gap-2"><FileText size={12} className="text-slate-400" /> Loglar</h3>
                <div className="bg-lumina-950 rounded-lg p-3 h-40 overflow-y-auto font-mono text-[10px]">
                  {logs.map((l, i) => <div key={i} className={`py-0.5 ${l.includes('✓') ? 'text-emerald-400' : l.includes('✗') ? 'text-red-400' : l.includes('Blueprint') || l.includes('Gemini') ? 'text-blue-400' : l.includes('OpenAI') ? 'text-green-400' : 'text-slate-400'}`}>{l}</div>)}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F8BE00]/10 flex items-center justify-center"><Zap size={28} className="text-[#F8BE00]" /></div>
              <h3 className="text-lg font-serif text-white mb-2">Qoolline Kampanya Motoru</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">Gemini analiz + OpenAI uretim + Gemini adapt. Referans gorsel yukle, kampanya sec, boyut belirle.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QoollineHub;

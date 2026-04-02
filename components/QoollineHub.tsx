import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Zap, Sparkles, Loader2, Download, FileText, Clock, XCircle, Edit2, Send, Upload, RefreshCw } from 'lucide-react';
import { Brand, GeneratedAsset, QoollineCampaign, PipelineImage, DesignBlueprint, BlueprintLayer } from '../types';
import { decomposeToBlueprint, reviseGeneratedImage, resizeImageToRawBase64 } from '../services/geminiService';
import { QOOLLINE_CAMPAIGNS, generateFromBlueprint } from '../services/qoollineService';
import { downloadBase64Image, downloadMultipleImages } from '../services/downloadService';
import CampaignFactory from './qoolline/CampaignFactory';
import CopywritingPanel from './qoolline/CopywritingPanel';

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
  const [activeTab, setActiveTab] = useState<'campaigns' | 'copy'>('campaigns');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [expandedRevision, setExpandedRevision] = useState<string | null>(null);
  const [revisionPrompts, setRevisionPrompts] = useState<Record<string, string>>({});
  const [revisionImages, setRevisionImages] = useState<Record<string, string>>({});
  const [revisingIds, setRevisingIds] = useState<Set<string>>(new Set());

  const log = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}] ${msg}`]);
  }, []);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // ═══ BLUEPRINT + SIMPLE GENERATE ═══
  const handleStartGeneration = useCallback(async (
    campaigns: QoollineCampaign[],
    formats: string[],
    referenceImages: PipelineImage[]
  ) => {
    if (referenceImages.length === 0) { alert('En az 1 referans gorsel yukleyin.'); return; }

    setIsRunning(true);
    setLogs([]);
    setResults([]);

    const initResults: GeneratedResult[] = [];
    campaigns.forEach(c => {
      formats.forEach(f => {
        initResults.push({ id: `${c.id}-${f}-${Date.now()}`, campaignId: c.id, campaignType: c.type, format: f, status: 'pending' });
      });
    });
    setResults(initResults);

    log(`Uretim baslatildi: ${campaigns.length} kampanya x ${formats.length} format`);

    // Step 1: Blueprint decompose for first reference
    log('Blueprint ayristiriliyor...');
    let blueprint: DesignBlueprint;
    try {
      blueprint = await decomposeToBlueprint(referenceImages[0].base64);
      log(`  ✓ ${blueprint.layers.length} katman tespit edildi`);
    } catch (err: any) {
      log(`  ✗ Blueprint hatasi: ${err.message}`);
      setIsRunning(false);
      return;
    }

    // Step 2: For each campaign, modify blueprint JSON + generate
    for (const campaign of campaigns) {
      // Modify blueprint: replace text layer contents with campaign texts
      const campaignTexts = [campaign.core, campaign.supporting, campaign.cta, campaign.extra].filter(Boolean);
      const modifiedLayers = blueprint.layers.map((layer, i) => {
        const l = { ...layer, style: { ...layer.style } };

        // Replace text layers with campaign texts in order
        if (l.type === 'text' || l.type === 'logo') {
          const textIndex = blueprint.layers.filter((ll, j) => j < i && (ll.type === 'text' || ll.type === 'logo')).length;
          if (l.type === 'logo') {
            l.content = brand.name;
          } else if (textIndex < campaignTexts.length) {
            l.content = campaignTexts[textIndex];
          }
        }

        // Remap colors to brand palette
        if (l.type === 'background') {
          l.style.color = brand.primaryColor;
        }

        return l;
      });

      const modifiedBlueprint = {
        ...blueprint,
        layers: modifiedLayers,
        colorSystem: {
          ...blueprint.colorSystem,
          dominant: brand.primaryColor,
          secondary: brand.secondaryColor,
          accent: brand.palette[2]?.hex || brand.primaryColor,
        },
      };

      const blueprintJson = JSON.stringify(modifiedBlueprint, null, 2);

      // Generate for each format
      for (const fmt of formats) {
        const resultId = initResults.find(r => r.campaignId === campaign.id && r.format === fmt)?.id;
        if (!resultId) continue;

        setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'generating' } : r));
        log(`🎨 Uretiliyor: "${campaign.type}" [${fmt}]`);

        try {
          const image = await generateFromBlueprint(
            blueprintJson,
            referenceImages[0].base64,
            fmt,
            brand.name,
            brand.logo,
          );
          setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'completed', imageBase64: image } : r));
          log(`  ✓ Tamamlandi [${fmt}]`);
          addToHistory({ id: `q-${resultId}`, url: image, promptUsed: campaign.type, brandId: brand.id, createdAt: Date.now() });
        } catch (err: any) {
          setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'failed', error: err.message } : r));
          log(`  ✗ Hata: ${err.message}`);
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
    const allIds = [resultId, ...siblings.map(s => s.id)];
    setRevisingIds(new Set(allIds));

    try {
      const revised = await reviseGeneratedImage(result.imageBase64, prompt, revisionImages[resultId] || null);
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, imageBase64: revised } : r));
      for (const sib of siblings) {
        try {
          const sibRevised = await reviseGeneratedImage(sib.imageBase64!, prompt, null);
          setResults(prev => prev.map(r => r.id === sib.id ? { ...r, imageBase64: sibRevised } : r));
        } catch {}
        setRevisingIds(prev => { const n = new Set(prev); n.delete(sib.id); return n; });
      }
    } catch (err: any) { console.error('Revision failed:', err); }

    setRevisingIds(new Set());
    setRevisionPrompts(prev => ({ ...prev, [resultId]: '' }));
    setRevisionImages(prev => ({ ...prev, [resultId]: '' }));
    setExpandedRevision(null);
  };

  // ═══ REGENERATE ═══
  const handleRegenerate = async (resultId: string) => {
    const result = results.find(r => r.id === resultId);
    if (!result?.imageBase64) return;
    setRevisingIds(new Set([resultId]));
    try {
      const regen = await reviseGeneratedImage(result.imageBase64, 'Bu gorseli farkli bir kompozisyon ile yeniden olustur. Ayni konuyu ve stili koru.', null);
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

  return (
    <div className="p-4 lg:p-6 h-screen overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-serif text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F8BE00]/20 flex items-center justify-center"><Zap size={18} className="text-[#F8BE00]" /></div>
            Qoolline Hub
          </h2>
          <p className="text-sm text-slate-400 mt-1">Blueprint + basit uretim</p>
        </div>
        {results.some(r => r.imageBase64) && (
          <button onClick={handleDownloadAll} className="flex items-center gap-2 px-4 py-2 bg-lumina-900 border border-lumina-800 rounded-lg text-xs text-white"><Download size={14} /> Tumunu Indir</button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-4">
            <div className="flex gap-1 mb-5 bg-lumina-950 rounded-lg p-1">
              {[{ id: 'campaigns', label: 'Kampanya', icon: Zap }, { id: 'copy', label: 'Kopya', icon: Sparkles }].map(tab => {
                const Icon = tab.icon; return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-lumina-gold/10 text-lumina-gold' : 'text-slate-500 hover:text-white'}`}>
                  <Icon size={12} />{tab.label}
                </button>);
              })}
            </div>
            {activeTab === 'campaigns' && <CampaignFactory brand={brand} onStartGeneration={handleStartGeneration} isRunning={isRunning} />}
            {activeTab === 'copy' && <CopywritingPanel />}
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
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1 px-2 py-1 bg-lumina-900 border border-lumina-800 rounded cursor-pointer hover:border-lumina-gold/50">
                                    <Upload size={10} className="text-slate-500" /><span className="text-[9px] text-slate-500">{revisionImages[result.id] ? '✓' : 'Referans ekle'}</span>
                                    <input type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { const b = await resizeImageToRawBase64(f, 1200); setRevisionImages(prev => ({ ...prev, [result.id]: b })); } catch {} } }} className="hidden" />
                                  </label>
                                  {revisionImages[result.id] && <button onClick={() => setRevisionImages(prev => ({ ...prev, [result.id]: '' }))} className="text-[9px] text-red-400">Kaldir</button>}
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
                <div className="bg-lumina-950 rounded-lg p-3 h-32 overflow-y-auto font-mono text-[10px]">
                  {logs.map((l, i) => <div key={i} className={`py-0.5 ${l.includes('✓') ? 'text-emerald-400' : l.includes('✗') ? 'text-red-400' : l.includes('Blueprint') ? 'text-blue-400' : 'text-slate-400'}`}>{l}</div>)}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F8BE00]/10 flex items-center justify-center"><Zap size={28} className="text-[#F8BE00]" /></div>
              <h3 className="text-lg font-serif text-white mb-2">Qoolline Kampanya Motoru</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">Referans gorsel yukle, kampanya sec, boyut belirle. Blueprint ayristirma + basit prompt ile uretim.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QoollineHub;

import React, { useState } from 'react';
import { Download, Edit2, Loader2, Send, XCircle, Clock, RefreshCw, Upload } from 'lucide-react';
import { QoollineGenerationResult } from '../../types';
import { downloadBase64Image } from '../../services/downloadService';
import { resizeImageToRawBase64 } from '../../services/geminiService';

interface QoollineResultsProps {
  results: QoollineGenerationResult[];
  onRevise: (resultId: string, instruction: string, revisionImageBase64?: string) => Promise<void>;
  onRegenerate: (resultId: string) => Promise<void>;
  logs: string[];
}

const QoollineResults: React.FC<QoollineResultsProps> = ({ results, onRevise, onRegenerate, logs }) => {
  const [revisionPrompts, setRevisionPrompts] = useState<Record<string, string>>({});
  const [revisionImages, setRevisionImages] = useState<Record<string, string>>({});
  const [expandedRevision, setExpandedRevision] = useState<string | null>(null);
  const [revisingIds, setRevisingIds] = useState<Set<string>>(new Set());
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

  // Group by campaign (same campaignId = same group, different formats side by side)
  const groups: Record<string, QoollineGenerationResult[]> = {};
  results.forEach(r => { if (!groups[r.campaignId]) groups[r.campaignId] = []; groups[r.campaignId].push(r); });

  const handleRevise = async (resultId: string) => {
    const prompt = revisionPrompts[resultId];
    if (!prompt?.trim()) return;
    setRevisingIds(prev => new Set(prev).add(resultId));
    await onRevise(resultId, prompt, revisionImages[resultId] || undefined);
    setRevisingIds(prev => { const n = new Set(prev); n.delete(resultId); return n; });
    setRevisionPrompts(prev => ({ ...prev, [resultId]: '' }));
    setRevisionImages(prev => ({ ...prev, [resultId]: '' }));
    setExpandedRevision(null);
  };

  const handleRegenerate = async (resultId: string) => {
    setRegeneratingIds(prev => new Set(prev).add(resultId));
    await onRegenerate(resultId);
    setRegeneratingIds(prev => { const n = new Set(prev); n.delete(resultId); return n; });
  };

  const handleRevisionImageUpload = async (resultId: string, file: File) => {
    try {
      const base64 = await resizeImageToRawBase64(file, 1200);
      setRevisionImages(prev => ({ ...prev, [resultId]: base64 }));
    } catch {}
  };

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([campaignId, group]) => {
        const campaignType = group[0]?.campaignType || '';

        return (
          <div key={campaignId} className="border border-lumina-800 rounded-xl overflow-hidden bg-lumina-950">
            <div className="px-3 py-2.5 bg-lumina-900/50 border-b border-lumina-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-white font-medium">{campaignType}</p>
                <span className="text-[10px] text-slate-500">{group.length} boyut — ayni tasarim dili</span>
              </div>
              <button onClick={() => group.forEach(r => { const img = r.revisedImageBase64 || r.imageBase64; if (img) downloadBase64Image(img, `qoolline-${campaignType}-${r.format}.png`); })} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                <Download size={12} />
              </button>
            </div>
            <div className="p-3">
              {/* Side by side — formats as pair */}
              <div className="flex gap-3">
                {group.map(result => {
                  const displayImage = result.revisedImageBase64 || result.imageBase64;
                  const isRevising = revisingIds.has(result.id);
                  const isRegenerating = regeneratingIds.has(result.id);
                  const isExpanded = expandedRevision === result.id;
                  const arMatch = result.format.match(/(\d+):(\d+)/);
                  const arW = arMatch ? parseInt(arMatch[1]) : 1;
                  const arH = arMatch ? parseInt(arMatch[2]) : 1;
                  const isVertical = arH > arW;

                  return (
                    <div key={result.id} className="flex-1 min-w-0">
                      {/* Format label */}
                      <div className="flex items-center justify-center gap-1.5 mb-2">
                        <span className="text-[10px] font-bold text-lumina-gold bg-lumina-gold/10 px-2 py-0.5 rounded-full">{result.format}</span>
                      </div>

                      {/* Image */}
                      <div className="relative rounded-lg overflow-hidden bg-lumina-900 border border-lumina-800" style={{ aspectRatio: `${arW}/${arH}`, maxHeight: isVertical ? '350px' : '250px' }}>
                        {(isRevising || isRegenerating) ? (
                          <div className="w-full h-full flex items-center justify-center">
                            {displayImage && <img src={`data:image/png;base64,${displayImage}`} className="w-full h-full object-cover opacity-30 absolute inset-0" />}
                            <div className="text-center relative z-10">
                              <Loader2 size={20} className="text-lumina-gold animate-spin mx-auto" />
                              <p className="text-[10px] text-lumina-gold mt-1">{isRegenerating ? 'Yeniden uretiliyor...' : 'Revize ediliyor...'}</p>
                            </div>
                          </div>
                        ) : displayImage ? (
                          <img src={`data:image/png;base64,${displayImage}`} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {result.status === 'generating' ? (
                              <div className="text-center"><Loader2 size={20} className="text-lumina-gold animate-spin mx-auto" /><p className="text-[10px] text-slate-500 mt-1">Uretiliyor...</p></div>
                            ) : result.status === 'failed' ? (
                              <div className="text-center px-2"><XCircle size={20} className="text-red-400 mx-auto" /><p className="text-[10px] text-red-400 mt-1">{result.error || 'Hata'}</p></div>
                            ) : (
                              <Clock size={20} className="text-slate-600" />
                            )}
                          </div>
                        )}

                        {result.revisedImageBase64 && !isRevising && (
                          <div className="absolute top-2 left-2 bg-lumina-gold/90 text-lumina-950 text-[9px] font-bold px-1.5 py-0.5 rounded">REVISED</div>
                        )}

                        {/* Action overlay */}
                        {displayImage && !isRevising && !isRegenerating && (
                          <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            <button onClick={() => downloadBase64Image(displayImage, `qoolline-${campaignType}-${result.format}.png`)} className="bg-white/20 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-[10px] flex items-center gap-1">
                              <Download size={10} /> Indir
                            </button>
                            <button onClick={() => handleRegenerate(result.id)} className="bg-blue-500/30 backdrop-blur-sm text-blue-300 px-2 py-1 rounded-lg text-[10px] flex items-center gap-1">
                              <RefreshCw size={10} /> Yeniden
                            </button>
                            <button onClick={() => setExpandedRevision(isExpanded ? null : result.id)} className="bg-lumina-gold/30 backdrop-blur-sm text-lumina-gold px-2 py-1 rounded-lg text-[10px] flex items-center gap-1">
                              <Edit2 size={10} /> Revize
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Revision input with image upload */}
                      {isExpanded && (
                        <div className="mt-2 p-2 bg-lumina-950 rounded-lg border border-lumina-800 space-y-1.5">
                          <div className="flex gap-1">
                            <input type="text" value={revisionPrompts[result.id] || ''} onChange={e => setRevisionPrompts(prev => ({ ...prev, [result.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleRevise(result.id)} placeholder="Nasil degissin?" className="flex-1 bg-lumina-900 border border-lumina-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none placeholder-slate-600" autoFocus />
                            <button onClick={() => handleRevise(result.id)} disabled={!revisionPrompts[result.id]?.trim()} className="px-1.5 bg-lumina-gold/20 text-lumina-gold rounded disabled:opacity-30"><Send size={10} /></button>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 px-2 py-1 bg-lumina-900 border border-lumina-800 rounded cursor-pointer hover:border-lumina-gold/50 transition-colors">
                              <Upload size={10} className="text-slate-500" />
                              <span className="text-[9px] text-slate-500">{revisionImages[result.id] ? 'Gorsel yuklendi ✓' : 'Referans ekle'}</span>
                              <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleRevisionImageUpload(result.id, f); }} className="hidden" />
                            </label>
                            {revisionImages[result.id] && (
                              <button onClick={() => setRevisionImages(prev => ({ ...prev, [result.id]: '' }))} className="text-[9px] text-red-400 hover:text-red-300">Kaldir</button>
                            )}
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-500 text-center mt-1">
                        {isRegenerating ? 'Yeniden uretiliyor...' : isRevising ? 'Revize ediliyor...' : result.revisedImageBase64 ? 'Revize edildi' : result.status === 'completed' ? 'Tamamlandi' : result.status === 'failed' ? 'Basarisiz' : result.status === 'pending' ? 'Bekliyor' : 'Isleniyor...'}
                      </p>
                    </div>
                  );
                })}
              </div>
              {/* Pair indicator */}
              {group.length > 1 && group.some(r => r.imageBase64) && (
                <div className="flex items-center justify-center mt-2 gap-2">
                  <div className="h-px flex-1 bg-lumina-800" /><span className="text-[9px] text-slate-600 px-2">ayni tasarim dili</span><div className="h-px flex-1 bg-lumina-800" />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {logs.length > 0 && (
        <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-3">
          <h4 className="text-xs text-white font-medium mb-2">Loglar</h4>
          <div className="bg-lumina-950 rounded-lg p-2 h-32 overflow-y-auto font-mono text-[10px]">
            {logs.map((log, i) => (
              <div key={i} className={`py-0.5 ${log.includes('✓') ? 'text-emerald-400' : log.includes('✗') || log.includes('hata') ? 'text-red-400' : log.includes('QC') ? 'text-indigo-400' : 'text-slate-400'}`}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QoollineResults;

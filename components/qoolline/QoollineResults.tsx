import React, { useState } from 'react';
import { Download, Edit2, Loader2, Send, XCircle, Clock } from 'lucide-react';
import { QoollineGenerationResult } from '../../types';
import { downloadBase64Image } from '../../services/downloadService';

interface QoollineResultsProps {
  results: QoollineGenerationResult[];
  onRevise: (resultId: string, instruction: string) => Promise<void>;
  logs: string[];
}

const QoollineResults: React.FC<QoollineResultsProps> = ({ results, onRevise, logs }) => {
  const [revisionPrompts, setRevisionPrompts] = useState<Record<string, string>>({});
  const [expandedRevision, setExpandedRevision] = useState<string | null>(null);
  const [revisingIds, setRevisingIds] = useState<Set<string>>(new Set());

  const groups: Record<string, QoollineGenerationResult[]> = {};
  results.forEach(r => { if (!groups[r.campaignType]) groups[r.campaignType] = []; groups[r.campaignType].push(r); });

  const handleRevise = async (resultId: string) => {
    const prompt = revisionPrompts[resultId];
    if (!prompt?.trim()) return;
    setRevisingIds(prev => new Set(prev).add(resultId));
    await onRevise(resultId, prompt);
    setRevisingIds(prev => { const n = new Set(prev); n.delete(resultId); return n; });
    setRevisionPrompts(prev => ({ ...prev, [resultId]: '' }));
    setExpandedRevision(null);
  };

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([campaignType, group]) => (
        <div key={campaignType} className="border border-lumina-800 rounded-xl overflow-hidden bg-lumina-950">
          <div className="px-3 py-2.5 bg-lumina-900/50 border-b border-lumina-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-white font-medium">{campaignType}</p>
              <span className="text-[10px] text-slate-500">{group.length} gorsel</span>
            </div>
            <button onClick={() => { group.forEach(r => { const img = r.revisedImageBase64 || r.imageBase64; if (img) downloadBase64Image(img, `qoolline-${r.campaignType}-${r.format}.png`); }); }} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
              <Download size={12} />
            </button>
          </div>
          <div className="p-3">
            <div className="flex gap-3 flex-wrap">
              {group.map(result => {
                const displayImage = result.revisedImageBase64 || result.imageBase64;
                const isRevising = revisingIds.has(result.id);
                const isExpanded = expandedRevision === result.id;
                const arMatch = result.format.match(/(\d+):(\d+)/);
                const arW = arMatch ? parseInt(arMatch[1]) : 1;
                const arH = arMatch ? parseInt(arMatch[2]) : 1;
                const isVertical = arH > arW;

                return (
                  <div key={result.id} className="flex-1 min-w-[140px] max-w-[250px]">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <span className="text-[10px] font-bold text-lumina-gold bg-lumina-gold/10 px-2 py-0.5 rounded-full">{result.format}</span>
                    </div>
                    <div className="relative rounded-lg overflow-hidden bg-lumina-900 border border-lumina-800" style={{ aspectRatio: `${arW}/${arH}`, maxHeight: isVertical ? '350px' : '250px' }}>
                      {isRevising ? (
                        <div className="w-full h-full flex items-center justify-center">
                          {displayImage && <img src={`data:image/png;base64,${displayImage}`} className="w-full h-full object-cover opacity-30 absolute inset-0" />}
                          <div className="text-center relative z-10">
                            <Loader2 size={20} className="text-lumina-gold animate-spin mx-auto" />
                            <p className="text-[10px] text-lumina-gold mt-1">Revize ediliyor...</p>
                          </div>
                        </div>
                      ) : displayImage ? (
                        <img src={`data:image/png;base64,${displayImage}`} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {result.status === 'generating' || result.status === 'qc-checking' || result.status === 'revising' ? (
                            <div className="text-center">
                              <Loader2 size={20} className="text-lumina-gold animate-spin mx-auto" />
                              <p className="text-[10px] text-slate-500 mt-1">{result.status === 'qc-checking' ? 'QC kontrol...' : result.status === 'revising' ? 'Revize...' : 'Uretiliyor...'}</p>
                            </div>
                          ) : result.status === 'failed' ? (
                            <div className="text-center px-2">
                              <XCircle size={20} className="text-red-400 mx-auto" />
                              <p className="text-[10px] text-red-400 mt-1">{result.error || 'Hata'}</p>
                            </div>
                          ) : (
                            <Clock size={20} className="text-slate-600" />
                          )}
                        </div>
                      )}

                      {result.qc && (
                        <div className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${result.qc.passed ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`} title={result.qc.issues.join(', ')}>
                          QC {result.qc.score}/10{result.qcRetryCount > 0 ? ` (${result.qcRetryCount}R)` : ''}
                        </div>
                      )}

                      {result.revisedImageBase64 && (
                        <div className="absolute top-2 right-2 bg-lumina-gold/90 text-lumina-950 text-[9px] font-bold px-1.5 py-0.5 rounded">REVISED</div>
                      )}

                      {displayImage && !isRevising && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button onClick={() => downloadBase64Image(displayImage, `qoolline-${result.campaignType}-${result.format}.png`)} className="bg-white/20 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-[10px] flex items-center gap-1">
                            <Download size={10} /> Indir
                          </button>
                          <button onClick={() => setExpandedRevision(isExpanded ? null : result.id)} className="bg-lumina-gold/30 backdrop-blur-sm text-lumina-gold px-2 py-1 rounded-lg text-[10px] flex items-center gap-1">
                            <Edit2 size={10} /> Revize
                          </button>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-2 p-2 bg-lumina-950 rounded-lg border border-lumina-800">
                        <div className="flex gap-1">
                          <input type="text" value={revisionPrompts[result.id] || ''} onChange={e => setRevisionPrompts(prev => ({ ...prev, [result.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleRevise(result.id)} placeholder="Nasil degissin?" className="flex-1 bg-lumina-900 border border-lumina-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none placeholder-slate-600" autoFocus />
                          <button onClick={() => handleRevise(result.id)} className="px-1.5 bg-lumina-gold/20 text-lumina-gold rounded"><Send size={10} /></button>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500 text-center mt-1">
                      {result.status === 'completed' ? 'Tamamlandi' : result.status === 'failed' ? 'Basarisiz' : result.status === 'pending' ? 'Bekliyor' : 'Isleniyor...'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

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

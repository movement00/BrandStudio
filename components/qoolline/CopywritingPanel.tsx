import React, { useState } from 'react';
import { Loader2, Copy, RefreshCw, Sparkles, Upload, Image as ImageIcon } from 'lucide-react';
import { QoollineCampaign, CopyVariant, PipelineImage } from '../../types';
import { QOOLLINE_CAMPAIGNS, generateCopyVariants } from '../../services/qoollineService';
import { resizeImageToRawBase64 } from '../../services/geminiService';

interface CopywritingPanelProps {
  onSelectVariant?: (variant: CopyVariant) => void;
  onGenerateWithVariant?: (variant: CopyVariant, referenceImage: PipelineImage) => void;
}

const CopywritingPanel: React.FC<CopywritingPanelProps> = ({ onSelectVariant, onGenerateWithVariant }) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState(QOOLLINE_CAMPAIGNS[0].id);
  const [variants, setVariants] = useState<CopyVariant[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [countryContext, setCountryContext] = useState('');
  const [referenceImage, setReferenceImage] = useState<PipelineImage | null>(null);

  const campaign = QOOLLINE_CAMPAIGNS.find(c => c.id === selectedCampaignId)!;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const results = await generateCopyVariants(campaign, 4, countryContext || undefined);
      setVariants(results);
    } catch (err: any) { console.error('Copy generation error:', err); }
    setIsGenerating(false);
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-white flex items-center gap-2">
        <Sparkles size={14} className="text-lumina-gold" />
        Copywriting Agent
      </h3>

      <select value={selectedCampaignId} onChange={e => { setSelectedCampaignId(e.target.value); setVariants([]); }} className="w-full bg-lumina-900 border border-lumina-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50">
        {QOOLLINE_CAMPAIGNS.map(c => (<option key={c.id} value={c.id}>{c.type}: {c.core}</option>))}
      </select>

      <input type="text" value={countryContext} onChange={e => setCountryContext(e.target.value)} placeholder="Ulke baglami (opsiyonel): orn. UK travelers to Europe" className="w-full bg-lumina-900 border border-lumina-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50 placeholder-slate-600" />

      <div className="p-3 bg-lumina-900 border border-lumina-800 rounded-lg">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Orijinal</p>
        <p className="text-xs text-white font-medium">{campaign.core}</p>
        <p className="text-[11px] text-slate-400">{campaign.supporting}</p>
        <span className="inline-block mt-1 px-2 py-0.5 bg-[#F8BE00]/20 text-[#F8BE00] text-[10px] rounded-full font-bold">{campaign.cta}</span>
      </div>

      <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-2 bg-lumina-gold/10 text-lumina-gold border border-lumina-gold/30 rounded-lg text-xs font-bold hover:bg-lumina-gold/20 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {isGenerating ? 'Uretiliyor...' : `${variants.length > 0 ? 'Yeniden ' : ''}4 Varyant Uret`}
      </button>

      {variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">A/B Varyantlari</p>
          {/* Reference image for variant generation */}
          <div className="mb-3 p-2 bg-lumina-950 border border-lumina-800 rounded-lg">
            {referenceImage ? (
              <div className="flex items-center gap-2">
                <img src={`data:image/png;base64,${referenceImage.base64}`} className="w-10 h-10 rounded object-cover" />
                <span className="text-[10px] text-slate-400 flex-1 truncate">{referenceImage.name}</span>
                <button onClick={() => setReferenceImage(null)} className="text-red-400 text-[10px]">Kaldir</button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer hover:text-lumina-gold transition-colors">
                <Upload size={12} className="text-slate-500" />
                <span className="text-[10px] text-slate-500">Gorsel yukle — varyantlarla birlikte uretim yap</span>
                <input type="file" accept="image/*" onChange={async e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    try {
                      const b64 = await resizeImageToRawBase64(f, 1200);
                      setReferenceImage({ id: `copy-ref-${Date.now()}`, base64: b64, name: f.name });
                    } catch {}
                  }
                }} className="hidden" />
              </label>
            )}
          </div>
          {variants.map((v, i) => (
            <div key={v.id} className="p-3 bg-lumina-950 border border-lumina-800 rounded-lg hover:border-lumina-gold/30 transition-all cursor-pointer group" onClick={() => onSelectVariant?.(v)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-lumina-gold bg-lumina-gold/10 px-1.5 py-0.5 rounded">V{i + 1}</span>
                  <p className="text-xs text-white font-medium mt-1">{v.headline}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{v.supporting}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-[#00CC9B]/20 text-[#00CC9B] text-[10px] rounded-full font-bold">{v.cta}</span>
                  {v.extra && <p className="text-[10px] text-slate-500 mt-1">{v.extra}</p>}
                  <p className="text-[9px] text-slate-600 mt-1.5 italic">{v.reasoning}</p>
                </div>
                {referenceImage && onGenerateWithVariant && (
                  <button onClick={(e) => { e.stopPropagation(); onGenerateWithVariant(v, referenceImage); }} className="opacity-0 group-hover:opacity-100 p-1 text-lumina-gold hover:text-lumina-gold/80 transition-all" title="Bu varyantla gorsel uret">
                    <ImageIcon size={12} />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); copyToClipboard(`${v.headline}\n${v.supporting}\n${v.cta}`); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-white transition-all" title="Kopyala">
                  <Copy size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CopywritingPanel;

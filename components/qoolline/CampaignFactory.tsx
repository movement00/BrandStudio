import React, { useState } from 'react';
import { Check, Zap, Upload, X, Plus, Loader2, Sparkles, Download } from 'lucide-react';
import { Brand, QoollineCampaign, PipelineImage } from '../../types';
import { QOOLLINE_CAMPAIGNS, generateCampaignTemplates } from '../../services/qoollineService';
import { resizeImageToRawBase64 } from '../../services/geminiService';

interface CampaignFactoryProps {
  brand: Brand;
  onStartGeneration: (campaigns: QoollineCampaign[], formats: string[], referenceImages: PipelineImage[]) => void;
  isRunning: boolean;
}

const FORMATS = [
  { label: '1:1 Square', value: '1:1' },
  { label: '4:5 Portrait', value: '4:5' },
  { label: '9:16 Story', value: '9:16' },
  { label: '16:9 Landscape', value: '16:9' },
];

const CampaignFactory: React.FC<CampaignFactoryProps> = ({ brand, onStartGeneration, isRunning }) => {
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set(QOOLLINE_CAMPAIGNS.map(c => c.id)));
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set(['4:5', '9:16']));
  const [referenceImages, setReferenceImages] = useState<PipelineImage[]>([]);
  const [customCampaigns, setCustomCampaigns] = useState<QoollineCampaign[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCore, setCustomCore] = useState('');
  const [customSupporting, setCustomSupporting] = useState('');
  const [customCta, setCustomCta] = useState('');
  const [customExtra, setCustomExtra] = useState('');
  const [customType, setCustomType] = useState('Custom');
  const [isGeneratingTemplates, setIsGeneratingTemplates] = useState(false);
  const [templateCount, setTemplateCount] = useState(6);
  const [templateStyle, setTemplateStyle] = useState('');

  const toggleCampaign = (id: string) => {
    setSelectedCampaigns(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleFormat = (value: string) => {
    setSelectedFormats(prev => { const next = new Set(prev); if (next.has(value)) next.delete(value); else next.add(value); return next; });
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    const newImages: PipelineImage[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const base64 = await resizeImageToRawBase64(files[i], 1200);
        newImages.push({ id: `ref-${Date.now()}-${i}`, base64, name: files[i].name });
      } catch (err) { console.error('Upload error:', err); }
    }
    setReferenceImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => setReferenceImages(prev => prev.filter(img => img.id !== id));

  const allCampaigns = [...QOOLLINE_CAMPAIGNS, ...customCampaigns];
  const selectedCampaignList = allCampaigns.filter(c => selectedCampaigns.has(c.id));
  const totalImages = selectedCampaignList.length * selectedFormats.size;

  const addCustomCampaign = () => {
    if (!customCore.trim()) return;
    const id = `custom-${Date.now()}`;
    const newCampaign: QoollineCampaign = { id, type: customType || 'Custom', core: customCore, supporting: customSupporting, cta: customCta || 'Learn More', extra: customExtra, notes: '' };
    setCustomCampaigns(prev => [...prev, newCampaign]);
    setSelectedCampaigns(prev => new Set(prev).add(id));
    setCustomCore(''); setCustomSupporting(''); setCustomCta(''); setCustomExtra(''); setCustomType('Custom');
    setShowCustomInput(false);
  };

  const removeCustomCampaign = (id: string) => {
    setCustomCampaigns(prev => prev.filter(c => c.id !== id));
    setSelectedCampaigns(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleGenerateTemplates = async () => {
    setIsGeneratingTemplates(true);
    try {
      const generated = await generateCampaignTemplates(brand, templateCount, [...QOOLLINE_CAMPAIGNS, ...customCampaigns], templateStyle || undefined);
      setCustomCampaigns(prev => [...prev, ...generated]);
      generated.forEach(c => setSelectedCampaigns(prev => new Set(prev).add(c.id)));
    } catch (err: any) {
      console.error('Template generation error:', err);
      alert('Sablon uretimi basarisiz: ' + err.message);
    }
    setIsGeneratingTemplates(false);
  };

  const exportToExcel = () => {
    const rows = allCampaigns.map(c => [c.type, c.core, c.supporting, c.cta, c.extra, c.notes].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','));
    const csv = 'Type,Core,Supporting Text,CTA,Extra Texts,Notes\n' + rows.join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Qoolline_Kampanya_Sablonlari_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Reference Images */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Referans Gorseller</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {referenceImages.map(img => (
            <div key={img.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-lumina-800 group">
              <img src={`data:image/png;base64,${img.base64}`} className="w-full h-full object-cover" />
              <button onClick={() => removeImage(img.id)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <X size={14} className="text-white" />
              </button>
            </div>
          ))}
          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-lumina-700 flex items-center justify-center cursor-pointer hover:border-lumina-gold/50 transition-colors">
            <Upload size={16} className="text-slate-500" />
            <input type="file" multiple accept="image/*" onChange={e => handleImageUpload(e.target.files)} className="hidden" />
          </label>
        </div>
        <p className="text-[10px] text-slate-600">Stil referansi olarak kullanilacak gorseller (opsiyonel)</p>
      </div>

      {/* Campaign Templates */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Kampanya Sablonlari</h3>
          <button onClick={() => setSelectedCampaigns(prev => prev.size === allCampaigns.length ? new Set() : new Set(allCampaigns.map(c => c.id)))} className="text-[10px] text-lumina-gold hover:underline">
            {selectedCampaigns.size === allCampaigns.length ? 'Hicbirini Sec' : 'Tumunu Sec'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QOOLLINE_CAMPAIGNS.map(campaign => {
            const isSelected = selectedCampaigns.has(campaign.id);
            return (
              <button key={campaign.id} onClick={() => toggleCampaign(campaign.id)} className={`text-left p-3 rounded-lg border transition-all ${isSelected ? 'border-lumina-gold/50 bg-lumina-gold/5' : 'border-lumina-800 bg-lumina-900 hover:border-lumina-700'}`}>
                <div className="flex items-start gap-2">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? 'bg-lumina-gold border-lumina-gold' : 'border-lumina-700'}`}>
                    {isSelected && <Check size={10} className="text-lumina-950" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white">{campaign.type}</p>
                    <p className="text-[11px] text-lumina-gold mt-0.5">"{campaign.core}"</p>
                    <p className="text-[10px] text-slate-500 mt-1">{campaign.notes}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Campaigns */}
      {customCampaigns.map(c => (
        <div key={c.id} className="flex items-start gap-2 p-3 rounded-lg border border-lumina-gold/50 bg-lumina-gold/5">
          <div className={`w-4 h-4 rounded border bg-lumina-gold border-lumina-gold flex items-center justify-center shrink-0 mt-0.5`}>
            <Check size={10} className="text-lumina-950" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white">{c.type}</p>
            <p className="text-[11px] text-lumina-gold">"{c.core}"</p>
          </div>
          <button onClick={() => removeCustomCampaign(c.id)} className="text-red-400 hover:text-red-300 shrink-0"><X size={12} /></button>
        </div>
      ))}

      {showCustomInput ? (
        <div className="p-3 bg-lumina-950 border border-lumina-800 rounded-lg space-y-2">
          <input type="text" value={customType} onChange={e => setCustomType(e.target.value)} placeholder="Kampanya tipi (orn: Promo)" className="w-full bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none placeholder-slate-600" />
          <input type="text" value={customCore} onChange={e => setCustomCore(e.target.value)} placeholder="Ana baslik *" className="w-full bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none placeholder-slate-600" />
          <input type="text" value={customSupporting} onChange={e => setCustomSupporting(e.target.value)} placeholder="Destek metin" className="w-full bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none placeholder-slate-600" />
          <input type="text" value={customCta} onChange={e => setCustomCta(e.target.value)} placeholder="CTA butonu (orn: Get eSIM)" className="w-full bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none placeholder-slate-600" />
          <input type="text" value={customExtra} onChange={e => setCustomExtra(e.target.value)} placeholder="Ekstra bilgi" className="w-full bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none placeholder-slate-600" />
          <div className="flex gap-2">
            <button onClick={addCustomCampaign} disabled={!customCore.trim()} className="flex-1 py-1.5 bg-lumina-gold/20 text-lumina-gold rounded text-[11px] font-bold disabled:opacity-30">Ekle</button>
            <button onClick={() => setShowCustomInput(false)} className="px-3 py-1.5 bg-lumina-900 text-slate-400 rounded text-[11px]">Iptal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowCustomInput(true)} className="w-full py-2 border-2 border-dashed border-lumina-700 rounded-lg text-xs text-slate-500 hover:border-lumina-gold/50 hover:text-lumina-gold transition-all flex items-center justify-center gap-1.5">
          <Plus size={14} /> Ozel Kampanya Ekle
        </button>
      )}

      {/* AI Template Generator */}
      <div className="p-3 bg-lumina-950 border border-lumina-800 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-white flex items-center gap-1.5"><Sparkles size={12} className="text-lumina-gold" /> AI Sablon Uret</h3>
          <select value={templateCount} onChange={e => setTemplateCount(Number(e.target.value))} className="bg-lumina-900 border border-lumina-800 rounded px-2 py-1 text-[10px] text-white">
            <option value={3}>3</option><option value={6}>6</option><option value={10}>10</option>
          </select>
        </div>
        <input type="text" value={templateStyle} onChange={e => setTemplateStyle(e.target.value)} placeholder="Stil yonlendirmesi (opsiyonel): orn. seasonal, emotional, luxury..." className="w-full bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none placeholder-slate-600 mb-2" />
        <div className="flex gap-2">
          <button onClick={handleGenerateTemplates} disabled={isGeneratingTemplates} className="flex-1 py-2 bg-lumina-gold/10 text-lumina-gold border border-lumina-gold/30 rounded-lg text-xs font-bold hover:bg-lumina-gold/20 transition-all disabled:opacity-30 flex items-center justify-center gap-1.5">
            {isGeneratingTemplates ? <><Loader2 size={12} className="animate-spin" /> Uretiliyor...</> : <><Sparkles size={12} /> {templateCount} Sablon Uret</>}
          </button>
          <button onClick={exportToExcel} className="px-3 py-2 bg-lumina-900 border border-lumina-800 rounded-lg text-xs text-slate-400 hover:text-white transition-all flex items-center gap-1" title="Kampanyalari Excel olarak indir">
            <Download size={12} /> Excel
          </button>
        </div>
      </div>

      {/* Format Selection */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Boyutlar</h3>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map(fmt => {
            const isSelected = selectedFormats.has(fmt.value);
            return (
              <button key={fmt.value} onClick={() => toggleFormat(fmt.value)} className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${isSelected ? 'border-lumina-gold/50 bg-lumina-gold/10 text-lumina-gold' : 'border-lumina-800 text-slate-400 hover:border-lumina-700'}`}>
                {fmt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Button */}
      <button onClick={() => onStartGeneration(selectedCampaignList, Array.from(selectedFormats), referenceImages)} disabled={isRunning || selectedCampaignList.length === 0 || selectedFormats.size === 0} className="w-full py-3 bg-[#F8BE00] text-[#201C1D] rounded-xl font-bold text-sm hover:bg-[#F8BE00]/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        <Zap size={16} />
        Kampanya Uret — {totalImages} gorsel ({selectedCampaigns.size} kampanya x {selectedFormats.size} boyut)
      </button>
    </div>
  );
};

export default CampaignFactory;

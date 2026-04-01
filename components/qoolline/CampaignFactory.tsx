import React, { useState } from 'react';
import { Check, Zap, Upload, X } from 'lucide-react';
import { Brand, QoollineCampaign, PipelineImage } from '../../types';
import { QOOLLINE_CAMPAIGNS } from '../../services/qoollineService';
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

  const selectedCampaignList = QOOLLINE_CAMPAIGNS.filter(c => selectedCampaigns.has(c.id));
  const totalImages = selectedCampaignList.length * selectedFormats.size;

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
          <button onClick={() => setSelectedCampaigns(prev => prev.size === QOOLLINE_CAMPAIGNS.length ? new Set() : new Set(QOOLLINE_CAMPAIGNS.map(c => c.id)))} className="text-[10px] text-lumina-gold hover:underline">
            {selectedCampaigns.size === QOOLLINE_CAMPAIGNS.length ? 'Hicbirini Sec' : 'Tumunu Sec'}
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
      <button onClick={() => onStartGeneration(selectedCampaignList, Array.from(selectedFormats), referenceImages)} disabled={isRunning || selectedCampaigns.size === 0 || selectedFormats.size === 0} className="w-full py-3 bg-[#F8BE00] text-[#201C1D] rounded-xl font-bold text-sm hover:bg-[#F8BE00]/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        <Zap size={16} />
        Kampanya Uret — {totalImages} gorsel ({selectedCampaigns.size} kampanya x {selectedFormats.size} boyut)
      </button>
    </div>
  );
};

export default CampaignFactory;

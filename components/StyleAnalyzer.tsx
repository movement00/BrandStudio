
import React, { useState, useEffect } from 'react';
import { Brand, StyleAnalysis, SavedTemplate, GeneratedAsset, TemplateFolder } from '../types';
import { Upload, Sparkles, Save, Image as ImageIcon, Loader2, RefreshCw, RectangleHorizontal, RectangleVertical, Square, Edit3, Send } from 'lucide-react';
import { analyzeImageStyle, generateBrandedImage, fileToGenerativePart, reviseGeneratedImage } from '../services/geminiService';
import { downloadBase64Image } from '../services/downloadService';

interface StyleAnalyzerProps {
  brands: Brand[];
  templates: SavedTemplate[];
  folders: TemplateFolder[];
  setTemplates: React.Dispatch<React.SetStateAction<SavedTemplate[]>>;
  addToHistory: (asset: GeneratedAsset) => void;
  initialTemplate: SavedTemplate | null;
  clearInitialTemplate: () => void;
}

const StyleAnalyzer: React.FC<StyleAnalyzerProps> = ({ 
  brands, 
  templates, 
  folders, 
  setTemplates, 
  addToHistory,
  initialTemplate,
  clearInitialTemplate
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  
  // Generation Input
  const [selectedBrandId, setSelectedBrandId] = useState<string>(brands[0]?.id || '');
  const [contextText, setContextText] = useState('');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  
  // New Aspect Ratio State
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");

  // Template handling
  const [templateName, setTemplateName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  // Revision State
  const [isRevising, setIsRevising] = useState(false);
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [revisionImage, setRevisionImage] = useState<string | null>(null);

  // Load Initial Template if available
  useEffect(() => {
    if (initialTemplate) {
      setReferenceImage(initialTemplate.thumbnail);
      setAnalysis(initialTemplate.analysis);
      setTemplateName(initialTemplate.name); // Pre-fill name if re-saving
      if(initialTemplate.folderId) setSelectedFolderId(initialTemplate.folderId);
      setStep(2); // Skip to step 2
      // Don't clear immediately to allow re-renders, but ideally we clear after loading
      // clearInitialTemplate(); // Optional: Clear so we don't reload on every render if parent doesn't clear
    }
  }, [initialTemplate]);

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLoading(true);
      setError(null);
      try {
        const base64 = await fileToGenerativePart(e.target.files[0]);
        setReferenceImage(base64);
        
        // Analyze immediately upon upload
        const result = await analyzeImageStyle(base64);
        setAnalysis(result);
        setStep(2);
      } catch (err) {
        console.error(err);
        setError("Görsel analiz edilemedi. Lütfen tekrar deneyin.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToGenerativePart(e.target.files[0]);
      setProductImage(base64);
    }
  };

  const handleRevisionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToGenerativePart(e.target.files[0]);
      setRevisionImage(base64);
    }
  };

  const handleGenerate = async () => {
    if (!analysis || !selectedBrandId) return;
    
    setLoading(true);
    setError(null);
    setIsApiKeyMissing(false);
    setIsRevising(false);

    try {
      const brand = brands.find(b => b.id === selectedBrandId);
      if (!brand) throw new Error("Marka bulunamadı");

      const generatedBase64 = await generateBrandedImage(
        brand, 
        analysis, 
        referenceImage, 
        productImage, 
        contextText, 
        aspectRatio
      );
      setGeneratedImage(generatedBase64);
      setStep(3);

      // Save to temporary history
      addToHistory({
        id: Date.now().toString(),
        url: generatedBase64,
        promptUsed: JSON.stringify(analysis),
        brandId: brand.id,
        createdAt: Date.now()
      });

    } catch (err: any) {
      console.error(err);
      if (err.message === 'API_KEY_MISSING') {
         setIsApiKeyMissing(true);
      } else {
        setError("Görsel oluşturulamadı. API kullanım izniniz olduğundan emin olun.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevisionSubmit = async () => {
    if (!generatedImage || !revisionPrompt) return;

    setLoading(true);
    setError(null);

    try {
      const newImage = await reviseGeneratedImage(generatedImage, revisionPrompt, revisionImage);
      setGeneratedImage(newImage);
      
      // Reset revision inputs but keep generatedImage updated
      setRevisionPrompt('');
      setRevisionImage(null);
      
      // Add revised version to history
      const brand = brands.find(b => b.id === selectedBrandId);
      addToHistory({
        id: Date.now().toString(),
        url: newImage,
        promptUsed: `Revision: ${revisionPrompt}`,
        brandId: brand?.id || '',
        createdAt: Date.now()
      });

    } catch (err: any) {
      console.error(err);
       if (err.message === 'API_KEY_MISSING') {
         setIsApiKeyMissing(true);
      } else {
        setError("Revize işlemi başarısız oldu.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = () => {
    if (!analysis || !templateName || !referenceImage) return;
    
    setTemplates(prev => [...prev, {
      id: Date.now().toString(),
      name: templateName,
      thumbnail: referenceImage,
      analysis: analysis,
      folderId: selectedFolderId || undefined,
      createdAt: Date.now()
    }]);
    setTemplateName('');
    alert("Stil Şablonu Kaydedildi!");
  };

  const openKeyDialog = async () => {
     if (window.aistudio && window.aistudio.openSelectKey) {
       await window.aistudio.openSelectKey();
       setIsApiKeyMissing(false);
     }
  };

  return (
    <div className="max-w-7xl mx-auto p-8 h-full flex flex-col">
       {/* Error Banner */}
       {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* API Key Modal Fallback */}
      {isApiKeyMissing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
           <div className="bg-lumina-900 border border-lumina-800 p-8 rounded-xl max-w-md text-center">
              <h3 className="text-xl font-bold text-white mb-4">Yükseltme Gerekli</h3>
              <p className="text-slate-300 mb-6">Nano Banana Pro ile yüksek kaliteli görseller oluşturmak için ücretli API anahtarı gereklidir.</p>
              <div className="flex flex-col gap-3">
                 <button onClick={openKeyDialog} className="bg-lumina-gold text-lumina-950 px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors">
                    API Anahtarı Seç
                 </button>
                 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-sm text-lumina-accent hover:underline">
                    Fatura Dokümantasyonu
                 </a>
                 <button onClick={() => setIsApiKeyMissing(false)} className="text-slate-500 text-sm mt-2">
                    İptal
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Progress Stepper */}
      <div className="flex items-center justify-center mb-10">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-lumina-gold' : 'text-slate-600'}`}>
          <span className="w-8 h-8 rounded-full border border-current flex items-center justify-center font-bold">1</span>
          <span className="font-medium">Stil Analizi</span>
        </div>
        <div className="w-16 h-px bg-slate-800 mx-4"></div>
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-lumina-gold' : 'text-slate-600'}`}>
          <span className="w-8 h-8 rounded-full border border-current flex items-center justify-center font-bold">2</span>
          <span className="font-medium">Konfigürasyon</span>
        </div>
        <div className="w-16 h-px bg-slate-800 mx-4"></div>
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-lumina-gold' : 'text-slate-600'}`}>
          <span className="w-8 h-8 rounded-full border border-current flex items-center justify-center font-bold">3</span>
          <span className="font-medium">Sonuç</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Input & Controls */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* STEP 1: UPLOAD */}
          <div className={`bg-lumina-900 border ${step === 1 ? 'border-lumina-gold' : 'border-lumina-800'} rounded-xl p-6 transition-all`}>
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Upload size={20} /> Referans Görsel
            </h3>
            <div className="relative border-2 border-dashed border-slate-700 rounded-lg h-48 flex flex-col items-center justify-center hover:border-lumina-gold/50 transition-colors bg-lumina-950">
              <input 
                type="file" 
                onChange={handleRefUpload} 
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept="image/*"
                disabled={loading}
              />
              {referenceImage ? (
                <img src={`data:image/jpeg;base64,${referenceImage}`} className="h-full w-full object-cover rounded-lg opacity-60" alt="ref" />
              ) : (
                <div className="text-center p-4">
                  <p className="text-slate-400 text-sm">Stilini kopyalamak için görsel yükle</p>
                  <p className="text-xs text-slate-600 mt-1">Gemini 3 Pro Analizi</p>
                </div>
              )}
              {loading && !analysis && (
                <div className="absolute inset-0 flex items-center justify-center bg-lumina-950/80 backdrop-blur-sm">
                  <Loader2 className="animate-spin text-lumina-gold" size={32} />
                </div>
              )}
            </div>
            {initialTemplate && (
               <div className="mt-2 text-xs text-lumina-gold flex items-center gap-1">
                 <Sparkles size={12} /> Kütüphaneden yüklendi: {initialTemplate.name}
               </div>
            )}
          </div>

          {/* STEP 2: CONFIGURATION */}
          {step >= 2 && (
             <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-6 animate-fade-in-up">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Sparkles size={20} /> Üretim Ayarları
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Hedef Marka</label>
                    <select 
                      value={selectedBrandId}
                      onChange={(e) => setSelectedBrandId(e.target.value)}
                      className="w-full bg-lumina-950 border border-slate-700 rounded-lg p-2 text-white focus:border-lumina-gold outline-none"
                    >
                      {brands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Görsel Boyutu</label>
                    <div className="grid grid-cols-4 gap-2">
                      <button 
                        onClick={() => setAspectRatio("1:1")}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${aspectRatio === "1:1" ? 'bg-lumina-gold/20 border-lumina-gold text-white' : 'bg-lumina-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        <Square size={20} className="mb-1" />
                        <span className="text-[10px] md:text-xs">Kare (1:1)</span>
                      </button>
                      <button 
                        onClick={() => setAspectRatio("4:5")}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${aspectRatio === "4:5" ? 'bg-lumina-gold/20 border-lumina-gold text-white' : 'bg-lumina-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        <RectangleVertical size={20} className="mb-1 scale-y-90" />
                        <span className="text-[10px] md:text-xs">Post (4:5)</span>
                      </button>
                      <button 
                        onClick={() => setAspectRatio("9:16")}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${aspectRatio === "9:16" ? 'bg-lumina-gold/20 border-lumina-gold text-white' : 'bg-lumina-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        <RectangleVertical size={20} className="mb-1" />
                        <span className="text-[10px] md:text-xs">Hikaye (9:16)</span>
                      </button>
                      <button 
                        onClick={() => setAspectRatio("16:9")}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${aspectRatio === "16:9" ? 'bg-lumina-gold/20 border-lumina-gold text-white' : 'bg-lumina-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        <RectangleHorizontal size={20} className="mb-1" />
                        <span className="text-[10px] md:text-xs">Yatay (16:9)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Konu / İçerik</label>
                    <textarea 
                      value={contextText}
                      onChange={(e) => setContextText(e.target.value)}
                      placeholder="Örn: Yaz indirimi için temiz ve minimalist bir duyuru görseli."
                      className="w-full bg-lumina-950 border border-slate-700 rounded-lg p-2 text-white h-24 resize-none focus:border-lumina-gold outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Ürün Görseli (Opsiyonel)</label>
                    <div className="relative flex items-center gap-2 bg-lumina-950 border border-slate-700 rounded-lg p-2">
                      <input 
                        type="file" 
                        onChange={handleProductUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <ImageIcon size={16} className="text-slate-500" />
                      <span className="text-sm text-slate-300 truncate">
                        {productImage ? "Ürün Görseli Yüklendi" : "Ürün Görseli Yükle"}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={handleGenerate}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-lumina-gold to-yellow-600 text-lumina-950 font-bold py-3 rounded-lg hover:shadow-lg hover:shadow-yellow-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    Gemini ile Oluştur
                  </button>
                </div>
             </div>
          )}
        </div>

        {/* RIGHT COLUMN: Output & JSON */}
        <div className="lg:col-span-8 space-y-6">
          {step === 1 && !analysis && (
             <div className="h-full border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-600">
               Referans Görsel Bekleniyor...
             </div>
          )}

          {/* GENERATION & REVISION - Moved to top for better workflow */}
          {generatedImage && (
            <div className="space-y-6">
              <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-2 animate-fade-in shadow-2xl shadow-black">
                <div className="relative group">
                  <img 
                    src={`data:image/png;base64,${generatedImage}`} 
                    alt="AI Generated" 
                    className="w-full rounded-lg"
                  />
                  {loading && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-lumina-gold" size={48} />
                        <span className="text-white font-medium">Revize Ediliyor...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Nano Banana Pro (Gemini 3 Pro)</span>
                  <div className="flex gap-2">
                     <button 
                       onClick={() => setIsRevising(!isRevising)}
                       className={`px-4 py-2 rounded-lg text-sm transition-colors border ${isRevising ? 'bg-lumina-gold text-lumina-950 border-lumina-gold font-bold' : 'bg-transparent border-slate-700 text-slate-300 hover:border-slate-500'}`}
                     >
                       <span className="flex items-center gap-2"><Edit3 size={16} /> Revize Et</span>
                     </button>
                     <button
                       onClick={() => downloadBase64Image(generatedImage!, `lumina-gen-${Date.now()}.png`)}
                       className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                     >
                       İndir
                     </button>
                  </div>
                </div>
              </div>

              {/* REVISION PANEL */}
              {isRevising && (
                <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-6 animate-fade-in-up">
                  <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                    <Edit3 size={18} className="text-lumina-gold" /> Çıktı Düzenleme & Revizyon
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Revize Talimatı</label>
                      <textarea 
                        value={revisionPrompt}
                        onChange={(e) => setRevisionPrompt(e.target.value)}
                        placeholder="Örn: Arka planı biraz daha koyulaştır ve metni aşağıya kaydır."
                        className="w-full bg-lumina-950 border border-slate-700 rounded-lg p-3 text-white h-24 resize-none focus:border-lumina-gold outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Ek Görsel / İkon (Opsiyonel)</label>
                      <div className="relative flex items-center gap-2 bg-lumina-950 border border-slate-700 rounded-lg p-2">
                        <input 
                          type="file" 
                          onChange={handleRevisionImageUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <ImageIcon size={16} className="text-slate-500" />
                        <span className="text-sm text-slate-300 truncate">
                          {revisionImage ? "Görsel Seçildi" : "Görsel veya İkon Ekle"}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={handleRevisionSubmit}
                      disabled={loading || !revisionPrompt}
                      className="w-full bg-lumina-800 text-white hover:bg-lumina-700 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={16} /> Revizeyi Uygula
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ANALYSIS RESULT & SAVE TEMPLATE - Always visible if analysis exists */}
          {analysis && (
            <div className={`bg-lumina-900/50 border border-lumina-800 rounded-xl p-6 relative overflow-hidden ${generatedImage ? 'opacity-80 hover:opacity-100 transition-opacity' : ''}`}>
               <div className="absolute top-0 right-0 p-4 bg-lumina-950/80 backdrop-blur text-xs font-mono text-lumina-gold border-b border-l border-lumina-800 rounded-bl-xl">
                 JSON PROMPT ÇIKTISI
               </div>
               <h3 className="text-white font-serif text-xl mb-4">Stil Matrisi (JSON Prompt)</h3>
               
               {/* Display JSON Structure more prominently */}
               <div className="bg-lumina-950 p-4 rounded-lg border border-lumina-800 font-mono text-xs text-slate-300 overflow-x-auto mb-6">
                 <pre>{JSON.stringify(analysis, null, 2)}</pre>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                 <div className="space-y-1">
                    <span className="text-slate-500 uppercase text-xs tracking-wider">Mood (Duygu)</span>
                    <p className="text-slate-200">{analysis.mood}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-slate-500 uppercase text-xs tracking-wider">Işıklandırma</span>
                    <p className="text-slate-200">{analysis.lighting}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-slate-500 uppercase text-xs tracking-wider">Renk Paleti</span>
                    <p className="text-slate-200">{analysis.colorPaletteDescription}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-slate-500 uppercase text-xs tracking-wider">Kompozisyon</span>
                    <p className="text-slate-200">{analysis.composition}</p>
                 </div>
                  <div className="col-span-1 md:col-span-2 space-y-1 bg-lumina-950/50 p-2 rounded border border-lumina-800">
                    <span className="text-lumina-gold uppercase text-xs tracking-wider">Arka Plan & Detaylar</span>
                    <p className="text-slate-200">{analysis.backgroundDetails || 'Standart'}</p>
                 </div>
               </div>

               {/* Save Template Section */}
               <div className="mt-6 pt-6 border-t border-lumina-800 flex flex-col md:flex-row items-center gap-4">
                  <input 
                    type="text" 
                    placeholder="Bu stile isim ver"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full md:w-auto flex-1 bg-lumina-950 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  />
                  <select
                     value={selectedFolderId}
                     onChange={(e) => setSelectedFolderId(e.target.value)}
                     className="w-full md:w-48 bg-lumina-950 border border-slate-700 rounded-lg p-2 text-white text-sm"
                  >
                     <option value="">Kategorisiz</option>
                     {folders.map(f => (
                       <option key={f.id} value={f.id}>{f.name}</option>
                     ))}
                  </select>
                  <button onClick={handleSaveTemplate} className="w-full md:w-auto text-lumina-gold hover:text-white flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 border border-lumina-gold/30 rounded-lg hover:bg-lumina-gold/10">
                    <Save size={16} /> Kitaplığa Kaydet
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StyleAnalyzer;

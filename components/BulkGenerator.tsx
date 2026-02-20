
import React, { useState } from 'react';
import { Brand, GeneratedAsset, BulkMatchItem, UploadedReference } from '../types';
import { Upload, Layers, Loader2, Play, Square, RectangleVertical, RectangleHorizontal, CheckCircle, AlertCircle, RefreshCw, Wand2, Image as ImageIcon, X, Edit3, Send } from 'lucide-react';
import { fileToGenerativePart, analyzeImageStyle, matchTopicsToStyles, generateBrandedImage, reviseGeneratedImage } from '../services/geminiService';

interface BulkGeneratorProps {
  brands: Brand[];
  addToHistory: (asset: GeneratedAsset) => void;
}

const BulkGenerator: React.FC<BulkGeneratorProps> = ({ brands, addToHistory }) => {
  // 1. Setup & Inputs
  const [selectedBrandId, setSelectedBrandId] = useState<string>(brands[0]?.id || '');
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [topicsInput, setTopicsInput] = useState<string>('');
  
  // Files State
  const [uploadedRefs, setUploadedRefs] = useState<UploadedReference[]>([]);
  const [productFiles, setProductFiles] = useState<UploadedReference[]>([]); // New: Product Images
  
  // Process State
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'analyzing' | 'matching' | 'ready' | 'generating'>('idle');
  const [analysisProgress, setAnalysisProgress] = useState<{ current: number, total: number }>({ current: 0, total: 0 });
  const [matches, setMatches] = useState<BulkMatchItem[]>([]);
  
  // Generation Progress
  const [generationProgress, setGenerationProgress] = useState<{ current: number, total: number }>({ current: 0, total: 0 });
  
  // Revision State
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [revisionInput, setRevisionInput] = useState<string>('');
  const [revisionFile, setRevisionFile] = useState<string | null>(null); // New: Revision Image State
  
  // Error handling
  const [error, setError] = useState<string | null>(null);

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: UploadedReference[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const base64 = await fileToGenerativePart(file);
        newFiles.push({
          id: `ref-${Date.now()}-${i}`,
          file,
          base64
        });
      }
      setUploadedRefs(prev => [...prev, ...newFiles]);
    }
  };

  const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: UploadedReference[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const base64 = await fileToGenerativePart(file);
        newFiles.push({
          id: `prod-${Date.now()}-${i}`,
          file,
          base64
        });
      }
      setProductFiles(prev => [...prev, ...newFiles]);
    }
  };

  // New: Handle Revision File
  const handleRevisionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
         const base64 = await fileToGenerativePart(e.target.files[0]);
         setRevisionFile(base64);
      } catch (err) {
         console.error("Revision file upload error", err);
      }
    }
  };

  const removeRefFile = (id: string) => {
    setUploadedRefs(prev => prev.filter(f => f.id !== id));
  };

  const removeProductFile = (id: string) => {
    setProductFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleAnalyzeAndMatch = async () => {
    const topics = topicsInput.split('\n').filter(t => t.trim() !== '');
    if (topics.length === 0) {
      setError("Lütfen en az bir konu girin.");
      return;
    }
    if (uploadedRefs.length === 0) {
      setError("Lütfen en az bir referans görsel (stil kaynağı) yükleyin.");
      return;
    }

    setProcessingStatus('analyzing');
    setError(null);
    setAnalysisProgress({ current: 0, total: uploadedRefs.length });

    try {
      // 1. Analyze Images sequentially to avoid rate limits
      const analyzedRefs: UploadedReference[] = [...uploadedRefs];
      
      for (let i = 0; i < analyzedRefs.length; i++) {
        if (!analyzedRefs[i].analysis) {
          try {
            const analysis = await analyzeImageStyle(analyzedRefs[i].base64);
            analyzedRefs[i].analysis = analysis;
          } catch (err) {
            console.error(`Error analyzing image ${i}`, err);
          }
        }
        setAnalysisProgress({ current: i + 1, total: analyzedRefs.length });
      }
      
      setUploadedRefs(analyzedRefs);
      
      // Filter out successfully analyzed images
      const validRefs = analyzedRefs.filter(r => r.analysis);
      if (validRefs.length === 0) {
        throw new Error("Hiçbir stil görseli analiz edilemedi.");
      }

      // 2. Match Topics to Styles
      setProcessingStatus('matching');
      const stylesForMatching = validRefs.map(r => ({ id: r.id, analysis: r.analysis! }));
      
      const matchResults = await matchTopicsToStyles(topics, stylesForMatching);
      
      // Construct Match Items
      const newMatches: BulkMatchItem[] = matchResults.map((m, index) => ({
        id: `match-${index}`,
        topic: topics[m.topicIndex],
        referenceImageId: m.styleId,
        status: 'pending'
      }));

      setMatches(newMatches);
      setProcessingStatus('ready');

    } catch (err: any) {
      console.error(err);
      setError("Analiz veya eşleştirme sırasında hata oluştu: " + err.message);
      setProcessingStatus('idle');
    }
  };

  const handleStartGeneration = async () => {
    setProcessingStatus('generating');
    setGenerationProgress({ current: 0, total: matches.length });
    
    const brand = brands.find(b => b.id === selectedBrandId);
    if (!brand) return;

    const newMatches = [...matches];

    for (let i = 0; i < newMatches.length; i++) {
      const match = newMatches[i];
      if (match.status === 'completed') continue;

      const refImage = uploadedRefs.find(r => r.id === match.referenceImageId);
      if (!refImage || !refImage.analysis) {
        newMatches[i].status = 'failed';
        setMatches([...newMatches]);
        continue;
      }

      // Select product image (cycle through if multiple, or null)
      let productBase64 = null;
      if (productFiles.length > 0) {
        const prodIndex = i % productFiles.length;
        productBase64 = productFiles[prodIndex].base64;
      }

      newMatches[i].status = 'generating';
      setMatches([...newMatches]);

      try {
        const generatedBase64 = await generateBrandedImage(
          brand,
          refImage.analysis,
          refImage.base64,
          productBase64, // Pass the selected product image
          match.topic,
          aspectRatio
        );

        newMatches[i].resultUrl = generatedBase64;
        newMatches[i].status = 'completed';
        
        addToHistory({
          id: Date.now().toString() + i,
          url: generatedBase64,
          promptUsed: `Bulk: ${match.topic}`,
          brandId: brand.id,
          createdAt: Date.now()
        });

      } catch (err) {
        console.error(`Error generating item ${i}`, err);
        newMatches[i].status = 'failed';
      }

      setMatches([...newMatches]);
      setGenerationProgress({ current: i + 1, total: matches.length });
    }

    setProcessingStatus('ready');
  };

  const handleRegenerateItem = async (index: number) => {
    const brand = brands.find(b => b.id === selectedBrandId);
    if (!brand) return;

    const newMatches = [...matches];
    const match = newMatches[index];
    const refImage = uploadedRefs.find(r => r.id === match.referenceImageId);

    if (!refImage || !refImage.analysis) return;

    // Reset status
    newMatches[index].status = 'generating';
    newMatches[index].resultUrl = undefined;
    setMatches([...newMatches]);

    let productBase64 = null;
    if (productFiles.length > 0) {
       const prodIndex = index % productFiles.length;
       productBase64 = productFiles[prodIndex].base64;
    }

    try {
      const generatedBase64 = await generateBrandedImage(
        brand,
        refImage.analysis,
        refImage.base64,
        productBase64,
        match.topic,
        aspectRatio
      );

      newMatches[index].resultUrl = generatedBase64;
      newMatches[index].status = 'completed';

      addToHistory({
        id: Date.now().toString() + index,
        url: generatedBase64,
        promptUsed: `Bulk Regen: ${match.topic}`,
        brandId: brand.id,
        createdAt: Date.now()
      });

    } catch (err) {
      console.error(err);
      newMatches[index].status = 'failed';
    }

    setMatches([...newMatches]);
  };

  const handleReviseItem = async (index: number) => {
    if (!revisionInput.trim()) return;

    const newMatches = [...matches];
    const match = newMatches[index];
    
    if (!match.resultUrl) return;

    // Show loading state on that item
    newMatches[index].status = 'generating';
    const oldUrl = match.resultUrl; // Keep old URL for fallback or history
    setMatches([...newMatches]);
    setRevisingId(null); // Close revision box
    
    // Capture the current revision file to use in the call
    const currentRevisionFile = revisionFile; 

    try {
      // Call Revision Service - Updated to use currentRevisionFile
      const revisedBase64 = await reviseGeneratedImage(oldUrl, revisionInput, currentRevisionFile);

      newMatches[index].resultUrl = revisedBase64;
      newMatches[index].status = 'completed';
      
      // Add revision to history
      const brand = brands.find(b => b.id === selectedBrandId);
      addToHistory({
        id: Date.now().toString() + index,
        url: revisedBase64,
        promptUsed: `Bulk Revise: ${revisionInput}`,
        brandId: brand?.id || '',
        createdAt: Date.now()
      });

      // Reset Revision States
      setRevisionInput('');
      setRevisionFile(null);

    } catch (err) {
      console.error(err);
      newMatches[index].status = 'completed'; // Revert status so image shows
      newMatches[index].resultUrl = oldUrl; // Revert image
      alert("Revizyon yapılamadı.");
    }

    setMatches([...newMatches]);
  };

  return (
    <div className="max-w-7xl mx-auto p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-3xl font-serif text-white mb-2 flex items-center gap-3">
             <Layers className="text-lumina-gold" /> Toplu Görsel Üretim
           </h2>
           <p className="text-slate-400">Çoklu konu, stil ve ürün görsellerini eşleştirerek seri üretim yapın.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        
        {/* LEFT COLUMN: Inputs */}
        <div className="lg:col-span-6 space-y-6 overflow-y-auto pr-2 custom-scrollbar h-[calc(100vh-140px)] pb-10">
          
          {/* Brand Selection */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-5">
            <label className="text-sm text-slate-400 block mb-2 font-medium">1. Hedef Marka</label>
            <select 
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="w-full bg-lumina-950 border border-slate-700 rounded-lg p-3 text-white focus:border-lumina-gold outline-none"
              disabled={processingStatus !== 'idle' && processingStatus !== 'ready'}
            >
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Aspect Ratio */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-5">
            <label className="text-sm text-slate-400 block mb-2 font-medium">2. Görsel Boyutu</label>
            <div className="grid grid-cols-3 gap-2">
               <button 
                  onClick={() => setAspectRatio("1:1")}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${aspectRatio === "1:1" ? 'bg-lumina-gold/20 border-lumina-gold text-white' : 'bg-lumina-950 border-slate-700 text-slate-400'}`}
                  disabled={processingStatus !== 'idle' && processingStatus !== 'ready'}
                >
                  <Square size={16} className="mb-1" />
                  <span className="text-[10px]">1:1</span>
                </button>
                <button 
                  onClick={() => setAspectRatio("4:5")}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${aspectRatio === "4:5" ? 'bg-lumina-gold/20 border-lumina-gold text-white' : 'bg-lumina-950 border-slate-700 text-slate-400'}`}
                  disabled={processingStatus !== 'idle' && processingStatus !== 'ready'}
                >
                  <RectangleVertical size={16} className="mb-1 scale-y-90" />
                  <span className="text-[10px]">4:5</span>
                </button>
                <button 
                  onClick={() => setAspectRatio("9:16")}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${aspectRatio === "9:16" ? 'bg-lumina-gold/20 border-lumina-gold text-white' : 'bg-lumina-950 border-slate-700 text-slate-400'}`}
                  disabled={processingStatus !== 'idle' && processingStatus !== 'ready'}
                >
                  <RectangleVertical size={16} className="mb-1" />
                  <span className="text-[10px]">9:16</span>
                </button>
            </div>
          </div>

          {/* Topics Input */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-5">
            <label className="text-sm text-slate-400 block mb-2 font-medium">3. Konular (Her satıra bir konu)</label>
            <textarea 
              value={topicsInput}
              onChange={(e) => setTopicsInput(e.target.value)}
              placeholder={`Örn:\nYaz indirimi duyurusu\nYeni sezon ürünleri\nÖğretmenler günü kutlaması`}
              className="w-full bg-lumina-950 border border-slate-700 rounded-lg p-3 text-white h-64 resize-none focus:border-lumina-gold outline-none text-sm leading-relaxed"
              disabled={processingStatus !== 'idle' && processingStatus !== 'ready'}
            />
            <p className="text-right text-xs text-slate-500 mt-2">
              {topicsInput.split('\n').filter(t => t.trim() !== '').length} konu girildi.
            </p>
          </div>

          {/* Reference Images (Styles) */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-5">
            <label className="text-sm text-slate-400 block mb-2 font-medium">4. Referans Stiller</label>
            <div className="relative border-2 border-dashed border-slate-700 rounded-lg p-4 flex flex-col items-center justify-center hover:border-lumina-gold/50 transition-colors bg-lumina-950 mb-4">
              <input 
                type="file" 
                multiple
                onChange={handleRefUpload} 
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept="image/*"
                disabled={processingStatus !== 'idle' && processingStatus !== 'ready'}
              />
              <Upload size={24} className="text-slate-500 mb-2" />
              <span className="text-xs text-slate-400 text-center">Analiz edilecek stilleri yükleyin<br/>(Çoklu Seçim)</span>
            </div>
            
            {uploadedRefs.length > 0 && (
               <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                 {uploadedRefs.map((ref) => (
                   <div key={ref.id} className="relative group aspect-square rounded overflow-hidden border border-slate-700">
                     <img src={`data:image/jpeg;base64,${ref.base64}`} className="w-full h-full object-cover" />
                     <button 
                       onClick={() => removeRefFile(ref.id)}
                       className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                       disabled={processingStatus !== 'idle' && processingStatus !== 'ready'}
                     >
                        <X size={10} />
                     </button>
                     {ref.analysis && (
                        <div className="absolute bottom-0 right-0 p-1">
                           <CheckCircle size={12} className="text-green-500 bg-white rounded-full" />
                        </div>
                     )}
                   </div>
                 ))}
               </div>
            )}
          </div>

          {/* Product Images (New) */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-5">
            <label className="text-sm text-slate-400 block mb-2 font-medium">5. Ürün Görselleri (Opsiyonel)</label>
            <div className="relative border-2 border-dashed border-slate-700 rounded-lg p-4 flex flex-col items-center justify-center hover:border-lumina-gold/50 transition-colors bg-lumina-950 mb-4">
              <input 
                type="file" 
                multiple
                onChange={handleProductUpload} 
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept="image/*"
                disabled={processingStatus !== 'idle' && processingStatus !== 'ready'}
              />
              <ImageIcon size={24} className="text-slate-500 mb-2" />
              <span className="text-xs text-slate-400 text-center">Görsellere yerleştirilecek ürünleri yükleyin<br/>(Sırasıyla kullanılır)</span>
            </div>
            
            {productFiles.length > 0 && (
               <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                 {productFiles.map((prod) => (
                   <div key={prod.id} className="relative group aspect-square rounded overflow-hidden border border-slate-700">
                     <img src={`data:image/jpeg;base64,${prod.base64}`} className="w-full h-full object-cover" />
                     <button 
                       onClick={() => removeProductFile(prod.id)}
                       className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                       disabled={processingStatus !== 'idle' && processingStatus !== 'ready'}
                     >
                        <X size={10} />
                     </button>
                   </div>
                 ))}
               </div>
            )}
            <p className="text-[10px] text-slate-500 mt-2">
              Birden fazla ürün yüklerseniz, konulara sırasıyla (1. Konu - 1. Ürün, 2. Konu - 2. Ürün...) dağıtılır.
            </p>
          </div>

          {/* Action Button */}
          {processingStatus === 'idle' && (
             <button 
               onClick={handleAnalyzeAndMatch}
               disabled={uploadedRefs.length === 0 || !topicsInput.trim()}
               className="w-full bg-lumina-gold text-lumina-950 font-bold py-3 rounded-xl hover:bg-yellow-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/10 mb-8"
             >
               <Wand2 size={18} /> Analiz Et ve Eşleştir
             </button>
          )}

           {processingStatus === 'analyzing' && (
             <div className="w-full bg-lumina-900 border border-lumina-gold/30 p-4 rounded-xl text-center">
                <Loader2 size={24} className="animate-spin text-lumina-gold mx-auto mb-2" />
                <p className="text-white font-medium">Stiller Analiz Ediliyor...</p>
                <p className="text-xs text-slate-400 mt-1">{analysisProgress.current} / {analysisProgress.total}</p>
             </div>
          )}

           {processingStatus === 'matching' && (
             <div className="w-full bg-lumina-900 border border-lumina-gold/30 p-4 rounded-xl text-center">
                <Loader2 size={24} className="animate-spin text-lumina-gold mx-auto mb-2" />
                <p className="text-white font-medium">AI Eşleştirme Yapıyor...</p>
             </div>
          )}
        </div>

        {/* RIGHT COLUMN: Results & Status */}
        <div className="lg:col-span-6 bg-lumina-900/50 border border-lumina-800 rounded-xl p-6 flex flex-col h-[calc(100vh-140px)]">
           <div className="flex justify-between items-center mb-4 pb-4 border-b border-lumina-800">
             <h3 className="text-white font-medium">Üretim Listesi</h3>
             {matches.length > 0 && processingStatus === 'ready' && (
               <button 
                 onClick={handleStartGeneration}
                 className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
               >
                 <Play size={18} /> Tümünü Başlat
               </button>
             )}
             {processingStatus === 'generating' && (
                <div className="flex items-center gap-3">
                   <span className="text-slate-400 text-sm">Üretiliyor: {generationProgress.current} / {generationProgress.total}</span>
                   <Loader2 size={18} className="animate-spin text-lumina-gold" />
                </div>
             )}
           </div>

           {matches.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
               <Layers size={48} className="mb-4 opacity-50" />
               <p>Sol taraftan konu ve görselleri girip analizi başlatın.</p>
             </div>
           ) : (
             <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
               {matches.map((match, idx) => {
                 const refImg = uploadedRefs.find(r => r.id === match.referenceImageId);
                 
                 // Determine which product will be used for this match (preview logic only)
                 let prodImg = null;
                 if (productFiles.length > 0) {
                    prodImg = productFiles[idx % productFiles.length];
                 }

                 return (
                   <div key={match.id} className="bg-lumina-950 border border-lumina-800 rounded-lg p-4 flex gap-4 items-start animate-fade-in">
                     {/* Ref Image Preview */}
                     <div className="flex flex-col gap-1">
                        <div className="w-20 h-20 shrink-0 rounded overflow-hidden border border-slate-700 bg-black relative">
                          {refImg && <img src={`data:image/jpeg;base64,${refImg.base64}`} className="w-full h-full object-cover opacity-70" />}
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white text-center py-0.5">STİL</div>
                        </div>
                        {prodImg && (
                           <div className="w-20 h-20 shrink-0 rounded overflow-hidden border border-slate-700 bg-black relative">
                             <img src={`data:image/jpeg;base64,${prodImg.base64}`} className="w-full h-full object-cover opacity-90" />
                             <div className="absolute bottom-0 inset-x-0 bg-lumina-gold text-[8px] text-black text-center py-0.5 font-bold">ÜRÜN</div>
                           </div>
                        )}
                     </div>

                     {/* Topic & Status */}
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1">
                         <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded">#{idx + 1}</span>
                         <h4 className="text-white text-sm font-medium truncate">{match.topic}</h4>
                       </div>
                       
                       {/* Generated Result OR Status */}
                       {match.resultUrl ? (
                         <div className="mt-2 flex gap-4">
                            <div className="w-32 h-32 rounded overflow-hidden border border-green-500/50 shadow-lg shrink-0">
                               <img src={`data:image/png;base64,${match.resultUrl}`} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col justify-between flex-1 min-w-0">
                               <div className="text-green-400 text-xs flex items-center gap-1 mb-2"><CheckCircle size={12} /> Tamamlandı</div>
                               
                               <div className="flex flex-col gap-2">
                                 {/* Revision Box */}
                                 {revisingId === match.id ? (
                                   <div className="bg-lumina-900 border border-lumina-800 p-2 rounded animate-fade-in">
                                     <textarea 
                                       value={revisionInput}
                                       onChange={(e) => setRevisionInput(e.target.value)}
                                       className="w-full bg-black text-xs text-white p-2 rounded mb-2 border border-slate-700 focus:border-lumina-gold outline-none"
                                       rows={2}
                                       placeholder="Nasıl revize edilsin?"
                                     />
                                     <div className="flex items-center gap-2 mb-2">
                                        <div className="relative flex-1 bg-lumina-950 border border-slate-700 rounded p-1 flex items-center gap-2">
                                           <ImageIcon size={12} className="text-slate-500" />
                                           <span className="text-[10px] text-slate-400 truncate flex-1">
                                             {revisionFile ? "Görsel Seçildi" : "Görsel Ekle (Opsiyonel)"}
                                           </span>
                                           <input 
                                              type="file" 
                                              onChange={handleRevisionFileUpload}
                                              className="absolute inset-0 opacity-0 cursor-pointer"
                                              accept="image/*"
                                           />
                                        </div>
                                        {revisionFile && (
                                           <button onClick={() => setRevisionFile(null)} className="text-red-400 p-1">
                                              <X size={12} />
                                           </button>
                                        )}
                                     </div>

                                     <div className="flex gap-2 justify-end">
                                       <button onClick={() => { setRevisingId(null); setRevisionFile(null); }} className="text-xs text-slate-500 hover:text-white">İptal</button>
                                       <button onClick={() => handleReviseItem(idx)} className="text-xs bg-lumina-gold text-black px-2 py-1 rounded font-bold">Uygula</button>
                                     </div>
                                   </div>
                                 ) : (
                                    <div className="flex flex-wrap gap-2">
                                       <a 
                                         href={`data:image/png;base64,${match.resultUrl}`} 
                                         download={`bulk-result-${idx}.png`}
                                         className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1.5 rounded text-center transition-colors truncate"
                                       >
                                         İndir
                                       </a>
                                       <button
                                         onClick={() => handleRegenerateItem(idx)}
                                         className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1.5 rounded transition-colors flex items-center justify-center"
                                         title="Aynı ayarlarla yeniden üret"
                                       >
                                         <RefreshCw size={14} />
                                       </button>
                                       <button
                                         onClick={() => { setRevisingId(match.id); setRevisionInput(''); setRevisionFile(null); }}
                                         className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1.5 rounded transition-colors flex items-center justify-center"
                                         title="Revize Et"
                                       >
                                         <Edit3 size={14} />
                                       </button>
                                    </div>
                                 )}
                               </div>
                            </div>
                         </div>
                       ) : (
                         <div className="mt-2">
                           {match.status === 'pending' && <span className="text-xs text-slate-500">Beklemede</span>}
                           {match.status === 'generating' && <span className="text-xs text-lumina-gold flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Üretiliyor...</span>}
                           {match.status === 'failed' && <span className="text-xs text-red-400">Hata Oluştu</span>}
                         </div>
                       )}
                     </div>
                   </div>
                 );
               })}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default BulkGenerator;

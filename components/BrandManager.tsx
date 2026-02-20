
import React, { useState } from 'react';
import { Brand, BrandColor } from '../types';
import { Plus, Trash2, Upload, Instagram, Phone, MapPin, Palette, X, Edit2, Check } from 'lucide-react';
import { resizeImageToRawBase64 } from '../services/geminiService';

interface BrandManagerProps {
  brands: Brand[];
  setBrands: React.Dispatch<React.SetStateAction<Brand[]>>;
}

const BrandManager: React.FC<BrandManagerProps> = ({ brands, setBrands }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newBrand, setNewBrand] = useState<Brand>({
    id: '',
    name: '',
    industry: '',
    description: '',
    logo: null,
    primaryColor: '#F8BE00',
    secondaryColor: '#201C1D',
    palette: [],
    tone: 'Profesyonel, Güvenilir, Premium',
    instagram: '',
    phone: '',
    address: ''
  });

  // Temp state for adding a single color to the palette
  const [tempColorName, setTempColorName] = useState('');
  const [tempColorHex, setTempColorHex] = useState('#000000');

  const resetForm = () => {
    setNewBrand({
      id: '', name: '', industry: '', description: '', logo: null,
      primaryColor: '#F8BE00', secondaryColor: '#201C1D', palette: [],
      tone: 'Profesyonel',
      instagram: '', phone: '', address: ''
    });
    setEditingId(null);
    setIsEditing(false);
  };

  const handleCreateNew = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleEdit = (brand: Brand) => {
    setNewBrand({ ...brand });
    setEditingId(brand.id);
    setIsEditing(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        // Resize image to max 500px to save local storage space
        const base64 = await resizeImageToRawBase64(e.target.files[0], 500);
        setNewBrand({ ...newBrand, logo: base64 });
      } catch (error) {
        console.error("Logo işleme hatası:", error);
        alert("Logo yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.");
      }
    }
  };

  const addColorToPalette = () => {
    if (tempColorName && tempColorHex) {
      setNewBrand({
        ...newBrand,
        palette: [...(newBrand.palette || []), { name: tempColorName, hex: tempColorHex }]
      });
      setTempColorName('');
      setTempColorHex('#000000');
    }
  };

  const removeColorFromPalette = (index: number) => {
    const newPalette = [...(newBrand.palette || [])];
    newPalette.splice(index, 1);
    setNewBrand({ ...newBrand, palette: newPalette });
  };

  const saveBrand = () => {
    if (!newBrand.name) return;

    if (editingId) {
      // Update existing
      setBrands(brands.map(b => b.id === editingId ? { ...newBrand, id: editingId } : b));
    } else {
      // Create new
      setBrands([...brands, { ...newBrand, id: Date.now().toString() }]);
    }
    
    resetForm();
  };

  const deleteBrand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click if any
    if (confirm("Bu markayı silmek istediğinize emin misiniz?")) {
      setBrands(brands.filter(b => b.id !== id));
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-serif text-white mb-2">Marka Profilleri</h2>
          <p className="text-slate-400">Kurumlarınız için kimlikleri ve kurumsal renk paletlerini yönetin.</p>
        </div>
        <button 
          onClick={handleCreateNew}
          className="bg-lumina-gold text-lumina-950 px-6 py-2 rounded-full font-semibold hover:bg-yellow-500 transition-colors flex items-center gap-2 shadow-lg shadow-yellow-500/20"
        >
          <Plus size={18} /> Yeni Marka Ekle
        </button>
      </div>

      {isEditing && (
        <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-6 mb-8 shadow-2xl relative animate-fade-in-up">
           <div className="absolute top-4 right-4">
             <button onClick={resetForm} className="text-slate-500 hover:text-white p-2">
               <X size={20} />
             </button>
           </div>
          <h3 className="text-xl font-medium text-white mb-6 flex items-center gap-2">
            {editingId ? <Edit2 size={20} className="text-lumina-gold" /> : <Plus size={20} className="text-lumina-gold" />}
            {editingId ? 'Profili Düzenle' : 'Yeni Profil Oluştur'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Identity & Palette */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-lumina-gold uppercase tracking-wider mb-2">Kimlik</h4>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Marka Adı</label>
                  <input 
                    type="text" 
                    value={newBrand.name}
                    onChange={e => setNewBrand({...newBrand, name: e.target.value})}
                    className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-3 text-white focus:border-lumina-gold focus:outline-none placeholder-slate-600"
                    placeholder="Örn: Qoolline"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Sektör</label>
                  <input 
                    type="text" 
                    value={newBrand.industry}
                    onChange={e => setNewBrand({...newBrand, industry: e.target.value})}
                    className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-3 text-white focus:border-lumina-gold focus:outline-none placeholder-slate-600"
                    placeholder="Örn: Eğitim Teknolojileri"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Marka Açıklaması</label>
                  <textarea 
                    value={newBrand.description || ''}
                    onChange={e => setNewBrand({...newBrand, description: e.target.value})}
                    className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-3 text-white focus:border-lumina-gold focus:outline-none placeholder-slate-600 resize-none h-20"
                    placeholder="Markanın ne yaptığını ve misyonunu kısaca anlatın..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Marka Tonu (Tone of Voice)</label>
                  <textarea 
                    value={newBrand.tone}
                    onChange={e => setNewBrand({...newBrand, tone: e.target.value})}
                    className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-3 text-white focus:border-lumina-gold focus:outline-none placeholder-slate-600 resize-none h-16"
                    placeholder="Örn: Yenilikçi, Enerjik, Modern, Samimi"
                  />
                </div>
              </div>

              {/* Advanced Color Palette */}
              <div className="bg-lumina-950 border border-lumina-800 rounded-xl p-4">
                 <h4 className="text-sm font-bold text-lumina-gold uppercase tracking-wider mb-4 flex items-center gap-2">
                   <Palette size={16} /> Kurumsal Renk Paleti
                 </h4>
                 
                 {/* Palette Inputs */}
                 <div className="flex items-end gap-2 mb-4">
                   <div className="flex-1">
                     <label className="block text-xs text-slate-500 mb-1">Renk Adı</label>
                     <input 
                       type="text" 
                       value={tempColorName}
                       onChange={e => setTempColorName(e.target.value)}
                       className="w-full bg-lumina-900 border border-lumina-800 rounded px-2 py-2 text-sm text-white focus:border-lumina-gold outline-none"
                       placeholder="Örn: Brand Yellow"
                     />
                   </div>
                   <div>
                     <label className="block text-xs text-slate-500 mb-1">Kod</label>
                     <div className="flex items-center gap-2 bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 h-[38px]">
                        <input 
                          type="color" 
                          value={tempColorHex}
                          onChange={e => setTempColorHex(e.target.value)}
                          className="w-6 h-6 bg-transparent border-none cursor-pointer"
                        />
                        <span className="text-xs text-slate-400 font-mono hidden sm:block">{tempColorHex}</span>
                     </div>
                   </div>
                   <button 
                     onClick={addColorToPalette}
                     className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm transition-colors h-[38px] flex items-center"
                   >
                     <Plus size={16} />
                   </button>
                 </div>

                 {/* Palette List */}
                 <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {newBrand.palette && newBrand.palette.map((color, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-lumina-900/50 p-2 rounded border border-lumina-800/50 group">
                         <div className="flex items-center gap-3">
                           <div className="w-6 h-6 rounded-full border border-white/10 shadow-sm" style={{ backgroundColor: color.hex }}></div>
                           <div>
                             <p className="text-xs font-bold text-white">{color.name}</p>
                             <p className="text-[10px] text-slate-500 font-mono">{color.hex}</p>
                           </div>
                         </div>
                         <button onClick={() => removeColorFromPalette(idx)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                           <X size={14} />
                         </button>
                      </div>
                    ))}
                    {(!newBrand.palette || newBrand.palette.length === 0) && (
                      <p className="text-xs text-slate-600 italic text-center py-2">Henüz renk eklenmedi.</p>
                    )}
                 </div>
              </div>
            </div>

            {/* Right Column: Visuals & Contact */}
            <div className="space-y-6">
              
              {/* LOGO UPLOAD SECTION - IMPROVED */}
              <div className="bg-lumina-950 border border-lumina-800 rounded-xl p-4">
                 <h4 className="text-sm font-bold text-lumina-gold uppercase tracking-wider mb-4 flex items-center gap-2">
                   <Upload size={16} /> Marka Logosu
                 </h4>
                 
                 <div className="flex flex-col items-center gap-4">
                    <label className="w-full cursor-pointer group">
                      <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all h-40 flex flex-col items-center justify-center relative overflow-hidden ${newBrand.logo ? 'border-lumina-gold bg-lumina-900' : 'border-lumina-800 hover:border-slate-600 hover:bg-lumina-900/50'}`}>
                        <input 
                          type="file" 
                          onChange={handleLogoUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          accept="image/*"
                        />
                        
                        {newBrand.logo ? (
                          <>
                            <img src={`data:image/png;base64,${newBrand.logo}`} alt="Logo Preview" className="h-full w-full object-contain p-2" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-white text-xs font-bold flex items-center gap-2"><Edit2 size={14} /> Değiştir</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full bg-lumina-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                               <Upload className="text-slate-400" size={20} />
                            </div>
                            <span className="text-slate-400 text-sm font-medium">Logo Yüklemek İçin Tıkla</span>
                            <span className="text-slate-600 text-xs mt-1">PNG (Şeffaf) önerilir (Otomatik Sıkıştırılır)</span>
                          </>
                        )}
                      </div>
                    </label>
                    
                    {newBrand.logo && (
                       <button 
                         onClick={() => setNewBrand({...newBrand, logo: null})}
                         className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                       >
                         <Trash2 size={12} /> Logoyu Kaldır
                       </button>
                    )}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Ana Renk (UI)</label>
                  <div className="flex items-center gap-2 bg-lumina-950 border border-lumina-800 rounded-lg p-2">
                    <input 
                      type="color" 
                      value={newBrand.primaryColor}
                      onChange={e => setNewBrand({...newBrand, primaryColor: e.target.value})}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                    />
                    <span className="text-slate-300 text-sm font-mono">{newBrand.primaryColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">İkincil Renk (UI)</label>
                  <div className="flex items-center gap-2 bg-lumina-950 border border-lumina-800 rounded-lg p-2">
                    <input 
                      type="color" 
                      value={newBrand.secondaryColor}
                      onChange={e => setNewBrand({...newBrand, secondaryColor: e.target.value})}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                    />
                    <span className="text-slate-300 text-sm font-mono">{newBrand.secondaryColor}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-lumina-800">
                <h4 className="text-sm font-bold text-lumina-gold uppercase tracking-wider">İletişim (Opsiyonel)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input 
                      type="text" 
                      value={newBrand.instagram || ''}
                      onChange={e => setNewBrand({...newBrand, instagram: e.target.value})}
                      className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-2 text-white text-sm focus:border-lumina-gold focus:outline-none placeholder-slate-600"
                      placeholder="@instagram_adi"
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      value={newBrand.phone || ''}
                      onChange={e => setNewBrand({...newBrand, phone: e.target.value})}
                      className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-2 text-white text-sm focus:border-lumina-gold focus:outline-none placeholder-slate-600"
                      placeholder="Tel No"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="text" 
                      value={newBrand.address || ''}
                      onChange={e => setNewBrand({...newBrand, address: e.target.value})}
                      className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-2 text-white text-sm focus:border-lumina-gold focus:outline-none placeholder-slate-600"
                      placeholder="Açık Adres"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-lumina-800">
            <button 
              onClick={resetForm}
              className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Vazgeç
            </button>
            <button 
              onClick={saveBrand}
              className="bg-lumina-gold text-lumina-950 px-8 py-2 rounded-lg font-bold hover:bg-yellow-500 flex items-center gap-2 shadow-lg shadow-yellow-500/20"
            >
              <Check size={18} /> {editingId ? 'Değişiklikleri Kaydet' : 'Profili Oluştur'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {brands.map(brand => (
          <div key={brand.id} className="bg-lumina-900 border border-lumina-800 rounded-xl p-6 hover:border-lumina-gold/50 transition-all group relative flex flex-col h-full">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-lumina-900/80 backdrop-blur p-1 rounded-lg border border-lumina-800">
               <button 
                 onClick={() => handleEdit(brand)} 
                 className="text-slate-400 hover:text-white p-1.5 hover:bg-lumina-800 rounded"
                 title="Düzenle"
               >
                 <Edit2 size={16} />
               </button>
               <button 
                 onClick={(e) => deleteBrand(brand.id, e)} 
                 className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-900/20 rounded"
                 title="Sil"
               >
                 <Trash2 size={16} />
               </button>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-slate-700 shrink-0">
                {brand.logo ? (
                  <img src={`data:image/png;base64,${brand.logo}`} alt={brand.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-2xl font-bold text-slate-800">{brand.name[0]}</span>
                )}
              </div>
              <div className="overflow-hidden">
                <h3 className="text-lg font-bold text-white truncate">{brand.name}</h3>
                <p className="text-sm text-slate-400 truncate">{brand.industry}</p>
              </div>
            </div>
            
            {brand.description && (
               <p className="text-xs text-slate-400 mb-4 leading-relaxed line-clamp-2 min-h-[2.5em]">
                 {brand.description}
               </p>
            )}
            
            <div className="space-y-2 mb-4 mt-auto">
              {brand.instagram && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Instagram size={14} className="text-lumina-gold" />
                  <span className="truncate">{brand.instagram}</span>
                </div>
              )}
              {brand.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone size={14} className="text-lumina-gold" />
                  <span className="truncate">{brand.phone}</span>
                </div>
              )}
            </div>

            {/* Color Palette Display */}
            <div className="mt-4 pt-4 border-t border-lumina-800">
              {brand.palette && brand.palette.length > 0 ? (
                 <div>
                    <div className="flex flex-wrap gap-1.5">
                      {brand.palette.slice(0, 7).map((c, i) => (
                        <div key={i} className="group/color relative cursor-help">
                          <div className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: c.hex }}></div>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/color:block bg-black text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 border border-slate-700">
                            {c.name}
                          </div>
                        </div>
                      ))}
                      {brand.palette.length > 7 && (
                        <div className="w-5 h-5 rounded-full bg-lumina-800 border border-lumina-700 flex items-center justify-center text-[9px] text-slate-400">
                          +{brand.palette.length - 7}
                        </div>
                      )}
                    </div>
                 </div>
              ) : (
                 <div className="flex gap-2">
                   <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: brand.primaryColor }}></div>
                   <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: brand.secondaryColor }}></div>
                 </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrandManager;

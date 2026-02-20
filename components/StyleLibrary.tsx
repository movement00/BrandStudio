
import React, { useState } from 'react';
import { SavedTemplate, TemplateFolder } from '../types';
import { Trash2, FolderPlus, Folder, FolderOpen, Play, MoreVertical } from 'lucide-react';

interface StyleLibraryProps {
  templates: SavedTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<SavedTemplate[]>>;
  folders: TemplateFolder[];
  setFolders: React.Dispatch<React.SetStateAction<TemplateFolder[]>>;
  onSelectTemplate: (template: SavedTemplate) => void;
}

const StyleLibrary: React.FC<StyleLibraryProps> = ({ 
  templates, 
  setTemplates, 
  folders, 
  setFolders,
  onSelectTemplate 
}) => {
  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm("Bu şablonu silmek istediğinize emin misiniz?")) {
      setTemplates(templates.filter(t => t.id !== id));
    }
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    setFolders([...folders, { id: Date.now().toString(), name: newFolderName }]);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const deleteFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm("Klasörü silmek istiyor musunuz? İçindeki şablonlar silinmeyecek.")) {
      setFolders(folders.filter(f => f.id !== id));
      // Reset templates in this folder to 'undefined' (uncategorized)
      setTemplates(templates.map(t => t.folderId === id ? { ...t, folderId: undefined } : t));
      if(activeFolderId === id) setActiveFolderId('all');
    }
  };

  const moveToFolder = (templateId: string, folderId: string) => {
    setTemplates(templates.map(t => t.id === templateId ? { ...t, folderId } : t));
    setShowMoveMenu(null);
  };

  const filteredTemplates = templates.filter(t => {
    if (activeFolderId === 'all') return true;
    if (activeFolderId === 'uncategorized') return !t.folderId;
    return t.folderId === activeFolderId;
  });

  return (
    <div className="flex h-full">
      {/* Sidebar for Folders */}
      <div className="w-64 border-r border-lumina-800 bg-lumina-900/30 p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-serif text-lg">Klasörler</h3>
          <button 
            onClick={() => setIsCreatingFolder(true)} 
            className="text-lumina-gold hover:text-white transition-colors"
            title="Yeni Klasör"
          >
            <FolderPlus size={20} />
          </button>
        </div>

        {isCreatingFolder && (
          <div className="mb-4 bg-lumina-950 p-2 rounded-lg border border-lumina-800 animate-fade-in">
            <input 
              autoFocus
              type="text" 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              placeholder="Klasör adı..."
              className="w-full bg-transparent text-sm text-white outline-none mb-2"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsCreatingFolder(false)} className="text-xs text-slate-500 hover:text-white">İptal</button>
              <button onClick={createFolder} className="text-xs text-lumina-gold hover:text-white font-bold">Oluştur</button>
            </div>
          </div>
        )}

        <nav className="space-y-1 flex-1 overflow-y-auto">
          <button 
            onClick={() => setActiveFolderId('all')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${activeFolderId === 'all' ? 'bg-lumina-gold/20 text-lumina-gold' : 'text-slate-400 hover:bg-lumina-800 hover:text-white'}`}
          >
            <FolderOpen size={16} /> Tüm Stiller ({templates.length})
          </button>
          
          {folders.map(folder => (
            <div key={folder.id} className="group relative">
               <button 
                onClick={() => setActiveFolderId(folder.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm pr-8 truncate ${activeFolderId === folder.id ? 'bg-lumina-gold/20 text-lumina-gold' : 'text-slate-400 hover:bg-lumina-800 hover:text-white'}`}
              >
                <Folder size={16} /> {folder.name}
              </button>
              <button 
                onClick={(e) => deleteFolder(folder.id, e)}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          <button 
            onClick={() => setActiveFolderId('uncategorized')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${activeFolderId === 'uncategorized' ? 'bg-lumina-gold/20 text-lumina-gold' : 'text-slate-400 hover:bg-lumina-800 hover:text-white'}`}
          >
            <Folder size={16} /> Kategorisiz
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
           <h2 className="text-2xl font-serif text-white">
             {activeFolderId === 'all' ? 'Tüm Stiller' : 
              activeFolderId === 'uncategorized' ? 'Kategorisiz Stiller' : 
              folders.find(f => f.id === activeFolderId)?.name || 'Stiller'}
           </h2>
           <p className="text-slate-400 text-sm">
             {filteredTemplates.length} stil bulundu. Kullanmak için karta tıklayın.
           </p>
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="text-center py-20 bg-lumina-900/20 rounded-xl border border-dashed border-slate-800">
             <p className="text-slate-500">Bu klasörde henüz stil yok.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
             {filteredTemplates.map(template => (
               <div 
                 key={template.id} 
                 onClick={() => onSelectTemplate(template)}
                 className="bg-lumina-900 border border-lumina-800 rounded-xl overflow-hidden group hover:border-lumina-gold/50 cursor-pointer transition-all hover:shadow-2xl hover:shadow-black/50"
               >
                  <div className="h-48 overflow-hidden relative">
                     <img 
                       src={`data:image/jpeg;base64,${template.thumbnail}`} 
                       alt={template.name} 
                       className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                     />
                     
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-lumina-gold text-lumina-950 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform">
                          <Play size={16} /> Stüdyoda Aç
                        </div>
                     </div>

                     <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                           <button 
                             onClick={() => setShowMoveMenu(showMoveMenu === template.id ? null : template.id)}
                             className="bg-black/60 text-white p-2 rounded-lg hover:bg-black/80 backdrop-blur-sm"
                           >
                             <MoreVertical size={16} />
                           </button>
                           {showMoveMenu === template.id && (
                             <div className="absolute right-0 top-full mt-2 w-40 bg-lumina-900 border border-lumina-800 rounded-lg shadow-xl z-10 py-1">
                               <div className="px-3 py-2 text-xs text-slate-500 border-b border-lumina-800">Şuraya Taşı:</div>
                               {folders.map(f => (
                                 <button 
                                   key={f.id}
                                   onClick={() => moveToFolder(template.id, f.id)}
                                   className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-lumina-800 hover:text-white truncate"
                                 >
                                   {f.name}
                                 </button>
                               ))}
                             </div>
                           )}
                        </div>
                        <button onClick={(e) => deleteTemplate(template.id, e)} className="bg-red-500/80 text-white p-2 rounded-lg hover:bg-red-500 backdrop-blur-sm">
                          <Trash2 size={16} />
                        </button>
                     </div>
                  </div>
                  <div className="p-4">
                     <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium truncate pr-2">{template.name}</h3>
                        {template.folderId && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {folders.find(f => f.id === template.folderId)?.name}
                          </span>
                        )}
                     </div>
                     <p className="text-xs text-slate-500">
                       {template.analysis.mood.split(',')[0]} • {template.analysis.artisticStyle.split(',')[0]}
                     </p>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleLibrary;

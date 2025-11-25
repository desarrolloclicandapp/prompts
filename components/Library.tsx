import React, { useEffect, useState } from 'react';
import { getFolderContent, createSubFolder, createDepartment, deleteItem, renameItem, moveItem } from '@/app/actions/browser'; 
import { EditItemModal } from './EditItemModal';
import { useMemo } from 'react';

interface FileSystemItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  meta?: any;
}

interface LibraryProps {
  onLoad: (prompt: any) => void;
  initialRootId?: string | null;
  onNavigate: (view: string, params?: any) => void; // <-- Debe estar en las props de Library
}

export const Library: React.FC<LibraryProps> = ({ onLoad, initialRootId, onNavigate }) => { // <-- Desestructurar onNavigate aquí
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialRootId || null);
  const [folderName, setFolderName] = useState("Inicio");
  const [parentId, setParentId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [realCurrentIdRef, setRealCurrentIdRef] = useState("");

  const [currentFolderData, setCurrentFolderData] = useState<any>(null); 

  useEffect(() => { 
      if (initialRootId !== undefined) setCurrentFolderId(initialRootId);
  }, [initialRootId]);

  useEffect(() => {
    loadContentWithIdFix();
  }, [currentFolderId]);

  const loadContentWithIdFix = async () => {
      setIsLoading(true);
      const result = await getFolderContent(currentFolderId || undefined);
      
      if (result.success && result.data) {
          setCurrentFolderData(result.data.currentFolder); // <-- Guardar el objeto
          setRealCurrentIdRef(result.data.currentFolder.id);
          setFolderName(result.data.currentFolder.name);
          setParentId(result.data.currentFolder.parentId);
          
          const folders = result.data.subFolders.map((f: any) => ({ id: f.id, name: f.name, type: 'folder' as const, meta: f }));
          const files = result.data.files.map((p: any) => ({ id: p.id, name: p.title, type: 'file' as const, meta: p }));
          setItems([...folders, ...files]);
      } else {
          if(result.error) console.error(result.error);
      }
      setIsLoading(false);
  }

  // FUNCIÓN handleGoBack (PUNTO 2 - Solución final de navegación)
  const handleGoBack = () => {
      // 1. Caso ESPECIAL: Si estamos dentro de un espacio personal visto desde Admin, volvemos a la lista.

      
      // 2. Navegación normal (subir un nivel)
      if (parentId) {
          setCurrentFolderId(parentId);
      } else if (currentFolderId === 'ADMIN_ROOT' || currentFolderId === 'SUPER_PERSONAL_ROOT') {
          // Si es raíz de Admin Global, volvemos al constructor o al Admin Root si hay.
          onNavigate('constructor');
      } else {
           // Raíz de Mi Espacio / Mi Depto
           onNavigate('constructor');
      }
  };


  const handleOpenEdit = (item: FileSystemItem, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita el doble clic
    setSelectedItem(item.meta || item); // Pasamos los metadatos completos
    setIsEditModalOpen(true);
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    setIsLoading(true);
    let success = false;

    if (currentFolderId === 'ADMIN_ROOT' || currentFolderId === 'SUPER_PERSONAL_ROOT') {
        const res = await createDepartment(newFolderName);
        success = res.success === true;
    } else {
        if (realCurrentIdRef) {
             // FIX: Orden de argumentos (nombre, id)
             const res = await createSubFolder(newFolderName, realCurrentIdRef); 
             success = res.success === true;
        }
    }
    
    if (success) {
        setNewFolderName("");
        setIsCreatingFolder(false);
        loadContentWithIdFix();
    } else {
        alert("Error al crear. Verifica permisos.");
        setIsLoading(false);
    }
  };

  // --- NUEVA FUNCIÓN DE BORRADO UNIFICADA ---
  const handleDelete = async (id: string, type: 'folder' | 'file', e: React.MouseEvent) => {
      e.stopPropagation(); 
      
      const label = type === 'folder' ? 'esta carpeta y todo su contenido' : 'este archivo';
      if(!confirm(`¿Seguro que quieres eliminar ${label}?`)) return;

      setIsLoading(true);
      const res = await deleteItem(id, type);
      
      if (res.success) {
          loadContentWithIdFix(); // Recargar para ver que desapareció
      } else {
          alert("Error: " + res.error);
          setIsLoading(false);
      }
  }

  const isAdminView = currentFolderId === 'ADMIN_ROOT' || currentFolderId === 'SUPER_PERSONAL_ROOT';
  
  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      {/* Barra Superior */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-lg font-medium text-gray-700">
            {/* BOTÓN VOLVER (RENDERIZADO FINAL) */}
            {(parentId || initialRootId === 'SUPER_PERSONAL_ROOT') && currentFolderId !== 'ADMIN_ROOT' && (
                <button 
                    onClick={handleGoBack} // Llama a la función corregida
                    className="p-1 hover:bg-gray-100 rounded-full mr-2 transition-colors"
                    title="Atrás"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
            )}
            <span className="flex items-center gap-2">
                {isAdminView ? (
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                )}
                {folderName}
            </span>
        </div>

        <button 
            onClick={() => setIsCreatingFolder(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isAdminView 
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {isAdminView ? "Crear Departamento" : "Nueva Carpeta"}
        </button>
      </div>

      {isCreatingFolder && (
          <form onSubmit={handleCreateFolder} className="mb-6 flex gap-2 animate-fade-in-down p-4 bg-gray-50 rounded-lg border border-gray-200">
              <input 
                autoFocus
                type="text" 
                placeholder={isAdminView ? "Nombre del nuevo departamento..." : "Nombre de la carpeta..."}
                className="border border-gray-300 rounded-lg px-4 py-2 w-80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
              />
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 font-medium">Crear</button>
              <button type="button" onClick={() => setIsCreatingFolder(false)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          </form>
      )}

      {/* GRID DE CONTENIDO */}
      {isLoading ? (
          <div className="text-center py-20 text-gray-400">Cargando...</div>
      ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
             <p>No hay elementos aquí.</p>
          </div>
      ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((item) => (
                  <div 
                    key={item.id}
                    onDoubleClick={() => {
                        if (item.type === 'folder') setCurrentFolderId(item.id);
                        else onLoad({
                            ...item.meta,
                            sections: item.meta.currentContent
                        });
                    }}
                    className={`
                        group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-3 text-center h-40 shadow-sm
                        ${item.type === 'folder' 
                            ? 'bg-amber-50 border-amber-100 hover:bg-amber-100 hover:border-amber-300 text-amber-900' 
                            : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md text-gray-700'
                        }
                    `}
                  >
                      {/* ICONO SEGÚN TIPO */}
                      {item.type === 'folder' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                      ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                      )}
                      
                      {/* NOMBRE */}
                      <span className="text-sm font-medium line-clamp-2 w-full break-words select-none">
                          {item.name}
                      </span>

                      {/* BOTÓN EDITAR (Punto 2) */}
                      <button 
                        onClick={(e) => handleOpenEdit(item, e)}
                        className="absolute top-2 right-10 p-1.5 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all z-10"
                        title="Editar"
                      >
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                      </button>
                      {/* BOTÓN BORRAR (Punto 2) */}
                      <button 
                        onClick={(e) => handleDelete(item.id, item.type, e)}
                        className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all z-10"
                        title="Borrar"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                  </div>
              ))}
          </div>
        )}
        {isEditModalOpen && selectedItem && (
          <EditItemModal 
              item={selectedItem}
              onClose={() => setIsEditModalOpen(false)}
              onSuccess={() => {
                  loadContentWithIdFix();
                  alert('¡Cambios guardados con éxito!');
              }}
          />
        )}
    </div>
  );
};
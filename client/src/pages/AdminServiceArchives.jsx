import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Archive, Building2, Folder, Plus, Edit2, Trash2, CheckCircle2, 
  AlertCircle, Search, RefreshCw, Power, ShieldCheck, Tag, 
  Layers, ArrowRight, X, ShieldAlert, Send, FileText, ChevronRight,
  HelpCircle, ArrowLeftRight
} from 'lucide-react';
import NewArchiveCategoryModal from '../components/NewArchiveCategoryModal';
import DynamicCategoryIcon, { AVAILABLE_ICONS, COLOR_PALETTE } from '../components/DynamicCategoryIcon';

export default function AdminServiceArchives() {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [categories, setCategories] = useState({ standards: [], customs: [], all: [] });
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals state
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteConfirmCat, setDeleteConfirmCat] = useState(null);
  const [moveDocsTarget, setMoveDocsTarget] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadServicesSummary();
  }, []);

  useEffect(() => {
    if (selectedService) {
      loadServiceCategories(selectedService.id);
    }
  }, [selectedService]);

  const loadServicesSummary = async () => {
    try {
      setLoadingServices(true);
      setErrorMsg('');
      const data = await api.getServicesArchiveSummary();
      setServices(data || []);
      if (data && data.length > 0 && !selectedService) {
        setSelectedService(data[0]);
      }
    } catch (err) {
      console.error('Error loading services summary:', err);
      setErrorMsg('Erreur lors du chargement des services.');
    } finally {
      setLoadingServices(false);
    }
  };

  const loadServiceCategories = async (srvId) => {
    try {
      setLoadingCategories(true);
      setErrorMsg('');
      const data = await api.getArchiveCategories(srvId);
      setCategories(data || { standards: [], customs: [], all: [] });
    } catch (err) {
      console.error('Error loading service categories:', err);
      setErrorMsg('Erreur lors du chargement des catégories du service.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleToggleActive = async (cat) => {
    try {
      await api.updateArchiveCategory(cat.id, {
        is_active: !cat.is_active
      });
      setSuccessMsg(`Statut de [${cat.name}] mis à jour avec succès.`);
      loadServiceCategories(selectedService.id);
      loadServicesSummary();
    } catch (err) {
      setErrorMsg(err.message || 'Erreur lors du changement de statut.');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      await api.updateArchiveCategory(editingCategory.id, {
        name: editingCategory.name,
        description: editingCategory.description,
        icon: editingCategory.icon,
        color: editingCategory.color,
        display_order: parseInt(editingCategory.display_order, 10) || 50,
        is_active: editingCategory.is_active
      });
      setEditingCategory(null);
      setSuccessMsg(`Catégorie [${editingCategory.name}] mise à jour avec succès.`);
      loadServiceCategories(selectedService.id);
      loadServicesSummary();
    } catch (err) {
      setErrorMsg(err.message || 'Erreur lors de la modification.');
    }
  };

  const handleDeleteCategory = async (cat) => {
    try {
      setIsDeleting(true);
      setDeleteError('');
      await api.deleteArchiveCategory(cat.id);
      setDeleteConfirmCat(null);
      setSuccessMsg(`Catégorie [${cat.name}] supprimée avec succès.`);
      loadServiceCategories(selectedService.id);
      loadServicesSummary();
    } catch (err) {
      setDeleteError(err.message || 'Impossible de supprimer cette catégorie.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveAndDelete = async () => {
    if (!deleteConfirmCat) return;
    try {
      setIsDeleting(true);
      setDeleteError('');
      
      const isTargetCustomId = !isNaN(Number(moveDocsTarget)) && Number(moveDocsTarget) > 0;
      
      await api.moveCategoryDocuments(deleteConfirmCat.id, {
        target_category_id: isTargetCustomId ? Number(moveDocsTarget) : null,
        target_category_code: isTargetCustomId ? undefined : (moveDocsTarget || 'NON_CLASSE')
      });

      await api.deleteArchiveCategory(deleteConfirmCat.id);
      setDeleteConfirmCat(null);
      setMoveDocsTarget('');
      setSuccessMsg(`Documents déplacés et catégorie supprimée avec succès.`);
      loadServiceCategories(selectedService.id);
      loadServicesSummary();
    } catch (err) {
      setDeleteError(err.message || 'Erreur lors du déplacement des documents.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredServices = services.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.acronym?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const otherCustomCategories = (categories.customs || []).filter(c => c.id !== deleteConfirmCat?.id);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-kindia-blue to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-black text-2xl text-kindia-gold border border-white/20 shadow-inner shrink-0">
            <Archive className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-kindia-gold bg-white/10 px-2.5 py-0.5 rounded-full">
                Administration Centrale • Archivage
              </span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl mt-1 text-white">
              Gestion des Archives des Services
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Supervision globale, personnalisation et organisation des catégories d'archives pour chaque faculté, département et service de l'Université.
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-2xl flex items-center justify-between text-emerald-800 text-xs font-bold shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-2xl flex items-center justify-between text-rose-800 text-xs font-bold shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-900">✕</button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Services List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-extrabold text-sm text-slate-900 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-kindia-blue" />
              <span>Structures & Services ({services.length})</span>
            </h3>
            <button
              onClick={loadServicesSummary}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition"
              title="Rafraîchir"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrer un service (ex: Faculté, DGI, Scolarité)..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-2 focus:ring-kindia-blue focus:bg-white"
            />
          </div>

          {/* List of services */}
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {loadingServices ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <div className="animate-spin w-5 h-5 border-2 border-kindia-blue border-t-transparent rounded-full mx-auto mb-2"></div>
                Chargement des services...
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Aucun service trouvé.
              </div>
            ) : (
              filteredServices.map((s) => {
                const isSelected = selectedService?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedService(s)}
                    className={`w-full p-3 rounded-2xl text-left transition flex items-center justify-between border ${
                      isSelected
                        ? 'bg-kindia-blue text-white border-kindia-blue shadow-md'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-xs truncate">{s.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold uppercase ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {s.code}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5 text-[10px] opacity-75">
                        <span>{s.categories_count || 0} catégorie(s)</span>
                        <span>•</span>
                        <span>{s.archived_docs_count || 0} doc(s)</span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-kindia-gold' : 'text-slate-400'}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Categories Management Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          {selectedService ? (
            <>
              {/* Header of selected service */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-kindia-blue bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      {selectedService.structure_type || 'SERVICE'}
                    </span>
                    <span className="text-xs text-slate-400">Code : {selectedService.code}</span>
                  </div>
                  <h3 className="font-heading font-extrabold text-xl text-slate-900 mt-1">
                    Catégories d'archives — {selectedService.name}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNewCatModalOpen(true)}
                  className="bg-kindia-blue hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Ajouter une catégorie</span>
                </button>
              </div>

              {/* Table of categories for selected service */}
              {loadingCategories ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  <div className="animate-spin w-6 h-6 border-2 border-kindia-blue border-t-transparent rounded-full mx-auto mb-2"></div>
                  Chargement des catégories du service...
                </div>
              ) : categories.customs?.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
                  <Folder className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold">Aucune catégorie pour ce service.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Cliquez sur « + Ajouter une catégorie » pour créer un nouveau dossier d'archives.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <th className="py-3 px-3">Catégorie</th>
                        <th className="py-3 px-3 text-center">Documents</th>
                        <th className="py-3 px-3 text-center">Icône</th>
                        <th className="py-3 px-3 text-center">Couleur</th>
                        <th className="py-3 px-3 text-center">Ordre</th>
                        <th className="py-3 px-3 text-center">Statut</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.customs.map((cat) => (
                        <tr key={cat.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{cat.name}</span>
                              {cat.is_default && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-blue-100 text-blue-800 uppercase">
                                  Standard
                                </span>
                              )}
                            </div>
                            {cat.description && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                {cat.description}
                              </p>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="px-2.5 py-1 rounded-full font-black text-xs bg-slate-100 text-slate-800 border border-slate-200">
                              {cat.document_count || 0}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex p-1.5 rounded-lg border text-xs font-bold ${cat.color || 'text-teal-700 bg-teal-50 border-teal-200'}`}>
                              <DynamicCategoryIcon iconName={cat.icon} className="w-4 h-4" />
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="text-[10px] font-semibold text-slate-600">
                              {COLOR_PALETTE.find(c => c.id === cat.color)?.label || 'Par défaut'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                            {cat.display_order}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleToggleActive(cat)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition ${
                                cat.is_active
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              {cat.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => setEditingCategory({
                                  ...cat,
                                  icon: cat.icon || 'Folder',
                                  color: cat.color || 'text-kindia-blue bg-blue-50 border-blue-200'
                                })}
                                className="p-1.5 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 rounded-lg text-xs transition"
                                title="Modifier (Renommer, icône, couleur, ordre)"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteError('');
                                  setMoveDocsTarget('');
                                  setDeleteConfirmCat(cat);
                                }}
                                className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-lg text-xs transition"
                                title="Supprimer la catégorie"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="p-16 text-center text-slate-400 text-xs">
              Sélectionnez un service dans la liste de gauche pour administrer ses catégories d'archives.
            </div>
          )}
        </div>

      </div>

      {/* New Category Modal */}
      {isNewCatModalOpen && selectedService && (
        <NewArchiveCategoryModal
          isOpen={isNewCatModalOpen}
          serviceId={selectedService.id}
          onClose={() => setIsNewCatModalOpen(false)}
          onSuccess={() => {
            setIsNewCatModalOpen(false);
            setSuccessMsg('Nouvelle catégorie créée avec succès !');
            loadServiceCategories(selectedService.id);
            loadServicesSummary();
          }}
        />
      )}

      {/* Edit Category Modal (Admin: Full Customization) */}
      {editingCategory && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-heading font-extrabold text-base text-slate-900">
                Modifier la Catégorie [ {editingCategory.name} ]
              </h3>
              <button onClick={() => setEditingCategory(null)} className="p-1 hover:bg-slate-100 rounded-full">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Nom de la catégorie</label>
                <input
                  type="text"
                  required
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tous les documents classés resteront intacts dans ce dossier après renommage.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-hidden"
                />
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Icône de la catégorie</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 border border-slate-200 rounded-2xl bg-slate-50/50">
                  {AVAILABLE_ICONS.map((opt) => {
                    const IconComp = opt.icon;
                    const isSelected = editingCategory.icon === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditingCategory({ ...editingCategory, icon: opt.id })}
                        className={`p-2 rounded-xl border text-left flex items-center space-x-2 transition ${
                          isSelected
                            ? 'border-kindia-blue bg-blue-50/80 text-kindia-blue font-bold shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <IconComp className="w-4 h-4 shrink-0" />
                        <span className="text-[11px] truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Couleur & Thème</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditingCategory({ ...editingCategory, color: c.id })}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition ${
                        editingCategory.color === c.id
                          ? 'border-slate-800 ring-2 ring-slate-800 bg-white shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${c.bg}`}></span>
                      <span className="text-[10px] truncate">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Ordre d'affichage</label>
                  <input
                    type="number"
                    value={editingCategory.display_order || 50}
                    onChange={(e) => setEditingCategory({ ...editingCategory, display_order: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Statut</label>
                  <select
                    value={editingCategory.is_active ? 1 : 0}
                    onChange={(e) => setEditingCategory({ ...editingCategory, is_active: parseInt(e.target.value, 10) === 1 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-hidden"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-kindia-blue hover:bg-blue-800 text-white rounded-xl text-xs font-bold"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Modal (Admin: Safe Deletion with Relocation) */}
      {deleteConfirmCat && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="font-heading font-extrabold text-base text-slate-900">
                Supprimer la Catégorie [ {deleteConfirmCat.name} ]
              </h3>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs">
              <p className="font-bold">
                « Cette catégorie contient {deleteConfirmCat.document_count || 0} document(s). Voulez-vous vraiment la supprimer ? »
              </p>
              {(deleteConfirmCat.document_count || 0) > 0 && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Pour éviter toute perte de documents, vous devez obligatoirement réassigner ces documents vers un autre dossier du service ou vers « Non classés ».
                </p>
              )}
            </div>

            {deleteError && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-800 text-xs font-medium">
                {deleteError}
              </div>
            )}

            {(deleteConfirmCat.document_count || 0) > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-kindia-blue" />
                  <span>Déplacer les {deleteConfirmCat.document_count} document(s) vers :</span>
                </label>
                <select
                  value={moveDocsTarget}
                  onChange={(e) => setMoveDocsTarget(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-hidden focus:ring-2 focus:ring-kindia-blue"
                >
                  <option value="">-- Choisir une destination obligatoire --</option>
                  <option value="NON_CLASSE">📁 Déplacer vers « Non classés »</option>
                  {otherCustomCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      📁 {c.name} ({c.document_count || 0} docs)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmCat(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Annuler
              </button>

              {(deleteConfirmCat.document_count || 0) > 0 ? (
                <button
                  type="button"
                  disabled={!moveDocsTarget || isDeleting}
                  onClick={handleMoveAndDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <span>{isDeleting ? 'Traitement...' : 'Déplacer & Supprimer'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeleteCategory(deleteConfirmCat)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <span>{isDeleting ? 'Suppression...' : 'Supprimer définitivement'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

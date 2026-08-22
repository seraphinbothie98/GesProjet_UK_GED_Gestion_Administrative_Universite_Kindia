import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  X, FolderCog, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, 
  Power, ArrowLeftRight, Tag, ShieldAlert, RefreshCw,
  Building2, Lock, Folder
} from 'lucide-react';
import NewArchiveCategoryModal from './NewArchiveCategoryModal';
import DynamicCategoryIcon, { AVAILABLE_ICONS, COLOR_PALETTE } from './DynamicCategoryIcon';

export default function ManageArchiveCategoriesModal({ isOpen, onClose, onCategoriesUpdated }) {
  const { user } = useAuth();
  const isAdmin = user?.role_code === 'ADMINISTRATEUR';

  const [categories, setCategories] = useState({ standards: [], customs: [], all: [] });
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(user?.service_id || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Submodals & editing state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteConfirmCat, setDeleteConfirmCat] = useState(null);
  const [moveDocsTarget, setMoveDocsTarget] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [availableTypes, setAvailableTypes] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (isAdmin) {
        loadServicesList();
      }
      loadDocumentTypes();
      loadCategories(selectedServiceId || user?.service_id);
    }
  }, [isOpen, selectedServiceId]);

  const loadDocumentTypes = async () => {
    try {
      const types = await api.getOfficialDocumentTypes();
      setAvailableTypes(types || []);
    } catch (e) {
      console.warn('Error fetching document types:', e);
    }
  };

  const loadServicesList = async () => {
    try {
      const srvList = await api.getServices();
      setServices(srvList || []);
    } catch (e) {
      console.warn('Error fetching services:', e);
    }
  };

  const loadCategories = async (srvId) => {
    try {
      setLoading(true);
      setError('');
      const targetId = srvId || user?.service_id;
      const data = await api.getArchiveCategories(isAdmin ? { service_id: targetId } : {});
      setCategories(data);
    } catch (err) {
      console.error('Error loading archive categories:', err);
      setError('Erreur lors du chargement des catégories.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (cat) => {
    if (!isAdmin) {
      setError('Seul l\'administrateur système est autorisé à modifier le statut d\'une catégorie.');
      return;
    }
    try {
      await api.updateArchiveCategory(cat.id, {
        is_active: !cat.is_active
      });
      setSuccessMsg(`Catégorie [${cat.name}] ${!cat.is_active ? 'activée' : 'désactivée'}.`);
      loadCategories(selectedServiceId);
      onCategoriesUpdated?.();
    } catch (err) {
      setError(err.message || 'Erreur lors du changement de statut.');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCategory || !isAdmin) return;
    try {
      await api.updateArchiveCategory(editingCategory.id, {
        name: editingCategory.name,
        description: editingCategory.description,
        icon: editingCategory.icon,
        color: editingCategory.color,
        display_order: parseInt(editingCategory.display_order, 10) || 50,
        associated_types: editingCategory.associated_types || [],
        is_default_for_types: editingCategory.is_default_for_types || [],
        is_active: editingCategory.is_active
      });
      setEditingCategory(null);
      setSuccessMsg(`Catégorie [${editingCategory.name}] mise à jour avec succès.`);
      loadCategories(selectedServiceId);
      onCategoriesUpdated?.();
    } catch (err) {
      setError(err.message || 'Erreur lors de la modification.');
    }
  };

  const toggleEditingType = (typeCode) => {
    if (!editingCategory) return;
    const currentTypes = editingCategory.associated_types || [];
    const currentDef = editingCategory.is_default_for_types || [];
    if (currentTypes.includes(typeCode)) {
      setEditingCategory({
        ...editingCategory,
        associated_types: currentTypes.filter(t => t !== typeCode),
        is_default_for_types: currentDef.filter(t => t !== typeCode)
      });
    } else {
      setEditingCategory({
        ...editingCategory,
        associated_types: [...currentTypes, typeCode],
        is_default_for_types: [...currentDef, typeCode]
      });
    }
  };

  const toggleEditingDefault = (typeCode, e) => {
    e.stopPropagation();
    if (!editingCategory) return;
    const currentDef = editingCategory.is_default_for_types || [];
    if (currentDef.includes(typeCode)) {
      setEditingCategory({
        ...editingCategory,
        is_default_for_types: currentDef.filter(t => t !== typeCode)
      });
    } else {
      setEditingCategory({
        ...editingCategory,
        is_default_for_types: [...currentDef, typeCode]
      });
    }
  };

  const handleDelete = async (cat) => {
    if (!isAdmin) return;
    try {
      setIsDeleting(true);
      setDeleteError('');
      await api.deleteArchiveCategory(cat.id);
      setDeleteConfirmCat(null);
      setSuccessMsg(`Catégorie [${cat.name}] supprimée avec succès.`);
      loadCategories(selectedServiceId);
      onCategoriesUpdated?.();
    } catch (err) {
      setDeleteError(err.message || 'Impossible de supprimer cette catégorie.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveAndDelete = async () => {
    if (!deleteConfirmCat || !isAdmin) return;
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
      loadCategories(selectedServiceId);
      onCategoriesUpdated?.();
    } catch (err) {
      setDeleteError(err.message || 'Erreur lors du déplacement des documents.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const otherCustomCategories = (categories.customs || []).filter(c => c.id !== deleteConfirmCat?.id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[88vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-kindia-blue via-kindia-lightBlue to-kindia-blue text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-kindia-gold border border-white/20">
              <FolderCog className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base">Gestion des Catégories d'Archives</h3>
              <p className="text-xs text-slate-200">
                {isAdmin ? 'Administration globale de tous les services' : 'Catégories d\'archivage de votre service'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {successMsg && (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-lg flex items-center justify-between text-emerald-800 text-xs font-semibold">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg('')} className="text-emerald-600">✕</button>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-lg flex items-center justify-between text-rose-800 text-xs font-semibold">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')} className="text-rose-600">✕</button>
            </div>
          )}

          {/* Admin Service Selector */}
          {isAdmin && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-kindia-blue" />
                <span className="text-xs font-bold text-slate-800">Sélectionner un service :</span>
              </div>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-xs outline-hidden min-w-[280px]"
              >
                <option value="">-- Choisir une structure administrative --</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Dossiers & Catégories ({categories.customs?.length || 0})
            </h4>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="bg-kindia-blue hover:bg-blue-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Ajouter une catégorie</span>
            </button>
          </div>

          {!isAdmin && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-950 text-[11px] flex items-center space-x-2">
              <Lock className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                Vous pouvez créer de nouvelles catégories pour votre service. La modification et la suppression des catégories existantes sont réservées à l'administrateur système.
              </span>
            </div>
          )}

          {/* List of Custom Categories */}
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-kindia-blue border-t-transparent rounded-full mx-auto mb-2"></div>
              <span className="text-xs text-slate-500">Chargement des catégories...</span>
            </div>
          ) : categories.customs?.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
              <p className="text-xs font-semibold">Aucune catégorie pour ce service.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Cliquez sur « + Ajouter une catégorie » pour créer votre premier dossier.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {categories.customs.map((cat) => (
                <div
                  key={cat.id}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    cat.is_active
                      ? 'bg-white border-slate-200 shadow-xs hover:border-kindia-blue/40'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${cat.color || 'text-teal-700 bg-teal-50 border-teal-200'}`}>
                      <DynamicCategoryIcon iconName={cat.icon} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {cat.name}
                        </span>
                        {cat.is_default && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-blue-100 text-blue-800 uppercase">
                            Standard
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {cat.document_count || 0} doc(s)
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold ${
                          cat.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-md">
                          {cat.description}
                        </p>
                      )}
                      {cat.associated_types && cat.associated_types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {cat.associated_types.map(t => {
                            const isDef = cat.is_default_for_types?.includes(t);
                            return (
                              <span
                                key={t}
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                  isDef ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {isDef ? `⭐ ${t}` : t}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions for Admin vs Locked for service */}
                  {isAdmin ? (
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handleToggleActive(cat)}
                        className={`p-1.5 rounded-lg border text-xs transition ${
                          cat.is_active 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                        title={cat.is_active ? 'Désactiver' : 'Activer'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setEditingCategory(cat)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition"
                        title="Modifier (Admin: Renommer, types associés, icône, couleur)"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setDeleteError('');
                          setMoveDocsTarget('');
                          setDeleteConfirmCat(cat);
                        }}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs transition"
                        title="Supprimer (Admin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 font-semibold px-2 py-1 bg-slate-100 rounded-lg flex items-center space-x-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Verrouillé</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            Fermer
          </button>
        </div>

      </div>

      {/* New Category Modal */}
      {isNewModalOpen && (
        <NewArchiveCategoryModal
          isOpen={isNewModalOpen}
          serviceId={isAdmin ? selectedServiceId : null}
          onClose={() => setIsNewModalOpen(false)}
          onSuccess={() => {
            setIsNewModalOpen(false);
            setSuccessMsg('Nouvelle catégorie créée avec succès !');
            loadCategories(selectedServiceId);
            onCategoriesUpdated?.();
          }}
        />
      )}

      {/* Edit Category Modal (Admin only) */}
      {editingCategory && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4 max-h-[88vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-heading font-extrabold text-base text-slate-900">
                Modifier la Catégorie [ {editingCategory.name} ]
              </h3>
              <button onClick={() => setEditingCategory(null)} className="p-1 hover:bg-slate-100 rounded-full">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Nom de la catégorie</label>
                <input
                  type="text"
                  required
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-hidden"
                />
              </div>

              {/* Associated Types Selector in Edit */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-black text-slate-800">
                  Types de documents / Actes associés
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                  {availableTypes.map((t) => {
                    const isSelected = (editingCategory.associated_types || []).includes(t.code);
                    const isDef = (editingCategory.is_default_for_types || []).includes(t.code);
                    return (
                      <div
                        key={t.code}
                        onClick={() => toggleEditingType(t.code)}
                        className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold cursor-pointer transition flex items-center space-x-1.5 select-none ${
                          isSelected
                            ? 'bg-kindia-blue text-white border-kindia-blue shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{t.label}</span>
                        {isSelected && (
                          <span
                            onClick={(e) => toggleEditingDefault(t.code, e)}
                            title={isDef ? 'Catégorie par défaut (Cliquez pour retirer)' : 'Définir par défaut'}
                            className={`text-[8px] px-1 py-0.2 rounded font-black cursor-pointer ${
                              isDef ? 'bg-kindia-gold text-slate-900' : 'bg-white/20 text-white hover:bg-white/40'
                            }`}
                          >
                            {isDef ? '⭐ DÉFAUT' : '+ DÉFAUT'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
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

              {/* Icon Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Icône</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-1 border border-slate-200 rounded-2xl bg-slate-50/50">
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

              {/* Color Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Couleur</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditingCategory({ ...editingCategory, color: c.id })}
                      className={`px-2 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition ${
                        editingCategory.color === c.id
                          ? 'border-slate-800 ring-2 ring-slate-800 bg-white shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${c.bg}`}></span>
                      <span className="text-[10px] truncate">{c.label}</span>
                    </button>
                  ))}
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
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Move Category Modal (Admin only) */}
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-hidden"
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
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
                >
                  {isDeleting ? 'Traitement...' : 'Déplacer & Supprimer'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDelete(deleteConfirmCat)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
                >
                  {isDeleting ? 'Suppression...' : 'Supprimer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, FolderPlus, CheckCircle2, AlertCircle, Plus, Tag, Check, Sparkles } from 'lucide-react';
import { AVAILABLE_ICONS, COLOR_PALETTE } from './DynamicCategoryIcon';

export default function NewArchiveCategoryModal({ isOpen, serviceId = null, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Folder');
  const [selectedColor, setSelectedColor] = useState('text-kindia-blue bg-blue-50 border-blue-200');
  const [displayOrder, setDisplayOrder] = useState('50');
  const [isActive, setIsActive] = useState(true);
  
  // Associated Types & Defaults (Rules 2, 3, 4, 8)
  const [availableTypes, setAvailableTypes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [defaultForTypes, setDefaultForTypes] = useState([]);
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadDocumentTypes();
    }
  }, [isOpen]);

  const loadDocumentTypes = async () => {
    try {
      setLoadingTypes(true);
      const types = await api.getOfficialDocumentTypes();
      setAvailableTypes(types || []);
    } catch (err) {
      console.warn('Error loading official document types:', err);
    } finally {
      setLoadingTypes(false);
    }
  };

  if (!isOpen) return null;

  const toggleTypeSelection = (typeCode) => {
    if (selectedTypes.includes(typeCode)) {
      setSelectedTypes(selectedTypes.filter(t => t !== typeCode));
      setDefaultForTypes(defaultForTypes.filter(t => t !== typeCode));
    } else {
      setSelectedTypes([...selectedTypes, typeCode]);
      setDefaultForTypes([...defaultForTypes, typeCode]);
    }
  };

  const toggleDefaultSelection = (typeCode, e) => {
    e.stopPropagation();
    if (defaultForTypes.includes(typeCode)) {
      setDefaultForTypes(defaultForTypes.filter(t => t !== typeCode));
    } else {
      setDefaultForTypes([...defaultForTypes, typeCode]);
    }
  };

  const handleCreateNewType = async () => {
    if (!newTypeLabel.trim()) return;
    try {
      const res = await api.createOfficialDocumentType({ label: newTypeLabel.trim() });
      if (res && res.type) {
        setAvailableTypes(prev => [...prev.filter(t => t.code !== res.type.code), res.type]);
        setSelectedTypes(prev => [...prev, res.type.code]);
        setDefaultForTypes(prev => [...prev, res.type.code]);
        setNewTypeLabel('');
        setShowNewTypeInput(false);
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du type.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom de la catégorie est obligatoire.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.createArchiveCategory({
        service_id: serviceId || undefined,
        name: name.trim(),
        description: description.trim() || null,
        icon: selectedIcon,
        color: selectedColor,
        display_order: parseInt(displayOrder, 10) || 50,
        associated_types: selectedTypes,
        is_default_for_types: defaultForTypes,
        is_active: isActive
      });

      onSuccess?.(res.category);
      onClose();
    } catch (err) {
      console.error('Create category error:', err);
      setError(err.message || 'Erreur lors de la création de la catégorie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-kindia-blue to-kindia-lightBlue text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-kindia-gold border border-white/20">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base">Nouvelle Catégorie d'Archives</h3>
              <p className="text-xs text-slate-200">Classement & liaison avec les actes officiels</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-lg flex items-center space-x-2 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Nom de la catégorie <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Actes réglementaires, Documents techniques, Rapports, Projets..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-kindia-blue focus:bg-white outline-hidden"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Positionnée automatiquement par ordre alphabétique dans le classement.
            </p>
          </div>

          {/* Associated Official Types Selector (Rules 2, 3, 4, 8) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-black text-slate-800">
                  Types de documents / Actes officiels associés
                </label>
                <p className="text-[10px] text-slate-500">
                  Sélectionnez les actes qui seront automatiquement classés dans cette catégorie
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewTypeInput(!showNewTypeInput)}
                className="text-[11px] font-bold text-kindia-blue hover:text-blue-800 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Autre type</span>
              </button>
            </div>

            {showNewTypeInput && (
              <div className="p-3 bg-white rounded-xl border border-blue-200 flex items-center space-x-2">
                <input
                  type="text"
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  placeholder="Nom du nouveau type (ex: Bordereau de livraison)"
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleCreateNewType}
                  className="px-3 py-1.5 bg-kindia-blue text-white rounded-lg text-xs font-bold shadow-xs hover:bg-kindia-lightBlue"
                >
                  Ajouter
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
              {availableTypes.map((t) => {
                const isSelected = selectedTypes.includes(t.code);
                const isDefault = defaultForTypes.includes(t.code);
                return (
                  <div
                    key={t.code}
                    onClick={() => toggleTypeSelection(t.code)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center space-x-1.5 select-none ${
                      isSelected
                        ? 'bg-kindia-blue text-white border-kindia-blue shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{t.label}</span>
                    {isSelected && (
                      <span
                        onClick={(e) => toggleDefaultSelection(t.code, e)}
                        title={isDefault ? 'Catégorie par défaut pour ce type (Cliquez pour désactiver)' : 'Définir comme catégorie par défaut'}
                        className={`text-[9px] px-1.5 py-0.2 rounded font-black cursor-pointer ${
                          isDefault ? 'bg-kindia-gold text-slate-900' : 'bg-white/20 text-white hover:bg-white/40'
                        }`}
                      >
                        {isDefault ? '⭐ DÉFAUT' : '+ DÉFAUT'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {selectedTypes.length > 0 && (
              <p className="text-[10px] text-emerald-700 font-semibold flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>{selectedTypes.length} type(s) lié(s) à cette catégorie</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Description / Notes d'usage (facultatif)
            </label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Décrets, arrêtés, circulaires et textes réglementaires officiels..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-kindia-blue focus:bg-white outline-hidden"
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Icône représentative
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-slate-50/50">
              {AVAILABLE_ICONS.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = selectedIcon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedIcon(opt.id)}
                    className={`p-2 rounded-xl border text-left flex items-center space-x-2 transition ${
                      isSelected
                        ? 'border-kindia-blue bg-blue-50/80 text-kindia-blue font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                    <span className="text-[11px] truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Couleur & Thème visuel
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColor(c.id)}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition ${
                    selectedColor === c.id
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

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-kindia-blue hover:bg-blue-800 text-white rounded-xl text-xs font-black shadow-md transition flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Création...' : 'Créer la catégorie'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

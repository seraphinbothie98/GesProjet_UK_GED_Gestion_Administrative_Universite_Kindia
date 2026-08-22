import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Tag, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import NewArchiveCategoryModal from './NewArchiveCategoryModal';

export default function ClassifyDocumentModal({ isOpen, document, onClose, onSuccess }) {
  const [categories, setCategories] = useState({ standards: [], customs: [], all: [] });
  const [selectedType, setSelectedType] = useState(document?.document_type || 'LETTRE');
  const [customCatId, setCustomCatId] = useState(document?.custom_category_id || '');
  const [loading, setLoading] = useState(false);
  const [fetchingCats, setFetchingCats] = useState(true);
  const [error, setError] = useState('');
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      setFetchingCats(true);
      const data = await api.getArchiveCategories();
      setCategories(data);
      if (document?.custom_category_id) {
        setCustomCatId(document.custom_category_id);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setFetchingCats(false);
    }
  };

  if (!isOpen || !document) return null;

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val.startsWith('CUSTOM_')) {
      const id = val.replace('CUSTOM_', '');
      setCustomCatId(id);
      const matched = categories.customs.find(c => String(c.id) === String(id));
      setSelectedType(matched ? matched.code : 'AUTRE');
    } else {
      setCustomCatId('');
      setSelectedType(val);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await api.classifyDocument(document.id, {
        document_type: selectedType,
        custom_category_id: customCatId || null,
        document_category: 'OFFICIAL'
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Classify error:', err);
      setError(err.message || 'Erreur lors du classement du document.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
          
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-kindia-blue to-kindia-lightBlue text-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-kindia-gold border border-white/20">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-base">Classer le Document</h3>
                <p className="text-xs text-slate-200">Réf : <strong className="text-kindia-gold">{document.reference}</strong></p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition text-slate-300 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-lg flex items-center space-x-2 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800">
                  Catégorie d'archivage <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsNewCatModalOpen(true)}
                  className="text-kindia-blue hover:text-blue-800 text-[11px] font-bold flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Nouvelle catégorie</span>
                </button>
              </div>

              {fetchingCats ? (
                <div className="p-3 text-center text-xs text-slate-400">Chargement des catégories...</div>
              ) : (
                <select
                  value={customCatId ? `CUSTOM_${customCatId}` : selectedType}
                  onChange={handleSelectChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-kindia-blue focus:bg-white outline-hidden"
                >
                  {/* Service Custom Categories */}
                  {categories.customs?.length > 0 && (
                    <optgroup label="── Catégories de mon service ──">
                      {categories.customs
                        .filter(c => c.is_active)
                        .map((c) => (
                          <option key={`custom-${c.id}`} value={`CUSTOM_${c.id}`}>
                            📁 {c.name}
                          </option>
                        ))}
                    </optgroup>
                  )}

                  {/* Standard Categories */}
                  <optgroup label="── Catégories institutionnelles ──">
                    {categories.standards?.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || fetchingCats}
                className="px-5 py-2 bg-kindia-blue hover:bg-blue-800 text-white rounded-xl text-xs font-black shadow-md transition flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{loading ? 'Classement en cours...' : 'Enregistrer le classement'}</span>
              </button>
            </div>
          </form>

        </div>
      </div>

      {/* Quick New Category Modal */}
      {isNewCatModalOpen && (
        <NewArchiveCategoryModal
          isOpen={isNewCatModalOpen}
          onClose={() => setIsNewCatModalOpen(false)}
          onSuccess={(newCat) => {
            setIsNewCatModalOpen(false);
            loadCategories();
            if (newCat) {
              setCustomCatId(newCat.id);
              setSelectedType(newCat.code);
            }
          }}
        />
      )}
    </>
  );
}

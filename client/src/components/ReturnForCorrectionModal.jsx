import React, { useState } from 'react';
import { api } from '../services/api';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';

export default function ReturnForCorrectionModal({ isOpen, document, onClose, onSuccess }) {
  const [returnReason, setReturnReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !document) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!returnReason.trim()) {
      setError('Le motif du retour pour correction est obligatoire.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.returnDocumentForCorrection({
        document_id: document.id,
        return_reason: returnReason.trim()
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Return document error:', err);
      setError(err.message || 'Erreur lors du retour du document pour correction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-white border border-white/20">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base">Retourner pour Correction</h3>
              <p className="text-xs text-amber-100">Document Réf : <strong className="text-white">{document.reference}</strong></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition text-amber-200 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-lg flex items-center space-x-2 text-rose-700 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <p>
              Le document sera renvoyé à son auteur (<strong className="text-amber-950">{document.creator_name || document.sender_name || 'Émetteur'}</strong>). Il pourra apporter les modifications nécessaires et resoumettre une nouvelle version (Version {(document.current_version || 1) + 1}).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Motif & Instructions de correction <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Ex: Veuillez corriger la référence du budget prévisionnel et joindre le bordereau officiel signé..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-hidden font-medium"
            />
          </div>

          {/* Modal Footer */}
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
              disabled={loading}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{loading ? 'Envoi du retour...' : 'Confirmer le Retour'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

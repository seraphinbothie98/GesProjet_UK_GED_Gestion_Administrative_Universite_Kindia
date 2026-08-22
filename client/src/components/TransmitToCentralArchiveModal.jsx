import React, { useState } from 'react';
import { api } from '../services/api';
import { X, Send, Landmark, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function TransmitToCentralArchiveModal({ isOpen, document, onClose, onSuccess }) {
  const [motive, setMotive] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !document) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!motive.trim()) {
      setError('Le motif officiel de transmission pour archivage central est obligatoire.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.transmitToCentralArchive(document.id, { motive: motive.trim() });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Transmit to central archive error:', err);
      setError(err.message || 'Erreur lors de la transmission pour archivage central.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-kindia-blue to-kindia-lightBlue text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-kindia-gold border border-white/20">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base">Transmettre pour Archivage Central</h3>
              <p className="text-xs text-slate-200">Document Réf : <strong className="text-kindia-gold">{document.reference}</strong></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-lg flex items-center space-x-2 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-200 text-xs text-blue-900 leading-relaxed space-y-1.5">
            <p className="font-semibold flex items-center space-x-1.5 text-blue-950">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Versement officiel aux Archives Centrales</span>
            </p>
            <p>
              Ce document sera transmis au <strong>Secrétariat Central (SC)</strong> pour versement aux archives centrales de l'Université.
            </p>
            <p className="text-[11px] text-blue-800">
              Le document conservera son identité d'origine, son numéro de référence et son historique complet de création par votre service.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Motif officiel de la transmission <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={motive}
              onChange={(e) => setMotive(e.target.value)}
              placeholder="Ex: Versement pour conservation légale, rapport académique annuel homologué..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-kindia-blue focus:bg-white outline-hidden font-medium"
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
              className="px-5 py-2.5 bg-kindia-gold text-kindia-blue hover:bg-amber-400 rounded-xl text-xs font-black shadow-md transition flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Transmission en cours...' : 'Confirmer la Transmission au SC'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

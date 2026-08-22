import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Share2, Building2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ShareArchiveModal({ isOpen, document, onClose, onSuccess }) {
  const [services, setServices] = useState([]);
  const [targetServiceId, setTargetServiceId] = useState('');
  const [motive, setMotive] = useState('');
  const [canDownload, setCanDownload] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.getServices().then(data => setServices(data || [])).catch(() => []);
      setTargetServiceId('');
      setMotive('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen || !document) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetServiceId) {
      setError('Veuillez sélectionner le service destinataire du partage.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.shareArchive(document.id, {
        target_service_id: Number(targetServiceId),
        motive: motive.trim(),
        can_download: canDownload
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Share archive error:', err);
      setError(err.message || 'Erreur lors du partage de l’archive.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-700 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-white border border-white/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base">Partager une Archive de Service</h3>
              <p className="text-xs text-teal-100">Document Réf : <strong className="text-white">{document.reference}</strong></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition text-teal-200 hover:text-white"
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

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Structure ou Service Destinataire <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={targetServiceId}
              onChange={(e) => setTargetServiceId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-600 focus:bg-white outline-hidden"
            >
              <option value="">Sélectionnez un service ou une faculté...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code || s.reference_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Motif du partage / Consultation autorisée
            </label>
            <textarea
              rows={3}
              value={motive}
              onChange={(e) => setMotive(e.target.value)}
              placeholder="Ex: Consultation accordée pour la commission d'homologation des maquettes..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-600 focus:bg-white outline-hidden font-medium"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="canDownloadCheck"
              checked={canDownload}
              onChange={(e) => setCanDownload(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
            />
            <label htmlFor="canDownloadCheck" className="text-xs text-slate-700 font-semibold cursor-pointer">
              Autoriser le téléchargement direct du fichier scellé
            </label>
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
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-black shadow-md transition flex items-center space-x-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Partage en cours...' : 'Valider le Partage'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

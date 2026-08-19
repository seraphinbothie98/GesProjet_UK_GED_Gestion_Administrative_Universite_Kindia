import React, { useState } from 'react';
import { api } from '../services/api';
import { 
  Search, FileText, CheckCircle, AlertCircle, X, Clock, 
  Calendar, User, Phone, Mail, MapPin, ShieldCheck, Download
} from 'lucide-react';

export default function PublicMissionTrackingModal({ isOpen, onClose }) {
  const [reference, setReference] = useState('');
  const [verificationInput, setVerificationInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [requestData, setRequestData] = useState(null);

  if (!isOpen) return null;

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!reference.trim() || !verificationInput.trim()) {
      setError('Veuillez remplir la référence et votre numéro de téléphone ou email.');
      return;
    }

    setLoading(true);
    setError(null);
    setRequestData(null);

    try {
      const res = await api.trackPublicMissionRequest({
        reference: reference.trim(),
        verification_input: verificationInput.trim()
      });
      setRequestData(res);
    } catch (err) {
      console.error('Track error:', err);
      setError(err.message || 'Aucune demande trouvée avec ces informations.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DEMANDE ENREGISTRÉE':
        return <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>📥</span><span>Demande reçue</span></span>;
      case 'INFORMATIONS COMPLÉMENTAIRES DEMANDÉES':
        return <span className="px-3 py-1 bg-orange-100 text-orange-900 border border-orange-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>⚠️</span><span>Compléments demandés</span></span>;
      case 'DEMANDE ACCEPTÉE':
      case 'ORDRE DE MISSION EN PRÉPARATION':
        return <span className="px-3 py-1 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>⚙️</span><span>En cours de traitement</span></span>;
      case 'EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL':
        return <span className="px-3 py-1 bg-purple-100 text-purple-900 border border-purple-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1 animate-pulse"><span>⏳</span><span>En attente de signature SG</span></span>;
      case 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL':
      case 'PRÊT À ÊTRE REMIS':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>✍️</span><span>Signé (Disponible au SC)</span></span>;
      case 'REMIS AU DEMANDEUR':
        return <span className="px-3 py-1 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>🤝</span><span>Remis au demandeur</span></span>;
      case 'ARCHIVÉ':
        return <span className="px-3 py-1 bg-slate-200 text-slate-800 border border-slate-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>📁</span><span>Archivé</span></span>;
      case 'REJETÉ':
        return <span className="px-3 py-1 bg-red-100 text-red-900 border border-red-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>❌</span><span>Demande rejetée</span></span>;
      default:
        return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-kindia-blue to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-kindia-gold/20 rounded-xl text-kindia-gold">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base tracking-wide">
                Suivre ma demande d’Ordre de Mission
              </h3>
              <p className="text-xs text-slate-300">
                Accès public sécurisé • Vérification par Référence et Téléphone ou Email
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Référence de la demande *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: DM-OM-2026-000001"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Téléphone ou Email du demandeur *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: +224 622... / email@..."
                  value={verificationInput}
                  onChange={(e) => setVerificationInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-kindia-blue"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow transition flex items-center space-x-2"
              >
                {loading ? (
                  <span>Recherche en cours...</span>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-kindia-gold" />
                    <span>Consulter l’Avancement</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Result View */}
          {requestData && (
            <div className="space-y-5">
              {/* Status Header Box */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] text-kindia-gold font-bold uppercase tracking-wider block">Référence : {requestData.reference}</span>
                  <h4 className="font-heading font-extrabold text-base text-white">{requestData.applicant_first_names} {requestData.applicant_last_name}</h4>
                  <span className="text-xs text-slate-300">{requestData.object_of_mission} ({requestData.destination})</span>
                </div>
                <div className="shrink-0">{getStatusBadge(requestData.status)}</div>
              </div>

              {/* Rejection / Complement Alert */}
              {requestData.status === 'REJETÉ' && requestData.rejection_reason && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 space-y-1">
                  <span className="font-extrabold block text-xs">Motif du Rejet par l’Administration :</span>
                  <p className="text-xs italic text-red-700">{requestData.rejection_reason}</p>
                </div>
              )}

              {requestData.status === 'INFORMATIONS COMPLÉMENTAIRES DEMANDÉES' && requestData.complement_request_notes && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-900 space-y-1">
                  <span className="font-extrabold block text-xs">Informations complémentaires demandées :</span>
                  <p className="text-xs italic text-orange-800">{requestData.complement_request_notes}</p>
                </div>
              )}

              {/* Details Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div><span className="font-bold text-slate-500">Service / Faculté :</span> <span className="text-slate-800">{requestData.applicant_service_name}</span></div>
                <div><span className="font-bold text-slate-500">Fonction :</span> <span className="text-slate-800">{requestData.applicant_function}</span></div>
                <div><span className="font-bold text-slate-500">Destination :</span> <span className="text-slate-800">{requestData.destination} ({requestData.country || 'Guinée'})</span></div>
                <div><span className="font-bold text-slate-500">Période :</span> <span className="text-slate-800">{new Date(requestData.start_date).toLocaleDateString('fr-FR')} - {new Date(requestData.end_date).toLocaleDateString('fr-FR')}</span></div>
              </div>

              {/* Chronological Timeline */}
              <div className="p-4 bg-slate-100 rounded-2xl border border-slate-300 space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-300 pb-2">
                  <Clock className="w-4 h-4 text-kindia-blue" />
                  <h5 className="font-heading font-extrabold text-xs text-kindia-blue uppercase tracking-wider">
                    Historique Chronologique des Étapes
                  </h5>
                </div>

                <div className="space-y-2.5 pt-1">
                  {requestData.history && requestData.history.length > 0 ? (
                    requestData.history.map((h, idx) => (
                      <div key={h.id || idx} className="flex items-start space-x-3 text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                        <div className="w-2 h-2 rounded-full bg-kindia-blue mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-700 font-mono">
                              {new Date(h.timestamp).toLocaleDateString('fr-FR')} à {new Date(h.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="font-bold text-kindia-blue uppercase">{h.role_name || 'Système'}</span>
                          </div>
                          <p className="text-xs text-slate-700 mt-0.5">{h.observation}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">Demande enregistrée.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

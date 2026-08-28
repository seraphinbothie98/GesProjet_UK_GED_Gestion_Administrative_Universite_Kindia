import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  X, 
  Archive, 
  Send, 
  CornerUpLeft, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  Landmark
} from 'lucide-react';

export default function ArchiveAndTransmitModal({ isOpen, document, onClose, onSuccess }) {
  const { user } = useAuth();
  
  // Options: 'ARCHIVE_SERVICE' | 'TRANSMIT' | 'RETURN_SC'
  const [selectedAction, setSelectedAction] = useState('TRANSMIT');
  const [services, setServices] = useState([]);
  const [targetServiceId, setTargetServiceId] = useState('');
  const [instruction, setInstruction] = useState('');
  const [priority, setPriority] = useState(document?.priority || 'NORMAL');
  const [motive, setMotive] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSC = user?.service_code === 'SC' || user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user?.role_code === 'AGENT_SC';

  useEffect(() => {
    if (isOpen) {
      loadServices();
      setSelectedAction('TRANSMIT');
      setTargetServiceId('');
      setInstruction('');
      setMotive('');
      setError('');
    }
  }, [isOpen]);

  const loadServices = async () => {
    try {
      const data = await api.getServices();
      // Filter out user's own service for transmission
      const activeServices = (data || []).filter(
        s => s.status === 'ACTIVE' && String(s.id) !== String(user?.service_id)
      );
      setServices(activeServices);
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  };

  if (!isOpen || !document) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (selectedAction === 'TRANSMIT') {
      if (!targetServiceId) {
        setError('Veuillez sélectionner le service destinataire.');
        return;
      }
      if (String(targetServiceId) === String(user?.service_id)) {
        setError('Impossible de transmettre vers votre propre service.');
        return;
      }
    }

    if (selectedAction === 'RETURN_SC' && !motive.trim()) {
      setError('Le motif officiel de retour pour archivage central est obligatoire.');
      return;
    }

    setLoading(true);
    try {
      if (selectedAction === 'ARCHIVE_SERVICE') {
        await api.archiveInService(document.id, { archive_scope: 'PRIVE_SERVICE' });
      } else if (selectedAction === 'TRANSMIT') {
        await api.transmitDocument({
          document_id: document.id,
          to_service_id: targetServiceId,
          instruction: instruction.trim() || 'Pour examen et suite à donner',
          priority
        });
      } else if (selectedAction === 'RETURN_SC') {
        await api.transmitToCentralArchive(document.id, { motive: motive.trim() });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Action error in ArchiveAndTransmitModal:', err);
      setError(err.message || 'Une erreur est survenue lors de l’opération.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-kindia-blue to-kindia-lightBlue px-6 py-4 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 text-kindia-gold font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base tracking-tight">Archiver et Transmettre</h3>
              <p className="text-xs text-slate-200">
                Dossier Réf : <strong className="text-kindia-gold font-mono">{document.reference}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {error && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-3.5 rounded-xl flex items-center space-x-2 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Question / Mode Selector */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2.5">
              Que souhaitez-vous faire avec ce dossier ?
            </label>
            <div className="space-y-2.5">
              
              {/* Option A: Archiver dans mon service */}
              <label 
                className={`flex items-start p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedAction === 'ARCHIVE_SERVICE' 
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="modal_action"
                  value="ARCHIVE_SERVICE"
                  checked={selectedAction === 'ARCHIVE_SERVICE'}
                  onChange={() => setSelectedAction('ARCHIVE_SERVICE')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center space-x-2">
                    <Archive className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-bold text-xs text-slate-900">A. Archiver dans mon service</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Le courrier relève de votre service et est finalisé. Il est classé dans vos archives de service et retiré des dossiers actifs à traiter.
                  </p>
                </div>
              </label>

              {/* Option B: Transmettre à un autre service */}
              <label 
                className={`flex items-start p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedAction === 'TRANSMIT' 
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="modal_action"
                  value="TRANSMIT"
                  checked={selectedAction === 'TRANSMIT'}
                  onChange={() => setSelectedAction('TRANSMIT')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center space-x-2">
                    <Send className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-xs text-slate-900">B. Transmettre / Réorienter vers un autre service</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Le courrier concerne un autre service (ex: DAF, DRH, Faculté, etc.). Le service choisi devient le nouveau responsable du dossier.
                  </p>
                </div>
              </label>

              {/* Option C: Retourner au Secrétariat Central */}
              {!isSC && (
                <label 
                  className={`flex items-start p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedAction === 'RETURN_SC' 
                      ? 'border-amber-600 bg-amber-50/70 shadow-xs' 
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="modal_action"
                    value="RETURN_SC"
                    checked={selectedAction === 'RETURN_SC'}
                    onChange={() => setSelectedAction('RETURN_SC')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center space-x-2">
                      <Landmark className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-bold text-xs text-slate-900">C. Retourner au Secrétariat Central pour archivage central</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Le traitement est terminé et le dossier doit être transmis au Secrétariat Central pour versement définitif dans les Archives Centrales de l'Université.
                    </p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Conditional Subforms */}

          {/* 1. Transmit Form */}
          {selectedAction === 'TRANSMIT' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5 animate-in fade-in">
              <div className="flex items-center space-x-1.5 text-blue-900 font-bold text-xs">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Paramètres de la transmission</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sélectionner le service destinataire <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={targetServiceId}
                  onChange={(e) => setTargetServiceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-kindia-blue outline-hidden"
                >
                  <option value="">-- Choisir le service destinataire --</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || s.reference_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instructions / Commentaire de transmission
                </label>
                <textarea
                  rows={3}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Ex: Pour traitement budgétaire, pour avis technique, pour suite à donner..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-kindia-blue outline-hidden"
                />
              </div>
            </div>
          )}

          {/* 2. Archive Service Confirmation Notice */}
          {selectedAction === 'ARCHIVE_SERVICE' && (
            <div className="p-4 bg-indigo-50/80 rounded-2xl border border-indigo-200 text-xs text-indigo-950 space-y-1.5 animate-in fade-in">
              <p className="font-bold flex items-center space-x-1.5 text-indigo-900">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Classement dans vos archives de service</span>
              </p>
              <p className="text-slate-700">
                Le document <strong>Réf {document.reference}</strong> sera classé dans les archives privées de votre service.
              </p>
              <p className="text-[11px] text-slate-500">
                • L'identifiant, les pièces jointes et l'historique complet sont intégralement conservés.<br/>
                • Le document sort de la file des courriers actifs à traiter.
              </p>
            </div>
          )}

          {/* 3. Return to SC Form */}
          {selectedAction === 'RETURN_SC' && (
            <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-3 animate-in fade-in">
              <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-xs">
                <Landmark className="w-4 h-4 text-amber-700" />
                <span>Versement pour Archivage Central</span>
              </div>
              <p className="text-xs text-amber-900">
                Le document sera retourné au <strong>Secrétariat Central</strong> qui recevra une notification pour effectuer l'archivage central.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Motif officiel du retour pour archivage central <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={motive}
                  onChange={(e) => setMotive(e.target.value)}
                  placeholder="Ex: Traitement inter-services finalisé, visas obtenus, demande de conservation définitive..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-kindia-blue outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2.5 text-white rounded-xl text-xs font-black transition shadow-md flex items-center space-x-2 ${
                selectedAction === 'ARCHIVE_SERVICE' 
                  ? 'bg-indigo-700 hover:bg-indigo-800' 
                  : selectedAction === 'TRANSMIT' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {loading ? (
                <span>Exécution en cours...</span>
              ) : selectedAction === 'ARCHIVE_SERVICE' ? (
                <>
                  <Archive className="w-4 h-4" />
                  <span>Confirmer l'archivage dans mon service</span>
                </>
              ) : selectedAction === 'TRANSMIT' ? (
                <>
                  <Send className="w-4 h-4" />
                  <span>Transmettre au service destinataire</span>
                </>
              ) : (
                <>
                  <CornerUpLeft className="w-4 h-4" />
                  <span>Retourner au SC pour archivage</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import WorkflowModal from '../components/WorkflowModal';
import MissionSignatureModal from '../components/MissionSignatureModal';
import { 
  Award, Inbox, CheckCircle2, Clock, ShieldCheck, Send, 
  UserCheck, RefreshCw, FileText, ArrowRight, Eye, AlertCircle
} from 'lucide-react';
import { formatFullName } from '../utils/userUtils';

export default function MobileResponsableSpace({ onSelectDocument, onNavigate }) {
  const { user, getLogoUrl, institution, hasPermission } = useAuth();
  const logoUrl = getLogoUrl();

  const canUserSign = hasPermission('signatures.manage') || 
                      hasPermission('mission.sign') || 
                      hasPermission('outgoing_mail.validate') ||
                      user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || 
                      user?.role_code === 'ADMINISTRATEUR';

  const [activeTab, setActiveTab] = useState('TO_SIGN'); // 'TO_SIGN' | 'RECEIVED' | 'PROCESSED' | 'EXT_MISS'
  const [documents, setDocuments] = useState([]);
  const [extMissions, setExtMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Rejection Modal State for External Mission
  const [rejectExtModal, setRejectExtModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // PDF Preview State
  const [previewExtDoc, setPreviewExtDoc] = useState(null);

  // Dedicated Mission Signature Modal State
  const [selectedMissionForSign, setSelectedMissionForSign] = useState(null);

  // Workflow Modal state for mobile action
  const [selectedDocForAction, setSelectedDocForAction] = useState(null);
  const [workflowMode, setWorkflowMode] = useState(null); // 'SIGN_AND_RETURN' | 'TRANSMIT' | 'ORIENT'

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'TO_SIGN') {
        const [docsRes, extRes] = await Promise.allSettled([
          api.getDocumentsToSign(),
          api.getExternalMissionariesToSign()
        ]);
        const list = docsRes.status === 'fulfilled' && Array.isArray(docsRes.value) ? docsRes.value : [];
        const extList = extRes.status === 'fulfilled' && Array.isArray(extRes.value) ? extRes.value : [];
        setDocuments(list);
        setExtMissions(extList);
      } else if (activeTab === 'EXT_MISS') {
        const extList = await api.getExternalMissionariesToSign().catch(() => []);
        setExtMissions(Array.isArray(extList) ? extList : []);
      } else if (activeTab === 'RECEIVED') {
        const list = await api.getDocuments({ status: 'PROCESSING' }).catch(() => []);
        setDocuments(Array.isArray(list) ? list : []);
      } else {
        const list = await api.getDocuments({ status: 'ACCEPTED' }).catch(() => []);
        setDocuments(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error('Failed to load mobile responsable documents:', err);
      setError('Erreur lors du chargement des documents.');
    } finally {
      setLoading(false);
    }
  };

  const handleActionComplete = () => {
    setSelectedDocForAction(null);
    setWorkflowMode(null);
    loadData();
  };

  const handleSignExternalMission = async (id) => {
    const mission = extMissions.find(m => m.id === id);
    const isDeparture = mission?.status === 'DÉPART ENREGISTRÉ – EN ATTENTE DE SIGNATURE DU SG';
    const actionLabel = isDeparture ? 'le DÉPART (Fin de mission)' : 'l’ARRIVÉE';

    if (!window.confirm(`Confirmez-vous l’apposition du visa et de la signature électronique du Secrétaire Général pour ${actionLabel} de ce missionnaire ?`)) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (isDeparture) {
        await api.signExternalMissionaryDeparture(id);
      } else {
        await api.signExternalMissionaryArrival(id);
      }
      await loadData();
    } catch (err) {
      console.error('Sign external mission error:', err);
      setError(err.message || 'Erreur lors de la signature électronique.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectExternalMission = async (e) => {
    e.preventDefault();
    if (!rejectExtModal || !rejectionReason.trim()) return;

    setLoading(true);
    setError('');
    try {
      await api.rejectExternalMissionary(rejectExtModal.id, rejectionReason.trim());
      setRejectExtModal(null);
      setRejectionReason('');
      await loadData();
    } catch (err) {
      console.error('Reject external mission error:', err);
      setError(err.message || 'Erreur lors du rejet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 w-full max-w-full">
      {/* Mobile Profile Header Card */}
      <div className="bg-gradient-to-r from-kindia-blue to-kindia-lightBlue rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="flex items-center space-x-3.5">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="w-12 h-12 object-contain rounded-xl bg-white p-1 shadow border border-white/20 shrink-0" 
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-kindia-gold text-kindia-blue font-extrabold text-lg flex items-center justify-center shadow shrink-0">
              UK
            </div>
          )}

          <div className="overflow-hidden">
            <span className="text-[10px] text-kindia-gold font-bold uppercase tracking-wider block">
              Espace Responsable • {user?.service_code || 'UK'}
            </span>
            <h2 className="font-heading font-extrabold text-base leading-tight truncate">
              {formatFullName(user)}
            </h2>
            <p className="text-[11px] text-slate-200 truncate font-medium mt-0.5">
              {user?.function_title || user?.role_name || user?.service_name}
            </p>
          </div>
        </div>

        {/* Institution Badge Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-300">
          <span className="truncate font-medium">{institution?.name || 'Université de Kindia'}</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
            🟢 Connecté
          </span>
        </div>
      </div>

      {/* Secrétariat Central Quick Banner for Demandes d'Ordres de Mission */}
      {(user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user?.service_code === 'SC') && onNavigate && (
        <div 
          onClick={() => onNavigate('missions')}
          className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-4 text-white shadow-md cursor-pointer hover:shadow-lg transition flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              📄
            </div>
            <div>
              <span className="text-[10px] text-yellow-200 font-bold uppercase tracking-wider block">
                Registre Secrétariat Central
              </span>
              <h3 className="font-heading font-extrabold text-sm text-white">
                Demandes d'Ordres de Mission (En Ligne)
              </h3>
              <p className="text-[11px] text-white/90">
                Consulter, valider et générer les ordres de mission officiels
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 bg-white text-amber-800 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 shadow">
            <span>Ouvrir</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Non-SC Quick Banner for Submitting a Mission Request */}
      {!(user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user?.service_code === 'SC') && onNavigate && (
        <div 
          onClick={() => onNavigate('missions')}
          className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md cursor-pointer hover:shadow-lg transition flex items-center justify-between border border-emerald-400/30"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              📝
            </div>
            <div>
              <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider block">
                Espace Missionnaire
              </span>
              <h3 className="font-heading font-extrabold text-sm text-white">
                Demander un Ordre de Mission
              </h3>
              <p className="text-[11px] text-emerald-100">
                Transmettre une demande officielle au Secrétariat Central
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 bg-white text-emerald-900 px-3 py-1.5 rounded-xl text-xs font-black shrink-0 shadow">
            <span>Demander</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Tactile Filter Tabs */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setActiveTab('TO_SIGN')}
          className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-1 ${
            activeTab === 'TO_SIGN'
              ? 'bg-kindia-blue text-white border-kindia-blue font-extrabold shadow-md'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Award className={`w-5 h-5 ${activeTab === 'TO_SIGN' ? 'text-kindia-gold' : 'text-kindia-blue'}`} />
          <span className="text-[11px]">À Signer</span>
        </button>

        <button
          onClick={() => setActiveTab('RECEIVED')}
          className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-1 ${
            activeTab === 'RECEIVED'
              ? 'bg-kindia-blue text-white border-kindia-blue font-extrabold shadow-md'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Inbox className={`w-5 h-5 ${activeTab === 'RECEIVED' ? 'text-kindia-gold' : 'text-kindia-blue'}`} />
          <span className="text-[11px]">À Traiter</span>
        </button>

        <button
          onClick={() => setActiveTab('PROCESSED')}
          className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-1 ${
            activeTab === 'PROCESSED'
              ? 'bg-kindia-blue text-white border-kindia-blue font-extrabold shadow-md'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CheckCircle2 className={`w-5 h-5 ${activeTab === 'PROCESSED' ? 'text-kindia-gold' : 'text-emerald-600'}`} />
          <span className="text-[11px]">Validés</span>
        </button>
      </div>

      {/* External Mission Orders to Sign Section for SG & Admin */}
      {extMissions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-4 text-white shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-yellow-200" />
              <h3 className="font-heading font-extrabold text-xs uppercase tracking-wide">
                Ordres de Mission Externes à Signer ({extMissions.length})
              </h3>
            </div>
            <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold">SG</span>
          </div>

          <div className="space-y-3">
            {extMissions.map(m => (
              <div key={m.id} className="bg-white text-slate-800 p-4 rounded-xl shadow space-y-2.5">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-black text-kindia-blue bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {m.reference}
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[10px] font-extrabold">
                    Transmis au SG
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-xs text-slate-900">{formatFullName(m)}</h4>
                  <p className="text-[11px] text-slate-600"><strong>Inst :</strong> {m.origin_institution} • <strong>OM :</strong> {m.mission_order_ref}</p>
                  <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5"><strong>Objet :</strong> {m.object_of_mission}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPreviewExtDoc(m)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center space-x-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visualiser PDF</span>
                  </button>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setRejectExtModal(m)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow"
                    >
                      Rejeter
                    </button>
                    <button
                      onClick={() => handleSignExternalMission(m.id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow flex items-center space-x-1"
                    >
                      <Award className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Signer</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document Mobile Cards Feed */}
      {loading ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-xs text-slate-500 font-bold">Chargement des dossiers attribués...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-2xl border border-red-200 text-xs text-red-700 font-bold text-center">
          {error}
        </div>
      ) : documents.length === 0 && extMissions.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="font-heading font-extrabold text-sm text-slate-800">Aucun document en attente</h3>
          <p className="text-xs text-slate-500">
            {activeTab === 'TO_SIGN' 
              ? 'Vous n’avez aucun document nécessitant votre signature actuellement.' 
              : 'Aucun courrier ou document trouvé dans cette catégorie.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(d => (
            <div 
              key={d.id} 
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-kindia-gold transition"
            >
              {/* Header Badges */}
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs font-black text-kindia-blue bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  {d.reference}
                </span>
                <StatusBadge status={d.status} />
              </div>

              {/* Title & Subject */}
              <div>
                <h4 className="font-heading font-extrabold text-xs text-slate-800 line-clamp-2">
                  {d.subject || d.title}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  <strong>Service Expéditeur :</strong> {d.current_service_name || 'Administration'}
                </p>
              </div>

              {/* Priority & Date Footer */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-2 font-bold">
                <PriorityBadge priority={d.priority || 'NORMAL'} />
                <span>{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
              </div>

              {/* Mobile Action Controls - Permission Gated */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onSelectDocument(d.id)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1"
                >
                  <Eye className="w-3.5 h-3.5 text-kindia-blue" />
                  <span>Consulter</span>
                </button>

                {activeTab === 'TO_SIGN' && canUserSign ? (
                  <button
                    onClick={() => {
                      if (d.document_type === 'MISSION_ORDER') {
                        setSelectedMissionForSign(d);
                      } else {
                        setSelectedDocForAction(d);
                        setWorkflowMode('SIGN_AND_RETURN');
                      }
                    }}
                    className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-extrabold rounded-xl flex items-center justify-center space-x-1 shadow"
                  >
                    <Award className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>✍️ Signer</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedDocForAction(d);
                      setWorkflowMode('TRANSMIT');
                    }}
                    className="w-full py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1 shadow"
                  >
                    <Send className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>Transmettre</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dedicated Mission Signature Modal */}
      {selectedMissionForSign && (
        <MissionSignatureModal
          documentId={selectedMissionForSign.id || selectedMissionForSign.document_id}
          missionData={selectedMissionForSign}
          onClose={() => setSelectedMissionForSign(null)}
          onSuccess={handleActionComplete}
        />
      )}

      {/* Workflow Action Modal for other documents */}
      {selectedDocForAction && workflowMode && (
        <WorkflowModal
          doc={selectedDocForAction}
          mode={workflowMode}
          onClose={() => {
            setSelectedDocForAction(null);
            setWorkflowMode(null);
          }}
          onSuccess={handleActionComplete}
        />
      )}

      {/* External Mission Rejection Modal */}
      {rejectExtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-red-700 text-white flex items-center justify-between">
              <h3 className="font-heading font-extrabold text-sm">Rejeter l’Ordre de Mission Externe</h3>
              <button onClick={() => setRejectExtModal(null)} className="text-red-200 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleRejectExternalMission} className="p-4 space-y-3 text-xs">
              <p className="text-slate-600 font-medium">
                Veuillez indiquer le motif obligatoire du rejet. Le dossier sera retourné au Secrétariat Central avec cette observation.
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Motif du Rejet *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Expliquez la raison du rejet..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRejectExtModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow"
                >
                  Confirmer le Rejet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* External Mission PDF Preview Modal */}
      {previewExtDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-kindia-blue text-white flex items-center justify-between shrink-0">
              <span className="font-heading font-extrabold text-xs">Aperçu PDF - Réf: {previewExtDoc.reference}</span>
              <button onClick={() => setPreviewExtDoc(null)} className="text-slate-300 hover:text-white">✕</button>
            </div>
            <div className="p-2 bg-slate-100 flex-1 min-h-[400px]">
              <iframe
                src={`/api/external-missionaries/${previewExtDoc.id}/document/final?token=${encodeURIComponent(localStorage.getItem('uk_ged_token') || '')}`}
                className="w-full h-full min-h-[380px] rounded-xl border border-slate-300 bg-white"
                title="Document Preview"
              />
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setPreviewExtDoc(null)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

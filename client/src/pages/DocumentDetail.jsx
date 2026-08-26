import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, DeadlineBadge } from '../components/Badge';
import WorkflowModal from '../components/WorkflowModal';
import TrajectoryTimeline from '../components/TrajectoryTimeline';
import QRVerificationModal from '../components/QRVerificationModal';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';
import NewDispatchModal from '../components/NewDispatchModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import MissionSignatureModal from '../components/MissionSignatureModal';
import SGOrientationModal from '../components/SGOrientationModal';
import ReturnForCorrectionModal from '../components/ReturnForCorrectionModal';
import TransmitToCentralArchiveModal from '../components/TransmitToCentralArchiveModal';
import OnlyOfficeEditorModal from '../components/OnlyOfficeEditorModal';
import { 
  ArrowLeft, Send, CornerUpLeft, ArrowRight, CheckCircle2, XCircle,
  Archive, FileText, Download, ShieldCheck, Lock, Award, Eye, QrCode,
  ShieldAlert, Building2, UserCheck, Edit3
} from 'lucide-react';

export default function DocumentDetail({ documentId, onBack }) {
  const { user, hasPermission } = useAuth();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState(null);
  
  const [workflowMode, setWorkflowMode] = useState(null); // 'ORIENT' | 'TRANSMIT' | 'RETURN' | null
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDirectArchiveModal, setShowDirectArchiveModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [showMissionSignatureModal, setShowMissionSignatureModal] = useState(false);
  const [showSGOrientModal, setShowSGOrientModal] = useState(false);
  const [showReturnForCorrectionModal, setShowReturnForCorrectionModal] = useState(false);
  const [showTransmitCentralModal, setShowTransmitCentralModal] = useState(false);
  const [showOnlyOfficeModal, setShowOnlyOfficeModal] = useState(false);

  const handleArchiveInService = async () => {
    if (!window.confirm('Voulez-vous classer ce document dans les archives privées de votre service ?')) return;
    try {
      await api.archiveInService(documentId, { archive_scope: 'PRIVE_SERVICE' });
      alert('Document classé avec succès dans les archives de votre service.');
      loadDocument();
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  useEffect(() => {
    if (documentId) {
      loadDocument();
    }
  }, [documentId]);

  const loadDocument = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDocumentDetail(documentId);
      setDoc(data);
    } catch (err) {
      setError(err.message || 'Accès refusé ou document introuvable.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('Voulez-vous vraiment classer ce document dans les archives électroniques ?')) return;
    try {
      await api.archiveDocument(documentId);
      alert('Document archivé avec succès.');
      loadDocument();
    } catch (err) {
      alert('Erreur lors de l’archivage : ' + err.message);
    }
  };

  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashReason, setTrashReason] = useState('');
  const [trashing, setTrashing] = useState(false);

  const handleDirectArchive = async () => {
    try {
      await api.archiveDirectDocument(documentId);
      setShowDirectArchiveModal(false);
      alert('Document officiel archivé directement avec succès.');
      loadDocument();
    } catch (err) {
      alert('Erreur lors de l’archivage direct : ' + err.message);
    }
  };

  const handleMoveToTrashSubmit = async (e) => {
    e.preventDefault();
    if (!trashReason.trim()) {
      alert('Le motif de suppression est obligatoire.');
      return;
    }
    setTrashing(true);
    try {
      await api.moveToTrash(documentId, trashReason);
      setShowTrashModal(false);
      setTrashReason('');
      alert('Document placé dans la Corbeille Administrateur avec succès.');
      onBack();
    } catch (err) {
      alert('Erreur lors du déplacement vers la corbeille : ' + err.message);
    } finally {
      setTrashing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-xs text-slate-500">Chargement des détails du document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 text-center max-w-lg mx-auto shadow-sm my-8">
        <Lock className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h3 className="font-bold text-slate-800 text-base">Accès Interdit / Règle de Visibilité Stricte</h3>
        <p className="text-xs text-slate-600 mt-2">{error}</p>
        <p className="text-[11px] text-slate-400 mt-2">
          Conformément à la règle de confidentialité de l'Université de Kindia (Section 3), la visibilité d'un document est strictement restreinte aux services récepteurs ou concernés par le circuit.
        </p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl">
          Retour au tableau de bord
        </button>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="space-y-6">
      {/* Top Bar Navigation & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <button 
          onClick={onBack}
          className="flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-kindia-blue transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la liste</span>
        </button>

        {/* Action Controls - Restricted to Current Service Holder */}
        {(() => {
          const isCurrentHolder = Number(doc.current_service_id) === Number(user?.service_id) || user?.role_code === 'ADMINISTRATEUR';
          const isSC = user?.service_code === 'SC';

          return (
            <div className="flex flex-col w-full sm:w-auto">
              {!isCurrentHolder && !isSC && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2 rounded-xl text-[11px] font-medium flex items-center space-x-2 mb-2 sm:mb-0">
                  <span>ℹ️ Document au service <strong>{doc.current_service_name}</strong> (Consultation seule)</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {/* Secrétaire Général Decision & Orientation (Rule 9: Imperative SG Circuit) */}
                {isCurrentHolder && !doc.is_locked && (user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user?.role_code === 'ADMINISTRATEUR') && (
                  <button
                    onClick={() => setShowSGOrientModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-black rounded-xl shadow-md transition flex items-center space-x-2 border border-amber-400"
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-200" />
                    <span>⚡ DÉCISION & ORIENTATION SG</span>
                  </button>
                )}

                {isCurrentHolder && !doc.is_locked && doc.status !== 'ACCEPTED' && doc.status !== 'REJECTED' && (hasPermission('documents.accept') || user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user?.role_code === 'RECTEUR') && (
                  <button
                    onClick={() => setWorkflowMode('ACCEPT')}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow transition flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>✓ ACCEPTER</span>
                  </button>
                )}

                {isCurrentHolder && !doc.is_locked && doc.status !== 'REJECTED' && (hasPermission('documents.reject') || user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user?.role_code === 'RECTEUR') && (
                  <button
                    onClick={() => setWorkflowMode('REJECT')}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow transition flex items-center space-x-1.5"
                  >
                    <XCircle className="w-4 h-4 text-red-200" />
                    <span>✕ REJETER</span>
                  </button>
                )}

                {/* Chef de Service / Responsible: Sign & Return to Secrétariat Central (Rules 4 & 5) */}
                {isCurrentHolder && !doc.is_locked && doc.current_service_code !== 'SC' && (
                  <button
                    onClick={() => {
                      if (doc.document_type === 'MISSION_ORDER') {
                        setShowMissionSignatureModal(true);
                      } else {
                        setWorkflowMode('SIGN_AND_RETURN');
                      }
                    }}
                    className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-black rounded-xl shadow transition flex items-center space-x-1.5"
                  >
                    <Award className="w-4 h-4 text-indigo-200" />
                    <span>✍️ SIGNER ET RETOURNER AU SC</span>
                  </button>
                )}

                {/* Return for correction button */}
                {isCurrentHolder && doc.status !== 'ARCHIVED' && doc.status !== 'RETOUR' && (
                  <button
                    onClick={() => setShowReturnForCorrectionModal(true)}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                    title="Renvoyer le document à l'émetteur avec un motif obligatoire de correction"
                  >
                    <CornerUpLeft className="w-3.5 h-3.5" />
                    <span>↩ RETOURNER POUR CORRECTION</span>
                  </button>
                )}

                {/* Return to Secrétariat Central Button (Rules 4 & 15) */}
                {isCurrentHolder && doc.status !== 'ARCHIVED' && doc.current_service_code !== 'SC' && (
                  <button
                    onClick={() => setWorkflowMode('RETURN')}
                    className="px-3.5 py-2 bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 text-xs font-bold rounded-xl transition flex items-center space-x-1.5"
                  >
                    <CornerUpLeft className="w-3.5 h-3.5 text-amber-700" />
                    <span>↩ RETOURNER AU SECRÉTARIAT CENTRAL</span>
                  </button>
                )}

                {/* ONLYOFFICE Document Server Action (Edit vs View) */}
                {doc.file_path && (
                  <button
                    onClick={() => setShowOnlyOfficeModal(true)}
                    className={`px-3.5 py-2 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5 ${
                      (isCurrentHolder || user?.role_code === 'ADMINISTRATEUR') && doc.status !== 'ARCHIVED' && doc.status !== 'SIGNÉ' && !doc.is_locked
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                    title="Ouvrir le document dans ONLYOFFICE Document Server"
                  >
                    {(isCurrentHolder || user?.role_code === 'ADMINISTRATEUR') && doc.status !== 'ARCHIVED' && doc.status !== 'SIGNÉ' && !doc.is_locked ? (
                      <>
                        <Edit3 className="w-3.5 h-3.5 text-emerald-200" />
                        <span>✏️ MODIFIER AVEC ONLYOFFICE</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-indigo-200" />
                        <span>👁️ OUVRIR DANS ONLYOFFICE</span>
                      </>
                    )}
                  </button>
                )}

                {isCurrentHolder && !doc.is_locked && hasPermission('documents.orient') && (
                  <button
                    onClick={() => setWorkflowMode('ORIENT')}
                    className="px-3.5 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>➡ ORIENTER</span>
                  </button>
                )}

                {isCurrentHolder && !doc.is_locked && hasPermission('documents.transmit') && (
                  <button
                    onClick={() => setWorkflowMode('TRANSMIT')}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>TRANSMETTRE</span>
                  </button>
                )}

                {/* Dispatch / Diffuse Administrative Document Action */}
                {hasPermission('dispatching.create') && (
                  <button
                    onClick={() => setShowDispatchModal(true)}
                    className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-extrabold rounded-xl shadow transition flex items-center space-x-1.5"
                    title="Diffuser ce document à plusieurs services (Note de service, Décision, Circulaire, etc.)"
                  >
                    <span>📢 DIFFUSER</span>
                  </button>
                )}

                {/* Archive in Local Service Archive Button (For Originating Service / Holder) */}
                {doc.status !== 'ARCHIVED' && (doc.status === 'VALIDÉ' || doc.status === 'SIGNÉ' || doc.status === 'ACCEPTED' || doc.status === 'COMPLETED') && (
                  <button
                    onClick={handleArchiveInService}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                    title="Classer dans les archives privées de mon service"
                  >
                    <Archive className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>📁 ARCHIVER DANS MON SERVICE</span>
                  </button>
                )}

                {/* Transmit to Central Archive Button (When doc is in private archive and not yet sent to SC) */}
                {doc.archive_scope === 'PRIVE_SERVICE' && doc.transmitted_to_sc_for_archive !== 1 && (
                  <button
                    onClick={() => setShowTransmitCentralModal(true)}
                    className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                    title="Transmettre ce document au Secrétariat Central pour versement aux archives centrales"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-200" />
                    <span>🏛️ TRANSMETTRE AU SC (ARCHIVAGE CENTRAL)</span>
                  </button>
                )}

                {/* Direct Archiving Button (Path B, Rules 5 & 13) */}
                {doc.status !== 'ARCHIVED' && isSC && doc.current_service_code === 'SC' && hasPermission('documents.archive_direct') && (
                  <button
                    onClick={() => setShowDirectArchiveModal(true)}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-200" />
                    <span>📁 ARCHIVER DIRECTEMENT</span>
                  </button>
                )}

                {/* Archiving Button: RESERVED EXCLUSIVELY FOR SECRÉTARIAT CENTRAL (Rules 3, 6, 14, 15) */}
                {doc.status !== 'ARCHIVED' && isSC && doc.current_service_code === 'SC' && hasPermission('documents.archive') && doc.processing_mode !== 'DIRECT_ARCHIVE' && (
                  <button
                    onClick={handleArchive}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                  >
                    <Archive className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>📁 ARCHIVER</span>
                  </button>
                )}

                {/* Trash Button: RESERVED EXCLUSIVELY FOR SYSTEM ADMINISTRATOR (Sections 1 & 14) */}
                {user?.role_code === 'ADMINISTRATEUR' && doc.status !== 'TRASHED' && (
                  <button
                    onClick={() => setShowTrashModal(true)}
                    className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                  >
                    <span>🗑️ PLACER EN CORBEILLE</span>
                  </button>
                )}

                <button
                  onClick={() => setShowReceiptPreview(true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl transition flex items-center space-x-1.5"
                  title="Consulter et imprimer le reçu officiel d'enregistrement avec QR Code"
                >
                  <FileText className="w-3.5 h-3.5 text-kindia-blue" />
                  <span>📄 Reçu d'enregistrement (PDF)</span>
                </button>

                <button
                  onClick={() => setShowQRModal(true)}
                  className="px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-xs font-bold rounded-xl transition flex items-center space-x-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Vérifier QR Code</span>
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Main Document Details Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left Column: Metadata & Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-kindia-gold uppercase tracking-wider block">
                  Référence Officielle Unique
                </span>
                <h1 className="font-heading font-extrabold text-xl text-kindia-blue mt-0.5">
                  {doc.reference}
                </h1>
              </div>

              <div className="flex items-center space-x-2">
                {doc.processing_mode === 'DIRECT_ARCHIVE' ? (
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                    📁 MODE : ARCHIVAGE DIRECT
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                    🔄 TRAITEMENT NORMAL
                  </span>
                )}
                <PriorityBadge priority={doc.priority} />
                <StatusBadge status={doc.status} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800">{doc.title}</h3>
              <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                {doc.description || 'Aucune description complémentaire.'}
              </p>
            </div>

            {/* External Signature Details (Rule 11) */}
            {doc.has_external_signature === 1 && (
              <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl text-xs space-y-1">
                <div className="font-bold text-emerald-900 flex items-center">
                  <span className="mr-1.5">✍️</span> Signature officielle déjà présente sur le document
                </div>
                <div className="grid grid-cols-2 gap-2 text-emerald-800 pt-1">
                  <div><span className="font-semibold text-emerald-900">Signataire :</span> {doc.external_signatory_name || 'Autorité émettrice externe'}</div>
                  <div><span className="font-semibold text-emerald-900">Date de signature :</span> {doc.external_signature_date ? new Date(doc.external_signature_date).toLocaleDateString('fr-FR') : 'Non renseignée'}</div>
                </div>
              </div>
            )}

            {/* Originating Structure & Head Snapshot Context (Rules 2, 3, 6, 9) */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs space-y-2">
              <div className="flex items-center space-x-2 font-bold text-slate-800">
                <Building2 className="w-4 h-4 text-kindia-blue" />
                <span>Origine Administrative & Circuit d'Émission</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Structure Émettrice :</span>
                  <span className="font-bold text-kindia-blue">{doc.originating_service_name || doc.sender_organization || 'Université de Kindia'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Responsable en Poste (Date d'émission) :</span>
                  <span className="font-semibold text-slate-800">{doc.originating_head_name || 'Non renseigné'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Fonction Officielle :</span>
                  <span className="font-medium text-slate-600">{doc.originating_head_function || 'Responsable de Service'}</span>
                </div>
              </div>

              {/* SG Instructions Banner if routed */}
              {doc.sg_orientation_instruction && (
                <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-0.5">
                  <span className="font-bold block text-[10px] uppercase text-amber-800">
                    ⚡ Instruction d'orientation du Secrétaire Général (SG) :
                  </span>
                  <p className="font-semibold text-xs">{doc.sg_orientation_instruction}</p>
                </div>
              )}
            </div>

            {/* Document Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Type de Document</span>
                <span className="font-bold text-slate-700">{doc.document_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Mode de traitement</span>
                <span className="font-bold text-slate-700">{doc.processing_mode === 'DIRECT_ARCHIVE' ? 'ARCHIVAGE DIRECT' : 'NORMAL'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Expéditeur</span>
                <span className="font-semibold text-slate-700">{doc.sender_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Organisme</span>
                <span className="font-semibold text-slate-700">{doc.sender_organization || 'Université de Kindia'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Détenteur Actuel</span>
                <span className="font-bold text-kindia-blue">{doc.current_service_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Responsable Actuel</span>
                <span className="font-semibold text-slate-700">{doc.current_user_name || 'Service Global'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Créé le</span>
                <span className="text-slate-700">{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>

            {doc.deadline_date && (
              <div className="pt-2">
                <DeadlineBadge deadlineDate={doc.deadline_date} status={doc.status} />
              </div>
            )}
          </div>

          {/* Extension Specific Data */}
          {doc.extension && doc.document_type === 'MISSION_ORDER' && (
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-3">
              <div className="flex items-center space-x-2 text-kindia-gold font-bold text-xs uppercase tracking-wider">
                <Award className="w-4 h-4" />
                <span>Détails de la Mission Officielle</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Missionnaire :</span>
                  <span className="font-bold">{doc.extension.missionary_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Destination :</span>
                  <span className="font-bold">{doc.extension.destination}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Objet de la mission :</span>
                  <span>{doc.extension.object_of_mission}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Transport :</span>
                  <span>{doc.extension.transport_mode}</span>
                </div>
              </div>

              {doc.extension.signed_pdf_path && (
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PDF Officiel Signé & Scellé Disponible</span>
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment({
                        file_name: `Document_Signé_${doc.reference.replace(/[/]/g, '_')}.pdf`,
                        file_path: `/api/documents/${doc.id}/signed-pdf/view`,
                        mime_type: 'application/pdf'
                      })}
                      className="px-3.5 py-2 bg-kindia-gold hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow"
                    >
                      <Eye className="w-4 h-4" />
                      <span>PRÉVISUALISER</span>
                    </button>
                    <a
                      href={`/uploads/${doc.extension.signed_pdf_path.split(/[/\\]/).pop()}`}
                      download={`Document_Signé_${doc.reference.replace(/[/]/g, '_')}.pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow"
                    >
                      <Download className="w-4 h-4" />
                      <span>Télécharger</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attachments Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-heading font-bold text-xs text-slate-800 uppercase tracking-wider mb-3">
              Pièces Jointes & Scans ({doc.attachments?.length || 0})
            </h3>

            {doc.attachments?.length === 0 ? (
              <p className="text-xs text-slate-400">Aucun fichier joint à ce document.</p>
            ) : (
              <div className="space-y-2">
                {doc.attachments.map(att => (
                  <div key={att.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <FileText className="w-5 h-5 text-kindia-blue shrink-0" />
                      <div className="truncate">
                        <span className="font-bold text-slate-800 truncate block">{att.file_name}</span>
                        <span className="text-[10px] text-slate-400">{(att.file_size / 1024).toFixed(1)} Ko</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment(att)}
                        className="px-3 py-1.5 bg-kindia-blue text-white hover:bg-kindia-lightBlue rounded-lg font-bold text-[11px] transition flex items-center space-x-1.5 shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5 text-kindia-gold" />
                        <span>PRÉVISUALISER</span>
                      </button>

                      <a
                        href={`/${att.file_path.replace(/\\/g, '/')}`}
                        download={att.file_name}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-[11px] text-slate-700 transition flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visual Trajectory Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-fit">
          <TrajectoryTimeline history={doc.history} transfers={doc.transfers} />
        </div>
      </div>

      {/* SG Orientation Modal (Rule 9) */}
      {showSGOrientModal && (
        <SGOrientationModal
          doc={doc}
          onClose={() => setShowSGOrientModal(false)}
          onSuccess={() => {
            loadDocument();
          }}
        />
      )}

      {/* Workflow Modal */}
      {workflowMode && (
        <WorkflowModal
          doc={doc}
          mode={workflowMode}
          onClose={() => setWorkflowMode(null)}
          onSuccess={() => {
            loadDocument();
          }}
        />
      )}

      {/* QR Code Verification Modal */}
      {showQRModal && (
        <QRVerificationModal
          reference={doc.reference}
          onClose={() => setShowQRModal(false)}
        />
      )}

      {/* Return for Correction Modal */}
      {showReturnForCorrectionModal && (
        <ReturnForCorrectionModal
          isOpen={showReturnForCorrectionModal}
          document={doc}
          onClose={() => setShowReturnForCorrectionModal(false)}
          onSuccess={() => {
            loadDocument();
          }}
        />
      )}

      {/* Transmit to Central Archive Modal */}
      {showTransmitCentralModal && (
        <TransmitToCentralArchiveModal
          isOpen={showTransmitCentralModal}
          document={doc}
          onClose={() => setShowTransmitCentralModal(false)}
          onSuccess={() => {
            loadDocument();
          }}
        />
      )}

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}

      {/* Direct Archive Confirmation Modal (Rule 6 Format) */}
      {showDirectArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="font-heading font-extrabold text-sm text-amber-900 flex items-center">
                <span className="mr-2">📁</span> CONFIRMER L'ARCHIVAGE DIRECT
              </h3>
              <button onClick={() => setShowDirectArchiveModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 text-xs space-y-2">
              <div className="flex justify-between border-b border-amber-200/60 pb-1.5">
                <span className="text-amber-800 font-semibold">Type :</span>
                <span className="font-bold text-amber-950">{doc.document_type}</span>
              </div>
              <div className="flex justify-between border-b border-amber-200/60 pb-1.5">
                <span className="text-amber-800 font-semibold">Référence :</span>
                <span className="font-bold text-amber-950">{doc.reference}</span>
              </div>

              <p className="text-amber-950 font-medium pt-2 leading-relaxed">
                Ce document sera directement placé dans les archives électroniques.
              </p>
              <p className="text-amber-900">
                Il ne sera pas transmis dans le circuit administratif normal.
              </p>
              <p className="font-bold text-slate-900 pt-2 text-center text-sm">
                Voulez-vous continuer ?
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowDirectArchiveModal(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-xl transition"
              >
                ANNULER
              </button>
              <button
                onClick={handleDirectArchive}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition"
              >
                ARCHIVER DIRECTEMENT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Trash Modal (Section 2, 4, 13) */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-rose-300">
            <div className="border-b border-rose-100 pb-3 flex items-center justify-between">
              <h3 className="font-heading font-extrabold text-sm text-rose-800 flex items-center">
                <span className="mr-2">🗑️</span> PLACER CE DOCUMENT DANS LA CORBEILLE
              </h3>
              <button onClick={() => setShowTrashModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200 text-xs space-y-2">
              <p className="font-bold text-rose-900">ATTENTION !</p>
              <p className="text-rose-800">
                Vous êtes sur le point de déplacer ce document vers la Corbeille Administrateur.
              </p>
              <p className="text-[11px] text-rose-700">
                Le document cessera d'être visible dans les circuits actifs, mais pourra être restauré par l'Administrateur Système.
              </p>
            </div>

            <form onSubmit={handleMoveToTrashSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-800 font-bold mb-1">Motif obligatoire de la suppression *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: Document de test créé par erreur..."
                  value={trashReason}
                  onChange={(e) => setTrashReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 shadow-inner"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTrashModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-xl transition"
                >
                  ANNULER
                </button>
                <button
                  type="submit"
                  disabled={trashing || !trashReason.trim()}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow transition"
                >
                  {trashing ? 'Traitement...' : '🗑️ CONFIRMER LE DÉPLACEMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Dispatch for this document */}
      {showDispatchModal && (
        <NewDispatchModal
          initialDocument={doc}
          onClose={() => setShowDispatchModal(false)}
          onCreated={() => {
            setShowDispatchModal(false);
            loadDocument();
          }}
        />
      )}

      {/* Modal: Receipt Preview & Print */}
      {showReceiptPreview && (
        <ReceiptPreviewModal
          receiptId={doc.id}
          reference={doc.reference}
          pdfUrl={`/api/receipts/document/${doc.id}/pdf`}
          onClose={() => setShowReceiptPreview(false)}
        />
      )}

      {/* Modal: Dedicated Mission Signature Modal */}
      {showMissionSignatureModal && (
        <MissionSignatureModal
          documentId={doc.id}
          missionData={doc.extension ? { ...doc.extension, reference: doc.reference, document_id: doc.id } : doc}
          onClose={() => setShowMissionSignatureModal(false)}
          onSuccess={() => {
            setShowMissionSignatureModal(false);
            loadDocument();
          }}
        />
      )}

      {/* Modal: ONLYOFFICE Document Server Online Editor */}
      {showOnlyOfficeModal && (
        <OnlyOfficeEditorModal
          isOpen={showOnlyOfficeModal}
          documentId={doc.id}
          onClose={() => setShowOnlyOfficeModal(false)}
          onSaveSuccess={() => {
            loadDocument();
          }}
        />
      )}
    </div>
  );
}

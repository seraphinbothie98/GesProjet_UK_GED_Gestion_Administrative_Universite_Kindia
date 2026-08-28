import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, Search, Eye, CheckCircle, XCircle, Send, Clock, 
  Building2, User, Phone, Mail, AlertCircle, X, Download, FileCheck, HelpCircle, ArrowRight
} from 'lucide-react';

export default function MissionRequests({ onSelectDocument }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Selected Detail Modal & Action Modals
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetail, setRequestDetail] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Rejection & Complement Modal States
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [showComplementModal, setShowComplementModal] = useState(false);
  const [complementNotes, setComplementNotes] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMissionRequests({ status: selectedStatus, search: searchQuery });
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load mission requests:', err);
      setError(err.message || 'Erreur lors du chargement des demandes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [selectedStatus]);

  const loadSingleRequestDetail = async (reqItem) => {
    setSelectedRequest(reqItem);
    try {
      const detail = await api.getMissionRequestById(reqItem.id);
      setRequestDetail(detail);
    } catch (err) {
      console.error('Failed to load detail:', err);
      setRequestDetail(reqItem);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadRequests();
  };

  const handleAcceptRequest = async (id) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.acceptMissionRequest(id);
      setSuccessMsg(res.message || 'Demande acceptée.');
      if (selectedRequest && selectedRequest.id === id) {
        const updated = await api.getMissionRequestById(id);
        setRequestDetail(updated);
      }
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’acceptation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !rejectionReason.trim()) {
      setError('Le motif de rejet est obligatoire.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.rejectMissionRequest(selectedRequest.id, rejectionReason.trim());
      setSuccessMsg(res.message || 'Demande rejetée.');
      setShowRejectModal(false);
      setRejectionReason('');
      const updated = await api.getMissionRequestById(selectedRequest.id);
      setRequestDetail(updated);
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Erreur lors du rejet.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmComplement = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !complementNotes.trim()) {
      setError('Les remarques de compléments sont obligatoires.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.requestMissionComplement(selectedRequest.id, complementNotes.trim());
      setSuccessMsg(res.message || 'Demande de complément enregistrée.');
      setShowComplementModal(false);
      setComplementNotes('');
      const updated = await api.getMissionRequestById(selectedRequest.id);
      setRequestDetail(updated);
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Erreur lors de la demande de complément.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateOfficialOM = async (id) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.generateOfficialMissionOrder(id);
      setSuccessMsg(`Ordre de mission officiel préparé (Réf: ${res.official_reference}).`);
      if (selectedRequest && selectedRequest.id === id) {
        const updated = await api.getMissionRequestById(id);
        setRequestDetail(updated);
      }
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Erreur lors de la préparation de l’ordre de mission officiel.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransmitToSG = async (id) => {
    if (!window.confirm('Confirmer la transmission de cet ordre de mission au Secrétaire Général pour signature électronique ?')) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.transmitMissionRequestToSG(id);
      setSuccessMsg(res.message || 'Ordre de mission officiel transmis au SG.');
      if (selectedRequest && selectedRequest.id === id) {
        const updated = await api.getMissionRequestById(id);
        setRequestDetail(updated);
      }
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Erreur lors de la transmission au Secrétaire Général.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DEMANDE ENREGISTRÉE':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>📥</span><span>Demande Reçue</span></span>;
      case 'INFORMATIONS COMPLÉMENTAIRES DEMANDÉES':
        return <span className="px-2.5 py-1 bg-orange-100 text-orange-900 border border-orange-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>⚠️</span><span>Compléments Demandés</span></span>;
      case 'DEMANDE ACCEPTÉE':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>✅</span><span>Demande Acceptée</span></span>;
      case 'ORDRE DE MISSION EN PRÉPARATION':
        return <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>⚙️</span><span>OM en préparation</span></span>;
      case 'EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL':
        return <span className="px-2.5 py-1 bg-purple-100 text-purple-900 border border-purple-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1 animate-pulse"><span>⏳</span><span>En attente signature SG</span></span>;
      case 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>✍️</span><span>Signé (Retour SC)</span></span>;
      case 'REMIS AU DEMANDEUR':
        return <span className="px-2.5 py-1 bg-teal-100 text-teal-900 border border-teal-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>🤝</span><span>Remis au demandeur</span></span>;
      case 'ARCHIVÉ':
        return <span className="px-2.5 py-1 bg-slate-200 text-slate-800 border border-slate-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>📁</span><span>Archivé</span></span>;
      case 'REJETÉ':
        return <span className="px-2.5 py-1 bg-red-100 text-red-900 border border-red-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>❌</span><span>Rejeté</span></span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-kindia-blue to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 bg-kindia-gold/20 rounded-xl text-kindia-gold">
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-heading font-extrabold tracking-wide">
              Demandes d’Ordres de Mission (Personnel & Enseignants)
            </h1>
          </div>
          <p className="text-xs text-slate-300">
            Secrétariat Central • Centralisation, vérification, préparation de l'Ordre de Mission Officiel et transmission au Secrétaire Général
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start space-x-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">Erreur</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start space-x-3 shadow-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">Succès</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center space-x-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par Référence, Nom, Service, Destination, Objet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-kindia-blue focus:bg-white transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-kindia-blue text-white text-xs font-bold rounded-xl hover:bg-kindia-lightBlue transition"
          >
            Rechercher
          </button>
        </form>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-kindia-blue"
          >
            <option value="">Tous les statuts</option>
            <option value="DEMANDE ENREGISTRÉE">Demandes reçues</option>
            <option value="INFORMATIONS COMPLÉMENTAIRES DEMANDÉES">Compléments demandés</option>
            <option value="DEMANDE ACCEPTÉE">Demandes acceptées</option>
            <option value="ORDRE DE MISSION EN PRÉPARATION">OM en préparation</option>
            <option value="EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL">En attente signature SG</option>
            <option value="SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL">Signé par le SG</option>
            <option value="REMIS AU DEMANDEUR">Remis au demandeur</option>
            <option value="ARCHIVÉ">Archivé</option>
            <option value="REJETÉ">Rejeté</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-4 border-kindia-gold border-t-transparent rounded-full mx-auto mb-3"></div>
            <span className="text-xs font-bold">Chargement des demandes d’ordres de mission...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileText className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-600">Aucune demande trouvée</p>
            <p className="text-xs text-slate-400">Les nouvelles demandes soumises par les enseignants et agents apparaîtront ici.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Référence</th>
                  <th className="py-3.5 px-4">Demandeur</th>
                  <th className="py-3.5 px-4">Fonction & Service</th>
                  <th className="py-3.5 px-4">Destination & Objet</th>
                  <th className="py-3.5 px-4">Période</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {requests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-kindia-blue">
                      {req.reference}
                      {req.official_doc_reference && (
                        <div className="text-[10px] text-emerald-700 font-bold">OM: {req.official_doc_reference}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{req.applicant_last_name} {req.applicant_first_names}</div>
                      <div className="text-[10px] text-slate-500">{req.applicant_phone}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{req.applicant_function}</div>
                      <div className="text-[10px] text-slate-500">{req.applicant_service_name}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-bold text-slate-800">{req.destination} ({req.country || 'Guinée'})</div>
                      <div className="text-[10px] text-slate-500 truncate">{req.object_of_mission}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {new Date(req.start_date).toLocaleDateString('fr-FR')} - {new Date(req.end_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => loadSingleRequestDetail(req)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1"
                        title="Consulter les détails et pièces jointes"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Fiche</span>
                      </button>

                      {(req.status === 'DEMANDE ENREGISTRÉE' || req.status === 'EN_ATTENTE_SC' || req.status === 'EN ATTENTE') && !req.official_document_id && (
                        <button
                          onClick={() => handleAcceptRequest(req.id)}
                          disabled={actionLoading}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 shadow-sm"
                          title="Accepter la demande pour préparation"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Accepter</span>
                        </button>
                      )}

                      {req.status === 'DEMANDE ACCEPTÉE' && !req.official_document_id && (
                        <button
                          onClick={() => handleGenerateOfficialOM(req.id)}
                          disabled={actionLoading}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 shadow-sm"
                          title="Injecter dans le modèle officiel et préparer l'ordre de mission"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>Préparer OM</span>
                        </button>
                      )}

                      {req.official_document_id && req.status !== 'EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL' && req.status !== 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL' && req.status !== 'REMIS AU DEMANDEUR' && req.status !== 'ARCHIVÉ' && (
                        <button
                          onClick={() => handleTransmitToSG(req.id)}
                          disabled={actionLoading}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 shadow-sm"
                          title="Transmettre l'ordre de mission officiel au SG pour signature"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Transmettre au SG</span>
                        </button>
                      )}

                      {req.official_document_id && onSelectDocument && (
                        <button
                          onClick={() => onSelectDocument(req.official_document_id)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 shadow-sm"
                          title="Consulter l'ordre de mission officiel généré"
                        >
                          <FileCheck className="w-3.5 h-3.5 text-kindia-gold" />
                          <span>Voir OM</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail & Action Drawer / Modal */}
      {selectedRequest && requestDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-kindia-blue text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] text-kindia-gold uppercase tracking-wider block font-bold">Fiche de Demande d'Ordre de Mission</span>
                <h3 className="font-heading font-extrabold text-base">{requestDetail.applicant_last_name} {requestDetail.applicant_first_names}</h3>
                <span className="text-xs text-slate-300 font-mono">Réf Demande: {requestDetail.reference}</span>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="text-slate-300 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {/* Action Toolbar Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Statut actuel :</span>
                  <div>{getStatusBadge(requestDetail.status)}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {requestDetail.status === 'DEMANDE ENREGISTRÉE' && (
                    <>
                      <button
                        onClick={() => handleAcceptRequest(requestDetail.id)}
                        disabled={actionLoading}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition flex items-center space-x-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Accepter la demande</span>
                      </button>
                      <button
                        onClick={() => setShowComplementModal(true)}
                        className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow transition flex items-center space-x-1"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>Demander Complément</span>
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow transition flex items-center space-x-1"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Rejeter</span>
                      </button>
                    </>
                  )}

                  {requestDetail.status === 'DEMANDE ACCEPTÉE' && !requestDetail.official_document_id && (
                    <button
                      onClick={() => handleGenerateOfficialOM(requestDetail.id)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                    >
                      <FileCheck className="w-4 h-4 text-kindia-gold" />
                      <span>Préparer l’Ordre de Mission Officiel</span>
                    </button>
                  )}

                  {requestDetail.official_document_id && requestDetail.status !== 'EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL' && (
                    <button
                      onClick={() => handleTransmitToSG(requestDetail.id)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                    >
                      <Send className="w-4 h-4" />
                      <span>Transmettre au Secrétaire Général</span>
                    </button>
                  )}

                  {requestDetail.official_document_id && (
                    <button
                      onClick={() => onSelectDocument && onSelectDocument(requestDetail.official_document_id)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition flex items-center space-x-1"
                    >
                      <Eye className="w-4 h-4 text-kindia-gold" />
                      <span>Ouvrir l'OM Officiel dans la GED</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-200">
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] border-b border-slate-200 pb-1">Identité & Rattachement</h4>
                  <div><span className="font-bold text-slate-500">Demandeur :</span> <span className="font-bold text-slate-800">{requestDetail.applicant_last_name} {requestDetail.applicant_first_names}</span></div>
                  <div><span className="font-bold text-slate-500">Fonction :</span> <span className="text-slate-800">{requestDetail.applicant_function}</span></div>
                  <div><span className="font-bold text-slate-500">Matricule :</span> <span className="font-mono text-slate-800">{requestDetail.applicant_matricule || 'N/A'}</span></div>
                  <div><span className="font-bold text-slate-500">Service / Département :</span> <span className="text-slate-800">{requestDetail.applicant_service_name}</span></div>
                  <div><span className="font-bold text-slate-500">Contact :</span> <span className="text-slate-800">{requestDetail.applicant_phone} • {requestDetail.applicant_email}</span></div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] border-b border-slate-200 pb-1">Détails de la Mission</h4>
                  <div><span className="font-bold text-slate-500">Objet :</span> <span className="text-slate-800">{requestDetail.object_of_mission}</span></div>
                  <div><span className="font-bold text-slate-500">Destination :</span> <span className="font-bold text-slate-800">{requestDetail.destination} ({requestDetail.country || 'Guinée'})</span></div>
                  <div><span className="font-bold text-slate-500">Lieu exact :</span> <span className="text-slate-800">{requestDetail.exact_location || 'N/A'}</span></div>
                  <div><span className="font-bold text-slate-500">Période :</span> <span className="text-slate-800">{new Date(requestDetail.start_date).toLocaleDateString('fr-FR')} au {new Date(requestDetail.end_date).toLocaleDateString('fr-FR')}</span></div>
                  <div><span className="font-bold text-slate-500">Moyen de transport :</span> <span className="text-slate-800">{requestDetail.transport_means || 'VÉHICULE OFFICIEL'}</span></div>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] flex items-center space-x-2">
                  <span>📎 Pièces Justificatives Jointes ({requestDetail.attachments?.length || 0})</span>
                </h4>

                {!requestDetail.attachments || requestDetail.attachments.length === 0 ? (
                  <p className="text-slate-400 italic">Aucune pièce justificative n'a été jointe à la demande.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {requestDetail.attachments.map(att => (
                      <div key={att.id} className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                        <div className="truncate pr-2">
                          <span className="font-bold text-slate-800 block truncate">{att.file_name}</span>
                          <span className="text-[10px] text-slate-400">{(att.file_size / 1024).toFixed(1)} Ko</span>
                        </div>
                        <a
                          href={`/uploads/mission_requests/${att.file_name}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-kindia-blue text-white rounded text-[10px] font-bold shrink-0 flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Ouvrir</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chronological History */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                  <Clock className="w-4 h-4 text-kindia-gold" />
                  <h4 className="font-heading font-extrabold text-xs text-kindia-gold uppercase tracking-wider">
                    Historique Chronologique de la Demande
                  </h4>
                </div>

                <div className="space-y-2.5 pt-1">
                  {!requestDetail.history || requestDetail.history.length === 0 ? (
                    <p className="text-slate-400 italic">Demande enregistrée.</p>
                  ) : (
                    requestDetail.history.map((h, idx) => (
                      <div key={h.id || idx} className="flex items-start space-x-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-kindia-gold mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-white font-mono">
                              {new Date(h.timestamp).toLocaleDateString('fr-FR')} – {new Date(h.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{h.role_name}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5">{h.observation}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-red-700 text-white flex items-center justify-between">
              <h3 className="font-heading font-extrabold text-sm">Rejeter la demande d’Ordre de Mission</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-red-200 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-4 space-y-3 text-xs">
              <p className="text-slate-600 font-medium">
                Veuillez indiquer le motif obligatoire du rejet. Le demandeur pourra consulter cette justification.
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Motif du Rejet *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Motif détaillé du rejet..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow"
                >
                  Confirmer le Rejet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complement Modal */}
      {showComplementModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-orange-600 text-white flex items-center justify-between">
              <h3 className="font-heading font-extrabold text-sm">Demander des Compléments d’Information</h3>
              <button onClick={() => setShowComplementModal(false)} className="text-orange-200 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleConfirmComplement} className="p-4 space-y-3 text-xs">
              <p className="text-slate-600 font-medium">
                Veuillez indiquer les éléments manquants ou les informations complémentaires à fournir par le demandeur.
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Informations Complémentaires Demandées *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Détaillez les informations ou pièces manquantes..."
                  value={complementNotes}
                  onChange={(e) => setComplementNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-600"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowComplementModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow"
                >
                  Envoyer la Demande de Complément
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

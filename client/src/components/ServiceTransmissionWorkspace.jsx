import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Inbox, Send, RotateCcw, Archive, Plus, Search, Filter, 
  FileText, CheckCircle2, Clock, AlertTriangle, XCircle, 
  ShieldCheck, Eye, Download, Check, Edit3, X, ChevronRight,
  Building2, User, Calendar, MessageSquare, ArrowRight, FileCheck, Lock
} from 'lucide-react';
import NewServiceTransmissionModal from './NewServiceTransmissionModal';

export default function ServiceTransmissionWorkspace({ user }) {
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'sent', 'returned', 'archive'
  
  const [inboxList, setInboxList] = useState([]);
  const [sentList, setSentList] = useState([]);
  const [returnedList, setReturnedList] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransmission, setSelectedTransmission] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Action Modals State
  const [actionType, setActionType] = useState(null); // 'acknowledge', 'modification', 'approve', 'sign', 'reject', 'archive', 'new_version'
  const [actionReason, setActionReason] = useState('');
  const [actionComments, setActionComments] = useState('');
  const [actionFile, setActionFile] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);

  const loadTabData = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'inbox') {
        const data = await api.getInboxTransmissions({ search: searchQuery });
        setInboxList(data || []);
      } else if (tab === 'sent') {
        const data = await api.getSentTransmissions({ search: searchQuery });
        setSentList(data || []);
      } else if (tab === 'returned') {
        const data = await api.getReturnedTransmissions({ search: searchQuery });
        setReturnedList(data || []);
      }
    } catch (err) {
      console.error('Error loading transmissions tab data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = async (transmission) => {
    setDetailsLoading(true);
    try {
      const details = await api.getTransmissionDetails(transmission.id);
      setSelectedTransmission(details);
    } catch (err) {
      alert(err.message || 'Impossible d’ouvrir les détails de cette transmission.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (!selectedTransmission) return;
    const trId = selectedTransmission.transmission.id;

    setActionLoading(true);
    setActionError('');

    try {
      if (actionType === 'acknowledge') {
        await api.acknowledgeTransmission(trId, actionComments);
      } else if (actionType === 'modification') {
        if (!actionReason.trim()) throw new Error('Le motif de modification est obligatoire.');
        await api.requestTransmissionModification(trId, actionReason, actionComments);
      } else if (actionType === 'approve') {
        await api.approveTransmission(trId, actionComments);
      } else if (actionType === 'sign') {
        await api.signTransmission(trId, {
          comments: actionComments
        });
      } else if (actionType === 'reject') {
        if (!actionReason.trim()) throw new Error('Le motif du refus est obligatoire.');
        await api.rejectTransmission(trId, actionReason);
      } else if (actionType === 'archive') {
        await api.archiveTransmission(trId, { comments: actionComments });
      }

      // Refresh current details & lists
      const refreshed = await api.getTransmissionDetails(trId);
      setSelectedTransmission(refreshed);
      loadTabData(activeTab);
      setActionType(null);
      setActionReason('');
      setActionComments('');
    } catch (err) {
      console.error('Action error:', err);
      setActionError(err.message || 'Erreur lors du traitement de l’action.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ENVOYE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" /> Envoyé (En attente)</span>;
      case 'RECU':
      case 'EN_COURS_DE_TRAITEMENT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" /> En cours de traitement</span>;
      case 'MODIFICATION_DEMANDEE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800"><Edit3 className="w-3 h-3 mr-1" /> Modification demandée</span>;
      case 'APPROUVE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800"><Check className="w-3 h-3 mr-1" /> Approuvé</span>;
      case 'SIGNE':
      case 'RETOURNE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800"><FileCheck className="w-3 h-3 mr-1" /> Signé & Retourné</span>;
      case 'REFUSE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Refusé</span>;
      case 'ARCHIVE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800"><Archive className="w-3 h-3 mr-1" /> Archivé</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const renderTable = (list, type) => {
    if (loading) {
      return (
        <div className="py-16 text-center text-slate-400">
          <div className="animate-spin w-8 h-8 border-3 border-kindia-blue border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-xs font-medium">Chargement des transmissions...</p>
        </div>
      );
    }

    if (!list || list.length === 0) {
      return (
        <div className="py-16 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="font-bold text-slate-600 text-sm">Aucun courrier dans cet espace</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {type === 'inbox' 
              ? 'Vous n’avez aucun courrier inter-services en attente de traitement.' 
              : type === 'sent' 
              ? 'Vous n’avez émis aucune transmission inter-services pour le moment.' 
              : 'Aucun courrier approuvé et signé ne vous a été retourné pour l’instant.'}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Identifiant / Réf</th>
              <th className="py-3 px-4">{type === 'inbox' ? 'Expéditeur' : 'Destinataire'}</th>
              <th className="py-3 px-4">Objet du Courrier</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
            {list.map((item) => (
              <tr 
                key={item.id}
                className="hover:bg-slate-50/80 transition cursor-pointer"
                onClick={() => handleOpenDetails(item)}
              >
                <td className="py-3.5 px-4 font-mono font-bold text-kindia-blue">
                  <div className="flex items-center space-x-1.5">
                    <Lock className="w-3 h-3 text-kindia-gold shrink-0" />
                    <span>{item.transmission_number}</span>
                  </div>
                  {item.document_number && (
                    <span className="text-[10px] text-slate-400 block font-normal font-sans">
                      Doc: {item.document_number}
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-800">
                      {type === 'inbox' ? item.from_service_name : item.to_service_name}
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 max-w-xs">
                  <span className="font-bold text-slate-900 line-clamp-1">{item.subject}</span>
                  {item.instruction && (
                    <span className="text-[11px] text-slate-400 line-clamp-1">{item.instruction}</span>
                  )}
                </td>
                <td className="py-3.5 px-4">
                  {getStatusBadge(item.status)}
                </td>
                <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                  {new Date(item.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDetails(item);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 font-bold text-xs transition inline-flex items-center space-x-1"
                  >
                    <span>Consulter</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-kindia-blue to-kindia-lightBlue flex items-center justify-center shadow-md text-white">
            <RotateCcw className="w-6 h-6 text-kindia-gold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-heading font-extrabold text-slate-900">
                Transmissions Inter-Services
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1" /> Circuit Fermé & Confidentiel
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Service actif : <strong className="text-kindia-blue">{user?.service_name || 'Personnel Université'}</strong> • Workflow direct entre services
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4 text-kindia-gold" />
          <span>Nouveau Courrier Inter-Services</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'inbox'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Courriers reçus (À traiter)</span>
          {inboxList.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'inbox' ? 'bg-white/20 text-white' : 'bg-kindia-blue text-white'}`}>
              {inboxList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'sent'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Courriers envoyés</span>
        </button>

        <button
          onClick={() => setActiveTab('returned')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'returned'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Courriers retournés (Signés)</span>
          {returnedList.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'returned' ? 'bg-white/20 text-white' : 'bg-teal-600 text-white'}`}>
              {returnedList.length}
            </span>
          )}
        </button>
      </div>

      {/* Main List */}
      <div>
        {activeTab === 'inbox' && renderTable(inboxList, 'inbox')}
        {activeTab === 'sent' && renderTable(sentList, 'sent')}
        {activeTab === 'returned' && renderTable(returnedList, 'returned')}
      </div>

      {/* Slide-over Detailed Inspection Modal */}
      {selectedTransmission && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-4xl h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-kindia-blue to-kindia-lightBlue text-white flex items-center justify-between sticky top-0 z-10 shadow-md">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Lock className="w-5 h-5 text-kindia-gold" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-extrabold text-base text-white">
                      {selectedTransmission.transmission.transmission_number}
                    </span>
                    {getStatusBadge(selectedTransmission.transmission.status)}
                  </div>
                  <p className="text-xs text-slate-200">
                    {selectedTransmission.transmission.from_service_name} ➔ {selectedTransmission.transmission.to_service_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTransmission(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 bg-slate-50/50">
              
              {/* Left Column: Document & Metadata (2 cols) */}
              <div className="lg:col-span-2 space-y-6">
                {/* General Info Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                    Informations du Courrier
                  </h3>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      {selectedTransmission.transmission.subject}
                    </h2>
                    {selectedTransmission.transmission.instruction && (
                      <p className="text-xs text-slate-600 mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100 italic">
                        « {selectedTransmission.transmission.instruction} »
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Expéditeur</span>
                      <span className="font-bold text-slate-800">{selectedTransmission.transmission.from_service_name}</span>
                      <span className="text-[11px] text-slate-500 block">
                        Par : {selectedTransmission.transmission.from_user_first_name} {selectedTransmission.transmission.from_user_last_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Destinataire</span>
                      <span className="font-bold text-slate-800">{selectedTransmission.transmission.to_service_name}</span>
                      {selectedTransmission.transmission.to_user_first_name && (
                        <span className="text-[11px] text-slate-500 block">
                          Attn : {selectedTransmission.transmission.to_user_first_name} {selectedTransmission.transmission.to_user_last_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedTransmission.transmission.modification_reason && (
                    <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs">
                      <span className="font-bold flex items-center mb-1">
                        <Edit3 className="w-3.5 h-3.5 mr-1 text-purple-600" /> Motif de la demande de modification :
                      </span>
                      {selectedTransmission.transmission.modification_reason}
                    </div>
                  )}

                  {selectedTransmission.transmission.rejection_reason && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs">
                      <span className="font-bold flex items-center mb-1">
                        <XCircle className="w-3.5 h-3.5 mr-1 text-red-600" /> Motif du refus :
                      </span>
                      {selectedTransmission.transmission.rejection_reason}
                    </div>
                  )}

                  {selectedTransmission.transmission.signer_name && (
                    <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-xs space-y-1">
                      <span className="font-bold flex items-center text-teal-800">
                        <ShieldCheck className="w-4 h-4 mr-1 text-teal-600" /> Signature Électronique Apposée
                      </span>
                      <div className="text-xs text-teal-950">
                        Signé par : <strong>{selectedTransmission.transmission.signer_name}</strong> ({selectedTransmission.transmission.signer_function_title})
                      </div>
                      <div className="text-[11px] text-teal-700">
                        Date de signature : {new Date(selectedTransmission.transmission.signed_at).toLocaleString('fr-FR')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Attached Document File */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                    Fichier du Document
                  </h3>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-8 h-8 text-kindia-blue" />
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">
                          {selectedTransmission.transmission.doc_file_name || 'Document_Principal.pdf'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Réf: {selectedTransmission.transmission.document_number}
                        </span>
                      </div>
                    </div>
                    {selectedTransmission.transmission.doc_file_path && (
                      <a
                        href={`/uploads/${selectedTransmission.transmission.doc_file_path.replace(/^.*uploads[\\/]/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-kindia-blue text-white font-bold text-xs hover:bg-kindia-lightBlue transition flex items-center space-x-1 shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ouvrir / Télécharger</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Confidential Timeline & Actions (1 col) */}
              <div className="space-y-6">
                
                {/* Actions Contextuelles */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Actions Disponibles
                  </h3>

                  {selectedTransmission.permissions.canAcknowledge && (
                    <button
                      onClick={() => setActionType('acknowledge')}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center justify-center space-x-2 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Accuser Réception & Prendre en charge</span>
                    </button>
                  )}

                  {selectedTransmission.permissions.canApprove && (
                    <button
                      onClick={() => setActionType('approve')}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center space-x-2 shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approuver le Courrier</span>
                    </button>
                  )}

                  {selectedTransmission.permissions.canSign && (
                    <button
                      onClick={() => setActionType('sign')}
                      className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center justify-center space-x-2 shadow-sm"
                    >
                      <FileCheck className="w-4 h-4" />
                      <span>Signer Électroniquement & Retourner</span>
                    </button>
                  )}

                  {selectedTransmission.permissions.canRequestModification && (
                    <button
                      onClick={() => setActionType('modification')}
                      className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center justify-center space-x-2 shadow-sm"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Demander une Modification</span>
                    </button>
                  )}

                  {selectedTransmission.permissions.canReject && (
                    <button
                      onClick={() => setActionType('reject')}
                      className="w-full py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition flex items-center justify-center space-x-2 shadow-sm"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Refuser le Courrier</span>
                    </button>
                  )}

                  {selectedTransmission.permissions.canArchive && (
                    <button
                      onClick={() => setActionType('archive')}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition flex items-center justify-center space-x-2 shadow-sm"
                    >
                      <Archive className="w-4 h-4" />
                      <span>Classer dans mes Archives</span>
                    </button>
                  )}
                </div>

                {/* Confidential Timeline */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-kindia-blue" />
                    Historique du Workflow
                  </h3>

                  <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {selectedTransmission.history.map((ev, idx) => (
                      <div key={idx} className="relative pl-3 text-xs">
                        <div className="absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full bg-kindia-blue ring-4 ring-white" />
                        <span className="font-bold text-slate-900 block">{ev.action_label}</span>
                        {ev.comments && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{ev.comments}</p>
                        )}
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(ev.created_at).toLocaleString('fr-FR', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* Action Execution Modal */}
      {actionType && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {actionType === 'acknowledge' && 'Accuser réception du courrier'}
                {actionType === 'modification' && 'Demander une modification'}
                {actionType === 'approve' && 'Approuver le courrier'}
                {actionType === 'sign' && 'Signature Électronique Officielle'}
                {actionType === 'reject' && 'Refuser le courrier'}
                {actionType === 'archive' && 'Archiver le courrier'}
              </h3>
              <button onClick={() => setActionType(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                {actionError}
              </div>
            )}

            <form onSubmit={handleExecuteAction} className="space-y-4">
              {(actionType === 'modification' || actionType === 'reject') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Motif obligatoire <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    required
                    rows={3}
                    placeholder="Précisez la raison détaillée..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              )}

              {actionType === 'sign' && (
                <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-xs space-y-2">
                  <span className="font-bold block">Votre signature officielle sera apposée :</span>
                  <div className="font-semibold">{user?.first_name} {user?.last_name}</div>
                  <div className="text-[11px] text-teal-700">{user?.function_title || 'Chef de Service'}</div>
                  <p className="text-[11px] text-teal-800 pt-1 border-t border-teal-200/60">
                    Le courrier signé sera <strong>automatiquement retourné</strong> à l’expéditeur.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Commentaires additionnels (optionnel)
                </label>
                <textarea
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  rows={2}
                  placeholder="Notes pour l'historique..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {actionLoading ? 'Validation...' : 'Confirmer l’action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Transmission Modal */}
      <NewServiceTransmissionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => {
          loadTabData(activeTab);
        }}
        user={user}
      />

    </div>
  );
}

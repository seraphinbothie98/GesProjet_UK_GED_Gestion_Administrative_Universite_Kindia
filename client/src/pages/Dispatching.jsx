import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Send, Inbox, BarChart2, Plus, Search, Filter, CheckCircle, Clock, 
  AlertCircle, FileText, Download, Bell, Eye, CheckSquare, ChevronRight, 
  RefreshCw, Users, ShieldAlert, Sparkles, Upload
} from 'lucide-react';
import NewDispatchModal from '../components/NewDispatchModal';
import DispatchDetailModal from '../components/DispatchDetailModal';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';
import AcknowledgeDispatchModal from '../components/AcknowledgeDispatchModal';

export default function Dispatching({ onSelectDocument }) {
  const [activeTab, setActiveTab] = useState('INBOX'); // 'INBOX', 'TRACKING', 'DASHBOARD'
  
  // Inbox state
  const [inboxDispatches, setInboxDispatches] = useState([]);
  const [inboxFilter, setInboxFilter] = useState('ALL'); // 'ALL', 'PENDING_ACK', 'ACTION_REQUIRED', 'LATE', 'COMPLETED'
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxLoading, setInboxLoading] = useState(false);

  // Tracking state
  const [trackingDispatches, setTrackingDispatches] = useState([]);
  const [trackingSearch, setTrackingSearch] = useState('');
  const [trackingStatus, setTrackingStatus] = useState('');
  const [trackingType, setTrackingType] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Dashboard Stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Modals state
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedDispatchId, setSelectedDispatchId] = useState(null);
  const [previewDocModal, setPreviewDocModal] = useState(null); // Attachment to preview
  const [acknowledgingItem, setAcknowledgingItem] = useState(null); // Item for Acknowledge workflow
  const [loadingDocId, setLoadingDocId] = useState(null); // Loading state for view document button
  const [errorModalDoc, setErrorModalDoc] = useState(null); // Explicit error display modal

  // Action completion popup state
  const [completingActionItem, setCompletingActionItem] = useState(null);
  const [actionComment, setActionComment] = useState('');
  const [actionFile, setActionFile] = useState(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab === 'INBOX') loadInbox();
    else if (activeTab === 'TRACKING') loadTracking();
    else if (activeTab === 'DASHBOARD') loadStats();
  }, [activeTab, inboxFilter, trackingStatus, trackingType]);

  const loadInbox = async () => {
    setInboxLoading(true);
    setError('');
    try {
      const data = await api.getMyServiceDispatchInbox({ filter: inboxFilter, search: inboxSearch });
      setInboxDispatches(data.dispatches || []);
    } catch (err) {
      console.error('Failed to load inbox dispatches:', err);
      setError('Impossible de charger les diffusions reçues.');
    } finally {
      setInboxLoading(false);
    }
  };

  const loadTracking = async () => {
    setTrackingLoading(true);
    setError('');
    try {
      const data = await api.getDispatches({ search: trackingSearch, status: trackingStatus, dispatch_type: trackingType });
      setTrackingDispatches(data.dispatches || []);
    } catch (err) {
      console.error('Failed to load tracking dispatches:', err);
      setError('Impossible de charger le suivi des diffusions.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await api.getDispatchDashboardStats();
      setStats(data.stats || null);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Handle consultation & open original document
  const handleViewDocument = async (item) => {
    setLoadingDocId(item.id);
    setError('');
    try {
      // Mark as viewed on server first
      try {
        await api.viewDispatchRecipient(item.id);
        loadInbox();
      } catch (viewErr) {
        console.warn('View recipient error:', viewErr);
      }

      if (onSelectDocument) {
        onSelectDocument(item.document_id);
        return;
      }

      // If standalone: fetch document details and open attachment
      const docData = await api.getDocumentDetail(item.document_id);
      const docObj = docData.document || docData;
      if (docObj.attachments && docObj.attachments.length > 0) {
        setPreviewDocModal(docObj.attachments[0]);
      } else {
        setPreviewDocModal({
          name: `${docObj.reference} - ${docObj.title}`,
          file_name: `${docObj.reference}.pdf`,
          file_path: `/uploads/${docObj.reference}.pdf`
        });
      }
    } catch (err) {
      console.error('View document error:', err);
      setErrorModalDoc({
        reference: item.document_reference || item.dispatch_reference,
        title: item.document_title || item.dispatch_title,
        message: err.message || 'Le document original est introuvable ou inaccessible.'
      });
    } finally {
      setLoadingDocId(null);
    }
  };

  // Handle Acknowledge ('Prise de connaissance') via dedicated workflow modal
  const handleAcknowledge = (item) => {
    setAcknowledgingItem(item);
  };

  // Handle Complete Action
  const handleCompleteActionSubmit = async (e) => {
    e.preventDefault();
    if (!completingActionItem) return;
    setActionSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('comment', actionComment);
      if (actionFile) formData.append('response_attachment', actionFile);

      const res = await api.completeDispatchAction(completingActionItem.id, formData);
      setMessage(res.message);
      setCompletingActionItem(null);
      setActionComment('');
      setActionFile(null);
      loadInbox();
    } catch (err) {
      setError(err.message || 'Erreur lors de la validation de l’action.');
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* TOP HEADER BANNER */}
      <div className="bg-gradient-to-r from-kindia-blue via-slate-900 to-slate-950 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="bg-kindia-gold text-slate-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Diffusion Administrative
            </span>
            <span className="text-slate-400 text-xs font-mono">UK-GED v2.0</span>
          </div>
          <h1 className="font-heading font-extrabold text-xl md:text-2xl text-white">
            Dispatching & Diffusion Multi-Services
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Système centralisé de diffusion des notes de service, décisions, circulaires et directives avec traçabilité et émargement certifié.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="px-5 py-3 bg-kindia-gold hover:bg-amber-400 text-slate-950 font-extrabold rounded-2xl shadow-lg transition flex items-center space-x-2 text-xs flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>NOUVELLE DIFFUSION</span>
        </button>
      </div>

      {/* FEEDBACK MESSAGES */}
      {message && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-6 py-3 rounded-2xl flex items-center justify-between shadow">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-600 text-white text-xs font-bold px-6 py-3 rounded-2xl flex items-center justify-between shadow">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* MAIN NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveTab('INBOX')}
          className={`py-3 px-5 font-bold text-xs rounded-t-2xl transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'INBOX' 
              ? 'bg-white border-kindia-blue text-kindia-blue shadow-sm' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Boîte de Réception du Service</span>
        </button>

        <button
          onClick={() => setActiveTab('TRACKING')}
          className={`py-3 px-5 font-bold text-xs rounded-t-2xl transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'TRACKING' 
              ? 'bg-white border-kindia-blue text-kindia-blue shadow-sm' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Suivi des Diffusions (Secrétariat Central)</span>
        </button>

        <button
          onClick={() => setActiveTab('DASHBOARD')}
          className={`py-3 px-5 font-bold text-xs rounded-t-2xl transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'DASHBOARD' 
              ? 'bg-white border-kindia-blue text-kindia-blue shadow-sm' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Statistiques & Analyse</span>
        </button>
      </div>

      {/* TAB 1: INBOX */}
      {activeTab === 'INBOX' && (
        <div className="space-y-4">
          
          {/* INBOX FILTERS & SEARCH */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              {[
                { id: 'ALL', label: 'Toutes les diffusions' },
                { id: 'PENDING_ACK', label: '✍️ À prendre connaissance' },
                { id: 'ACTION_REQUIRED', label: '⚡ Actions requises' },
                { id: 'LATE', label: '⚠️ En retard' },
                { id: 'COMPLETED', label: '✓ Traités' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setInboxFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    inboxFilter === f.id 
                      ? 'bg-kindia-blue text-white shadow-sm' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher une diffusion..."
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadInbox()}
                className="w-full pl-8 p-1.5 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {/* INBOX LIST CARDS */}
          {inboxLoading ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-8 h-8 text-kindia-blue animate-spin" />
              <p className="text-xs text-slate-500 font-bold">Chargement de votre boîte de réception...</p>
            </div>
          ) : inboxDispatches.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-xl">
                📭
              </div>
              <h3 className="font-heading font-extrabold text-sm text-slate-800">Aucun document diffusé dans cette catégorie</h3>
              <p className="text-xs text-slate-500">Votre service n'a aucune diffusion en attente correspondant à ce filtre.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {inboxDispatches.map((item) => {
                const isLate = item.is_late;
                const isAck = item.status === 'PRISE_DE_CONNAISSANCE' || item.acknowledged_at;
                const isActionDone = item.status === 'ACTION_TERMINEE' || item.action_completed_at;

                return (
                  <div 
                    key={item.id}
                    className={`bg-white p-5 rounded-2xl border transition shadow-sm hover:shadow-md space-y-3 ${
                      isLate ? 'border-red-300 bg-red-50/10' : (isAck || isActionDone ? 'border-slate-200' : 'border-blue-200 bg-blue-50/10')
                    }`}
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono font-bold text-kindia-blue bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                            {item.dispatch_reference}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Doc: {item.document_reference}
                          </span>
                          {item.dispatch_type === 'PRISE_DE_CONNAISSANCE' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                              Prise de connaissance obligatoire
                            </span>
                          )}
                          {item.dispatch_type === 'ACTION_REQUISE' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                              Action requise
                            </span>
                          )}
                          {isLate && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 animate-pulse">
                              ⚠️ En retard
                            </span>
                          )}
                        </div>

                        <h3 className="font-heading font-extrabold text-sm text-slate-800">
                          {item.dispatch_title || item.document_title}
                        </h3>
                      </div>

                      {/* Status badge */}
                      <div>
                        {isAck ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Pris connaissance</span>
                          </span>
                        ) : isActionDone ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center space-x-1">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                            <span>Action terminée</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>En attente de traitement</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Message or action description */}
                    {item.dispatch_message && (
                      <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        « {item.dispatch_message} »
                      </p>
                    )}

                    {item.action_description && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                        <span className="font-bold block">Tâche à accomplir :</span>
                        <span>{item.action_description}</span>
                      </div>
                    )}

                    {/* Footer Info & Action buttons */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                        <span>Émetteur : <strong className="text-slate-600">{item.sender_service_name}</strong></span>
                        <span>•</span>
                        <span>Échéance : <strong className={isLate ? 'text-red-600 font-bold' : 'text-slate-600'}>
                          {item.deadline ? new Date(item.deadline).toLocaleString('fr-FR') : 'Aucune'}
                        </strong></span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDocument(item)}
                          disabled={loadingDocId === item.id}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          {loadingDocId === item.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 text-kindia-blue animate-spin" />
                              <span>Chargement...</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-kindia-blue" />
                              <span>Consulter le Document</span>
                            </>
                          )}
                        </button>

                        {item.dispatch_type === 'PRISE_DE_CONNAISSANCE' && !isAck && (
                          <button
                            onClick={() => handleAcknowledge(item)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center space-x-1.5"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Prendre Connaissance</span>
                          </button>
                        )}

                        {item.dispatch_type === 'ACTION_REQUISE' && !isActionDone && (
                          <button
                            onClick={() => setCompletingActionItem(item)}
                            className="px-4 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white rounded-xl text-xs font-bold shadow transition flex items-center space-x-1.5"
                          >
                            <span>⚡ Traiter l'Action</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRACKING */}
      {activeTab === 'TRACKING' && (
        <div className="space-y-4">
          
          {/* TRACKING FILTERS */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3 text-xs">
            <div className="flex items-center space-x-3 w-full md:w-auto">
              <select
                value={trackingStatus}
                onChange={(e) => setTrackingStatus(e.target.value)}
                className="p-2 rounded-xl border border-slate-300 font-bold bg-white"
              >
                <option value="">Tous les statuts</option>
                <option value="EN_COURS">En cours</option>
                <option value="TERMINE">Terminé</option>
                <option value="EN_RETARD">En retard</option>
              </select>

              <select
                value={trackingType}
                onChange={(e) => setTrackingType(e.target.value)}
                className="p-2 rounded-xl border border-slate-300 font-bold bg-white"
              >
                <option value="">Tous les types</option>
                <option value="SIMPLE">Diffusion Simple</option>
                <option value="PRISE_DE_CONNAISSANCE">Prise de connaissance</option>
                <option value="ACTION_REQUISE">Action requise</option>
              </select>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher réf, titre, doc..."
                value={trackingSearch}
                onChange={(e) => setTrackingSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadTracking()}
                className="w-full pl-8 p-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {/* TRACKING TABLE */}
          {trackingLoading ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-8 h-8 text-kindia-blue animate-spin" />
              <p className="text-xs text-slate-500 font-bold">Chargement des diffusions...</p>
            </div>
          ) : trackingDispatches.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-xl">
                📋
              </div>
              <h3 className="font-heading font-extrabold text-sm text-slate-800">Aucune diffusion enregistrée</h3>
              <p className="text-xs text-slate-500">Lancez une nouvelle diffusion pour distribuer un document à plusieurs services.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/75 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                      <th className="py-3 px-4">Réf. Diffusion</th>
                      <th className="py-3 px-3">Document Original</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Émetteur</th>
                      <th className="py-3 px-3">Émargement / Avancement</th>
                      <th className="py-3 px-3">Statut Global</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trackingDispatches.map((d) => {
                      const percentage = d.total_recipients > 0 ? Math.round(((d.acknowledged_count || 0) / d.total_recipients) * 100) : 0;
                      return (
                        <tr key={d.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono font-bold text-kindia-blue">
                            {d.reference}
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800 block truncate max-w-xs">{d.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">[{d.document_reference}]</span>
                          </td>

                          <td className="py-3 px-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {d.dispatch_type.replace(/_/g, ' ')}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-600">
                            <span>{d.sender_service_name || 'Secrétariat Central'}</span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="space-y-1 w-32">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span>{d.acknowledged_count || 0}/{d.total_recipients || 0}</span>
                                <span>{percentage}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {d.status === 'TERMINE' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                ✓ Terminé
                              </span>
                            )}
                            {d.status === 'EN_COURS' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                🔄 En cours
                              </span>
                            )}
                            {d.status === 'EN_RETARD' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                ⚠️ En retard
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right space-x-1.5">
                            <button
                              onClick={() => setSelectedDispatchId(d.id)}
                              className="px-2.5 py-1 bg-kindia-blue text-white rounded-lg text-[11px] font-bold hover:bg-kindia-lightBlue transition shadow-sm"
                            >
                              Suivi & Émargement
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DASHBOARD STATS */}
      {activeTab === 'DASHBOARD' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Diffusions</span>
              <span className="text-2xl font-heading font-extrabold text-kindia-blue">{stats.total_dispatches}</span>
              <p className="text-[11px] text-slate-500">{stats.active_dispatches} en cours actuellement</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Taux d'Émargement</span>
              <span className="text-2xl font-heading font-extrabold text-emerald-700">{stats.acknowledgement_rate}%</span>
              <p className="text-[11px] text-emerald-600 font-bold">Prise de connaissance certifiée</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Taux de Consultation</span>
              <span className="text-2xl font-heading font-extrabold text-blue-700">{stats.consultation_rate}%</span>
              <p className="text-[11px] text-blue-600">Documents ouverts par les services</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Diffusions en Retard</span>
              <span className="text-2xl font-heading font-extrabold text-red-700">{stats.late_dispatches}</span>
              <p className="text-[11px] text-red-600">Échéance dépassée</p>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: COMPLETE REQUIRED ACTION */}
      {completingActionItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-slate-800 flex items-center">
                <CheckSquare className="w-4 h-4 text-kindia-gold mr-1.5" />
                Finaliser l'Action Requise
              </h3>
              <button onClick={() => setCompletingActionItem(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
              <span className="font-bold block mb-0.5">Action demandée :</span>
              <span>{completingActionItem.action_description}</span>
            </div>

            <form onSubmit={handleCompleteActionSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Commentaire / Compte-rendu d'exécution</label>
                <textarea
                  rows={3}
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  placeholder="Indiquez les dispositions prises ou observations..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Document joint justificatif (Optionnel)</label>
                <input
                  type="file"
                  onChange={(e) => setActionFile(e.target.files[0])}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCompletingActionItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-5 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow transition"
                >
                  {actionSubmitting ? 'Validation...' : 'CLÔTURER L’ACTION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW DISPATCH */}
      {showNewModal && (
        <NewDispatchModal
          onClose={() => setShowNewModal(false)}
          onCreated={(res) => {
            setMessage(res.message);
            if (activeTab === 'INBOX') loadInbox();
            else if (activeTab === 'TRACKING') loadTracking();
          }}
        />
      )}

      {/* MODAL: DISPATCH DETAIL & TRACKING */}
      {selectedDispatchId && (
        <DispatchDetailModal
          dispatchId={selectedDispatchId}
          onClose={() => setSelectedDispatchId(null)}
          onUpdated={() => {
            if (activeTab === 'TRACKING') loadTracking();
          }}
        />
      )}

      {/* MODAL: DOCUMENT PREVIEW */}
      {previewDocModal && (
        <AttachmentPreviewModal
          attachment={previewDocModal}
          onClose={() => setPreviewDocModal(null)}
        />
      )}

      {/* MODAL: ACKNOWLEDGE WORKFLOW ('PRENDRE CONNAISSANCE') */}
      {acknowledgingItem && (
        <AcknowledgeDispatchModal
          item={acknowledgingItem}
          onClose={() => setAcknowledgingItem(null)}
          onSuccess={(msg) => {
            setMessage(msg);
            loadInbox();
          }}
        />
      )}

      {/* MODAL: EXPLICIT DOCUMENT ERROR DISPLAY */}
      {errorModalDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-red-200 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-extrabold text-base text-slate-800">
              Impossible de charger ce document.
            </h3>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-400 block text-[10px]">Référence :</span>
              <span className="font-mono font-bold text-kindia-blue">{errorModalDoc.reference}</span>
              {errorModalDoc.title && (
                <span className="text-slate-600 block mt-1 font-semibold">{errorModalDoc.title}</span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              {errorModalDoc.message || 'Le document original est introuvable ou inaccessible.'}
            </p>
            <div className="pt-2 flex justify-center space-x-3 text-xs">
              <button
                onClick={() => setErrorModalDoc(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition shadow"
              >
                RETOUR
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

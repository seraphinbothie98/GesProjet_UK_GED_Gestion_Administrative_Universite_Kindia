import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Folder, FolderOpen, Archive, Eye, Trash2, AlertTriangle, X, CheckCircle, 
  Search, Download, ExternalLink, UserCheck, Calendar, Building2, FileText, 
  MapPin, CheckCircle2, ShieldCheck, Printer, RefreshCw
} from 'lucide-react';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';

export default function Archives({ onSelectDocument }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // External Mission Order Detail Modal state
  const [selectedExtDoc, setSelectedExtDoc] = useState(null);

  // Modern Universal Preview Modal state
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // PDF Quick Preview Modal state (fallback)
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');

  // Deletion Modal state for Admin
  const [selectedDocForDelete, setSelectedDocForDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.role_code === 'ADMINISTRATEUR';

  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async () => {
    setLoading(true);
    try {
      const [docs, extDocs] = await Promise.all([
        api.getDocuments({ status: 'ARCHIVED' }).catch(() => []),
        api.getExternalMissionaries({ status: 'ARCHIVÉ' }).catch(() => [])
      ]);

      const formattedExtDocs = (extDocs || []).map(m => ({
        id: `ext-${m.id}`,
        external_id: m.id,
        is_external: true,
        reference: m.reference,
        title: `${m.last_name} ${m.first_names} (${m.origin_institution}) — ${m.object_of_mission || 'Mission externe'}`,
        document_type: 'EXTERNAL_MISSION_ORDER',
        document_type_label: 'Ordre de mission externe',
        archived_at: m.updated_at || m.created_at,
        status: m.status,
        raw_external: m
      }));

      setDocuments([...(docs || []), ...formattedExtDocs]);
    } catch (err) {
      console.error('Error loading archives:', err);
      setError('Erreur lors du chargement des archives.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubmit = async (e, permanent = false) => {
    e.preventDefault();
    if (!selectedDocForDelete) return;

    if (deleteConfirmInput !== 'SUPPRIMER') {
      setError('Veuillez saisir exactement "SUPPRIMER" pour confirmer la suppression.');
      return;
    }

    if (!deleteReason.trim()) {
      setError('Le motif de la suppression est obligatoire.');
      return;
    }

    setDeleting(true);
    setError('');
    setMessage('');

    try {
      if (selectedDocForDelete.is_external) {
        const res = await api.deleteExternalMissionary(selectedDocForDelete.external_id);
        setMessage(res.message || `Ordre de mission externe ${selectedDocForDelete.reference} supprimé.`);
      } else {
        if (permanent) {
          const res = await api.permanentDeleteDocument(selectedDocForDelete.id, deleteReason, deleteConfirmInput);
          setMessage(res.message || `Document ${selectedDocForDelete.reference} définitivement supprimé.`);
        } else {
          const res = await api.moveToTrash(selectedDocForDelete.id, deleteReason);
          setMessage(res.message || `Document ${selectedDocForDelete.reference} placé dans la Corbeille Administrateur.`);
        }
      }
      setSelectedDocForDelete(null);
      setDeleteReason('');
      setDeleteConfirmInput('');
      loadArchives();
    } catch (err) {
      setError(err.message || 'Erreur lors de la suppression.');
    } finally {
      setDeleting(false);
    }
  };

  const folders = [
    { id: 'ALL', label: 'Toutes les Archives 2026', count: documents.length },
    { id: 'DECRET', label: '📜 Décrets', count: documents.filter(d => d.document_type === 'DECRET' || d.document_type === 'Décret').length },
    { id: 'ARRETE', label: '📜 Arrêtés', count: documents.filter(d => d.document_type === 'ARRETE' || d.document_type === 'Arrêté').length },
    { id: 'NOTE_SERVICE', label: '📝 Notes de service', count: documents.filter(d => d.document_type === 'NOTE_SERVICE' || d.document_type === 'Note de service').length },
    { id: 'DECISION', label: '📋 Décisions', count: documents.filter(d => d.document_type === 'DECISION' || d.document_type === 'Décision').length },
    { id: 'CIRCULAIRE', label: '📄 Circulaires', count: documents.filter(d => d.document_type === 'CIRCULAIRE' || d.document_type === 'Circulaire').length },
    { id: 'PROCES_VERBAL', label: '📑 Procès-verbaux', count: documents.filter(d => d.document_type === 'PROCES_VERBAL' || d.document_type === 'Procès-verbal').length },
    { id: 'INCOMING_MAIL', label: '📥 Courriers entrants', count: documents.filter(d => d.document_type === 'INCOMING_MAIL' || d.document_type === 'COURRIER_ENTRANT').length },
    { id: 'OUTGOING_MAIL', label: '📤 Courriers sortants', count: documents.filter(d => d.document_type === 'OUTGOING_MAIL').length },
    { id: 'MISSION_ORDER', label: '✈️ Ordres de mission', count: documents.filter(d => d.document_type === 'MISSION_ORDER').length },
    { id: 'EXTERNAL_MISSION_ORDER', label: '📁 Ordres de mission externes', count: documents.filter(d => d.document_type === 'EXTERNAL_MISSION_ORDER').length }
  ];

  const filteredDocs = documents
    .filter(d => {
      if (selectedFolder === 'ALL') return true;
      if (selectedFolder === 'EXTERNAL_MISSION_ORDER') return d.document_type === 'EXTERNAL_MISSION_ORDER';
      if (selectedFolder === 'MISSION_ORDER') return d.document_type === 'MISSION_ORDER';
      return d.document_type === selectedFolder || (d.document_type && d.document_type.toUpperCase().includes(selectedFolder));
    })
    .filter(d => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (d.reference && d.reference.toLowerCase().includes(term)) ||
        (d.title && d.title.toLowerCase().includes(term)) ||
        (d.document_type_label && d.document_type_label.toLowerCase().includes(term)) ||
        (d.sender_name && d.sender_name.toLowerCase().includes(term))
      );
    });

  const getPdfDownloadUrl = (doc) => {
    const token = localStorage.getItem('uk_ged_token') || '';
    if (doc.is_external) {
      return `/api/external-missionaries/${doc.external_id}/document/final?token=${encodeURIComponent(token)}`;
    }
    return `/api/documents/${doc.id}/view?token=${encodeURIComponent(token)}`;
  };

  const handleOpenPreview = (doc) => {
    const token = localStorage.getItem('uk_ged_token') || '';
    if (doc.is_external) {
      setPreviewAttachment({
        id: `ext-${doc.external_id}`,
        file_name: `${doc.reference}.pdf`,
        name: `${doc.reference} — Ordre de mission complet`,
        url: `/api/external-missionaries/${doc.external_id}/document/final?token=${encodeURIComponent(token)}`
      });
    } else {
      setPreviewAttachment({
        id: doc.id,
        document_id: doc.id,
        file_name: `${doc.reference || 'document'}.pdf`,
        name: `${doc.reference} — ${doc.title}`,
        url: `/api/documents/${doc.id}/view?token=${encodeURIComponent(token)}`
      });
    }
  };

  const handleDownload = async (e, doc) => {
    e.preventDefault();
    try {
      if (doc.is_external) {
        const token = localStorage.getItem('uk_ged_token') || '';
        const url = `/api/external-missionaries/${doc.external_id}/document/final?token=${encodeURIComponent(token)}`;
        window.open(url, '_blank');
      } else {
        await api.downloadDocumentOrAttachment(doc.id, `${doc.reference || 'archive'}.pdf`);
      }
    } catch (err) {
      setError('Erreur lors du téléchargement du document archivé.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-800">Archives Électroniques Permanentes</h2>
            <p className="text-xs text-slate-500">Classement Thématique, Conservation Sécurisée & Ordres de Mission Externes</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={loadArchives}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition text-xs font-bold flex items-center space-x-1"
            title="Actualiser les archives"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
          {isAdmin && (
            <span className="px-3 py-1 bg-rose-100 text-rose-800 font-bold text-xs rounded-full border border-rose-200 flex items-center space-x-1">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Mode Administration Actif</span>
            </span>
          )}
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs rounded-xl font-bold border border-emerald-300 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 text-rose-800 text-xs rounded-xl font-bold border border-rose-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Folder Hierarchy Menu */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2 h-fit">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
            <span>Dossiers Archives 2026</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
              {documents.length}
            </span>
          </div>

          <div className="space-y-1">
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFolder(f.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition ${
                  selectedFolder === f.id
                    ? 'bg-kindia-blue text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  {selectedFolder === f.id ? (
                    <FolderOpen className="w-4 h-4 text-kindia-gold shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">{f.label}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                  selectedFolder === f.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Archived Documents List */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Search and Table Header */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-xs text-slate-800 flex items-center space-x-2">
                <span>
                  {folders.find(f => f.id === selectedFolder)?.label || 'Archives'}
                </span>
                <span className="text-slate-400">({filteredDocs.length} document{filteredDocs.length > 1 ? 's' : ''})</span>
              </h3>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher référence, titre..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-kindia-blue focus:bg-white transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Référence</th>
                  <th className="p-3.5">Titre / Missionnaire / Objet</th>
                  <th className="p-3.5">Catégorie</th>
                  <th className="p-3.5">Archivé Le</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      <div className="flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-kindia-blue" />
                        <span>Chargement des archives en cours...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      {searchTerm ? 'Aucun document ne correspond à votre recherche.' : 'Aucun document archivé dans ce dossier.'}
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-bold text-kindia-blue whitespace-nowrap">
                        {doc.reference}
                      </td>
                      <td className="p-3.5 text-slate-800 font-semibold max-w-xs truncate">
                        <span title={doc.title}>{doc.title}</span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {doc.is_external ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            📁 OM Externe
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {doc.document_type}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600 whitespace-nowrap">
                        {doc.archived_at ? new Date(doc.archived_at).toLocaleDateString('fr-FR') : 'N/A'}
                      </td>
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {/* Action 1: Consultation Details */}
                        {doc.is_external ? (
                          <button
                            onClick={() => setSelectedExtDoc(doc.raw_external)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 font-bold rounded-lg transition inline-flex items-center space-x-1"
                            title="Consulter la fiche détaillée et les visas"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Détails</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onSelectDocument(doc.id)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 font-bold rounded-lg transition inline-flex items-center space-x-1"
                            title="Consulter le document dans le circuit GED"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Consulter</span>
                          </button>
                        )}

                        {/* Action 2: PDF / Document Preview */}
                        <button
                          onClick={() => handleOpenPreview(doc)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-kindia-blue hover:text-white text-kindia-blue font-bold rounded-lg transition inline-flex items-center space-x-1"
                          title="Prévisualiser le document numérisé / PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Aperçu</span>
                        </button>

                        {/* Action 3: Download */}
                        <button
                          onClick={(e) => handleDownload(e, doc)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 font-bold rounded-lg transition inline-flex items-center space-x-1"
                          title="Télécharger le fichier officiel"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Télécharger</span>
                        </button>

                        {/* Action 4: Admin Deletion Action */}
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setSelectedDocForDelete(doc);
                              setDeleteReason('');
                              setDeleteConfirmInput('');
                              setError('');
                            }}
                            className="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-600 hover:text-white text-rose-700 font-bold rounded-lg transition inline-flex items-center space-x-1 shadow-sm"
                            title="Action Administrateur uniquement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: EXTERNAL MISSION ORDER DETAILED VIEW */}
      {selectedExtDoc && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6 border border-slate-200">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-xs">
                    📁 ORDRE DE MISSION EXTERNE ARCHIVÉ
                  </span>
                  <span className="font-mono font-bold text-kindia-blue text-sm">
                    {selectedExtDoc.reference}
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-base text-slate-800">
                  {selectedExtDoc.last_name} {selectedExtDoc.first_names}
                </h3>
              </div>
              <button
                onClick={() => setSelectedExtDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Mission Details */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 border border-slate-100">
                <h4 className="font-bold text-slate-800 flex items-center space-x-1.5 uppercase text-[11px] text-kindia-blue">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Origine & Missionnaire</span>
                </h4>
                <div>
                  <span className="text-slate-500 block text-[10px]">Institution d'origine :</span>
                  <span className="font-bold text-slate-800">{selectedExtDoc.origin_institution}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Réf. Ordre de mission original :</span>
                  <span className="font-mono font-bold text-slate-700">{selectedExtDoc.mission_order_ref}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Fonction / Titre :</span>
                  <span className="font-medium text-slate-800">{selectedExtDoc.function_title}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Contact :</span>
                  <span className="text-slate-700">Tél : {selectedExtDoc.phone || 'Non renseigné'} | Email : {selectedExtDoc.email || 'Non renseigné'}</span>
                </div>
              </div>

              {/* Mission Objectives & Host Service */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 border border-slate-100">
                <h4 className="font-bold text-slate-800 flex items-center space-x-1.5 uppercase text-[11px] text-kindia-blue">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Objectif & Accueil à l'UK</span>
                </h4>
                <div>
                  <span className="text-slate-500 block text-[10px]">Objet de la mission :</span>
                  <span className="font-bold text-slate-800">{selectedExtDoc.object_of_mission}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Lieu d'exécution :</span>
                  <span className="font-medium text-slate-800">{selectedExtDoc.location_of_mission}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Service d'accueil :</span>
                  <span className="font-medium text-slate-800">{selectedExtDoc.host_service_name || 'Université de Kindia'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Responsable d'accueil :</span>
                  <span className="font-medium text-slate-800">{selectedExtDoc.host_responsible_name || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Visas & Workflow Timeline */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
              <h4 className="font-bold text-xs text-slate-800 uppercase flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Mentions & Visas Officiels Apposés à l'Université de Kindia</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                {/* 1. Visa d'arrivée */}
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-1 text-emerald-800 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>1. Visa à l’arrivée</span>
                  </div>
                  <p className="text-slate-700 italic">« Vu à l’arrivée à l’Université de Kindia »</p>
                  <p className="text-slate-500 text-[10px]">
                    Date : <strong>{selectedExtDoc.arrival_date ? new Date(selectedExtDoc.arrival_date).toLocaleDateString('fr-FR') : 'Enregistrée'}</strong>
                  </p>
                </div>

                {/* 2. Visa Secrétariat Général */}
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-1 text-kindia-blue font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-kindia-blue" />
                    <span>2. Visa Secrétariat Général</span>
                  </div>
                  <p className="text-slate-700 italic">Signature & Cachet Officiels SG</p>
                  <p className="text-slate-500 text-[10px]">
                    Date : <strong>{selectedExtDoc.signed_at ? new Date(selectedExtDoc.signed_at).toLocaleDateString('fr-FR') : 'Visé'}</strong>
                  </p>
                </div>

                {/* 3. Visa de départ */}
                <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-1 text-purple-800 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>3. Visa au départ</span>
                  </div>
                  <p className="text-slate-700 italic">« Vu au départ de l’Université de Kindia »</p>
                  <p className="text-slate-500 text-[10px]">
                    Date : <strong>{selectedExtDoc.departure_date ? new Date(selectedExtDoc.departure_date).toLocaleDateString('fr-FR') : 'Enregistré'}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap justify-between items-center pt-4 border-t border-slate-100 gap-2">
              <button
                type="button"
                onClick={() => setSelectedExtDoc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Fermer
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewPdfUrl(`/api/external-missionaries/${selectedExtDoc.id}/document/final`);
                    setPreviewTitle(`${selectedExtDoc.reference} — Ordre de mission complet`);
                  }}
                  className="px-4 py-2 bg-kindia-blue hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Prévisualiser le PDF</span>
                </button>

                <a
                  href={`/api/external-missionaries/${selectedExtDoc.id}/document/final`}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger PDF Officiel</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK PDF PREVIEW MODAL */}
      {previewPdfUrl && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-2 truncate">
                <FileText className="w-4 h-4 text-kindia-blue shrink-0" />
                <h3 className="font-bold text-xs text-slate-800 truncate">{previewTitle}</h3>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href={previewPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger</span>
                </a>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={previewPdfUrl}
                title="Prévisualisation du document"
                className="w-full h-full rounded-xl border border-slate-300 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ARCHIVED DOCUMENT DELETION MODAL (Admin Only) */}
      {selectedDocForDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-rose-300">
            <div className="flex justify-between items-center border-b border-rose-100 pb-2">
              <h3 className="font-heading font-extrabold text-sm text-rose-800 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>ATTENTION ! SUPPRESSION DE DOCUMENT ARCHIVÉ</span>
              </h3>
              <button onClick={() => setSelectedDocForDelete(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-xl text-xs space-y-2">
              <p className="font-bold uppercase tracking-wide text-rose-900">ATTENTION !</p>
              <p className="font-medium">Vous êtes sur le point de supprimer définitivement ce document des archives.</p>
              <p className="font-mono text-xs font-extrabold text-slate-800 bg-white p-2 rounded border border-rose-200">
                {selectedDocForDelete.reference} — {selectedDocForDelete.title}
              </p>
              <p className="font-extrabold text-rose-800 uppercase text-[11px]">Cette opération est irréversible.</p>
              <p className="font-bold text-slate-800">Voulez-vous réellement continuer ?</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-800 font-bold mb-1">Motif de la suppression *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ex: Suppression d'un document de test créé par erreur."
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 shadow-inner"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">
                  Pour confirmer la suppression définitive, saisissez <span className="font-mono text-rose-700">SUPPRIMER</span> *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Saisissez SUPPRIMER"
                  value={deleteConfirmInput}
                  onChange={e => setDeleteConfirmInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold tracking-wider"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedDocForDelete(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  ANNULER
                </button>

                <div className="flex space-x-2">
                  {!selectedDocForDelete.is_external && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSubmit(e, false)}
                      disabled={deleting || deleteConfirmInput !== 'SUPPRIMER' || !deleteReason.trim()}
                      className={`px-4 py-2.5 text-white font-bold rounded-xl shadow transition text-xs ${
                        deleteConfirmInput === 'SUPPRIMER' && deleteReason.trim()
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-slate-300 cursor-not-allowed'
                      }`}
                      title="Placer dans la Corbeille Administrateur (Suppression logique)"
                    >
                      {deleting ? 'Traitement...' : 'CORBEILLE'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleDeleteSubmit(e, true)}
                    disabled={deleting || deleteConfirmInput !== 'SUPPRIMER' || !deleteReason.trim()}
                    className={`px-4 py-2.5 text-white font-bold rounded-xl shadow transition text-xs ${
                      deleteConfirmInput === 'SUPPRIMER' && deleteReason.trim()
                        ? 'bg-rose-700 hover:bg-rose-800'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                    title="Suppression physique définitive immédiate"
                  >
                    {deleting ? 'Suppression...' : 'SUPPRIMER DÉFINITIVEMENT'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: UNIVERSAL SECURE ATTACHMENT / DOCUMENT PREVIEW MODAL */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}

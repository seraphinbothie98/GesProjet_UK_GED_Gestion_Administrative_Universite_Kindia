import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, DeadlineBadge } from '../components/Badge';
import { Plus, Inbox, UploadCloud, File, Eye, X, Send, Camera, FileUp } from 'lucide-react';
import DigitizationScannerModal from '../components/DigitizationScannerModal';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';
import ReceiptSuccessModal from '../components/ReceiptSuccessModal';

export default function IncomingMail({ onSelectDocument }) {
  const { hasPermission } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // New Mail / Document Form State
  const [processingMode, setProcessingMode] = useState('NORMAL'); // 'NORMAL' | 'DIRECT_ARCHIVE'
  const [officialType, setOfficialType] = useState('COURRIER_ENTRANT');
  const [documentTypes, setDocumentTypes] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderOrg, setSenderOrg] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [receptionDate, setReceptionDate] = useState(new Date().toISOString().split('T')[0]);
  const [documentDate, setDocumentDate] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [instruction, setInstruction] = useState('Pour examen et traitement');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [hasExternalSignature, setHasExternalSignature] = useState(false);
  const [externalSignatoryName, setExternalSignatoryName] = useState('');
  const [externalSignatureDate, setExternalSignatureDate] = useState('');
  const [files, setFiles] = useState([]);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [createdReceiptData, setCreatedReceiptData] = useState(null);
  const [previewRef, setPreviewRef] = useState('');
  const [generatingRef, setGeneratingRef] = useState(false);
  const [directArchiveSuccessData, setDirectArchiveSuccessData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const docs = await api.getDocuments({ type: 'INCOMING_MAIL' });
      setDocuments(docs);
      const servs = await api.getServices();
      setServices(servs.filter(s => s.status === 'ACTIVE'));
      const dTypes = await api.getDocumentTypes();
      setDocumentTypes(dTypes);
    } catch (err) {
      console.error('Error loading incoming mail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReference = async () => {
    setGeneratingRef(true);
    try {
      const typeToUse = processingMode === 'DIRECT_ARCHIVE' ? (officialType || 'NOTE_SERVICE') : 'INCOMING_MAIL';
      const ref = await api.previewReference(typeToUse);
      setPreviewRef(ref);
    } catch (e) {
      console.warn('Error previewing reference:', e);
    } finally {
      setGeneratingRef(false);
    }
  };

  const handleProcessingModeChange = (mode) => {
    setProcessingMode(mode);
    setError('');
    setPreviewRef('');
    if (mode === 'DIRECT_ARCHIVE') {
      const isCurrentAllowed = documentTypes.find(dt => dt.code === officialType && dt.allow_direct_archive === 1);
      if (!isCurrentAllowed) {
        const firstDirect = documentTypes.find(dt => dt.allow_direct_archive === 1);
        setOfficialType(firstDirect ? firstDirect.code : 'NOTE_SERVICE');
      }
    } else {
      setOfficialType('COURRIER_ENTRANT');
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title || !senderName) {
      setError('Veuillez remplir le titre et l’expéditeur.');
      return;
    }

    if (processingMode === 'DIRECT_ARCHIVE') {
      const selectedTypeConfig = documentTypes.find(dt => dt.code === officialType);
      if (selectedTypeConfig && selectedTypeConfig.allow_direct_archive === 0) {
        setError(`Le type de document [${selectedTypeConfig.label}] n'est pas autorisé pour l'archivage direct. Veuillez choisir un acte officiel (Note de service, Décret, Arrêté, Décision...).`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('processing_mode', processingMode);
      formData.append('official_type', officialType);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('sender_name', senderName);
      formData.append('sender_organization', senderOrg);
      formData.append('sender_address', senderAddress);
      formData.append('reception_date', receptionDate);
      if (documentDate) formData.append('document_date', documentDate);
      formData.append('priority', priority);
      formData.append('instruction', instruction);
      if (deadlineDate) formData.append('deadline_date', deadlineDate);

      if (hasExternalSignature) {
        formData.append('has_external_signature', '1');
        formData.append('external_signatory_name', externalSignatoryName);
        if (externalSignatureDate) formData.append('external_signature_date', externalSignatureDate);
      }

      for (let f of files) {
        formData.append('files', f);
      }

      const res = await api.createIncomingMail(formData);
      setShowModal(false);

      const chosenTypeObj = documentTypes.find(dt => dt.code === officialType);
      const typeLabel = chosenTypeObj ? chosenTypeObj.label : officialType;

      if (res && res.reference) {
        setCreatedReceiptData({
          reference: res.reference,
          receipt: res.receipt,
          documentType: 'INCOMING_MAIL',
          isDirectArchive: processingMode === 'DIRECT_ARCHIVE',
          officialTypeLabel: typeLabel,
          documentTitle: title,
          docId: res.id
        });
      }

      resetForm();
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du courrier entrant.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setProcessingMode('NORMAL');
    setOfficialType('COURRIER_ENTRANT');
    setTitle('');
    setDescription('');
    setSenderName('');
    setSenderOrg('');
    setSenderAddress('');
    setPriority('NORMAL');
    setInstruction('Pour examen et traitement');
    setDeadlineDate('');
    setDocumentDate('');
    setHasExternalSignature(false);
    setExternalSignatoryName('');
    setExternalSignatureDate('');
    setFiles([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-kindia-blue flex items-center justify-center">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-800">Module Courriers Entrants</h2>
            <p className="text-xs text-slate-500">Réception, Numérisation, Orientation & Suivi</p>
          </div>
        </div>

        {hasPermission('incoming_mail.create') && (
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 sm:mt-0 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4 text-kindia-gold" />
            <span>Enregistrer un Courrier Entrant</span>
          </button>
        )}
      </div>

      {/* Documents Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full">
        {/* Mobile Cards Feed (block sm:hidden) */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-6 text-center text-xs text-slate-400">Chargement...</div>
          ) : documents.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Aucun courrier entrant disponible.</div>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="p-4 space-y-2 hover:bg-slate-50/80 transition">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-black text-kindia-blue bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {doc.reference}
                  </span>
                  <StatusBadge status={doc.status} />
                </div>

                <div>
                  <h4 className="font-heading font-extrabold text-xs text-slate-800 line-clamp-2">{doc.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    <strong>Expéditeur :</strong> {doc.sender_name} {doc.sender_organization ? `(${doc.sender_organization})` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    <strong>Service Destinataire :</strong> {doc.current_service_name}
                  </p>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 font-bold">
                  <PriorityBadge priority={doc.priority} />
                  <DeadlineBadge deadlineDate={doc.deadline_date} status={doc.status} />
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onSelectDocument(doc.id)}
                    className="w-full py-2 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Consulter le document</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Référence Unique</th>
                <th className="p-3.5">Titre / Objet</th>
                <th className="p-3.5">Expéditeur</th>
                <th className="p-3.5">Service Destinataire</th>
                <th className="p-3.5">Priorité</th>
                <th className="p-3.5">Échéance</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Chargement des courriers entrants...</td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Aucun courrier entrant disponible.</td>
                </tr>
              ) : (
                documents.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-bold text-kindia-blue">{doc.reference}</td>
                    <td className="p-3.5 text-slate-800 font-semibold max-w-xs truncate">{doc.title}</td>
                    <td className="p-3.5 text-slate-700">
                      {doc.sender_name} <span className="text-[10px] text-slate-400 block">{doc.sender_organization}</span>
                    </td>
                    <td className="p-3.5 text-slate-700 font-medium">{doc.current_service_name}</td>
                    <td className="p-3.5"><PriorityBadge priority={doc.priority} /></td>
                    <td className="p-3.5"><DeadlineBadge deadlineDate={doc.deadline_date} status={doc.status} /></td>
                    <td className="p-3.5"><StatusBadge status={doc.status} /></td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onSelectDocument(doc.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 font-bold rounded-lg transition inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Consulter</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registration & Digitization */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar border border-slate-200">
            <div className="bg-kindia-blue p-4 text-white flex justify-between items-center sticky top-0 z-10">
              <h3 className="font-heading font-bold text-sm">Enregistrement & Numérisation d'un Courrier Entrant</h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  {error}
                </div>
              )}

              {/* Mode de traitement selector (Rule 2) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800">Mode de traitement *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className={`flex items-start p-3 rounded-xl border cursor-pointer transition ${processingMode === 'NORMAL' ? 'bg-blue-50/80 border-kindia-blue text-kindia-blue font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    <input
                      type="radio"
                      name="processing_mode"
                      value="NORMAL"
                      checked={processingMode === 'NORMAL'}
                      onChange={() => handleProcessingModeChange('NORMAL')}
                      className="mt-0.5 mr-2"
                    />
                    <div>
                      <div>🔄 À traiter / Orienter</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">Workflow classique (Secrétariat Central ➔ SG ➔ Recteur)</div>
                    </div>
                  </label>

                  <label className={`flex items-start p-3 rounded-xl border cursor-pointer transition ${processingMode === 'DIRECT_ARCHIVE' ? 'bg-amber-50/80 border-amber-500 text-amber-900 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    <input
                      type="radio"
                      name="processing_mode"
                      value="DIRECT_ARCHIVE"
                      checked={processingMode === 'DIRECT_ARCHIVE'}
                      onChange={() => handleProcessingModeChange('DIRECT_ARCHIVE')}
                      className="mt-0.5 mr-2"
                    />
                    <div>
                      <div>📁 Document officiel à archiver directement</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">Documents déjà finalisés (Note de service, Décret, Arrêté...)</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {processingMode === 'DIRECT_ARCHIVE' ? "Type d'Acte Officiel (Archivage direct) *" : "Type de Document *"}
                  </label>
                  <select
                    value={officialType}
                    onChange={(e) => setOfficialType(e.target.value)}
                    className={`w-full text-xs p-2.5 rounded-xl border bg-white ${
                      processingMode === 'DIRECT_ARCHIVE' ? 'border-amber-400 bg-amber-50/30 font-bold text-amber-900 focus:ring-amber-500' : 'border-slate-300'
                    }`}
                  >
                    {(processingMode === 'DIRECT_ARCHIVE'
                      ? documentTypes.filter(dt => dt.allow_direct_archive === 1)
                      : documentTypes
                    ).map(dt => (
                      <option key={dt.code} value={dt.code}>
                        {dt.label} {processingMode !== 'DIRECT_ARCHIVE' && dt.allow_direct_archive ? '(Archivage direct 🗸)' : ''}
                      </option>
                    ))}
                  </select>
                  {processingMode === 'DIRECT_ARCHIVE' && (
                    <span className="text-[10px] text-amber-700 font-semibold block mt-1">
                      🗸 Acte officiel finalisé prêt pour archivage
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Titre / Objet du courrier *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={processingMode === 'DIRECT_ARCHIVE' ? "Ex: Note de service relative aux examens" : "Ex: Décret de nomination administrative"}
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date de Réception *</label>
                  <input
                    type="date"
                    value={receptionDate}
                    onChange={(e) => setReceptionDate(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date du Document (optionnel)</label>
                  <input
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {processingMode === 'DIRECT_ARCHIVE' ? (
                <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs space-y-2">
                  <div className="flex items-center text-amber-900 font-bold">
                    <span className="mr-2">📁</span> Mode : ARCHIVAGE DIRECT
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Ce document sera enregistré au Secrétariat Central en attente de vérification et d'archivage direct. Il ne sera pas transmis dans le circuit administratif normal.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Service d'enregistrement :</span>
                    <span className="font-bold text-kindia-blue bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      Secrétariat Central
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Destinataire initial :</span>
                    <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      Secrétaire Général (Automatique)
                    </span>
                  </div>
                </div>
              )}

              {/* Optional external signature section (Rule 11) */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="flex items-center text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasExternalSignature}
                    onChange={(e) => setHasExternalSignature(e.target.checked)}
                    className="mr-2 rounded text-kindia-blue focus:ring-kindia-blue"
                  />
                  ✍️ Signature officielle déjà présente sur le document ?
                </label>

                {hasExternalSignature && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nom / Titre du signataire externe</label>
                      <input
                        type="text"
                        value={externalSignatoryName}
                        onChange={(e) => setExternalSignatoryName(e.target.value)}
                        placeholder="Ex: Le Ministre / Le Gouverneur"
                        className="w-full text-xs p-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date de signature</label>
                      <input
                        type="date"
                        value={externalSignatureDate}
                        onChange={(e) => setExternalSignatureDate(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expéditeur (Nom / Organisme) *</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Ex: Ministère de l'Enseignement Supérieur"
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priorité</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value="LOW">Basse</option>
                    <option value="NORMAL">Normale</option>
                    <option value="HIGH">Haute</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date limite de traitement (Optionnel)</label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instruction initiale</label>
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              {/* Dual Digitization & File Import Options */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Numérisation & Pièces jointes (PDF, Scans)</label>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setShowScannerModal(true)}
                    className="py-3 px-4 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-2"
                  >
                    <Camera className="w-4 h-4 text-kindia-gold" />
                    <span>📷 NUMÉRISER</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowScannerModal(true)}
                    className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center space-x-2"
                  >
                    <FileUp className="w-4 h-4 text-emerald-600" />
                    <span>📁 PARCOURIR / IMPORTER</span>
                  </button>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className="border-2 border-dashed border-slate-300 hover:border-kindia-blue rounded-2xl p-4 text-center bg-slate-50 transition cursor-pointer"
                >
                  <UploadCloud className="w-6 h-6 text-kindia-blue mx-auto mb-1" />
                  <p className="text-xs text-slate-600 font-semibold">Glissez-déposez les fichiers numérisés ici</p>
                  <p className="text-[10px] text-slate-400">PDF, JPG, PNG jusqu'à 20 Mo</p>
                </div>

                {files.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {files.map((f, i) => (
                      <div key={i} className="text-xs p-2.5 bg-blue-50 text-blue-900 rounded-xl flex justify-between items-center border border-blue-100">
                        <div className="flex items-center space-x-2 truncate">
                          <File className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-semibold truncate">{f.name}</span>
                          <span className="text-[10px] text-blue-500 shrink-0">({(f.size / 1024).toFixed(1)} Ko)</span>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment({
                              file_name: f.name,
                              file_path: URL.createObjectURL(f),
                              file_size: f.size,
                              mime_type: f.type
                            })}
                            className="px-2 py-1 bg-kindia-blue text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 hover:bg-kindia-lightBlue transition"
                          >
                            <Eye className="w-3 h-3 text-kindia-gold" />
                            <span>PRÉVISUALISER</span>
                          </button>
                          <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reference Generation Pre-check */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block">Référence Officielle du document :</span>
                  {previewRef ? (
                    <span className="font-mono font-black text-xs text-kindia-blue bg-blue-100 px-2 py-0.5 rounded border border-blue-200 inline-block mt-0.5">
                      {previewRef}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Sera générée automatiquement selon le format officiel UK-GED</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleGenerateReference}
                  disabled={generatingRef}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-sm"
                >
                  <span>{generatingRef ? 'Génération...' : '⚡ Générer la référence'}</span>
                </button>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow transition"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer le courrier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Scanner / Importer Modal */}
      {showScannerModal && (
        <DigitizationScannerModal
          onClose={() => setShowScannerModal(false)}
          onAddFiles={(newFiles) => {
            setFiles(prev => [...prev, ...newFiles]);
          }}
        />
      )}

      {/* Draft Attachment Preview Modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}

      {/* Official Receipt Success Modal with QR Code (For both Normal and Direct Archive Mail) */}
      {createdReceiptData && (
        <ReceiptSuccessModal
          documentType="INCOMING_MAIL"
          reference={createdReceiptData.reference}
          receipt={createdReceiptData.receipt}
          isDirectArchive={createdReceiptData.isDirectArchive}
          officialTypeLabel={createdReceiptData.officialTypeLabel}
          documentTitle={createdReceiptData.documentTitle}
          onClose={() => setCreatedReceiptData(null)}
        />
      )}
    </div>
  );
}

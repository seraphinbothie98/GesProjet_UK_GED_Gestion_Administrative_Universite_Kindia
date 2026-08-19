import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  X, Send, CheckCircle, AlertCircle, Search, 
  Layers, Users, Clock, FileText, CheckSquare, Square, Info
} from 'lucide-react';

export default function NewDispatchModal({ initialDocument = null, onClose, onCreated }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(initialDocument?.id || '');
  const [selectedDocument, setSelectedDocument] = useState(initialDocument || null);
  
  const [services, setServices] = useState([]);
  const [recipientsMode, setRecipientsMode] = useState('ALL_SERVICES'); // 'ALL_SERVICES' | 'SELECTED_SERVICES'
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');

  const [dispatchType, setDispatchType] = useState('PRISE_DE_CONNAISSANCE'); // 'SIMPLE', 'PRISE_DE_CONNAISSANCE', 'ACTION_REQUISE'
  const [title, setTitle] = useState(initialDocument?.title ? `Diffusion : ${initialDocument.title}` : '');
  const [message, setMessage] = useState('Veuillez prendre connaissance de ce document administratif et en assurer le suivi.');
  const [actionDescription, setActionDescription] = useState('');
  const [deadline, setDeadline] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmAll, setShowConfirmAll] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load active services
      const srvData = await api.getServices();
      const activeServices = (srvData || []).filter(s => s.status === 'ACTIVE');
      setServices(activeServices);
      setSelectedServiceIds(activeServices.map(s => s.id));

      // If document not provided, load compatible documents
      if (!initialDocument) {
        const docsData = await api.getDocuments({ limit: 50 });
        setDocuments(docsData.documents || docsData || []);
      }
    } catch (err) {
      console.error('Failed to load initial data for dispatch:', err);
      setError('Impossible de charger la liste des documents ou services.');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentChange = (docId) => {
    setSelectedDocId(docId);
    const doc = documents.find(d => String(d.id) === String(docId));
    setSelectedDocument(doc || null);
    if (doc) {
      setTitle(`Diffusion : ${doc.title}`);
    }
  };

  const handleToggleService = (serviceId) => {
    setSelectedServiceIds(prev => 
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleSelectAllServices = () => {
    setSelectedServiceIds(services.map(s => s.id));
  };

  const handleDeselectAllServices = () => {
    setSelectedServiceIds([]);
  };

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(serviceSearch.toLowerCase()) || 
    s.code.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDocId) {
      setError('Veuillez sélectionner un document à diffuser.');
      return;
    }
    if (!title.trim()) {
      setError('L’objet de la diffusion est obligatoire.');
      return;
    }
    if (recipientsMode === 'SELECTED_SERVICES' && selectedServiceIds.length === 0) {
      setError('Veuillez sélectionner au moins un service destinataire.');
      return;
    }
    if (dispatchType === 'ACTION_REQUISE' && !actionDescription.trim()) {
      setError('Veuillez spécifier la description de l’action requise.');
      return;
    }

    if (recipientsMode === 'ALL_SERVICES' && !showConfirmAll) {
      setShowConfirmAll(true);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        document_id: selectedDocId,
        dispatch_type: dispatchType,
        title: title.trim(),
        message: message.trim(),
        action_description: dispatchType === 'ACTION_REQUISE' ? actionDescription.trim() : null,
        deadline: deadline || null,
        recipients_mode: recipientsMode,
        service_ids: recipientsMode === 'SELECTED_SERVICES' ? selectedServiceIds : []
      };

      const res = await api.createDispatch(payload);
      if (onCreated) onCreated(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la diffusion du document.');
    } finally {
      setSubmitting(false);
      setShowConfirmAll(false);
    }
  };

  const effectiveRecipientCount = recipientsMode === 'ALL_SERVICES' ? services.length : selectedServiceIds.length;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-kindia-blue to-slate-900 text-white p-6 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-kindia-gold text-slate-950 font-extrabold flex items-center justify-center text-lg shadow-md">
              📢
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-base text-white">
                Nouvelle Diffusion Administrative & Dispatching
              </h2>
              <p className="text-xs text-slate-300">
                Transmission multi-services sans duplication physique du document original
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ERROR NOTIFICATION */}
        {error && (
          <div className="bg-red-500 text-white text-xs font-bold px-6 py-2.5 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          
          {/* 1. DOCUMENT À DIFFUSER */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="font-heading font-extrabold text-slate-800 flex items-center text-xs">
              <FileText className="w-4 h-4 text-kindia-gold mr-1.5" />
              1. Document Original à Diffuser
            </h3>

            {initialDocument ? (
              <div className="p-3 bg-white rounded-xl border border-kindia-blue/30 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-mono font-bold text-kindia-blue bg-blue-50 px-2 py-0.5 rounded mr-2">
                    {initialDocument.reference}
                  </span>
                  <span className="font-bold text-slate-800">{initialDocument.title}</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Type : {initialDocument.document_type || 'Document Officiel'}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Document Verrouillé
                </span>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Sélectionner le document officiel *</label>
                <select
                  value={selectedDocId}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold bg-white text-slate-800"
                  required
                >
                  <option value="">-- Choisir un document dans la base --</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>
                      [{d.reference}] {d.title} ({d.document_type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. PARAMÈTRES DE DIFFUSION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Objet / Titre de la diffusion *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Diffusion Note de Service Réf. 2026/0025..."
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Type de diffusion *</label>
              <select
                value={dispatchType}
                onChange={(e) => setDispatchType(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold bg-white"
              >
                <option value="SIMPLE">ℹ️ Diffusion Simple (Information)</option>
                <option value="PRISE_DE_CONNAISSANCE">✍️ Prise de Connaissance Obligatoire</option>
                <option value="ACTION_REQUISE">⚡ Action Requise avec Échéance</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Date limite / Échéance (Optionnel)</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-700"
              />
            </div>

            {dispatchType === 'ACTION_REQUISE' && (
              <div className="col-span-2 bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-2">
                <label className="block font-bold text-amber-900">Description de l'action requise *</label>
                <textarea
                  rows={2}
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  placeholder="Décrivez précisément la tâche à accomplir par chaque service destinataire..."
                  className="w-full p-2 rounded-lg border border-amber-300 text-xs font-semibold"
                  required
                />
              </div>
            )}

            <div className="col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Message d'accompagnement aux services</label>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          {/* 3. DESTINATAIRES */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-heading font-extrabold text-slate-800 flex items-center text-xs">
                <Users className="w-4 h-4 text-kindia-gold mr-1.5" />
                3. Services Destinataires ({effectiveRecipientCount} sélectionnés)
              </h3>

              <div className="flex items-center space-x-2">
                <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientsMode"
                    value="ALL_SERVICES"
                    checked={recipientsMode === 'ALL_SERVICES'}
                    onChange={() => setRecipientsMode('ALL_SERVICES')}
                    className="text-kindia-blue"
                  />
                  <span className="font-bold text-slate-700">Tous les services</span>
                </label>
                <label className="inline-flex items-center space-x-1.5 cursor-pointer ml-3">
                  <input
                    type="radio"
                    name="recipientsMode"
                    value="SELECTED_SERVICES"
                    checked={recipientsMode === 'SELECTED_SERVICES'}
                    onChange={() => setRecipientsMode('SELECTED_SERVICES')}
                    className="text-kindia-blue"
                  />
                  <span className="font-bold text-slate-700">Sélection manuelle</span>
                </label>
              </div>
            </div>

            {recipientsMode === 'ALL_SERVICES' ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-center space-x-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>
                  Le document sera diffusé simultanément à l'ensemble des <strong>{services.length} services actifs</strong> de l'Université de Kindia.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un service..."
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      className="w-full pl-8 p-1.5 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllServices}
                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-bold"
                  >
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllServices}
                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-bold"
                  >
                    Tout désélectionner
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                  {filteredServices.map(s => {
                    const isChecked = selectedServiceIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleToggleService(s.id)}
                        className={`p-2 rounded-lg border flex items-center space-x-2 cursor-pointer transition ${
                          isChecked 
                            ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-bold' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-kindia-blue flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        )}
                        <div className="truncate">
                          <span className="text-[10px] font-mono text-slate-500 mr-1.5">[{s.code}]</span>
                          <span className="text-xs">{s.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* CONFIRMATION POPUP FOR ALL SERVICES */}
          {showConfirmAll && (
            <div className="p-4 bg-amber-500 text-slate-950 font-bold rounded-2xl space-y-2 shadow-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-slate-950 flex-shrink-0" />
                <span className="text-sm font-extrabold">Confirmation de Diffusion Générale</span>
              </div>
              <p className="text-xs text-slate-900 font-semibold">
                Ce document officiel sera immédiatement diffusé à <strong>{services.length} services administratifs et pédagogiques</strong> de l'Université de Kindia.
              </p>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmAll(false)}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-1.5 bg-slate-950 text-amber-300 hover:text-white rounded-xl text-xs font-extrabold shadow"
                >
                  {submitting ? 'Diffusion...' : 'CONFIRMER LA DIFFUSION'}
                </button>
              </div>
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
            <span className="text-[11px] text-slate-500 font-mono">
              💡 Réf. générée : <strong>DSP-UK-2026-XXXXXX</strong>
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
              >
                Fermer
              </button>
              <button
                type="submit"
                disabled={submitting || loading}
                className="px-5 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow transition flex items-center space-x-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-kindia-gold" />
                <span>{submitting ? 'Transmission en cours...' : `Diffuser à ${effectiveRecipientCount} Service(s)`}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}

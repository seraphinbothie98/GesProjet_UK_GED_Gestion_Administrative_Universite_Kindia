import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import { 
  Send, Plus, Eye, X, FileText, Building2, UserCheck, 
  ShieldCheck, AlertCircle, CheckCircle, ArrowRight, Layers 
} from 'lucide-react';

export default function OutgoingMail({ onSelectDocument }) {
  const { user, hasPermission } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [services, setServices] = useState([]);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [showSoitTransmisModal, setShowSoitTransmisModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Standard Outgoing Mail Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [contentBody, setContentBody] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [confidentiality, setConfidentiality] = useState('INTERNAL');

  // Contextual Administrative / Soit-Transmis Form (Rules 1 to 9)
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [recipientCategory, setRecipientCategory] = useState('INTERNAL'); // 'INTERNAL' | 'EXTERNAL'
  const [targetRecipientType, setTargetRecipientType] = useState('SERVICE');
  const [targetServiceId, setTargetServiceId] = useState('');
  const [targetRecipientId, setTargetRecipientId] = useState('');
  const [stRecipientName, setStRecipientName] = useState('');
  const [stObjectTitle, setStObjectTitle] = useState('');
  const [stContentBody, setStContentBody] = useState('');
  const [stPiecesJointes, setStPiecesJointes] = useState('');
  const [stShowPreview, setStShowPreview] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [docs, sData, tData] = await Promise.all([
        api.getDocuments({ type: 'OUTGOING_MAIL' }),
        api.getServices(),
        api.getAvailableTemplates()
      ]);
      setDocuments(docs || []);
      setServices(sData || []);
      setAvailableTemplates(tData || []);

      if (tData && tData.length > 0) {
        setSelectedTemplateId(tData[0].id);
      }
    } catch (err) {
      console.error('Error loading outgoing mail data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Find user originating service
  const userOriginatingService = services.find(s => Number(s.id) === Number(user?.service_id)) || {
    id: user?.service_id,
    name: user?.service_name || 'Service Émetteur',
    reference_code: user?.service_code || 'UK/SERV',
    head_first_name: user?.first_name,
    head_last_name: user?.last_name,
    function_title: user?.function_title || 'Responsable'
  };

  const handleOpenSoitTransmis = () => {
    setError('');
    setStObjectTitle('');
    setStContentBody('');
    setStPiecesJointes('');
    setRecipientCategory('INTERNAL');
    
    // Default to Rectorat / Secrétariat Général
    const sg = services.find(s => s.code === 'SG') || services[0];
    if (sg) {
      setTargetServiceId(sg.id);
      setStRecipientName(sg.name);
    }
    setShowSoitTransmisModal(true);
  };

  const handleTargetServiceChange = (sId) => {
    setTargetServiceId(sId);
    const target = services.find(s => String(s.id) === String(sId));
    if (target) {
      const headName = target.head_first_name ? `${target.head_first_name} ${target.head_last_name}` : '';
      setStRecipientName(headName ? `${target.name} (${headName})` : target.name);
    }
  };

  const handleSoitTransmisSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const finalRecipient = recipientCategory === 'INTERNAL' 
      ? stRecipientName 
      : stRecipientName;

    if (!finalRecipient || !stObjectTitle || !stContentBody) {
      setError('Veuillez remplir le destinataire, l’objet et le contenu du document.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('document_type', 'SOIT_TRANSMIS');
      formData.append('template_id', selectedTemplateId || '');
      formData.append('title', `Soit-Transmis : ${stObjectTitle}`);
      formData.append('object_title', stObjectTitle);
      formData.append('content_body', stContentBody);
      formData.append('pieces_jointes', stPiecesJointes);
      formData.append('priority', priority);
      formData.append('confidentiality', confidentiality);
      formData.append('target_recipient_type', targetRecipientType);
      formData.append('target_recipient_name', finalRecipient);
      formData.append('target_service_id', recipientCategory === 'INTERNAL' ? (targetServiceId || '') : '');
      formData.append('target_recipient_id', targetRecipientId || '');

      const res = await api.createAdministrativeDocument(formData);
      setSuccessMsg(`Document administratif créé avec succès (Réf: ${res.reference}) et transmis au Secrétaire Général.`);
      setShowSoitTransmisModal(false);
      await loadData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du document administratif.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStandardSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title || !recipientName) {
      setError('Veuillez renseigner le titre et le destinataire.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('recipient_name', recipientName);
      formData.append('recipient_address', recipientAddress);
      formData.append('content_body', contentBody);
      formData.append('priority', priority);
      formData.append('confidentiality', confidentiality);

      const res = await api.createAdministrativeDocument(formData);
      setSuccessMsg(`Courrier sortant créé avec succès (Réf: ${res.reference}).`);
      setShowModal(false);
      setTitle('');
      setDescription('');
      setRecipientName('');
      setRecipientAddress('');
      setContentBody('');
      await loadData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du courrier.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-kindia-blue to-blue-700 text-white flex items-center justify-center shadow-md">
            <Send className="w-6 h-6 text-kindia-gold" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-xl text-slate-800">
              Actes Administratifs & Courriers Sortants
            </h2>
            <p className="text-xs text-slate-500">
              Émission contextuelle par service, Soit-Transmis, numérotation automatique et transmission au SG
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenSoitTransmis}
            className="bg-kindia-gold hover:bg-yellow-400 text-kindia-blue text-xs font-black px-4 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2 border border-amber-300"
          >
            <Send className="w-4 h-4 text-kindia-blue" />
            <span>CRÉER UN SOIT-TRANSMIS</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4 text-kindia-gold" />
            <span>Autre Acte Sortant</span>
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Référence Service</th>
                <th className="p-3.5">Titre / Objet</th>
                <th className="p-3.5">Structure Émettrice</th>
                <th className="p-3.5">Destinataire</th>
                <th className="p-3.5">Priorité</th>
                <th className="p-3.5">Statut Circuit</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Chargement...</td></tr>
              ) : documents.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Aucun acte administratif sortant enregistré.</td></tr>
              ) : (
                documents.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-kindia-blue">
                      {doc.reference}
                    </td>
                    <td className="p-3.5 text-slate-800 font-semibold max-w-xs truncate">
                      {doc.title}
                    </td>
                    <td className="p-3.5 text-slate-700">
                      {doc.sender_organization || doc.current_service_name}
                    </td>
                    <td className="p-3.5 text-slate-700">
                      {doc.target_recipient_name || doc.sender_name || '—'}
                    </td>
                    <td className="p-3.5">
                      <PriorityBadge priority={doc.priority} />
                    </td>
                    <td className="p-3.5">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onSelectDocument(doc.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 font-bold rounded-lg transition inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Détails</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL : CRÉATION CONTEXTUELLE DE SOIT-TRANSMIS (RULE 6-9)*/}
      {/* ======================================================== */}
      {showSoitTransmisModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-scale-up max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-kindia-blue to-slate-800 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-kindia-gold text-kindia-blue flex items-center justify-center font-bold">
                  📨
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-white">
                    Création d’un Soit-Transmis Administratif
                  </h3>
                  <p className="text-xs text-amber-200">
                    Service émetteur : {userOriginatingService.name} (Réf : {userOriginatingService.reference_code || userOriginatingService.code})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowSoitTransmisModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSoitTransmisSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Service Context & Rule 9 Banner */}
              <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200 space-y-1 text-slate-700">
                <div className="flex items-center space-x-2 font-bold text-kindia-blue">
                  <ShieldCheck className="w-4 h-4 text-kindia-blue shrink-0" />
                  <span>Circuit Hiérarchique Impératif du Secrétaire Général (SG)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Conformément à la règle de gouvernance de l'Université de Kindia, cet acte émis par <strong>{userOriginatingService.name}</strong> portera la référence unique de votre service et sera automatiquement orienté vers le <strong>Secrétariat Général</strong> pour décision (visa direct, orientation vers le Recteur, ou instruction).
                </p>
              </div>

              {/* Step 1: Model Selection with Scopes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-kindia-blue" />
                  <span>Modèle de Document Contextuel *</span>
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                >
                  {availableTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      [{t.scope_type || 'GLOBAL'}] {t.name} {t.target_service_name ? `— Spécifique ${t.target_service_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Hierarchical Recipient Selection (Rule 7) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-heading font-extrabold text-xs text-slate-800 block">
                  Destinataire Hiérarchique
                </span>

                <div className="flex items-center space-x-4 pb-2 border-b border-slate-200">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="recip_cat"
                      value="INTERNAL"
                      checked={recipientCategory === 'INTERNAL'}
                      onChange={() => setRecipientCategory('INTERNAL')}
                      className="text-kindia-blue"
                    />
                    <span className="font-bold text-slate-800">Structure / Autorité Interne de l’Université</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="recip_cat"
                      value="EXTERNAL"
                      checked={recipientCategory === 'EXTERNAL'}
                      onChange={() => setRecipientCategory('EXTERNAL')}
                      className="text-kindia-blue"
                    />
                    <span className="font-bold text-slate-800">Destinataire Externe (Ministère, Partenaire)</span>
                  </label>
                </div>

                {recipientCategory === 'INTERNAL' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Structure ou Service Destinataire *</label>
                      <select
                        value={targetServiceId}
                        onChange={(e) => handleTargetServiceChange(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                        required
                      >
                        <option value="">— Sélectionner le service / faculté / rectorat —</option>
                        {services.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.reference_code || s.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Intitulé du Destinataire *</label>
                      <input
                        type="text"
                        value={stRecipientName}
                        onChange={(e) => setStRecipientName(e.target.value)}
                        placeholder="Ex: Secrétaire Général, Doyen Faculté des Sciences..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-kindia-blue focus:border-kindia-blue focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nom / Institution Externe Destinataire *</label>
                    <input
                      type="text"
                      value={stRecipientName}
                      onChange={(e) => setStRecipientName(e.target.value)}
                      placeholder="Ex: Ministère de l'Enseignement Supérieur, de la Recherche Scientifique..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-kindia-blue focus:border-kindia-blue focus:outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Step 3: Document Content */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Objet de la Transmission *</label>
                <input
                  type="text"
                  value={stObjectTitle}
                  onChange={(e) => setStObjectTitle(e.target.value)}
                  placeholder="Ex: Transmission des procès-verbaux de délibération des examens de Licence"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contenu / Description des Actes Transmis *</label>
                <textarea
                  rows={3}
                  value={stContentBody}
                  onChange={(e) => setStContentBody(e.target.value)}
                  placeholder="J'ai l'honneur de vous transmettre ci-joint pour examen et signature les dossiers administratifs..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pièces Jointes & Quantités</label>
                  <input
                    type="text"
                    value={stPiecesJointes}
                    onChange={(e) => setStPiecesJointes(e.target.value)}
                    placeholder="Ex: 03 Chemises cartonnées avec bordereau d'envoi"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono focus:border-kindia-blue focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Niveau d'Urgence / Priorité</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                  >
                    <option value="NORMAL">Normale</option>
                    <option value="HIGH">Urgente</option>
                    <option value="VERY_HIGH">Très Urgente / Immédiate</option>
                  </select>
                </div>
              </div>

              {/* Step 4: Live Official Preview */}
              {stShowPreview && (
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-300 space-y-3 font-mono text-[11px] text-slate-800 shadow-inner">
                  <div className="text-center font-bold text-kindia-blue whitespace-pre-line leading-tight">
                    {userOriginatingService.header_text || `RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA\n${userOriginatingService.name.toUpperCase()}`}
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-700">
                    <span>N° Réf. Unique : {userOriginatingService.reference_code || userOriginatingService.code}/2026/0001 (Attribué à la validation)</span>
                    <span>Kindia, le {new Date().toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="bg-kindia-blue text-white p-1.5 text-center rounded-lg font-bold">
                    SOIT-TRANSMIS OFFICIEL
                  </div>
                  <div><strong>Destinataire :</strong> {stRecipientName || '[Destinataire]'}</div>
                  <div><strong>Objet :</strong> {stObjectTitle || '[Objet]'}</div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 italic text-slate-600">
                    {stContentBody || '[Contenu du Soit-Transmis]'}
                  </div>
                  <div><strong>Pièces Jointes :</strong> {stPiecesJointes || 'Néant'}</div>
                  <div className="pt-2 text-right">
                    <span className="font-bold">{userOriginatingService.function_title || 'Le Responsable'} : </span>
                    <span>{userOriginatingService.head_first_name} {userOriginatingService.head_last_name}</span>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSoitTransmisModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-kindia-gold hover:bg-yellow-400 text-kindia-blue font-black rounded-xl shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <span>{submitting ? 'Génération...' : 'SOUMETTRE DANS LE WORKFLOW SG'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standard Outgoing Mail Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-kindia-blue p-5 text-white flex justify-between items-center">
              <h3 className="font-heading font-bold text-sm text-white">Rédaction d'un Courrier Sortant</h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStandardSubmit} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Titre / Objet *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Réponse à la demande d'habilitation"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-kindia-blue focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Destinataire *</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ex: Direction Nationale de l'Enseignement Supérieur"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-kindia-blue focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contenu</label>
                <textarea
                  rows={4}
                  value={contentBody}
                  onChange={(e) => setContentBody(e.target.value)}
                  placeholder="Contenu officiel..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-kindia-blue focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl">
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow transition">
                  {submitting ? 'Création...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import DocumentEditorInterface from './DocumentEditorInterface';
import { 
  X, Send, Save, FileText, Building2, User, 
  Paperclip, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react';

export default function NewAdministrativeDocumentModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();

  const [step, setStep] = useState(1); // 1: Type/Template, 2: Redaction, 3: Transmission
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Loaded data
  const [docTypes, setDocTypes] = useState([]);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [services, setServices] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [users, setUsers] = useState([]);

  // Form state
  const [selectedType, setSelectedType] = useState('SOIT_TRANSMIS');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [objectTitle, setObjectTitle] = useState('');
  const [contentBody, setContentBody] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [confidentiality, setConfidentiality] = useState('INTERNAL');
  
  // Recipient selection
  const [targetRecipientType, setTargetRecipientType] = useState('SERVICE');
  const [targetServiceId, setTargetServiceId] = useState('');
  const [targetRecipientId, setTargetRecipientId] = useState('');
  const [targetRecipientName, setTargetRecipientName] = useState('');
  
  // Attachments
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      resetForm();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [typesRes, tmplRes, servRes, hierRes, usrRes] = await Promise.all([
        api.getDocumentTypes().catch(() => []),
        api.getAvailableTemplates().catch(() => []),
        api.getServices().catch(() => []),
        api.getServiceHierarchy().catch(() => []),
        api.getUsers().catch(() => [])
      ]);

      setDocTypes(typesRes.length > 0 ? typesRes : [
        { code: 'SOIT_TRANSMIS', label: 'Soit-Transmis', description: 'Bordereau officiel de transmission' },
        { code: 'DEMANDE', label: 'Demande administrative', description: 'Demande de congé, absence ou matériel' },
        { code: 'LETTRE', label: 'Lettre officielle', description: 'Courrier officiel et correspondance' },
        { code: 'NOTE_SERVICE', label: 'Note de service', description: 'Directive et communication interne' },
        { code: 'RAPPORT', label: 'Rapport d’activité / académique', description: 'Compte-rendu et rapport annuel' },
        { code: 'PROCES_VERBAL', label: 'Procès-verbal', description: 'PV de délibération ou de réunion' },
        { code: 'DECISION', label: 'Décision rectorale / décanale', description: 'Acte réglementaire d’application' }
      ]);
      setAvailableTemplates(tmplRes);
      setServices(servRes);
      setHierarchy(hierRes);
      setUsers(usrRes);

      // Default target service is SG
      const sg = servRes.find(s => s.code === 'SG');
      if (sg) setTargetServiceId(sg.id.toString());
    } catch (err) {
      console.error('Load new doc modal data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedType('SOIT_TRANSMIS');
    setSelectedTemplateId('');
    setObjectTitle('');
    setContentBody('');
    setPriority('NORMAL');
    setConfidentiality('INTERNAL');
    setTargetRecipientType('SERVICE');
    setTargetRecipientName('');
    setFiles([]);
    setError('');
  };

  const handleTemplateSelect = (tmpl) => {
    setSelectedTemplateId(tmpl.id.toString());
    if (tmpl.header_text) {
      // populate template defaults
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (actionType = 'SUBMIT') => {
    if (!objectTitle.trim()) {
      setError('L’objet du document est obligatoire.');
      setStep(2);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('document_type', selectedType);
      formData.append('document_category', selectedType);
      if (selectedTemplateId) formData.append('template_id', selectedTemplateId);
      formData.append('title', objectTitle.trim());
      formData.append('object_title', objectTitle.trim());
      formData.append('content_body', contentBody.trim());
      formData.append('priority', priority);
      formData.append('confidentiality', confidentiality);
      formData.append('target_recipient_type', targetRecipientType);
      formData.append('target_service_id', targetServiceId || '');
      formData.append('target_recipient_id', targetRecipientId || '');
      formData.append('target_recipient_name', targetRecipientName || (services.find(s => s.id === Number(targetServiceId))?.name || 'Destinataire'));
      formData.append('action', actionType); // 'DRAFT' or 'SUBMIT'

      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      await api.createAdministrativeDocument(formData);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Submit document error:', err);
      setError(err.message || 'Erreur lors de la création du document.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentServiceObj = services.find(s => s.id === user?.service_id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-kindia-blue to-kindia-lightBlue text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-kindia-gold border border-white/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-lg">Nouveau Document Administratif</h3>
              <p className="text-xs text-slate-200">
                Structure émettrice : <strong className="text-kindia-gold">{currentServiceObj?.name || user?.service_name || 'Mon Service'}</strong>
                {currentServiceObj?.reference_code && ` (Réf: ${currentServiceObj.reference_code})`}
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

        {/* Step Indicator */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-6 text-xs font-bold">
            <button 
              onClick={() => setStep(1)}
              className={`flex items-center space-x-2 ${step === 1 ? 'text-kindia-blue font-extrabold' : 'text-slate-400'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 1 ? 'bg-kindia-blue text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
              <span>Type d'acte & Modèle</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <button 
              onClick={() => setStep(2)}
              className={`flex items-center space-x-2 ${step === 2 ? 'text-kindia-blue font-extrabold' : 'text-slate-400'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 2 ? 'bg-kindia-blue text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
              <span>Rédaction & Contenu</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <button 
              onClick={() => setStep(3)}
              className={`flex items-center space-x-2 ${step === 3 ? 'text-kindia-blue font-extrabold' : 'text-slate-400'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 3 ? 'bg-kindia-blue text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
              <span>Destinataire & Pièces</span>
            </button>
          </div>

          <span className="text-[11px] font-semibold text-slate-500">
            Étape {step} sur 3
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-lg flex items-center space-x-2 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Type and Scoped Template selection */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-3">
                  1. Choisissez le type d'acte administratif :
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {docTypes.map((dt) => {
                    const isSelected = selectedType === dt.code;
                    return (
                      <div
                        key={dt.code}
                        onClick={() => setSelectedType(dt.code)}
                        className={`p-3 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                          isSelected 
                            ? 'border-kindia-blue bg-blue-50/50 shadow-md ring-2 ring-kindia-blue/20' 
                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-slate-900">{dt.label}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-kindia-blue" />}
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2">{dt.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scoped Templates selection for this category */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  2. Modèle de mise en page disponible pour votre service :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setSelectedTemplateId('')}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      !selectedTemplateId 
                        ? 'border-kindia-gold bg-amber-50/40 font-bold text-kindia-blue' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Format Standard Automatique</span>
                      {!selectedTemplateId && <span className="text-[10px] bg-kindia-gold text-kindia-blue px-2 py-0.5 rounded-full font-bold">Actif</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Applique l'en-tête officiel de l'Université et de votre service émetteur.</p>
                  </div>

                  {availableTemplates
                    .filter(t => !t.document_category || t.document_category === selectedType || t.code.includes(selectedType))
                    .map((tmpl) => (
                      <div
                        key={tmpl.id}
                        onClick={() => handleTemplateSelect(tmpl)}
                        className={`p-3 rounded-xl border cursor-pointer transition ${
                          selectedTemplateId === tmpl.id.toString()
                            ? 'border-kindia-blue bg-blue-50/40 font-bold text-kindia-blue'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{tmpl.name}</span>
                          <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded uppercase">{tmpl.scope_type}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">{tmpl.category || 'Modèle officiel'}</p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Redaction with Editor */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Objet / Titre du document <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={objectTitle}
                  onChange={(e) => setObjectTitle(e.target.value)}
                  placeholder="Ex: Transmission des notes de Licence 3 / Demande de congé annuel..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-kindia-blue focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Corps du document et rédaction :
                </label>
                <DocumentEditorInterface
                  value={contentBody}
                  onChange={setContentBody}
                  headerText={currentServiceObj?.header_text}
                  serviceName={currentServiceObj?.name}
                  referenceCode={currentServiceObj?.reference_code ? `${currentServiceObj.reference_code}/${new Date().getFullYear()}/...` : 'RÉFÉRENCE AUTOMATIQUE'}
                  recipientName={targetRecipientName || (services.find(s => s.id === Number(targetServiceId))?.name || 'Destinataire')}
                  objectTitle={objectTitle}
                />
              </div>
            </div>
          )}

          {/* STEP 3: Recipient, Priorities & Attachments */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Recipient Selection */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-kindia-blue" />
                  <span>Destinataire Hiérarchique & Règle Administrative</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Structure ou Service Destinataire
                    </label>
                    <select
                      value={targetServiceId}
                      onChange={(e) => {
                        setTargetServiceId(e.target.value);
                        const s = services.find(srv => srv.id === Number(e.target.value));
                        if (s) setTargetRecipientName(s.name);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-kindia-blue outline-hidden"
                    >
                      <option value="">Sélectionnez un service destinataire...</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || s.reference_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nom / Titre officiel du Destinataire
                    </label>
                    <input
                      type="text"
                      value={targetRecipientName}
                      onChange={(e) => setTargetRecipientName(e.target.value)}
                      placeholder="Ex: Monsieur le Doyen de la Faculté des Sciences / Recteur"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-kindia-blue outline-hidden"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Règle Impérative de l'Administration Centrale :</strong> Tout acte administratif transmis à l'attention du Rectorat ou de l'administration centrale sera automatiquement orienté par le <strong>Secrétaire Général (SG)</strong> avant signature finale.
                  </div>
                </div>
              </div>

              {/* Priority and Confidentiality */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priorité</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-hidden"
                  >
                    <option value="LOW">Basse</option>
                    <option value="NORMAL">Normale</option>
                    <option value="HIGH">Haute</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confidentialité</label>
                  <select
                    value={confidentiality}
                    onChange={(e) => setConfidentiality(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-hidden"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="INTERNAL">Interne</option>
                    <option value="RESTRICTED">Restreint</option>
                    <option value="CONFIDENTIAL">Confidentiel</option>
                  </select>
                </div>
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pièces jointes justificatives</span>
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50"
                />
                {files.length > 0 && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                    ✓ {files.length} fichier(s) joint(s)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 2 && !objectTitle.trim()) {
                    setError('L’objet du document est obligatoire avant de continuer.');
                    return;
                  }
                  setError('');
                  setStep(step + 1);
                }}
                className="px-5 py-2.5 bg-kindia-blue text-white hover:bg-kindia-lightBlue rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5"
              >
                <span>Suivant</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSubmit('DRAFT')}
                  className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-slate-500" />
                  <span>Enregistrer comme brouillon</span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSubmit('SUBMIT')}
                  className="px-5 py-2.5 bg-kindia-gold text-kindia-blue hover:bg-amber-400 rounded-xl text-xs font-black shadow-md transition flex items-center space-x-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>{loading ? 'Soumission en cours...' : 'Soumettre & Transmettre'}</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

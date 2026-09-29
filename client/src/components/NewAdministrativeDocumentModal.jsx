import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import DocumentEditorInterface from './DocumentEditorInterface';
import { 
  X, Send, Save, FileText, Building2, User, 
  Paperclip, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Sparkles,
  Plus, Upload, FileUp, Tag, Calendar, Layers, HelpCircle, Eye, RefreshCw, FileCode
} from 'lucide-react';
import { formatFullName } from '../utils/userUtils';

export default function NewAdministrativeDocumentModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();

  const [step, setStep] = useState(1); // 1: Select/Import Template, 2: Redaction & Content, 3: Transmission
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Loaded data
  const [docTypes, setDocTypes] = useState([]);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [services, setServices] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [users, setUsers] = useState([]);
  const [serviceCustomFields, setServiceCustomFields] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState({});

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState(null); // template object or null (blank)
  const [isDraftingBlank, setIsDraftingBlank] = useState(false);
  const [selectedType, setSelectedType] = useState('SOIT_TRANSMIS');
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

  // Modal State for New/Import Template (Rule 4, 6, 7)
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [newTemplateMode, setNewTemplateMode] = useState('IMPORT'); // 'IMPORT' | 'CREATE'
  const [newTemplateFile, setNewTemplateFile] = useState(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplateDocType, setNewTemplateDocType] = useState('SOIT_TRANSMIS');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [newTemplateSaving, setNewTemplateSaving] = useState(false);
  const [extractingFile, setExtractingFile] = useState(false);
  const [extractSuccessMsg, setExtractSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      resetForm();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [typesRes, tmplRes, servRes, hierRes, usrRes, cfRes] = await Promise.all([
        api.getCreatableDocumentTypes().catch(() => []),
        api.getAvailableTemplates().catch(() => []),
        api.getServices().catch(() => []),
        api.getServiceHierarchy().catch(() => []),
        api.getUsers().catch(() => []),
        api.getServiceCustomFields(user?.service_id).catch(() => ({ custom_fields: [] }))
      ]);

      const loadedTypes = typesRes && typesRes.length > 0 ? typesRes : [
        { code: 'SOIT_TRANSMIS', label: 'Soit-Transmis', description: 'Bordereau officiel de transmission' },
        { code: 'DEMANDE', label: 'Demande administrative', description: 'Demande de congé, absence ou matériel' },
        { code: 'LETTRE', label: 'Lettre officielle', description: 'Courrier officiel et correspondance' },
        { code: 'NOTE_SERVICE', label: 'Note de service', description: 'Directive et communication interne' },
        { code: 'RAPPORT', label: 'Rapport d’activité / académique', description: 'Compte-rendu et rapport annuel' },
        { code: 'PROCES_VERBAL', label: 'Procès-verbal', description: 'PV de délibération ou de réunion' },
        { code: 'ATTESTATION', label: 'Attestation', description: 'Attestation administrative et de présence' },
        { code: 'CONVOCATION', label: 'Convocation', description: 'Convocation aux réunions et commissions' }
      ];

      setDocTypes(loadedTypes);
      if (loadedTypes.length > 0 && !loadedTypes.some(t => t.code === selectedType)) {
        setSelectedType(loadedTypes[0].code);
      }
      setAvailableTemplates(tmplRes || []);
      setServices(servRes || []);
      setHierarchy(hierRes || []);
      setUsers(usrRes || []);

      const customFieldsList = cfRes.custom_fields || [];
      setServiceCustomFields(customFieldsList);
      
      const initialCustomValues = {};
      customFieldsList.forEach(cf => {
        initialCustomValues[cf.variable_code] = cf.default_value || '';
      });
      setCustomFieldValues(initialCustomValues);

      // Default target service is SG
      const sg = servRes?.find(s => s.code === 'SG');
      if (sg) setTargetServiceId(sg.id.toString());
    } catch (err) {
      console.error('Load new doc modal data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedTemplate(null);
    setIsDraftingBlank(false);
    setSelectedType('SOIT_TRANSMIS');
    setObjectTitle('');
    setContentBody('');
    setPriority('NORMAL');
    setConfidentiality('INTERNAL');
    setTargetRecipientType('SERVICE');
    setTargetRecipientName('');
    setFiles([]);
    setError('');
    setShowAddTemplateModal(false);
  };

  // Helper to replace dynamic variables (Rule 12 & 13)
  const replaceDynamicVariables = (text, customContext = {}) => {
    if (!text) return '';
    const now = new Date();
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const formattedDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    
    const context = {
      '{{REFERENCE}}': customContext.reference || `${now.getFullYear()}/[NUM]/MESRSI/UK/${user?.service_code || 'SRV'}`,
      '{{DATE}}': customContext.date || formattedDate,
      '{{SERVICE}}': user?.service_name || 'Service Administratif',
      '{{FACULTE}}': user?.academic_structure || 'Université de Kindia',
      '{{DEPARTEMENT}}': user?.service_name || '',
      '{{DESTINATAIRE}}': targetRecipientName || 'Monsieur le Secrétaire Général',
      '{{OBJET}}': objectTitle || '[Objet du document]',
      '{{RESPONSABLE}}': formatFullName(user, 'Responsable'),
      '{{FONCTION_RESPONSABLE}}': user?.function_title || user?.role_name || 'Responsable',
      '{{ANNEE}}': String(now.getFullYear())
    };

    let result = text;
    for (const [key, val] of Object.entries(context)) {
      const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
      result = result.replace(regex, val || '');
    }

    // Replace custom service variables (Rules 9, 10, 11)
    for (const [key, val] of Object.entries(customFieldValues)) {
      const regex1 = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const regex2 = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex1, val || '').replace(regex2, val || '');
    }

    return result;
  };

  // Select an existing template (Rule 5)
  const handleSelectTemplate = (tmpl) => {
    setSelectedTemplate(tmpl);
    setIsDraftingBlank(false);
    setSelectedType(tmpl.document_type_code || tmpl.document_category || 'SOIT_TRANSMIS');
  };

  // Choose Blank drafting mode
  const handleSelectBlank = (typeCode = 'SOIT_TRANSMIS') => {
    setSelectedTemplate(null);
    setIsDraftingBlank(true);
    setSelectedType(typeCode);
  };

  // Proceed to Step 2 : Redaction & Content (Rule 5 & 14)
  const handleProceedToRedaction = () => {
    if (!selectedTemplate && !isDraftingBlank) {
      setError('Veuillez sélectionner un modèle ou choisir de rédiger un document vierge.');
      return;
    }
    setError('');

    if (selectedTemplate) {
      const initialHtml = selectedTemplate.content_body_html || `<p>${selectedTemplate.name}</p>`;
      setContentBody(replaceDynamicVariables(initialHtml));
      if (!objectTitle) {
        setObjectTitle(selectedTemplate.name);
      }
    } else {
      setContentBody('');
    }

    setStep(2);
  };

  // File Upload Extraction Handler for Templates (Rule 4 & 6)
  const handleTemplateFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNewTemplateFile(file);
    setExtractSuccessMsg('');
    setError('');

    try {
      setExtractingFile(true);
      const formData = new FormData();
      formData.append('template_file', file);

      const res = await api.extractTemplateFileContent(formData);
      if (res.suggested_name && !newTemplateName) {
        setNewTemplateName(res.suggested_name);
      }
      setNewTemplateContent(res.extracted_html || '');
      setExtractSuccessMsg(`Contenu extrait avec succès (${res.format} - ${(res.size / 1024).toFixed(1)} Ko).`);
    } catch (err) {
      console.error('File extraction error:', err);
      setError("Impossible d'extraire automatiquement le contenu : " + err.message);
    } finally {
      setExtractingFile(false);
    }
  };

  // Save new custom template for service (Rule 4, 6, 11)
  const handleSaveCustomTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError('Le nom du modèle est obligatoire.');
      return;
    }

    try {
      setNewTemplateSaving(true);
      setError('');

      const formData = new FormData();
      formData.append('name', newTemplateName.trim());
      formData.append('description', newTemplateDesc.trim());
      formData.append('document_type_code', newTemplateDocType);
      formData.append('category', newTemplateDocType);
      formData.append('scope_type', 'SERVICE');
      formData.append('target_service_id', user?.service_id || '');
      formData.append('content_body_html', newTemplateContent);
      formData.append('editor_type', 'UK_GED_EDITOR');
      
      if (newTemplateFile) {
        formData.append('template_file', newTemplateFile);
      }

      const res = await api.createCustomTemplate(formData);
      const createdTmpl = res.template || { 
        id: res.id || Date.now(), 
        name: newTemplateName.trim(), 
        document_type_code: newTemplateDocType,
        content_body_html: newTemplateContent 
      };

      // Reload available templates
      const updatedList = await api.getAvailableTemplates().catch(() => []);
      setAvailableTemplates(updatedList);

      // Automatically select newly created template
      setSelectedTemplate(createdTmpl);
      setIsDraftingBlank(false);
      setSelectedType(newTemplateDocType);

      // Close submodal
      setShowAddTemplateModal(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
      setNewTemplateFile(null);
      setNewTemplateContent('');
      setExtractSuccessMsg('');

      // Move directly to redaction
      const resolvedHtml = replaceDynamicVariables(newTemplateContent);
      setContentBody(resolvedHtml);
      setObjectTitle(newTemplateName.trim());
      setStep(2);

    } catch (err) {
      console.error('Save template error:', err);
      setError('Erreur lors de l’enregistrement du modèle : ' + err.message);
    } finally {
      setNewTemplateSaving(false);
    }
  };

  // Final document submission (Step 3)
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
      if (selectedTemplate?.id) formData.append('template_id', selectedTemplate.id);
      formData.append('title', objectTitle.trim());
      formData.append('object_title', objectTitle.trim());
      formData.append('content_body', contentBody.trim());
      formData.append('priority', priority);
      formData.append('confidentiality', confidentiality);
      formData.append('target_recipient_type', targetRecipientType);
      formData.append('target_service_id', targetServiceId || '');
      formData.append('target_recipient_id', targetRecipientId || '');
      formData.append('target_recipient_name', targetRecipientName || (services.find(s => s.id === Number(targetServiceId))?.name || 'Destinataire'));
      formData.append('custom_values', JSON.stringify(customFieldValues));
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

  // Helper toolbar to insert dynamic variable tags into editor
  const insertVariableTag = (tag) => {
    setContentBody(prev => prev + ` ${tag} `);
  };

  if (!isOpen) return null;

  const currentServiceObj = services.find(s => s.id === user?.service_id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-kindia-blue via-kindia-lightBlue to-kindia-blue text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-kindia-gold border border-white/20 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-lg">Nouveau Document Administratif</h3>
              <p className="text-xs text-slate-200">
                Service émetteur : <strong className="text-kindia-gold">{currentServiceObj?.name || user?.service_name || 'Mon Service'}</strong>
                {currentServiceObj?.reference_code && ` (Code : ${currentServiceObj.reference_code})`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-4 text-xs font-bold">
            <span className={`flex items-center space-x-1.5 ${step === 1 ? 'text-kindia-blue font-black' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-kindia-blue text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
              <span>Type d'acte & Modèle</span>
            </span>
            <span className="text-slate-300">/</span>
            <span className={`flex items-center space-x-1.5 ${step === 2 ? 'text-kindia-blue font-black' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-kindia-blue text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
              <span>Rédaction & Champs</span>
            </span>
            <span className="text-slate-300">/</span>
            <span className={`flex items-center space-x-1.5 ${step === 3 ? 'text-kindia-blue font-black' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-kindia-blue text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
              <span>Destinataire & Pièces</span>
            </span>
          </div>

          <span className="text-[11px] text-slate-400 font-medium">Étape {step} sur 3</span>
        </div>

        {error && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-rose-800 text-xs font-bold">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-900">✕</button>
          </div>
        )}

        {/* Modal Body with Multi-Step Flow */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* ========================================================================= */}
          {/* STEP 1: TYPE D'ACTE AUTORISÉ & MODÈLES (RULES 1, 2, 3, 5, 8, 9, 10, 11)     */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="space-y-6">
              
              {/* Section 1: Choix du Type de Document Autorisé */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-2xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-kindia-blue bg-blue-100/70 px-2.5 py-0.5 rounded-full">
                      Étape 1.1 • Type d'acte administratif
                    </span>
                    <h4 className="font-heading font-extrabold text-base text-slate-900 mt-1">
                      Sélectionnez le type de document à produire
                    </h4>
                    <p className="text-xs text-slate-500">
                      Types autorisés pour votre service (<strong className="text-slate-700">{currentServiceObj?.name || 'Votre service'}</strong>) et votre rôle (<strong className="text-slate-700">{user?.role_name || user?.role_code}</strong>).
                    </p>
                  </div>

                  <div className="shrink-0">
                    <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                      {docTypes.length} type(s) autorisé(s)
                    </span>
                  </div>
                </div>

                {/* Types Chips Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-2">
                  {docTypes.map(dt => {
                    const isTypeSelected = selectedType === dt.code;
                    return (
                      <button
                        key={dt.code}
                        type="button"
                        onClick={() => {
                          setSelectedType(dt.code);
                          setSelectedTemplate(null);
                          setIsDraftingBlank(false);
                        }}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                          isTypeSelected
                            ? 'bg-kindia-blue text-white border-kindia-blue shadow-md ring-2 ring-kindia-blue/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="font-heading font-black text-xs leading-snug">
                            {dt.label}
                          </span>
                          {isTypeSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />}
                        </div>
                        {dt.description && (
                          <span className={`text-[10px] line-clamp-1 ${isTypeSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {dt.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Choix du Mode de Conception pour ce Type */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                      Étape 1.2 • Mode de rédaction
                    </span>
                    <h4 className="font-heading font-extrabold text-base text-slate-900 mt-1">
                      Comment souhaitez-vous concevoir ce document ?
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Option A: Modèle Existant */}
                  <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 flex flex-col justify-between hover:border-kindia-blue/50 transition">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="w-7 h-7 rounded-xl bg-blue-100 text-kindia-blue font-black text-xs flex items-center justify-center">A</span>
                        <h5 className="font-heading font-extrabold text-xs text-slate-900">Modèle Officiel par Défaut</h5>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Modèle actif configuré par l'Administrateur pour <strong>{docTypes.find(d => d.code === selectedType)?.label || selectedType}</strong>.
                      </p>
                    </div>

                    {(() => {
                      const defaultTpl = availableTemplates.find(
                        t => (t.document_type_code === selectedType || t.document_category === selectedType || t.code === selectedType || t.category === selectedType)
                             && t.is_active === 1 
                             && t.is_default === 1
                      );

                      if (!defaultTpl) {
                        return (
                          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-1">
                            <span className="text-[11px] font-bold text-amber-800 block">
                              « Aucun modèle par défaut n'est configuré pour ce type de document. »
                            </span>
                            <span className="text-[10px] text-amber-700/80 block">
                              Utilisez les options B ou C ci-contre pour importer un fichier Word ou rédiger directement.
                            </span>
                          </div>
                        );
                      }

                      const isSelected = selectedTemplate?.id === defaultTpl.id;
                      return (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => handleSelectTemplate(defaultTpl)}
                            className={`w-full p-3 rounded-2xl border text-left text-xs font-bold transition flex items-center justify-between ${
                              isSelected
                                ? 'border-kindia-blue bg-blue-50/90 text-kindia-blue shadow-md ring-2 ring-kindia-blue/20'
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="font-black text-slate-900 block truncate">📄 {defaultTpl.name}</span>
                              <span className="text-[10px] text-kindia-blue font-mono">v{defaultTpl.version || 1} • Modèle officiel actif</span>
                            </div>
                            {isSelected ? (
                              <CheckCircle2 className="w-5 h-5 text-kindia-blue shrink-0" />
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] text-slate-500 font-bold">Sélectionner</span>
                            )}
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Option B: Importer un modèle Word (.docx) */}
                  <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 flex flex-col justify-between hover:border-emerald-500/50 transition">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">B</span>
                        <h5 className="font-heading font-extrabold text-xs text-slate-900">Importer un modèle Word</h5>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Chargez un fichier <strong>.docx</strong> officiel pour l'ajouter à la bibliothèque de votre service.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setNewTemplateDocType(selectedType);
                        setShowAddTemplateModal(true);
                      }}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition flex items-center justify-center space-x-2 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Importer un fichier .docx</span>
                    </button>
                  </div>

                  {/* Option C: Créer directement (Document Vierge) */}
                  <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 flex flex-col justify-between hover:border-indigo-500/50 transition">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">C</span>
                        <h5 className="font-heading font-extrabold text-xs text-slate-900">Créer Directement</h5>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Rédigez directement avec l'éditeur intégré ou ONLYOFFICE avec la charte officielle de l'Université.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectBlank(selectedType)}
                      className={`w-full py-2.5 px-3 rounded-2xl text-xs font-black transition flex items-center justify-center space-x-2 cursor-pointer ${
                        isDraftingBlank
                          ? 'bg-kindia-blue text-white shadow-md'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {isDraftingBlank && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      <span>{isDraftingBlank ? 'Sélectionné Vierge' : 'Rédiger Directement'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Button to Step 2 */}
              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={handleProceedToRedaction}
                  disabled={!selectedTemplate && !isDraftingBlank}
                  className="px-6 py-2.5 bg-kindia-blue hover:bg-blue-800 disabled:opacity-40 text-white rounded-2xl text-xs font-black transition flex items-center space-x-2 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <span>Suivant (Rédaction & Contenu)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: RÉDACTION & CONTENU (RULES 5, 10, 11, 12, 13)                      */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="space-y-5">
              
              {/* Top Context & Type Selector */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Objet / Titre officiel du document <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={objectTitle}
                    onChange={(e) => setObjectTitle(e.target.value)}
                    placeholder="Ex: Transmission des procès-verbaux de délibération L3 Informatique..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-kindia-blue outline-hidden shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Type d'acte officiel associé :
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-kindia-blue focus:ring-2 focus:ring-kindia-blue outline-hidden shadow-xs cursor-pointer"
                  >
                    {docTypes.map(dt => (
                      <option key={dt.code} value={dt.code}>
                        {dt.label} ({dt.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Service Custom Fields Input Section (Rules 10, 11) */}
              {serviceCustomFields.filter(f => f.applies_to_document !== 0 || f.applies_to_reference !== 0).length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                    <span className="flex items-center space-x-1.5">
                      <Tag className="w-4 h-4 text-amber-700" />
                      <span>Champs dynamiques propres à votre service ({currentServiceObj?.name || 'Mon Service'}) :</span>
                    </span>
                    <span className="text-[10px] text-amber-700 font-normal">
                      Renseignés ici et injectés automatiquement dans la référence et le document
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {serviceCustomFields.filter(f => f.applies_to_document !== 0 || f.applies_to_reference !== 0).map(cf => (
                      <div key={cf.id} className="space-y-1">
                        <label className="block text-[11px] font-bold text-amber-950">
                          {cf.name} {cf.is_required ? <span className="text-rose-500">*</span> : ''}
                          <span className="text-[10px] text-amber-600 font-mono ml-1 font-normal">({`{{${cf.variable_code}}}`})</span>
                        </label>
                        
                        {cf.field_type === 'SELECT' ? (
                          <select
                            value={customFieldValues[cf.variable_code] || ''}
                            onChange={(e) => setCustomFieldValues({
                              ...customFieldValues,
                              [cf.variable_code]: e.target.value
                            })}
                            className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                          >
                            <option value="">Sélectionner une option...</option>
                            {(cf.options || []).map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : cf.field_type === 'DATE' ? (
                          <input
                            type="date"
                            value={customFieldValues[cf.variable_code] || ''}
                            onChange={(e) => setCustomFieldValues({
                              ...customFieldValues,
                              [cf.variable_code]: e.target.value
                            })}
                            className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                          />
                        ) : cf.field_type === 'NUMBER' ? (
                          <input
                            type="number"
                            value={customFieldValues[cf.variable_code] || ''}
                            onChange={(e) => setCustomFieldValues({
                              ...customFieldValues,
                              [cf.variable_code]: e.target.value
                            })}
                            placeholder={cf.default_value || '0'}
                            className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                          />
                        ) : (
                          <input
                            type="text"
                            value={customFieldValues[cf.variable_code] || ''}
                            onChange={(e) => setCustomFieldValues({
                              ...customFieldValues,
                              [cf.variable_code]: e.target.value
                            })}
                            placeholder={cf.default_value || `Valeur pour ${cf.name}`}
                            className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                          />
                        )}
                        {cf.description && <p className="text-[9px] text-amber-700">{cf.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Variables Helper Toolbar (Rule 12 & Custom Tags) */}
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-kindia-blue">
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>Variables dynamiques disponibles (remplacées automatiquement) :</span>
                  </span>
                </div>
                
                {/* System variables */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '{{REFERENCE}}', '{{DATE}}', '{{SERVICE}}', '{{FACULTE}}', 
                    '{{DESTINATAIRE}}', '{{OBJET}}', '{{RESPONSABLE}}', '{{FONCTION_RESPONSABLE}}', '{{ANNEE}}'
                  ].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariableTag(v)}
                      className="px-2 py-1 bg-white hover:bg-kindia-blue hover:text-white border border-blue-200 text-kindia-blue rounded-lg text-[10px] font-mono font-bold transition shadow-2xs"
                      title={`Insérer la variable ${v}`}
                    >
                      + {v}
                    </button>
                  ))}
                  
                  {/* Service custom variables */}
                  {serviceCustomFields.map(cf => (
                    <button
                      key={cf.id}
                      type="button"
                      onClick={() => insertVariableTag(`{{${cf.variable_code}}}`)}
                      className="px-2 py-1 bg-amber-50 hover:bg-kindia-gold hover:text-kindia-blue border border-amber-200 text-amber-900 rounded-lg text-[10px] font-mono font-bold transition shadow-2xs"
                      title={`Insérer la variable personnalisée {{${cf.variable_code}}}`}
                    >
                      + {`{{${cf.variable_code}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rich Document Editor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Corps du document et contenu rédigé :
                </label>
                <DocumentEditorInterface
                  value={contentBody}
                  onChange={(val) => setContentBody(val)}
                  placeholder="Rédigez ou adaptez le contenu de votre document officiel..."
                  documentType={selectedType}
                  serviceName={user?.service_name || 'Université de Kindia'}
                />
              </div>

              {/* Navigation buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour aux modèles</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!objectTitle.trim()) {
                      setError('Veuillez renseigner l’objet du document.');
                      return;
                    }
                    setError('');
                    setStep(3);
                  }}
                  className="px-6 py-2.5 bg-kindia-blue hover:bg-blue-800 text-white rounded-xl text-xs font-black transition flex items-center space-x-2 shadow-md"
                >
                  <span>Suivant (Destinataire & Pièces)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: DESTINATAIRE & TRANSMISSION (RULE 14)                             */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Destination Service / Authority */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-kindia-blue" />
                    <span>Destinataire du document</span>
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Type de destinataire :
                    </label>
                    <select
                      value={targetRecipientType}
                      onChange={(e) => setTargetRecipientType(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    >
                      <option value="SERVICE">Structure Administrative / Service Interne</option>
                      <option value="USER">Agent / Utilisateur Spécifique</option>
                      <option value="EXTERNAL">Destinataire Externe (Ministère, Partenaire...)</option>
                    </select>
                  </div>

                  {targetRecipientType === 'SERVICE' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sélectionner le service destinataire :
                      </label>
                      <select
                        value={targetServiceId}
                        onChange={(e) => {
                          setTargetServiceId(e.target.value);
                          const s = services.find(srv => String(srv.id) === String(e.target.value));
                          if (s) setTargetRecipientName(s.name);
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                      >
                        <option value="">-- Choisir une structure --</option>
                        {services.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code || s.reference_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {targetRecipientType === 'USER' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sélectionner l'agent :
                      </label>
                      <select
                        value={targetRecipientId}
                        onChange={(e) => {
                          setTargetRecipientId(e.target.value);
                          const u = users.find(usr => String(usr.id) === String(e.target.value));
                          if (u) setTargetRecipientName(formatFullName(u));
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                      >
                        <option value="">-- Choisir un utilisateur --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {formatFullName(u)} ({u.service_name || u.role_name})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {targetRecipientType === 'EXTERNAL' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nom de l'entité / du destinataire externe :
                      </label>
                      <input
                        type="text"
                        value={targetRecipientName}
                        onChange={(e) => setTargetRecipientName(e.target.value)}
                        placeholder="Ex: Ministère de l'Enseignement Supérieur..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                      />
                    </div>
                  )}

                  {/* Priority & Confidentiality */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Priorité :</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-hidden"
                      >
                        <option value="NORMAL">Normale</option>
                        <option value="URGENT">Urgente</option>
                        <option value="VERY_URGENT">Très urgente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Confidentialité :</label>
                      <select
                        value={confidentiality}
                        onChange={(e) => setConfidentiality(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-hidden"
                      >
                        <option value="INTERNAL">Interne</option>
                        <option value="CONFIDENTIAL">Confidentiel</option>
                        <option value="PUBLIC">Public</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Attachments / Pièces jointes */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                    <Paperclip className="w-4 h-4 text-kindia-blue" />
                    <span>Pièces jointes & Documents annexes</span>
                  </h4>

                  <div className="border-2 border-dashed border-slate-200 hover:border-kindia-blue rounded-2xl p-4 text-center bg-white cursor-pointer transition relative">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setFiles(prev => [...prev, ...Array.from(e.target.files)]);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    <span className="text-xs font-bold text-slate-700 block">Cliquez ou déposez vos fichiers</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">PDF, Word, Excel, Images jusqu'à 50 Mo</span>
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {files.map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs">
                          <span className="truncate max-w-[200px] font-medium text-slate-700">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour à la rédaction</span>
                </button>

                <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleSubmit('DRAFT')}
                    disabled={loading}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs"
                  >
                    <Save className="w-4 h-4 text-slate-500" />
                    <span>Enregistrer brouillon</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit('SUBMIT')}
                    disabled={loading}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-kindia-blue to-blue-800 hover:from-blue-800 hover:to-kindia-blue text-white rounded-xl text-xs font-black transition flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <Send className="w-4 h-4 text-kindia-gold" />
                    <span>Soumettre & Transmettre</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUBMODAL: AJOUTER / IMPORTER UN MODÈLE DE SERVICE (RULES 4, 6, 7, 11)       */}
      {/* ========================================================================= */}
      {showAddTemplateModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
            
            <div className="px-6 py-4 bg-kindia-blue text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Plus className="w-5 h-5 text-kindia-gold" />
                <h4 className="font-heading font-black text-base">
                  {newTemplateMode === 'IMPORT' ? 'Importer un modèle externe' : 'Créer un modèle personnalisé'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTemplateModal(false)}
                className="p-1.5 text-white/80 hover:text-white rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Mode Toggle */}
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setNewTemplateMode('IMPORT')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    newTemplateMode === 'IMPORT' ? 'bg-white text-kindia-blue shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📁 Importer un fichier (.docx, .odt...)
                </button>
                <button
                  type="button"
                  onClick={() => setNewTemplateMode('CREATE')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    newTemplateMode === 'CREATE' ? 'bg-white text-kindia-blue shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✍️ Rédiger depuis zéro
                </button>
              </div>

              {/* Import File Area */}
              {newTemplateMode === 'IMPORT' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Fichier modèle à importer :
                  </label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-kindia-blue rounded-2xl p-5 text-center bg-slate-50 relative cursor-pointer">
                    <input
                      type="file"
                      accept=".docx,.doc,.odt,.pdf,.txt,.html"
                      onChange={handleTemplateFileSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <FileUp className="w-8 h-8 text-kindia-blue mx-auto mb-2" />
                    <span className="text-xs font-black text-slate-800 block">
                      {newTemplateFile ? newTemplateFile.name : 'Sélectionnez votre fichier modèle (.docx, .odt...)'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Formats recommandés : Microsoft Word (.docx), OpenDocument (.odt), Text (.txt)
                    </span>
                  </div>

                  {extractingFile && (
                    <div className="text-xs text-kindia-blue flex items-center space-x-2 font-bold py-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyse et extraction automatique du contenu en cours...</span>
                    </div>
                  )}

                  {extractSuccessMsg && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg font-bold flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{extractSuccessMsg}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Template Metadata */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom du modèle <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Ex: Lettre de demande informatique / Rapport de mission..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Type d'acte officiel associé :
                    </label>
                    <select
                      value={newTemplateDocType}
                      onChange={(e) => setNewTemplateDocType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    >
                      {docTypes.map(dt => (
                        <option key={dt.code} value={dt.code}>
                          {dt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Rattachement structure :
                    </label>
                    <input
                      type="text"
                      disabled
                      value={user?.service_name || 'Mon Service'}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description ou usage (optionnel) :
                  </label>
                  <input
                    type="text"
                    value={newTemplateDesc}
                    onChange={(e) => setNewTemplateDesc(e.target.value)}
                    placeholder="Ex: Modèle officiel pour les demandes de matériel et fournitures..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Submodal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setShowAddTemplateModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleSaveCustomTemplate}
                disabled={newTemplateSaving || !newTemplateName.trim()}
                className="px-5 py-2 bg-kindia-blue hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-md"
              >
                {newTemplateSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-kindia-gold" />
                )}
                <span>Enregistrer pour mon service</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

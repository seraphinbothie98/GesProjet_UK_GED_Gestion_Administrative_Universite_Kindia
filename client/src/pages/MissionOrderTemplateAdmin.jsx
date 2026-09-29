import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileCheck, Upload, Eye, RefreshCw, Power, CheckCircle, 
  AlertCircle, Download, FileText, Clock, ShieldCheck, 
  Copy, Image as ImageIcon, Sliders, Star, Sparkles, 
  Check, X, ExternalLink, HelpCircle, History, Layers, Trash2
} from 'lucide-react';
import * as docx from 'docx-preview';
import PdfTemplateEditorModal from '../components/PdfTemplateEditorModal';

export default function MissionOrderTemplateAdmin() {
  const { user } = useAuth();
  const isAdmin = user?.role_code === 'ADMINISTRATEUR' || user?.role_code === 'ADMIN';

  // Core Data
  const [templateData, setTemplateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Modals state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showWordModal, setShowWordModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showPdfStudioModal, setShowPdfStudioModal] = useState(false);
  const [pdfStudioTemplate, setPdfStudioTemplate] = useState(null);
  const [versionToDelete, setVersionToDelete] = useState(null);
  const [deletingVersion, setDeletingVersion] = useState(false);

  // Replacement / New version form state
  const [replaceFile, setReplaceFile] = useState(null);
  const [replaceName, setReplaceName] = useState('Ordre de mission officiel');
  const [replaceAnalysis, setReplaceAnalysis] = useState(null);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [submittingVersion, setSubmittingVersion] = useState(false);
  const [replaceModalError, setReplaceModalError] = useState('');

  // Word Revision Fallback form state
  const [wordFile, setWordFile] = useState(null);
  const [submittingWordRevision, setSubmittingWordRevision] = useState(false);
  const [wordProtocolTriggered, setWordProtocolTriggered] = useState(false);

  // Branding / Watermark state
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.15);
  const [watermarkSize, setWatermarkSize] = useState(60);
  const [watermarkPosition, setWatermarkPosition] = useState('CENTER');
  const [savingWatermark, setSavingWatermark] = useState(false);

  // Document Format Engine by default (WORD_DOCX vs DIRECT_PDF)
  const [defaultFormat, setDefaultFormat] = useState('WORD_DOCX');
  const [savingFormat, setSavingFormat] = useState(false);

  // Hidden File Inputs Refs
  const logoInputRef = useRef(null);
  const watermarkInputRef = useRef(null);
  const previewDocxContainerRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getOfficialMissionTemplate();
      setTemplateData(data);

      if (data?.default_document_format) {
        setDefaultFormat(data.default_document_format);
      }

      if (data?.branding) {
        setWatermarkEnabled(Boolean(data.branding.watermark_enabled));
        setWatermarkOpacity(Number(data.branding.watermark_opacity ?? 0.15));
        setWatermarkSize(Number(data.branding.watermark_size ?? 60));
        setWatermarkPosition(data.branding.watermark_position || 'CENTER');
      }
      if (data?.template?.name) {
        setReplaceName(data.template.name);
      }
    } catch (err) {
      console.error('Failed to load mission template data:', err);
      setError(err.message || 'Erreur lors du chargement de la configuration du modèle.');
    } finally {
      setLoading(false);
    }
  };

  // Change default document format
  const handleFormatChange = async (newFormat) => {
    setDefaultFormat(newFormat);
    setSavingFormat(true);
    setError('');
    setMessage('');
    try {
      const res = await api.updateMissionDefaultFormat(newFormat);
      setMessage(res.message || 'Format par défaut mis à jour avec succès.');
    } catch (err) {
      setError(err.message || 'Erreur lors de la mise à jour du format par défaut.');
    } finally {
      setSavingFormat(false);
    }
  };

  // Copy helper
  const handleCopyField = (tag) => {
    navigator.clipboard.writeText(`{{${tag}}}`);
    setCopiedField(tag);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Preview Modal Handler
  const handleOpenPreview = async (version = null) => {
    const target = version || templateData?.template;
    if (!target) return;
    setPreviewVersion(target);
    setShowPreviewModal(true);
    setPreviewLoading(true);

    setTimeout(async () => {
      if (previewDocxContainerRef.current) {
        try {
          const blob = await api.fetchMissionTemplateBlob(target.id);
          previewDocxContainerRef.current.innerHTML = '';
          await docx.renderAsync(blob, previewDocxContainerRef.current, null, {
            className: 'docx-rendered-page',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false
          });
        } catch (renderErr) {
          console.warn('Docx preview fallback render note:', renderErr);
        } finally {
          setPreviewLoading(false);
        }
      } else {
        setPreviewLoading(false);
      }
    }, 150);
  };

  // Set Default Version
  const handleSetDefault = async (versionId) => {
    setError('');
    setMessage('');
    try {
      const res = await api.setDefaultMissionTemplateVersion(versionId);
      setMessage(res.message);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la définition du modèle par défaut.');
    }
  };

  // Delete Template Version
  const handleDeleteVersion = async () => {
    if (!versionToDelete) return;
    setDeletingVersion(true);
    setError('');
    setMessage('');
    try {
      const res = await api.deleteMissionTemplateVersion(versionToDelete.id);
      setMessage(res.message || `Version ${versionToDelete.version_number} supprimée avec succès.`);
      setVersionToDelete(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la suppression de la version.');
    } finally {
      setDeletingVersion(false);
    }
  };

  // Toggle Template Status
  const handleToggleStatus = async (id) => {
    setError('');
    setMessage('');
    try {
      const res = await api.toggleOfficialMissionTemplateStatus(id);
      setMessage(res.message);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors du changement de statut.');
    }
  };

  // Direct Word Launch & Fallback
  const handleOpenInWord = async () => {
    setShowWordModal(true);
    setWordProtocolTriggered(false);
    try {
      const protocolData = await api.getWordProtocolUri();
      if (protocolData?.wordProtocolUri) {
        window.location.href = protocolData.wordProtocolUri;
        setWordProtocolTriggered(true);
      }
    } catch (err) {
      console.log('Direct protocol launch note:', err.message);
    }
  };

  // Word Revision Upload
  const handleWordRevisionSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!wordFile) {
      setError('Veuillez sélectionner le fichier modifié.');
      return;
    }

    setSubmittingWordRevision(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('template_file', wordFile);

      const res = await api.uploadMissionTemplateRevision(formData);
      setMessage(res.message);
      setWordFile(null);
      setShowWordModal(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’enregistrement de la révision.');
    } finally {
      setSubmittingWordRevision(false);
    }
  };

  // Analyze Replace File on Selection
  const handleReplaceFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReplaceFile(file);
      setAnalyzingFile(true);
      setReplaceAnalysis(null);

      try {
        const formData = new FormData();
        formData.append('template_file', file);
        const analysis = await api.analyzeMissionTemplateDocx(formData);
        setReplaceAnalysis(analysis);
      } catch (err) {
        console.warn('Field analysis notice:', err);
      } finally {
        setAnalyzingFile(false);
      }
    }
  };

  // Confirm Model Replacement
  const handleReplaceSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!replaceFile) return;

    setSubmittingVersion(true);
    setReplaceModalError('');
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('template_file', replaceFile);
      formData.append('name', replaceName || 'Ordre de mission officiel');
      formData.append('document_format', defaultFormat || 'DIRECT_PDF');

      const res = await api.uploadOfficialMissionTemplate(formData);
      setMessage(res.message);
      setReplaceFile(null);
      setReplaceAnalysis(null);
      setReplaceModalError('');
      setShowReplaceModal(false);
      await loadData();
    } catch (err) {
      setReplaceModalError(err.message || 'Erreur lors de l’importation du modèle.');
      setError(err.message || 'Erreur lors de l’importation du modèle.');
    } finally {
      setSubmittingVersion(false);
    }
  };

  // Logo Upload Handler
  const handleLogoUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('logo_file', file);

      setError('');
      setMessage('');
      try {
        const res = await api.uploadMissionLogo(formData);
        setMessage(res.message);
        await loadData();
      } catch (err) {
        setError(err.message || 'Erreur lors du téléversement du logo officiel.');
      }
    }
  };

  // Watermark Image Upload Handler
  const handleWatermarkUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('watermark_file', file);

      setError('');
      setMessage('');
      try {
        const res = await api.uploadMissionWatermark(formData);
        setMessage(res.message);
        await loadData();
      } catch (err) {
        setError(err.message || 'Erreur lors du téléversement du filigrane.');
      }
    }
  };

  // Watermark Settings Save
  const handleSaveWatermarkSettings = async () => {
    setSavingWatermark(true);
    setError('');
    setMessage('');
    try {
      const res = await api.updateMissionWatermarkSettings({
        enabled: watermarkEnabled,
        opacity: watermarkOpacity,
        size: watermarkSize,
        position: watermarkPosition
      });
      setMessage(res.message);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’enregistrement des paramètres du filigrane.');
    } finally {
      setSavingWatermark(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center bg-white rounded-2xl border border-red-200 shadow-sm space-y-3">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="font-heading font-bold text-base text-slate-800">Accès Réservé à l'Administrateur</h3>
        <p className="text-xs text-slate-500">
          La gestion du modèle officiel d’ordre de mission est strictement réservée à l'administrateur du système.
        </p>
      </div>
    );
  }

  const currentTemplate = templateData?.template;
  const versions = templateData?.versions || [];
  const branding = templateData?.branding || {};
  const DEFAULT_OFFICIAL_FIELDS = [
    'reference', 'titre_grade', 'grade', 'titre', 'nom', 'prenoms', 'nationalite', 'fonction', 'service', 
    'matricule', 'destination', 'objet_mission', 'moyen_transport', 
    'date_depart', 'date_retour', 'chauffeur', 'date_document', 
    'lieu_document', 'nom_secretaire_general',
    'qr_code', 'cachet_officiel', 'signature_sg'
  ];
  const availableFields = (templateData?.availableFields && templateData.availableFields.length > 0)
    ? templateData.availableFields
    : DEFAULT_OFFICIAL_FIELDS;
  const fieldAnalysis = templateData?.fieldAnalysis || { detected: [], known: [], unknown: [] };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Hidden File Inputs for Brand Assets */}
      <input 
        type="file" 
        ref={logoInputRef} 
        onChange={handleLogoUpload} 
        accept=".png,.jpg,.jpeg,.webp,.svg" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={watermarkInputRef} 
        onChange={handleWatermarkUpload} 
        accept=".png,.jpg,.jpeg,.webp,.svg" 
        className="hidden" 
      />

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-kindia-blue text-kindia-gold flex items-center justify-center font-bold shadow-md shadow-kindia-blue/20 shrink-0">
            <FileCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-heading font-black text-xl text-slate-800 tracking-tight">
              ORDRE DE MISSION
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Administration & Configuration du Modèle Officiel • Université de Kindia
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {currentTemplate && (
            <button
              onClick={() => { setReplaceFile(null); setReplaceAnalysis(null); setShowReplaceModal(true); }}
              className="px-4 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5"
            >
              <Upload className="w-4 h-4 text-kindia-gold" />
              <span>Remplacer le modèle</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-800 text-xs font-bold rounded-2xl border border-red-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 0. FORMAT DU DOCUMENT & MOTEUR DE SIGNATURE PAR DÉFAUT */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-heading font-black text-sm text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-kindia-blue" />
              <span>FORMAT DU DOCUMENT & MOTEUR DE SIGNATURE PAR DÉFAUT</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Définissez le format appliqué par défaut lors de la création et du traitement des ordres de mission.
            </p>
          </div>
          {savingFormat && (
            <span className="text-[11px] font-bold text-kindia-blue flex items-center gap-1.5 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enregistrement...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label 
            onClick={() => handleFormatChange('WORD_DOCX')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3.5 ${
              defaultFormat === 'WORD_DOCX'
                ? 'border-kindia-blue bg-blue-50/40 shadow-sm ring-1 ring-kindia-blue'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="defaultMissionFormat"
              value="WORD_DOCX"
              checked={defaultFormat === 'WORD_DOCX'}
              onChange={() => handleFormatChange('WORD_DOCX')}
              className="mt-1 text-kindia-blue"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-slate-900">
                  📝 Modèle Word (DOCX) Officiel
                </span>
                {defaultFormat === 'WORD_DOCX' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-kindia-blue text-white">Par défaut</span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 block leading-relaxed">
                Modèle Word dynamique • Remplacement des balises & Conversion bureautique complète haute fidélité
              </span>
            </div>
          </label>

          <label 
            onClick={() => handleFormatChange('DIRECT_PDF')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3.5 ${
              defaultFormat === 'DIRECT_PDF'
                ? 'border-emerald-600 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-600'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="defaultMissionFormat"
              value="DIRECT_PDF"
              checked={defaultFormat === 'DIRECT_PDF'}
              onChange={() => handleFormatChange('DIRECT_PDF')}
              className="mt-1 text-emerald-600"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-slate-900">
                  ⚡ Format PDF Direct (Haute Vitesse)
                </span>
                {defaultFormat === 'DIRECT_PDF' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">Par défaut</span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 block leading-relaxed">
                Document PDF optimisé • Signature et scellement vectoriel instantané directement dans le PDF (&lt; 1s)
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. MODÈLE ACTUELLEMENT UTILISÉ CARD */}
      {/* ========================================================================= */}
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
        defaultFormat === 'DIRECT_PDF' ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'
      }`}>
        <div className={`px-6 py-4 border-b flex justify-between items-center transition-colors ${
          defaultFormat === 'DIRECT_PDF' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center space-x-2">
            {defaultFormat === 'DIRECT_PDF' ? (
              <Sparkles className="w-4 h-4 text-emerald-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-kindia-blue" />
            )}
            <span className={defaultFormat === 'DIRECT_PDF' ? 'text-emerald-900' : 'text-slate-800'}>
              MODÈLE ACTUELLEMENT UTILISÉ ({defaultFormat === 'DIRECT_PDF' ? 'FORMAT PDF DIRECT' : 'FORMAT WORD DOCX'})
            </span>
          </span>

          {currentTemplate && (
            <div className="flex items-center space-x-2">
              {defaultFormat === 'DIRECT_PDF' ? (
                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center space-x-1 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>PDF DIRECT ACTIF</span>
                </span>
              ) : (
                currentTemplate.is_default === 1 && (
                  <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1 shadow-sm">
                    <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                    <span>PAR DÉFAUT</span>
                  </span>
                )
              )}

              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center space-x-1 ${
                currentTemplate.status === 'ACTIVE'
                  ? (defaultFormat === 'DIRECT_PDF' ? 'bg-emerald-200/80 text-emerald-900 border border-emerald-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300')
                  : 'bg-slate-200 text-slate-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${currentTemplate.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span>{currentTemplate.status === 'ACTIVE' ? 'Actif' : 'Inactif'}</span>
              </span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-kindia-blue" />
              <span>Chargement du modèle officiel...</span>
            </div>
          ) : !currentTemplate ? (
            /* Empty State */
            <div className="py-12 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400 border border-slate-200">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-slate-800 text-base">Aucun modèle officiel n'est encore configuré.</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Importez le document officiel Word (.docx) ou PDF (.pdf) pour initialiser le modèle de l'Ordre de mission de l'Université de Kindia.
                </p>
              </div>
              <button
                onClick={() => { setReplaceFile(null); setReplaceAnalysis(null); setShowReplaceModal(true); }}
                className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-extrabold text-xs rounded-xl shadow transition inline-flex items-center space-x-2"
              >
                <Upload className="w-4 h-4 text-kindia-gold" />
                <span>Importer le modèle officiel</span>
              </button>
            </div>
          ) : (
            /* Configured Template Card */
            <div className="space-y-6">
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl border text-xs ${
                defaultFormat === 'DIRECT_PDF' ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="space-y-3">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Nom du document maître :</span>
                    <strong className="text-slate-900 text-sm font-bold font-mono block mt-0.5 flex items-center gap-2">
                      <span>
                        {defaultFormat === 'DIRECT_PDF' 
                          ? (currentTemplate.file_name || currentTemplate.name).replace(/\.docx$/i, '.pdf')
                          : (currentTemplate.file_name || currentTemplate.name)}
                      </span>
                      {defaultFormat === 'DIRECT_PDF' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Format PDF
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          Format Word DOCX
                        </span>
                      )}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Moteur & Traitement :</span>
                    <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs mt-0.5 shadow-sm ${
                      defaultFormat === 'DIRECT_PDF'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono'
                        : 'bg-indigo-100 text-indigo-900 font-mono'
                    }`}>
                      {defaultFormat === 'DIRECT_PDF'
                        ? '⚡ PDF Vectoriel Scellé • Signature Instantanée (< 1s)'
                        : `Version ${currentTemplate.version_number || 1} (Modèle Word OpenXML)`}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">ID du modèle :</span>
                    <span className="font-mono font-bold text-slate-700 text-xs mt-0.5 block">
                      #{currentTemplate.id}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Statut :</span>
                    <span className="font-bold text-slate-800 flex items-center space-x-1.5 mt-0.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${defaultFormat === 'DIRECT_PDF' ? 'bg-emerald-500' : (currentTemplate.is_default === 1 ? 'bg-amber-500' : 'bg-emerald-500')}`} />
                      <span>{defaultFormat === 'DIRECT_PDF' ? 'Actif (Format PDF Direct)' : (currentTemplate.is_default === 1 ? 'Par défaut (Word DOCX)' : 'Actif')}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Date de création :</span>
                    <span className="text-slate-700 font-medium flex items-center space-x-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(currentTemplate.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Dernière révision :</span>
                    <span className="text-slate-700 font-medium flex items-center space-x-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(currentTemplate.updated_at || currentTemplate.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => handleOpenPreview()}
                  className={`px-4 py-2.5 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm ${
                    defaultFormat === 'DIRECT_PDF' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-kindia-blue hover:bg-kindia-lightBlue'
                  }`}
                >
                  <Eye className="w-4 h-4 text-kindia-gold" />
                  <span>Aperçu {defaultFormat === 'DIRECT_PDF' ? 'du Modèle PDF' : 'du Modèle'}</span>
                </button>

                <button
                  onClick={() => {
                    setPdfStudioTemplate(currentTemplate);
                    setShowPdfStudioModal(true);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm"
                  title="Ouvrir le studio interactif de configuration et positionnement des zones PDF"
                >
                  <Sliders className="w-4 h-4 text-emerald-200" />
                  <span>Studio Graphique Zones PDF</span>
                </button>

                {defaultFormat === 'WORD_DOCX' ? (
                  <button
                    onClick={handleOpenInWord}
                    className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm"
                    title="Ouvrir et modifier le document dans Microsoft Word sur votre ordinateur"
                  >
                    <ExternalLink className="w-4 h-4 text-blue-200" />
                    <span>Modifier dans Microsoft Word</span>
                  </button>
                ) : (
                  <button
                    onClick={() => api.downloadOfficialMissionTemplate(currentTemplate.id, (currentTemplate.file_name || 'modele_om.pdf').replace(/\.docx$/i, '.pdf'))}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm"
                    title="Télécharger une copie du modèle PDF"
                  >
                    <Download className="w-4 h-4 text-emerald-100" />
                    <span>Télécharger le modèle PDF</span>
                  </button>
                )}

                <button
                  onClick={() => { setReplaceFile(null); setReplaceAnalysis(null); setShowReplaceModal(true); }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>Remplacer le modèle</span>
                </button>

                {currentTemplate.is_default !== 1 && defaultFormat === 'WORD_DOCX' && (
                  <button
                    onClick={() => handleSetDefault(currentTemplate.id)}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm"
                  >
                    <Star className="w-4 h-4 fill-white" />
                    <span>Définir par défaut</span>
                  </button>
                )}

                <button
                  onClick={() => handleToggleStatus(currentTemplate.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm ${
                    currentTemplate.status === 'ACTIVE'
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span>{currentTemplate.status === 'ACTIVE' ? 'Désactiver' : 'Activer'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. IDENTITÉ VISUELLE (LOGO & FILIGRANE) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center space-x-2">
          <ImageIcon className="w-4 h-4 text-kindia-blue" />
          <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-slate-700">
            IDENTITÉ VISUELLE OFFICIELLE
          </h3>
        </div>

        <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Logo Officiel Card */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-heading font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                  LOGO OFFICIEL DE L'UNIVERSITÉ
                </h4>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                  Format Original Préservé
                </span>
              </div>

              <div className="h-36 bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-center shadow-inner relative overflow-hidden">
                {branding.logo_path ? (
                  <img 
                    src={branding.logo_path} 
                    alt="Logo Officiel Kindia" 
                    className="max-h-full max-w-full object-contain" 
                  />
                ) : (
                  <span className="text-xs text-slate-400">Aucun logo configuré</span>
                )}
              </div>

              <div className="text-[11px] text-slate-500 space-y-1">
                <p><strong>Fichier :</strong> {branding.logo_path ? branding.logo_path.split('/').pop() : 'logo_univ_kindia.png'}</p>
                <p className="text-[10px] text-slate-400">Formats acceptés : PNG, JPG, JPEG, WEBP, SVG</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => logoInputRef.current?.click()}
                className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center space-x-1.5"
              >
                <Upload className="w-4 h-4 text-kindia-blue" />
                <span>{branding.logo_path ? 'Remplacer le logo officiel' : 'Importer le logo officiel'}</span>
              </button>
            </div>
          </div>

          {/* Filigrane Card & Settings */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-heading font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                  IMAGE DU FILIGRANE
                </h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  watermarkEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {watermarkEnabled ? '● Activé' : '○ Désactivé'}
                </span>
              </div>

              <div className="h-36 bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-center shadow-inner relative overflow-hidden">
                {branding.watermark_path ? (
                  <img 
                    src={branding.watermark_path} 
                    alt="Filigrane Officiel" 
                    style={{ 
                      opacity: watermarkEnabled ? watermarkOpacity : 0.05,
                      transform: `scale(${watermarkSize / 100})`
                    }}
                    className="max-h-full max-w-full object-contain transition-all" 
                  />
                ) : (
                  <span className="text-xs text-slate-400">Aucun filigrane configuré</span>
                )}
              </div>

              {/* Watermark Live Parameters Controls */}
              <div className="space-y-3 pt-1 text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 text-[11px]">Filigrane actif :</label>
                  <button
                    onClick={() => setWatermarkEnabled(!watermarkEnabled)}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] transition ${
                      watermarkEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    {watermarkEnabled ? 'Activé' : 'Désactivé'}
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Opacité :</span>
                    <strong className="font-mono text-kindia-blue">{Math.round(watermarkOpacity * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.80"
                    step="0.05"
                    value={watermarkOpacity}
                    onChange={e => setWatermarkOpacity(parseFloat(e.target.value))}
                    className="w-full accent-kindia-blue cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Taille :</span>
                    <strong className="font-mono text-kindia-blue">{watermarkSize}%</strong>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    step="5"
                    value={watermarkSize}
                    onChange={e => setWatermarkSize(parseInt(e.target.value))}
                    className="w-full accent-kindia-blue cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => watermarkInputRef.current?.click()}
                className="flex-1 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center space-x-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>{branding.watermark_path ? 'Remplacer l’image' : 'Importer filigrane'}</span>
              </button>

              <button
                onClick={handleSaveWatermarkSettings}
                disabled={savingWatermark}
                className="py-2 px-4 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <Sliders className="w-3.5 h-3.5 text-kindia-gold" />
                <span>{savingWatermark ? 'Enregistrement...' : 'Enregistrer réglages'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CHAMPS DYNAMIQUES */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-kindia-blue" />
            <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-slate-700">
              CHAMPS DYNAMIQUES DISPONIBLES & DÉTECTÉS
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Cliquez sur un champ pour copier sa balise
          </span>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Detected vs Unknown Analysis Panel */}
          {fieldAnalysis.detected && fieldAnalysis.detected.length > 0 && (
            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>CHAMPS DÉTECTÉS DANS LE MODÈLE DOCX ({fieldAnalysis.detected.length})</span>
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {fieldAnalysis.known.map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 shadow-sm">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>{`{{${tag}}}`}</span>
                  </span>
                ))}

                {fieldAnalysis.unknown.map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 shadow-sm" title="Champ personnalisé ou non standard trouvé dans le document">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <span>{`{{${tag}}}`} (personnalisé)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Available Fields Reference Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              LISTE DES CHAMPS OFFICIELS DISPONIBLES
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableFields.map(field => {
                const tag = `{{${field}}}`;
                const isCopied = copiedField === field;
                const isDetected = fieldAnalysis.known.includes(field);

                const getFieldLabel = (f) => {
                  if (f === 'titre_grade' || f === 'grade_titre') return 'Titre / Grade';
                  if (f === 'grade') return 'Grade (Titre)';
                  if (f === 'titre') return 'Titre (Grade)';
                  if (f === 'nom_secretaire_general') return 'Secrétaire Général';
                  if (f === 'cachet_officiel') return 'Cachet Officiel';
                  if (f === 'signature_sg') return 'Signature SG';
                  return f.replace(/_/g, ' ');
                };

                return (
                  <div 
                    key={field}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between hover:border-kindia-blue/40 transition group"
                  >
                    <div className="overflow-hidden pr-2">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase truncate">
                        {getFieldLabel(field)}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-800 block truncate">
                        {tag}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      {isDetected && (
                        <span className="text-emerald-600 mr-1" title="Présent dans le DOCX">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <button
                        onClick={() => handleCopyField(field)}
                        className={`p-1.5 rounded-lg text-xs font-bold transition ${
                          isCopied 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-kindia-blue hover:text-white'
                        }`}
                        title="Copier la balise"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. HISTORIQUE DES VERSIONS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-kindia-blue" />
            <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-slate-700">
              VERSIONS DU MODÈLE OFFICIEL ({versions.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Une seule version active par défaut
          </span>
        </div>

        <div className="p-6 md:p-8">
          {versions.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">Aucune version enregistrée.</p>
          ) : (
            <div className="space-y-3">
              {versions.map((ver) => {
                const isDef = ver.is_default === 1;

                return (
                  <div
                    key={ver.id}
                    className={`p-4 rounded-2xl border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                      isDef 
                        ? 'bg-amber-50/40 border-amber-300 shadow-sm' 
                        : 'bg-slate-50 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start space-x-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        isDef ? 'bg-kindia-blue text-kindia-gold' : 'bg-slate-200 text-slate-700'
                      }`}>
                        v{ver.version_number || 1}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <strong className="text-slate-900 text-xs font-bold">
                            Version {ver.version_number || 1} — {ver.name}
                          </strong>
                          {isDef && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 flex items-center space-x-1">
                              <Star className="w-3 h-3 fill-amber-700" />
                              <span>PAR DÉFAUT</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 font-mono">
                          {ver.file_name || ver.file_path} • {ver.file_type || 'DOCX'}
                        </p>

                        <p className="text-[10px] text-slate-400 flex items-center space-x-2 pt-0.5">
                          <span>Modifiée par : <strong>{ver.author_name || 'Administrateur'}</strong></span>
                          <span>•</span>
                          <span>{new Date(ver.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                      <button
                        onClick={() => {
                          setPdfStudioTemplate(ver);
                          setShowPdfStudioModal(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
                        title="Configurer les coordonnées des zones PDF"
                      >
                        <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Zones PDF</span>
                      </button>

                      <button
                        onClick={() => handleOpenPreview(ver)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
                        title="Aperçu de cette version"
                      >
                        <Eye className="w-3.5 h-3.5 text-kindia-blue" />
                        <span>Aperçu</span>
                      </button>

                      <button
                        onClick={() => api.downloadOfficialMissionTemplate(ver.id, ver.file_name)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
                        title="Télécharger ce fichier"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-600" />
                        <span>Télécharger</span>
                      </button>

                      {!isDef && (
                        <button
                          onClick={() => handleSetDefault(ver.id)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
                          title="Définir cette version comme modèle officiel par défaut"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>Définir par défaut</span>
                        </button>
                      )}

                      {versions.length > 1 && (
                        <button
                          onClick={() => setVersionToDelete(ver)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
                          title="Supprimer cette version du modèle"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PDF TEMPLATE VISUAL STUDIO MODAL */}
      {/* ========================================================================= */}
      {showPdfStudioModal && (
        <PdfTemplateEditorModal
          isOpen={showPdfStudioModal}
          onClose={() => setShowPdfStudioModal(false)}
          template={pdfStudioTemplate || currentTemplate}
          onSaveSuccess={loadData}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 0: CONFIRMATION DE SUPPRESSION DE VERSION */}
      {/* ========================================================================= */}
      {versionToDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-heading font-extrabold text-base text-slate-800">
                Supprimer la Version {versionToDelete.version_number || 1} ?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Êtes-vous sûr de vouloir supprimer définitivement cette version du modèle (<strong>{versionToDelete.file_name || versionToDelete.name}</strong>) ?
              </p>
              {versionToDelete.is_default === 1 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] font-medium text-left">
                  ⚠️ <strong>Attention :</strong> Cette version est actuellement définie par défaut. Si vous la supprimez, la version restante la plus récente sera automatiquement promue comme modèle par défaut.
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setVersionToDelete(null)}
                disabled={deletingVersion}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteVersion}
                disabled={deletingVersion}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingVersion ? 'Suppression...' : 'Confirmer la suppression'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: APERÇU DU MODÈLE HAUTE-FIDÉLITÉ */}
      {/* ========================================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <Eye className="w-5 h-5 text-kindia-blue" />
                <h3 className="font-heading font-extrabold text-sm text-slate-800">
                  Aperçu du Modèle Officiel • Version {previewVersion?.version_number || 1}
                </h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Fermer l'aperçu ✕
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-100/70 relative">
              {/* Official Document Simulated Preview Canvas */}
              <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-2xl p-8 md:p-12 border border-slate-300 min-h-[600px] relative overflow-hidden">
                {/* Watermark Overlay in Preview */}
                {watermarkEnabled && branding.watermark_path && (
                  <div 
                    className="absolute inset-0 pointer-events-none flex items-center justify-center z-0"
                    style={{
                      opacity: watermarkOpacity,
                      transform: `scale(${watermarkSize / 100})`
                    }}
                  >
                    <img 
                      src={branding.watermark_path} 
                      alt="Filigrane" 
                      className="max-w-full max-h-full object-contain" 
                    />
                  </div>
                )}

                {/* Document Header with Logo */}
                <div className="relative z-10 space-y-6">
                  <div className="flex items-start justify-between border-b pb-4">
                    <div className="text-[11px] font-heading font-bold text-slate-800 leading-tight space-y-0.5">
                      <p className="uppercase text-[9px] text-slate-500">RÉPUBLIQUE DE GUINÉE</p>
                      <p className="text-[8px] text-slate-400">Travail - Justice - Solidarité</p>
                      <p className="pt-2 text-kindia-blue font-extrabold">MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR</p>
                      <p className="font-black text-slate-900">UNIVERSITÉ DE KINDIA</p>
                    </div>

                    {branding.logo_path && (
                      <div className="w-16 h-16 shrink-0">
                        <img 
                          src={branding.logo_path} 
                          alt="Logo Kindia" 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-center py-2">
                    <h2 className="font-heading font-black text-lg tracking-wider text-kindia-blue uppercase underline underline-offset-4">
                      ORDRE DE MISSION
                    </h2>
                    <p className="text-xs font-mono font-bold text-slate-600 mt-1">
                      N° : 2026/0124/MESRSI/UK/RECT/SG
                    </p>
                  </div>

                  {/* Document Body */}
                  <div className="text-xs text-slate-800 space-y-4 leading-relaxed">
                    <p>
                      Il est ordonné à : <strong className="text-kindia-blue font-bold">M. Dr. Alpha Oumar DIALLO</strong>
                    </p>

                    <div className="grid grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200 text-[11px]">
                      <div>
                        <span className="text-slate-400 block font-medium">Nationalité :</span>
                        <strong>Guinéenne</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Fonction / Titre :</span>
                        <strong>Enseignant-Chercheur</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Service d'attache :</span>
                        <strong>Département Informatique</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Matricule :</span>
                        <strong>198442X</strong>
                      </div>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <p><strong>De se rendre à :</strong> Conakry (Direction Générale de la Recherche)</p>
                      <p><strong>Objet de la mission :</strong> Participation à la conférence nationale sur la numérisation universitaire.</p>
                      <p><strong>Moyen de transport :</strong> Véhicule de service (Immatriculation VA-4421-GN)</p>
                      <p><strong>Dates :</strong> Du 20 Septembre 2026 au 25 Septembre 2026</p>
                    </div>

                    <div className="pt-8 flex justify-between items-end text-[11px]">
                      <div>
                        <p className="text-slate-400">Fait à Kindia, le 15 Septembre 2026</p>
                      </div>
                      <div className="text-center space-y-1">
                        <p className="font-bold">Le Secrétaire Général</p>
                        <p className="text-[10px] text-slate-500">Dr. Mamadou Billo DOUMBOUYA</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Render container for docx-preview if file loaded */}
                <div ref={previewDocxContainerRef} className="hidden" />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                Prévisualisation avec les ressources configurées (Logo & Filigrane).
              </span>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2 bg-kindia-blue text-white font-bold rounded-xl shadow transition"
              >
                Fermer l'aperçu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MICROSOFT WORD INTÉGRATION & PARCOURS FALLBACK */}
      {/* ========================================================================= */}
      {showWordModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ExternalLink className="w-5 h-5 text-blue-700" />
                <h3 className="font-heading font-extrabold text-base text-slate-800">
                  Modifier le Modèle dans Microsoft Word
                </h3>
              </div>
              <button
                onClick={() => setShowWordModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {wordProtocolTriggered && (
                <div className="p-3 bg-blue-50 text-blue-900 rounded-xl border border-blue-200 text-xs flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Tentative d'ouverture directe dans Microsoft Word lancée.</span>
                </div>
              )}

              <p className="text-slate-600">
                Vous pouvez personnaliser librement le document officiel dans Microsoft Word (polices, tableaux, couleurs, marges, alignements). Suivez les étapes ci-dessous :
              </p>

              {/* Step by step Fallback Workflow */}
              <div className="space-y-3">
                {/* Step 1 */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 block">1. Télécharger le fichier source</span>
                    <span className="text-[11px] text-slate-500">Téléchargez le fichier DOCX officiel sur votre ordinateur</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => api.downloadOfficialMissionTemplate(currentTemplate?.id, currentTemplate?.file_name)}
                    className="px-3.5 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>Télécharger (.docx)</span>
                  </button>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800 block">2. Personnaliser dans Microsoft Word</span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Ouvrez le fichier dans Word, effectuez vos ajustements en conservant les balises souhaitées (ex: <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 font-bold text-kindia-blue">{`{{nom}}`}</code>), puis enregistrez le document.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">3. Importer la version modifiée</span>
                  <input
                    type="file"
                    accept=".docx"
                    onChange={e => setWordFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-700 file:text-white hover:file:bg-blue-800"
                  />
                  {wordFile && (
                    <span className="text-emerald-700 font-bold block text-[11px]">
                      ✓ Fichier sélectionné : {wordFile.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowWordModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={!wordFile || submittingWordRevision}
                  onClick={handleWordRevisionSubmit}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingWordRevision ? 'Validation en cours...' : `Valider et Créer la Version ${(currentTemplate?.version_number || 1) + 1}`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REMPLACEMENT & DÉTECTION DES CHAMPS */}
      {/* ========================================================================= */}
      {showReplaceModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-5 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-heading font-extrabold text-base text-slate-800 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-kindia-blue" />
                <span>{currentTemplate ? 'Remplacer le modèle officiel' : 'Importer le modèle officiel'}</span>
              </h3>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReplaceSubmit} className="space-y-4 text-xs">
              {replaceModalError && (
                <div className="p-3 bg-red-50 text-red-800 text-xs font-bold rounded-xl border border-red-200 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{replaceModalError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nom du modèle *</label>
                <input
                  type="text"
                  value={replaceName}
                  onChange={e => setReplaceName(e.target.value)}
                  placeholder="Ex : Ordre de mission officiel"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Fichier modèle Word (.docx) ou PDF (.pdf) *</label>
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50 space-y-2">
                  <input
                    type="file"
                    accept=".docx,.doc,.pdf"
                    onChange={handleReplaceFileChange}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue"
                    required
                  />
                  <p className="text-[10px] text-slate-400">
                    Formats supportés : Word (.docx) ou PDF officiel (.pdf) • Taille max : 25 MB
                  </p>
                </div>
              </div>

              {/* Instant Dynamic Field Analysis in modal */}
              {analyzingFile && (
                <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-xl flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Analyse automatique du document...</span>
                </div>
              )}

              {replaceAnalysis && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">
                    Champs dynamiques ({replaceAnalysis.detectedFields?.length || 0}) :
                  </span>
                  {replaceAnalysis.detectedFields?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {replaceAnalysis.knownFields?.map(f => (
                        <span key={f} className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-mono text-[10px] font-bold">
                          ✓ {`{{${f}}}`}
                        </span>
                      ))}
                      {replaceAnalysis.unknownFields?.map(f => (
                        <span key={f} className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-mono text-[10px] font-bold" title="Champ personnalisé">
                          ⚠ {`{{${f}}}`}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-blue-50 text-blue-900 rounded-lg text-xs leading-relaxed border border-blue-200 flex items-start space-x-2">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>
                        Aucun champ dynamique détecté automatiquement. Vous pouvez placer manuellement les champs depuis le <strong>Studio graphique → Zone PDF</strong> après validation.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <span className="font-bold block">Confirmation :</span>
                <p>Voulez-vous utiliser ce document comme nouveau modèle officiel par défaut ? L'ancienne version restera archivée dans l'historique.</p>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowReplaceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingVersion || !replaceFile}
                  className="px-5 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-extrabold rounded-xl shadow transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {submittingVersion && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>{submittingVersion ? 'Validation en cours...' : 'Valider la nouvelle version'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  X, Save, FileText, Tag, CheckCircle, AlertCircle, Copy, 
  RefreshCw, Loader2, ArrowLeft, Download, Eye, Sparkles, Layers,
  Star, Check, Upload, ExternalLink, ShieldCheck, ShieldAlert,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, Table, Type, Settings
} from 'lucide-react';

export default function OnlyOfficeEditorModal({ template, version, onClose, onSaved, onPreviewFallback }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [docServerState, setDocServerState] = useState('LOADING'); // 'LOADING' | 'READY' | 'UNAVAILABLE'
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copiedField, setCopiedField] = useState(null);

  // Template & Version IDs
  const templateId = template?.id || template?.code;
  const templateName = template?.name || 'Modèle Officiel';
  const currentVersionNum = version?.version_number || version?.version || template?.version || 1;
  const versionId = version?.id || version?.version_number || 'current';
  const fileName = template?.file_path || `${template?.code || 'document'}.docx`;

  const docEditorRef = useRef(null);
  const connectorRef = useRef(null);
  const editorCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Local fallback editor state
  const [localHtml, setLocalHtml] = useState('');
  const [ribbonTab, setRibbonTab] = useState('HOME'); // 'HOME', 'INSERT', 'ONLYOFFICE'
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [fontSize, setFontSize] = useState('11pt');
  const [uploadingDocx, setUploadingDocx] = useState(false);

  // Dynamic Fields Catalog for UK-GED
  const dynamicFieldCategories = [
    {
      category: 'IDENTIFICATION DU DOCUMENT',
      fields: [
        { key: '{{reference}}', label: 'Référence Officielle (ex: OM-2026-000125)' },
        { key: '{{date_document}}', label: 'Date d’Établissement du document' },
        { key: '{{annee_universitaire}}', label: 'Année Universitaire (ex: 2025-2026)' }
      ]
    },
    {
      category: 'DONNÉES DU MISSIONNAIRE',
      fields: [
        { key: '{{missionnaire_nom}}', label: 'Nom de famille du Missionnaire' },
        { key: '{{missionnaire_prenoms}}', label: 'Prénoms du Missionnaire' },
        { key: '{{missionnaire_fonction}}', label: 'Fonction / Grade' },
        { key: '{{missionnaire_service}}', label: 'Faculté / Direction / Service' },
        { key: '{{matricule}}', label: 'Numéro Matricule' },
        { key: '{{nationalite}}', label: 'Nationalité' }
      ]
    },
    {
      category: 'MISSION & DÉPLACEMENT',
      fields: [
        { key: '{{destination}}', label: 'Lieu / Ville de Destination' },
        { key: '{{objet_mission}}', label: 'Objet officiel de la Mission' },
        { key: '{{date_depart}}', label: 'Date de Départ' },
        { key: '{{date_retour}}', label: 'Date de Retour' },
        { key: '{{moyen_transport}}', label: 'Moyen de Transport' },
        { key: '{{conduit_par}}', label: 'Chauffeur / Immatriculation Véhicule' }
      ]
    },
    {
      category: 'SIGNATURES & SCEAUX OFFICIELS',
      fields: [
        { key: '{{signature_secretaire_general}}', label: 'Emplacement Signature Secrétaire Général' },
        { key: '{{signature_recteur}}', label: 'Emplacement Signature Recteur' },
        { key: '{{signataire_nom}}', label: 'Nom complet de l’Autorité Signataire' },
        { key: '{{qr_code}}', label: 'Emplacement Sceau QR Code Sécurisé' }
      ]
    }
  ];

  useEffect(() => {
    initOnlyoffice();
    return () => {
      destroyEditor();
    };
  }, [templateId, versionId]);

  const destroyEditor = () => {
    if (docEditorRef.current) {
      try {
        if (typeof docEditorRef.current.destroyEditor === 'function') {
          docEditorRef.current.destroyEditor();
        }
      } catch (e) {
        console.warn('Error destroying ONLYOFFICE editor instance:', e);
      }
      docEditorRef.current = null;
    }
  };

  const loadOnlyOfficeScript = (docServerUrl) => {
    return new Promise((resolve, reject) => {
      if (window.DocsAPI && window.DocsAPI.DocEditor) {
        return resolve(window.DocsAPI);
      }

      const scriptId = 'onlyoffice-api-script';
      const existingScript = document.getElementById(scriptId);
      if (existingScript) existingScript.remove();

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `${docServerUrl.replace(/\/+$/, '')}/web-apps/apps/api/documents/api.js`;
      script.async = true;
      script.onload = () => {
        if (window.DocsAPI && window.DocsAPI.DocEditor) {
          resolve(window.DocsAPI);
        } else {
          reject(new Error('DocsAPI object not found after script load.'));
        }
      };
      script.onerror = () => {
        reject(new Error(`Impossible de charger le script ONLYOFFICE depuis ${script.src}`));
      };

      document.body.appendChild(script);
    });
  };

  // Load document HTML for integrated canvas when ONLYOFFICE is offline
  const loadFallbackDocument = async () => {
    try {
      const htmlRes = await api.getTemplateVersionHTML(templateId, versionId);
      const content = htmlRes.html || '<p>Document prêt pour personnalisation.</p>';
      setLocalHtml(content);
      setTimeout(() => {
        if (editorCanvasRef.current) {
          editorCanvasRef.current.innerHTML = content;
        }
      }, 50);
    } catch (e) {
      console.warn('Fallback HTML load error:', e);
    }
  };

  const initOnlyoffice = async () => {
    console.log(`[PERSONNALISER] template_id = ${templateId}, version_id = ${versionId}, file = ${fileName}`);
    setLoading(true);
    setError('');
    setMessage('');
    setDocServerState('LOADING');
    destroyEditor();

    try {
      if (!templateId) throw new Error('Identifiant du modèle manquant.');

      // 1. Fetch ONLYOFFICE Config from UK-GED Backend
      const configRes = await api.getOnlyofficeConfig(templateId, versionId, 'edit');
      const { config, docServerUrl } = configRes;

      if (!config || !docServerUrl) {
        throw new Error('Configuration ONLYOFFICE invalide reçue du serveur.');
      }

      // 2. Load ONLYOFFICE DocsAPI Script
      try {
        await loadOnlyOfficeScript(docServerUrl);
      } catch (scriptErr) {
        console.warn('ONLYOFFICE Document Server is not reachable at:', docServerUrl);
        setDocServerState('UNAVAILABLE');
        setLoading(false);
        loadFallbackDocument();
        return;
      }

      // 3. Mount Editor inside DOM Container
      setDocServerState('READY');
      setLoading(false);

      setTimeout(() => {
        const container = document.getElementById('onlyoffice-editor-frame');
        if (!container) {
          console.error('Editor container element not found in DOM');
          return;
        }

        container.innerHTML = '';

        const fullConfig = {
          ...config,
          events: {
            onAppReady: () => {
              console.log('ONLYOFFICE Docs Editor is READY');
              try {
                if (docEditorRef.current?.createConnector) {
                  connectorRef.current = docEditorRef.current.createConnector();
                }
              } catch (connErr) {
                console.warn('Connector init warning:', connErr);
              }
            },
            onDocumentReady: () => {
              console.log('ONLYOFFICE Document loaded successfully');
            },
            onError: (event) => {
              console.error('ONLYOFFICE Editor Error event:', event);
              setError(`Erreur ONLYOFFICE: ${event.data ? JSON.stringify(event.data) : 'Erreur document'}`);
            }
          }
        };

        try {
          docEditorRef.current = new window.DocsAPI.DocEditor('onlyoffice-editor-frame', fullConfig);
        } catch (editorInitErr) {
          console.error('Failed to instantiate DocsAPI.DocEditor:', editorInitErr);
          setDocServerState('UNAVAILABLE');
          loadFallbackDocument();
        }
      }, 100);

    } catch (err) {
      console.error('ONLYOFFICE init failed:', err);
      setDocServerState('UNAVAILABLE');
      setLoading(false);
      loadFallbackDocument();
    }
  };

  const executeDocCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorCanvasRef.current) {
      editorCanvasRef.current.focus();
    }
  };

  // Insert Table in Local Canvas
  const insertTable = (rows = 3, cols = 2) => {
    let tableHtml = '<table style="width:100%; border-collapse:collapse; margin:16px 0; border:1px solid #CBD5E1;">';
    for (let r = 0; r < rows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        tableHtml += '<td style="border:1px solid #CBD5E1; padding:8px 12px; font-size:12px; vertical-align:top;">&nbsp;</td>';
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</table><p>&nbsp;</p>';
    executeDocCommand('insertHTML', tableHtml);
  };

  // Insert Official Kindia Header
  const insertOfficialHeader = () => {
    const headerHtml = `
      <div style="text-align:center; margin-bottom:20px; border-bottom:2px solid #0B2545; padding-bottom:12px;" contenteditable="true">
        <h3 style="font-size:14px; font-weight:bold; color:#0B2545; margin:0 0 2px 0; text-transform:uppercase;">RÉPUBLIQUE DE GUINÉE</h3>
        <p style="font-size:11px; font-style:italic; color:#D4AF37; margin:0 0 4px 0;">Travail – Justice – Solidarité</p>
        <p style="font-size:11px; font-weight:bold; color:#0B2545; margin:0 0 2px 0;">MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L'INNOVATION</p>
        <h2 style="font-size:16px; font-weight:bold; color:#0B2545; margin:0 0 2px 0;">UNIVERSITÉ DE KINDIA</h2>
        <p style="font-size:12px; font-weight:bold; color:#475569; margin:0;">SECRÉTARIAT GÉNÉRAL</p>
      </div>
      <p>&nbsp;</p>
    `;
    executeDocCommand('insertHTML', headerHtml);
  };

  // Insert Signature Block
  const insertSignatureBlock = () => {
    const sigHtml = `
      <table style="width:100%; border:0; margin-top:30px;">
        <tr>
          <td style="width:50%; border:0;"></td>
          <td style="width:50%; border:0; text-align:right;">
            <p style="margin:0 0 4px 0; font-size:12px;">Kindia, le {{date_document}}</p>
            <p style="margin:0 0 4px 0; font-size:13px; font-weight:bold; color:#0B2545;">LE SECRÉTAIRE GÉNÉRAL</p>
            <p style="margin:20px 0; font-size:11px; color:#94A3B8;">[Signature Électronique Certifiée & Sceau QR]</p>
            <p style="margin:0; font-size:13px; font-weight:bold; text-decoration:underline; color:#0B2545;">{{signataire_nom}}</p>
          </td>
        </tr>
      </table>
      <p>&nbsp;</p>
    `;
    executeDocCommand('insertHTML', sigHtml);
  };

  // Handle Dynamic Placeholder Click (Insert in DOCX or Copy)
  const handleInsertDynamicField = (fieldKey) => {
    // 1. Try ONLYOFFICE Connector if active
    if (docServerState === 'READY' && connectorRef.current && typeof connectorRef.current.executeMethod === 'function') {
      try {
        connectorRef.current.executeMethod('PasteText', [fieldKey]);
      } catch (e) {
        console.warn('Connector pasteText error:', e);
      }
    } else if (editorCanvasRef.current) {
      // 2. Insert into Local Canvas at cursor position
      const tagBadge = `<span data-field-key="${fieldKey}" class="dynamic-tag" contenteditable="false" style="background-color:#EFF6FF; color:#1E40AF; padding:2px 8px; border-radius:6px; font-family:monospace; font-weight:bold; border:1px solid #BFDBFE; display:inline-block; margin:0 2px;">🏷️ ${fieldKey}</span>&nbsp;`;
      executeDocCommand('insertHTML', tagBadge);
    }

    // Always copy to clipboard for convenience
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fieldKey);
    }
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Save Document
  const handleSaveDocument = async (asNewVersion = false) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (docServerState === 'READY' && docEditorRef.current) {
        // ONLYOFFICE Native Save Command
        if (typeof docEditorRef.current.serviceCommand === 'function') {
          try {
            docEditorRef.current.serviceCommand('save');
          } catch (e) {
            console.warn('serviceCommand save error:', e);
          }
        }
        const res = await api.manualSaveOnlyoffice(templateId, {
          save_as_new_version: asNewVersion,
          change_description: asNewVersion 
            ? `Nouvelle version Word v${currentVersionNum + 1} (ONLYOFFICE Docs)`
            : `Mise à jour Word v${currentVersionNum} (ONLYOFFICE Docs)`
        });
        setMessage(res.message || 'Modèle officiel Word DOCX enregistré avec succès !');
      } else if (editorCanvasRef.current) {
        // Local Canvas Save
        const htmlContent = editorCanvasRef.current.innerHTML;
        const payload = {
          name: templateName,
          content_body_html: htmlContent,
          save_as_new_version: asNewVersion,
          change_description: asNewVersion 
            ? `Nouvelle version Word v${currentVersionNum + 1}` 
            : `Personnalisation Word v${currentVersionNum}`
        };

        const res = await api.customizeTemplate(templateId, payload);
        setMessage(res.message || 'Modèle officiel Word DOCX enregistré avec succès !');
      }

      if (onSaved) onSaved();

      if (asNewVersion) {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || 'Erreur lors de l’enregistrement du document.');
    } finally {
      setSaving(false);
    }
  };

  // Direct DOCX file upload
  const handleUploadRevisedDocx = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDocx(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('docx_file', file);
      formData.append('save_as_new_version', 'false');
      formData.append('change_description', `Révision importée [${file.name}]`);

      const res = await api.uploadDocxRevision(templateId, formData);
      setMessage(res.message || 'Fichier Word DOCX mis à jour avec succès !');
      if (onSaved) onSaved();
      loadFallbackDocument();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’importation du fichier DOCX.');
    } finally {
      setUploadingDocx(false);
    }
  };

  // Set as default template
  const handleSetDefault = async () => {
    if (!window.confirm(`Voulez-vous définir [${templateName}] comme modèle par défaut officiel pour ce type de document ?`)) {
      return;
    }
    try {
      const res = await api.setDefaultDocumentTemplate(templateId, true);
      setMessage(res.message || 'Modèle défini comme modèle par défaut.');
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Erreur lors de la définition du modèle par défaut.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm w-screen h-screen overflow-hidden text-slate-800 text-xs">
      
      {/* 1. TOP HEADER */}
      <div className="bg-slate-900 text-white px-6 py-3 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 flex-shrink-0 shadow-lg">
        
        {/* Left Info */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-kindia-gold to-amber-600 text-slate-950 flex items-center justify-center font-black text-base shadow">
            W
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-heading font-extrabold text-sm md:text-base text-white">
                Éditeur de Document Officiel – {templateName}
              </h2>
              <span className="bg-kindia-gold text-slate-950 text-[10px] px-2.5 py-0.5 rounded-full font-black font-mono uppercase shadow-sm">
                v{currentVersionNum}
              </span>
              {docServerState === 'READY' ? (
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/40 flex items-center space-x-1">
                  <span>🟢 ONLYOFFICE ACTIF</span>
                </span>
              ) : (
                <span className="bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-500/40 flex items-center space-x-1">
                  <span>📄 ÉDITEUR DOCX INTÉGRÉ</span>
                </span>
              )}
              {template?.is_default === 1 && (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-500/40 flex items-center space-x-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>DÉFAUT</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Université : <strong className="text-slate-300">Université de Kindia</strong> • Fichier : <strong className="text-kindia-gold">{fileName}</strong> • ID : <span className="text-slate-300 font-bold">{templateId}</span>
            </p>
          </div>
        </div>

        {/* Right Top Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          
          <button
            onClick={() => api.downloadTemplateDocx(templateId)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition flex items-center space-x-1.5 border border-slate-700 font-bold"
            title="Télécharger le fichier Word (.DOCX)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DOCX</span>
          </button>

          {template?.is_default !== 1 && (
            <button
              onClick={handleSetDefault}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl transition flex items-center space-x-1 border border-amber-500/40 font-bold"
              title="Définir comme modèle par défaut officiel"
            >
              <Star className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Par défaut</span>
            </button>
          )}

          {onPreviewFallback && (
            <button
              onClick={() => {
                onClose();
                onPreviewFallback();
              }}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition flex items-center space-x-1.5 border border-slate-700 font-bold"
              title="Prévisualisation haute fidélité"
            >
              <Eye className="w-3.5 h-3.5 text-kindia-blue" />
              <span>Aperçu</span>
            </button>
          )}

          <button
            onClick={() => handleSaveDocument(false)}
            disabled={saving || loading}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-emerald-200" />}
            <span>ENREGISTRER</span>
          </button>

          <button
            onClick={() => handleSaveDocument(true)}
            disabled={saving || loading}
            className="px-4 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-extrabold rounded-xl shadow transition flex items-center space-x-1.5 border border-kindia-gold/40 disabled:opacity-50"
            title="Enregistrer comme nouvelle version incrémentale (v+1)"
          >
            <Layers className="w-3.5 h-3.5 text-kindia-gold" />
            <span>NOUVELLE VERSION</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition ml-1"
            title="Fermer l'éditeur"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Notifications Banner */}
      {message && (
        <div className="bg-emerald-600 text-white px-6 py-2 flex items-center justify-between text-xs font-bold shadow animate-fade-in flex-shrink-0">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {error && (
        <div className="bg-red-600 text-white px-6 py-2 flex items-center justify-between text-xs font-bold shadow animate-fade-in flex-shrink-0">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-200">
        
        {/* DOCUMENT VIEWPORT */}
        <div className="flex-1 flex flex-col relative h-full bg-slate-100 overflow-hidden">
          
          {loading && (
            <div className="absolute inset-0 z-20 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-3">
              <div className="w-12 h-12 border-4 border-kindia-gold border-t-transparent rounded-full animate-spin"></div>
              <p className="font-heading font-extrabold text-sm tracking-wide">
                Chargement du document officiel...
              </p>
              <p className="text-xs text-slate-300 font-mono">
                {templateName} (Version v{currentVersionNum})
              </p>
            </div>
          )}

          {docServerState === 'READY' ? (
            /* Active ONLYOFFICE Docs iFrame Mount */
            <div id="onlyoffice-editor-frame" className="w-full h-full flex-1"></div>
          ) : (
            /* High-Fidelity Integrated DOCX Canvas with Word Ribbon */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Ribbon Sub-Header Tabs */}
              <div className="bg-slate-800 text-white px-6 py-1.5 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setRibbonTab('HOME')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition ${ribbonTab === 'HOME' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Accueil
                  </button>
                  <button
                    onClick={() => setRibbonTab('INSERT')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition ${ribbonTab === 'INSERT' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Insertion
                  </button>
                  <button
                    onClick={() => setRibbonTab('ONLYOFFICE')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition ${ribbonTab === 'ONLYOFFICE' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Connexion ONLYOFFICE
                  </button>
                </div>

                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <span>ℹ️ Cliquez sur un champ dynamique à droite pour l'insérer au curseur</span>
                </div>
              </div>

              {/* Ribbon Controls */}
              <div className="bg-slate-50 border-b border-slate-300 p-2 flex flex-wrap items-center gap-2 flex-shrink-0 text-slate-700 shadow-sm">
                {ribbonTab === 'HOME' && (
                  <>
                    <button
                      onClick={() => executeDocCommand('bold')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg font-bold"
                      title="Gras (Ctrl+B)"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => executeDocCommand('italic')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg"
                      title="Italique (Ctrl+I)"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => executeDocCommand('underline')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg"
                      title="Souligné (Ctrl+U)"
                    >
                      <Underline className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => executeDocCommand('strikeThrough')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg"
                      title="Barré"
                    >
                      <Strikethrough className="w-4 h-4" />
                    </button>

                    <div className="h-5 w-px bg-slate-300 mx-1" />

                    <button
                      onClick={() => executeDocCommand('justifyLeft')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg"
                      title="Aligner à gauche"
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => executeDocCommand('justifyCenter')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg"
                      title="Centrer"
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => executeDocCommand('justifyRight')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg"
                      title="Aligner à droite"
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => executeDocCommand('justifyFull')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg"
                      title="Justifier"
                    >
                      <AlignJustify className="w-4 h-4" />
                    </button>

                    <div className="h-5 w-px bg-slate-300 mx-1" />

                    <button
                      onClick={() => executeDocCommand('insertUnorderedList')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg"
                      title="Liste à puces"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </>
                )}

                {ribbonTab === 'INSERT' && (
                  <>
                    <button
                      onClick={() => insertTable(3, 2)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold flex items-center space-x-1"
                    >
                      <Table className="w-3.5 h-3.5 text-kindia-blue" />
                      <span>Insérer Tableau</span>
                    </button>

                    <button
                      onClick={insertSignatureBlock}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold flex items-center space-x-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Bloc Signatures & Sceau</span>
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm("Le document importé possède déjà un en-tête. Souhaitez-vous vraiment insérer un en-tête institutionnel supplémentaire ?")) {
                          insertOfficialHeader();
                        }
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold flex items-center space-x-1 text-slate-600"
                      title="Utiliser uniquement si le document ne contient aucun en-tête"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>En-tête institutionnel (optionnel)</span>
                    </button>
                  </>
                )}

                {ribbonTab === 'ONLYOFFICE' && (
                  <div className="flex items-center space-x-2 w-full">
                    <span className="text-[11px] text-slate-500">Serveur ONLYOFFICE autonome :</span>
                    <button
                      onClick={initOnlyoffice}
                      className="px-3 py-1 bg-kindia-blue text-white rounded-lg font-bold flex items-center space-x-1 shadow-sm"
                    >
                      <RefreshCw className="w-3 h-3 text-kindia-gold" />
                      <span>Re-tester connexion ONLYOFFICE</span>
                    </button>

                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".docx"
                      onChange={handleUploadRevisedDocx}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingDocx}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center space-x-1 shadow-sm"
                    >
                      <Upload className="w-3 h-3 text-kindia-gold" />
                      <span>{uploadingDocx ? 'Importation...' : 'Importer DOCX modifié'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Scrollable Editable Paper Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10 flex justify-center bg-slate-200">
                <div
                  ref={editorCanvasRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="bg-white shadow-2xl rounded-xl w-full max-w-4xl min-h-[90vh] p-8 md:p-14 outline-none border border-slate-300 text-slate-800 leading-relaxed font-sans focus:ring-2 focus:ring-kindia-blue/40"
                  style={{
                    fontFamily: fontFamily,
                    fontSize: fontSize,
                    lineHeight: '1.6'
                  }}
                />
              </div>

            </div>
          )}

        </div>

        {/* 3. RIGHT SIDEBAR - DYNAMIC FIELDS PANEL */}
        <div className="w-full md:w-80 bg-white border-l border-slate-300 flex flex-col flex-shrink-0 h-auto md:h-full shadow-lg">
          
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="font-heading font-extrabold text-xs text-slate-800 flex items-center">
                <Tag className="w-3.5 h-3.5 text-kindia-gold mr-1.5" />
                CHAMPS DYNAMIQUES UK-GED
              </h3>
              <p className="text-[10px] text-slate-500">
                Cliquez pour insérer au curseur ou copier la balise
              </p>
            </div>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>

          {/* Copy Toast Alert */}
          {copiedField && (
            <div className="m-3 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-[11px] font-bold flex items-center space-x-2 animate-fade-in shadow-sm">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Balise <code className="bg-white px-1.5 py-0.5 rounded text-emerald-800 font-mono">{copiedField}</code> insérée & copiée !</span>
            </div>
          )}

          {/* Fields Directory Scrollable List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 divide-y divide-slate-100">
            {dynamicFieldCategories.map(cat => (
              <div key={cat.category} className="pt-3 first:pt-0 space-y-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  {cat.category}
                </span>

                <div className="space-y-1.5">
                  {cat.fields.map(f => (
                    <button
                      key={f.key}
                      onClick={() => handleInsertDynamicField(f.key)}
                      className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition flex items-center justify-between group"
                    >
                      <div className="space-y-0.5 overflow-hidden pr-1">
                        <span className="font-mono font-bold text-[11px] text-kindia-blue block truncate group-hover:text-blue-800">
                          {f.key}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {f.label}
                        </span>
                      </div>
                      <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-kindia-blue flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Guide Note */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 leading-normal">
            <span className="font-bold text-slate-700 block mb-0.5">ℹ️ Remplacement Automatique :</span>
            Lors de la génération d'un acte officiel ou d'un ordre de mission, ces balises seront automatiquement remplacées par les données réelles saisies.
          </div>

        </div>

      </div>

    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  X, Save, FileText, Layout, Tag, CheckCircle, AlertCircle, Copy, 
  RefreshCw, Type, Loader2, ArrowLeft, Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  Download, Eye, Sparkles, Table, Plus, ChevronRight, Layers,
  Scissors, Undo, Redo, ShieldCheck, Check, Star, Settings, FileCheck
} from 'lucide-react';

export default function TemplateEditorModal({ template, version, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeRibbonTab, setActiveRibbonTab] = useState('HOME'); // HOME, INSERT, LAYOUT, FIELDS
  const [showFieldsSidebar, setShowFieldsSidebar] = useState(true);
  const [saveAsNewVer, setSaveAsNewVer] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');

  // Version info
  const templateId = template?.id || template?.code;
  const templateCode = template?.code || template?.document_type_code || 'ORDRE_MISSION';
  const templateName = template?.name || 'Ordre de Mission Officiel';
  const currentVersionNum = version?.version_number || version?.version || template?.version || 1;
  const versionId = version?.id || version?.version_number || 'current';
  const fileName = template?.file_path || `${templateCode.toLowerCase()}_modele.docx`;

  // Formatting & State
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [fontSize, setFontSize] = useState('11pt');
  const [textColor, setTextColor] = useState('#1E293B');
  const [marginSize, setMarginSize] = useState('normal'); // normal, narrow, wide
  const [copiedField, setCopiedField] = useState(null);

  // Editable Document Canvas Ref & Saved Range
  const editorRef = useRef(null);
  const savedSelectionRef = useRef(null);

  // Universal Dynamic Fields Directory for ANY administrative document
  const dynamicFieldCategories = [
    {
      category: 'RÉFÉRENCE & DATE',
      fields: [
        { key: '{{reference}}', label: 'Référence Officielle du document' },
        { key: '{{date_document}}', label: 'Date d’Établissement officielle' },
        { key: '{{lieu}}', label: 'Lieu d’Établissement (Kindia)' },
        { key: '{{annee_universitaire}}', label: 'Année Universitaire (ex: 2025-2026)' }
      ]
    },
    {
      category: 'OBJET & DESTINATAIRE',
      fields: [
        { key: '{{objet}}', label: 'Objet du document' },
        { key: '{{destinataire}}', label: 'Destinataire officiel / Qualité' },
        { key: '{{service_emetteur}}', label: 'Service / Direction émettrice' },
        { key: '{{faculte}}', label: 'Faculté de rattachement' },
        { key: '{{departement}}', label: 'Département académique' }
      ]
    },
    {
      category: 'BÉNÉFICIAIRE / CONCERNÉ',
      fields: [
        { key: '{{beneficiaire_nom}}', label: 'Nom complet du bénéficiaire' },
        { key: '{{matricule}}', label: 'Numéro Matricule' },
        { key: '{{fonction}}', label: 'Fonction / Grade' },
        { key: '{{missionnaire_nom}}', label: 'Nom du Missionnaire (si mission)' },
        { key: '{{destination}}', label: 'Destination (si mission)' }
      ]
    },
    {
      category: 'SIGNATURES & SÉCURITÉ',
      fields: [
        { key: '{{signataire_nom}}', label: 'Nom de l’Autorité Signataire' },
        { key: '{{signataire_fonction}}', label: 'Fonction de l’Autorité Signataire' },
        { key: '{{signature}}', label: 'Emplacement Signature Numérique' },
        { key: '{{qr_code}}', label: 'Sceau QR Code Officiel de vérification' }
      ]
    }
  ];

  useEffect(() => {
    loadDocument();
  }, [templateId, versionId]);

  const loadDocument = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (!templateId) throw new Error('Identifiant de modèle non spécifié.');

      const htmlRes = await api.getTemplateVersionHTML(templateId, versionId);
      const docHtml = htmlRes.html || '<p>Document Word prêt pour édition.</p>';

      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = docHtml;
        }
      }, 50);
    } catch (err) {
      console.error('Failed to load Word document for editing:', err);
      setError(err.message || 'Erreur lors du chargement du fichier DOCX.');
    } finally {
      setLoading(false);
    }
  };

  // Selection preservation
  const saveCurrentSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
  };

  // Word Ribbon Commands
  const executeDocCommand = (command, value = null) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(command, false, value);
      saveCurrentSelection();
    }
  };

  // Insert Tag Badge
  const insertDynamicField = (tagKey) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();

    const tagHtml = `<span data-field-key="${tagKey}" class="dynamic-tag" contenteditable="false" style="background-color:#EFF6FF; color:#1E40AF; padding:2px 8px; border-radius:6px; font-family:monospace; font-weight:bold; border:1px solid #BFDBFE; display:inline-block; margin:0 2px;">🏷️ ${tagKey}</span>&nbsp;`;
    
    document.execCommand('insertHTML', false, tagHtml);
    saveCurrentSelection();

    setCopiedField(tagKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Insert Table
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
            <p style="margin:20px 0; font-size:11px; color:#94A3B8;">[Emplacement Signature Électronique]</p>
            <p style="margin:0; font-size:13px; font-weight:bold; text-decoration:underline; color:#0B2545;">{{signataire_nom}}</p>
          </td>
        </tr>
      </table>
      <p>&nbsp;</p>
    `;
    executeDocCommand('insertHTML', sigHtml);
  };

  // Save changes
  const handleSave = async (asNewVersion = false) => {
    if (!editorRef.current) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const htmlContent = editorRef.current.innerHTML;

      const payload = {
        name: templateName,
        content_body_html: htmlContent,
        save_as_new_version: asNewVersion || saveAsNewVer,
        change_description: changeDescription || (asNewVersion ? `Nouvelle version Word v${currentVersionNum + 1}` : `Personnalisation Word v${currentVersionNum}`)
      };

      const res = await api.customizeTemplate(templateId, payload);
      setMessage(res.message || 'Modèle officiel Word enregistré avec succès !');
      
      if (onSaved) onSaved();

      setTimeout(() => {
        if (asNewVersion) onClose();
      }, 1200);
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err.message || 'Erreur lors de la sauvegarde du modèle Word.');
    } finally {
      setSaving(false);
    }
  };

  // Margin CSS helper
  const getMarginClass = () => {
    if (marginSize === 'narrow') return 'p-6 md:p-8';
    if (marginSize === 'wide') return 'p-12 md:p-16';
    return 'p-8 md:p-12';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm w-screen h-screen overflow-hidden text-slate-800 text-xs">
      
      {/* 1. TOP HEADER - EXACT MODEL DETAILS & STATUS */}
      <div className="bg-slate-900 text-white px-6 py-3 border-b border-slate-800 flex justify-between items-center flex-shrink-0 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-kindia-gold text-slate-950 flex items-center justify-center font-black text-sm shadow">
            W
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-heading font-extrabold text-sm text-white">
                Éditeur de modèle – {templateName}
              </h2>
              <span className="bg-kindia-gold text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-extrabold font-mono uppercase">
                Version v{currentVersionNum}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/40 flex items-center space-x-1">
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Modèle sélectionné</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Fichier source : <strong className="text-kindia-gold">{fileName}</strong> • Identifiant : {templateId}
            </p>
          </div>
        </div>

        {/* Right Top Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => api.downloadTemplateDocx(templateId)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition flex items-center space-x-1.5"
            title="Télécharger le fichier Word (.DOCX)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Télécharger DOCX</span>
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={saving || loading}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-emerald-200" />}
            <span>ENREGISTRER</span>
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={saving || loading}
            className="px-4 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-extrabold rounded-xl shadow transition flex items-center space-x-1.5 border border-kindia-gold/40 disabled:opacity-50"
            title="Enregistrer comme nouvelle version incrémentale (v+1)"
          >
            <Layers className="w-3.5 h-3.5 text-kindia-gold" />
            <span>NOUVELLE VERSION</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition ml-2"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. MICROSOFT WORD RIBBON BAR */}
      <div className="bg-slate-100 border-b border-slate-300 flex-shrink-0">
        
        {/* Ribbon Tabs (Accueil, Insertion, Mise en page, Variables) */}
        <div className="flex space-x-1 px-6 pt-1 border-b border-slate-200 bg-slate-200/60 text-[11px] font-bold">
          {[
            { id: 'HOME', label: 'Accueil' },
            { id: 'INSERT', label: 'Insertion' },
            { id: 'LAYOUT', label: 'Mise en page' },
            { id: 'FIELDS', label: '🏷️ Champs Dynamiques UK-GED' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveRibbonTab(tab.id)}
              className={`px-4 py-1.5 rounded-t-lg transition font-heading font-extrabold ${
                activeRibbonTab === tab.id
                  ? 'bg-white text-kindia-blue border-t-2 border-kindia-blue shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Ribbon Content Panels */}
        <div className="px-6 py-2 bg-white flex flex-wrap items-center gap-4 text-xs">
          
          {/* TAB: ACCUEIL */}
          {activeRibbonTab === 'HOME' && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Font Family */}
              <select
                value={fontFamily}
                onChange={(e) => {
                  setFontFamily(e.target.value);
                  executeDocCommand('fontName', e.target.value);
                }}
                className="p-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-slate-50"
              >
                <option value="Calibri">Calibri (Word Standard)</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
                <option value="Garamond">Garamond</option>
              </select>

              {/* Font Size */}
              <select
                value={fontSize}
                onChange={(e) => {
                  setFontSize(e.target.value);
                  executeDocCommand('fontSize', e.target.value === '18pt' ? '6' : (e.target.value === '14pt' ? '4' : '3'));
                }}
                className="p-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50"
              >
                <option value="9pt">9 pt</option>
                <option value="10pt">10 pt</option>
                <option value="11pt">11 pt</option>
                <option value="12pt">12 pt</option>
                <option value="14pt">14 pt</option>
                <option value="16pt">16 pt</option>
                <option value="18pt">18 pt</option>
                <option value="24pt">24 pt</option>
              </select>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              {/* Bold, Italic, Underline, Strike */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => executeDocCommand('bold')}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded transition"
                  title="Gras (Ctrl+B)"
                >
                  <Bold className="w-3.5 h-3.5 text-slate-800" />
                </button>
                <button
                  onClick={() => executeDocCommand('italic')}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded transition"
                  title="Italique (Ctrl+I)"
                >
                  <Italic className="w-3.5 h-3.5 text-slate-800" />
                </button>
                <button
                  onClick={() => executeDocCommand('underline')}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded transition"
                  title="Souligné (Ctrl+U)"
                >
                  <Underline className="w-3.5 h-3.5 text-slate-800" />
                </button>
                <button
                  onClick={() => executeDocCommand('strikeThrough')}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded transition"
                  title="Barré"
                >
                  <Strikethrough className="w-3.5 h-3.5 text-slate-800" />
                </button>
              </div>

              {/* Color Picker */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => {
                    setTextColor(e.target.value);
                    executeDocCommand('foreColor', e.target.value);
                  }}
                  className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                  title="Couleur du texte"
                />
                <button
                  onClick={() => executeDocCommand('hiliteColor', '#FEF08A')}
                  className="p-1.5 hover:bg-white rounded transition text-[10px] font-bold text-amber-900 bg-amber-100"
                  title="Surligner en jaune"
                >
                  Surligner
                </button>
              </div>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              {/* Alignments */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => executeDocCommand('justifyLeft')}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded transition"
                  title="Aligner à gauche"
                >
                  <AlignLeft className="w-3.5 h-3.5 text-slate-800" />
                </button>
                <button
                  onClick={() => executeDocCommand('justifyCenter')}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded transition"
                  title="Centrer"
                >
                  <AlignCenter className="w-3.5 h-3.5 text-slate-800" />
                </button>
                <button
                  onClick={() => executeDocCommand('justifyRight')}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded transition"
                  title="Aligner à droite"
                >
                  <AlignRight className="w-3.5 h-3.5 text-slate-800" />
                </button>
                <button
                  onClick={() => executeDocCommand('justifyFull')}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded transition"
                  title="Justifier"
                >
                  <AlignJustify className="w-3.5 h-3.5 text-slate-800" />
                </button>
              </div>

              {/* Lists */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => executeDocCommand('insertUnorderedList')}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded transition"
                  title="Puces"
                >
                  <List className="w-3.5 h-3.5 text-slate-800" />
                </button>
                <button
                  onClick={() => executeDocCommand('insertOrderedList')}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded transition"
                  title="Numérotation"
                >
                  <ListOrdered className="w-3.5 h-3.5 text-slate-800" />
                </button>
              </div>

              {/* Clear Formatting */}
              <button
                onClick={() => executeDocCommand('removeFormat')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                title="Effacer la mise en forme"
              >
                Normal
              </button>
            </div>
          )}

          {/* TAB: INSERTION */}
          {activeRibbonTab === 'INSERT' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => insertTable(3, 2)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center space-x-1.5 border border-slate-200"
              >
                <Table className="w-3.5 h-3.5 text-kindia-blue" />
                <span>Tableau 3x2</span>
              </button>

              <button
                onClick={() => insertTable(4, 3)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center space-x-1.5 border border-slate-200"
              >
                <Table className="w-3.5 h-3.5 text-kindia-blue" />
                <span>Tableau 4x3</span>
              </button>

              <button
                onClick={() => {
                  if (window.confirm("Le document importé possède déjà un en-tête. Souhaitez-vous vraiment insérer un en-tête supplémentaire ?")) {
                    insertOfficialHeader();
                  }
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center space-x-1.5 border border-slate-200"
                title="Utiliser uniquement si le document ne contient aucun en-tête"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>En-tête institutionnel (optionnel)</span>
              </button>

              <button
                onClick={insertSignatureBlock}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg font-bold flex items-center space-x-1.5 border border-amber-200"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>Bloc Signature SG</span>
              </button>

              <button
                onClick={() => executeDocCommand('insertHorizontalRule')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold border border-slate-200"
              >
                Ligne de séparation
              </button>
            </div>
          )}

          {/* TAB: MISE EN PAGE */}
          {activeRibbonTab === 'LAYOUT' && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-600">Marges de la page :</span>
              <button
                onClick={() => setMarginSize('normal')}
                className={`px-3 py-1.5 rounded-lg font-bold border ${marginSize === 'normal' ? 'bg-kindia-blue text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Normales (2.5 cm)
              </button>
              <button
                onClick={() => setMarginSize('narrow')}
                className={`px-3 py-1.5 rounded-lg font-bold border ${marginSize === 'narrow' ? 'bg-kindia-blue text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Étroites (1.27 cm)
              </button>
              <button
                onClick={() => setMarginSize('wide')}
                className={`px-3 py-1.5 rounded-lg font-bold border ${marginSize === 'wide' ? 'bg-kindia-blue text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Larges (3.0 cm)
              </button>
              <span className="text-slate-400 font-mono text-[11px]">Format : A4 Portrait (210 x 297 mm)</span>
            </div>
          )}

          {/* TAB: CHAMPS DYNAMIQUES */}
          {activeRibbonTab === 'FIELDS' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-blue-900">Insertion rapide de variables officielles :</span>
              {['{{missionnaire_nom}}', '{{missionnaire_prenoms}}', '{{destination}}', '{{objet_mission}}', '{{date_depart}}', '{{date_retour}}', '{{signature_secretaire_general}}'].map(tag => (
                <button
                  key={tag}
                  onClick={() => insertDynamicField(tag)}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-kindia-blue font-mono font-bold rounded-lg transition text-[11px]"
                >
                  + {tag}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Notifications Alert Banner */}
      {message && (
        <div className="bg-emerald-50 text-emerald-800 px-6 py-2 text-xs font-bold border-b border-emerald-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-800 px-6 py-2 text-xs font-bold border-b border-red-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* 3. MAIN WORKSPACE: A4 DOCUMENT CANVAS + DYNAMIC VARIABLES SIDEBAR */}
      <div className="flex-1 flex overflow-hidden bg-slate-200/80">
        
        {/* Left / Center: Word A4 Document Canvas */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start">
          {loading ? (
            <div className="my-auto flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-2xl space-y-4 max-w-md border border-slate-200 text-center">
              <Loader2 className="w-10 h-10 text-kindia-blue animate-spin" />
              <div>
                <h4 className="font-heading font-extrabold text-slate-800 text-base">Chargement du document Word (.DOCX)...</h4>
                <p className="text-xs text-slate-500 mt-1">Extraction de la structure fidèle du modèle v{currentVersionNum}</p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl flex flex-col items-center space-y-4">
              
              {/* Word A4 Page Simulation Sheet */}
              <div 
                className={`w-full bg-white rounded-md shadow-2xl border border-slate-300 min-h-[1050px] text-slate-900 transition-all font-sans ${getMarginClass()}`}
                style={{ fontFamily: fontFamily }}
              >
                {/* Visual editable container */}
                <div
                  ref={editorRef}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onKeyUp={saveCurrentSelection}
                  onMouseUp={saveCurrentSelection}
                  className="outline-none focus:ring-0 min-h-[900px] leading-relaxed text-sm word-canvas prose prose-slate max-w-none"
                  style={{ minHeight: '850px' }}
                />
              </div>

              {/* Bottom Canvas Info */}
              <div className="text-center text-[11px] text-slate-500 font-mono pb-6">
                Édition Microsoft Word DOCX • Université de Kindia • Modèle lié : {templateId}
              </div>

            </div>
          )}
        </div>

        {/* Right Sidebar: Dynamic Variables Directory */}
        <div className="w-80 bg-white border-l border-slate-300 flex flex-col flex-shrink-0 shadow-lg">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Tag className="w-4 h-4 text-kindia-blue" />
              <h3 className="font-heading font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                Champs Dynamiques UK-GED
              </h3>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Cliquez sur n'importe quel champ pour l'insérer instantanément dans le document à la position de votre curseur.
            </p>

            {dynamicFieldCategories.map((cat, idx) => (
              <div key={idx} className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-kindia-blue block border-b border-slate-200 pb-1">
                  {cat.category}
                </span>

                <div className="space-y-1.5">
                  {cat.fields.map(f => (
                    <div
                      key={f.key}
                      onClick={() => insertDynamicField(f.key)}
                      className="p-2 bg-slate-50 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-300 cursor-pointer transition flex items-center justify-between group"
                    >
                      <div>
                        <span className="font-mono font-extrabold text-kindia-blue block text-[11px]">
                          {f.key}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate max-w-[200px]">
                          {f.label}
                        </span>
                      </div>

                      <button className="p-1 rounded bg-white group-hover:bg-kindia-blue group-hover:text-white text-slate-400 transition shadow-sm">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer of Sidebar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400">
            Les balises seront automatiquement substituées lors de la génération réelle des documents.
          </div>
        </div>

      </div>

    </div>
  );
}

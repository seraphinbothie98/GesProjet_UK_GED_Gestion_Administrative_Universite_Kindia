import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  FileText, Plus, CheckCircle, List, Layers, Eye, History, Upload, 
  Trash2, Power, Star, Copy, Download, Edit3, Sparkles, AlertCircle, RefreshCw 
} from 'lucide-react';
import TemplateEditorModal from '../components/TemplateEditorModal';
import TemplatePreviewModal from '../components/TemplatePreviewModal';
import OnlyOfficeEditorModal from '../components/OnlyOfficeEditorModal';
import ErrorBoundary from '../components/ErrorBoundary';

export default function TemplateAdmin() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState('');
  const [templateDetail, setTemplateDetail] = useState(null);
  const [templateVersions, setTemplateVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Selected template resolution (strict ID and code matching)
  const selectedTemplate = templates.find(t => t.code === selectedTemplateCode || String(t.id) === String(selectedTemplateCode)) || templateDetail;

  // Form State
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('OFFICIAL');
  const [newEditorType, setNewEditorType] = useState('MS_WORD'); // 'MS_WORD' | 'UK_GED_EDITOR'
  const [newHeader, setNewHeader] = useState('RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA');
  const [newFooter, setNewFooter] = useState('UNIVERSITÉ DE KINDIA • BP 164 Kindia, Guinée');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fields, setFields] = useState([]);

  // Modals State
  const [editingTemplateModal, setEditingTemplateModal] = useState(null);
  const [previewModalData, setPreviewModalData] = useState(null); // { template, version }

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplateCode) {
      loadTemplateDetail(selectedTemplateCode);
    }
  }, [selectedTemplateCode]);

  const loadTemplates = async () => {
    try {
      const data = await api.getDocumentTemplates();
      setTemplates(data);
      if (data.length > 0 && !selectedTemplateCode) {
        setSelectedTemplateCode(data[0].code);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateDetail = async (code) => {
    try {
      const data = await api.getDocumentTemplate(code);
      setTemplateDetail(data.template);
      setFields(data.fields || []);
      setTemplateVersions(data.versions || []);
    } catch (err) {
      console.error('Failed to load template detail:', err);
    }
  };

  // Open Preview with the exact selected template and version
  const handleOpenPreview = (templateObj, versionObj = null) => {
    const targetTemplate = templateObj || selectedTemplate;
    if (!targetTemplate) return;
    setPreviewModalData({
      template: targetTemplate,
      version: versionObj
    });
  };

  // Open Editor with the exact selected template and version
  const handleOpenEdit = (templateObj, versionObj = null) => {
    const targetTemplate = templateObj || selectedTemplate;
    if (!targetTemplate) return;
    setEditingTemplateModal({
      template: targetTemplate,
      version: versionObj
    });
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newCode || !newName) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      let res;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('code', newCode);
        formData.append('name', newName);
        formData.append('category', newCategory);
        formData.append('editor_type', newEditorType);
        formData.append('header_text', newHeader);
        formData.append('footer_text', newFooter);
        formData.append('template_file', selectedFile);

        const uploadRes = await fetch(`/api/templates`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('uk_ged_token')}` },
          body: formData
        });
        res = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(res.error || 'Erreur lors de la création du modèle');
      } else {
        res = await api.createDocumentTemplate({
          code: newCode,
          name: newName,
          category: newCategory,
          editor_type: newEditorType,
          header_text: newHeader,
          footer_text: newFooter
        });
      }

      setMessage(res.message);
      setNewCode('');
      setNewName('');
      setSelectedFile(null);
      loadTemplates();
      setSelectedTemplateCode(res.code);
      setActiveTab('ALL');
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du modèle.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (code) => {
    try {
      const res = await api.toggleTemplateStatus(code);
      setMessage(res.message);
      loadTemplates();
    } catch (err) {
      setError(err.message || 'Erreur lors du changement de statut.');
    }
  };

  const handleSetDefault = async (t) => {
    try {
      const res = await api.setDefaultDocumentTemplate(t.id, false);
      if (res.conflict) {
        if (window.confirm(res.message)) {
          await api.setDefaultDocumentTemplate(t.id, true);
        }
      }
      setMessage(`[${t.name}] défini comme modèle actif par défaut.`);
      loadTemplates();
    } catch (err) {
      setError(err.message || 'Erreur lors de la définition du modèle par défaut.');
    }
  };

  const handleDuplicate = async (t) => {
    try {
      const res = await api.duplicateDocumentTemplate(t.id);
      setMessage(res.message);
      loadTemplates();
    } catch (err) {
      setError('Erreur lors de la duplication : ' + err.message);
    }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Voulez-vous supprimer le modèle [${t.name}] ?`)) return;
    try {
      const res = await api.deleteDocumentTemplate(t.id);
      setMessage(res.message);
      loadTemplates();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !selectedTemplateCode) return;

    setSaving(true);
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.append('template_file', selectedFile);

    try {
      const res = await api.uploadTemplateFile(selectedTemplateCode, formData);
      setMessage(res.message);
      setSelectedFile(null);
      loadTemplates();
      loadTemplateDetail(selectedTemplateCode);
    } catch (err) {
      setError(err.message || 'Erreur lors de l’importation du fichier.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500 font-bold">Chargement du moteur de modèles...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-kindia-blue text-kindia-gold flex items-center justify-center shadow">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-lg text-slate-800">📄 Moteur de Personnalisation des Modèles Officiels</h2>
            <p className="text-xs text-slate-500">Éditeur visuel interactif, prévisualisation fidèle et gestion des versions de l’Université de Kindia</p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('ADD')}
          className="mt-3 sm:mt-0 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
        >
          <Plus className="w-4 h-4 text-kindia-gold" />
          <span>➕ AJOUTER UN TYPE DE DOCUMENT</span>
        </button>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-800 text-xs font-bold rounded-2xl border border-red-200 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sub-menu Navigation Bar */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm text-xs font-bold">
        {[
          { id: 'ALL', label: 'Tous les modèles', icon: FileText },
          { id: 'ADD', label: 'Ajouter un modèle', icon: Plus },
          { id: 'ACTIVE', label: 'Modèles actifs', icon: CheckCircle },
          { id: 'FIELDS', label: 'Champs dynamiques', icon: List },
          { id: 'VERSIONS', label: 'Gestion des versions', icon: Layers },
          { id: 'PREVIEW', label: 'Prévisualisation', icon: Eye }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 ${
                isActive
                  ? 'bg-kindia-blue text-white shadow-sm font-bold'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-kindia-gold' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TOUS LES MODÈLES AVEC PRÉVISUALISATION & PERSONNALISATION */}
      {activeTab === 'ALL' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.length === 0 && (
            <div className="col-span-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="font-heading font-black text-slate-700 text-base">Aucun modèle enregistré</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Le système ne précharge aucun faux modèle. Cliquez sur « Ajouter un modèle » pour importer ou créer votre premier modèle officiel.
              </p>
              <button 
                type="button" 
                onClick={() => setActiveTab('ADD')} 
                className="px-4 py-2 bg-kindia-blue hover:bg-blue-800 text-white rounded-xl text-xs font-black shadow-sm transition"
              >
                + Ajouter un modèle
              </button>
            </div>
          )}
          {templates.map(t => {
            const isDefault = t.is_default === 1;
            return (
              <div key={t.code} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative hover:border-kindia-gold transition flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono text-kindia-gold font-bold uppercase">{t.code}</span>
                      <h3 className="font-heading font-extrabold text-sm text-slate-800">{t.name}</h3>
                    </div>
                    {isDefault && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1">
                        <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                        <span>ACTIF</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2">{t.description || 'Modèle de document administratif officiel de l’Université de Kindia.'}</p>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-700">v{t.version || 1}</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase border ${
                      t.scope_type === 'DEPARTMENT' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                      t.scope_type === 'FACULTY' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                      'bg-purple-50 text-purple-800 border-purple-300'
                    }`}>
                      {t.scope_type || 'GLOBAL'} {t.target_service_ref ? `(${t.target_service_ref})` : ''}
                    </span>
                    {t.editor_type === 'MS_WORD' || t.format === 'DOCX' ? (
                      <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded border border-blue-200 flex items-center space-x-1">
                        <span>📄 Word</span>
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                        <span>✏️ Éditeur</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenPreview(t, null)}
                      className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
                      title="Prévisualisation fidèle du document"
                    >
                      <Eye className="w-4 h-4 text-kindia-blue" />
                      <span>Prévisualiser</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(t, null)}
                      className="py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center space-x-1"
                    >
                      <Edit3 className="w-4 h-4 text-kindia-gold" />
                      <span>Personnaliser</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-[10px] font-bold">
                    <button
                      onClick={() => handleSetDefault(t)}
                      className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center space-x-1 border border-amber-200"
                      title="Définir comme modèle actif par défaut"
                    >
                      <Star className="w-3 h-3 text-amber-600" />
                      <span>Défaut</span>
                    </button>

                    <button
                      onClick={() => api.downloadTemplateDocx(t.id).catch(e => alert(e.message))}
                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center space-x-1 border border-blue-200"
                      title="Télécharger le fichier Word DOCX"
                    >
                      <Download className="w-3 h-3" />
                      <span>DOCX</span>
                    </button>

                    <button
                      onClick={() => handleDuplicate(t)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center space-x-1"
                      title="Dupliquer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copie</span>
                    </button>

                    <button
                      onClick={() => handleDelete(t)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg flex items-center justify-center"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Suppr</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: AJOUTER UN MODÈLE */}
      {activeTab === 'ADD' && (
        <form onSubmit={handleCreateTemplate} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-2xl mx-auto text-xs">
          <h3 className="font-heading font-extrabold text-sm text-slate-800 border-b border-slate-200 pb-3 flex items-center">
            <Plus className="w-4 h-4 text-kindia-gold mr-2" />
            Créer un Nouveau Type de Document Officiel
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Code Unique du Modèle *</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Ex : ATTESTATION_TRAVAIL"
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-kindia-blue uppercase"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nom du Modèle Officiel *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex : Attestation de Service / Travail"
                className="w-full p-2.5 rounded-xl border border-slate-300"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Éditeur du Document *</label>
              <select
                value={newEditorType}
                onChange={(e) => setNewEditorType(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold bg-blue-50 text-blue-900"
              >
                <option value="MS_WORD">📄 Microsoft Word (.DOCX avec balises)</option>
                <option value="UK_GED_EDITOR">🌟 Éditeur Visuel Intégré UK-GED</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Catégorie Administrative</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              >
                <option value="OFFICIAL">Actes & Cartes Officiels</option>
                <option value="Missions">Ordres de Mission</option>
                <option value="Correspondances">Correspondances & Courriers</option>
                <option value="Notes & Décisions">Notes & Décisions</option>
                <option value="Comptes Rendus">Comptes Rendus</option>
                <option value="Administratif">Administratif Définitif</option>
              </select>
            </div>

            <div className="col-span-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
              <label className="block font-bold text-slate-700 mb-1">
                Fichier Modèle Word Initial (.DOCX) {newEditorType === 'MS_WORD' && <span className="text-blue-600 font-normal">(Optionnel : généré automatiquement si vide)</span>}
              </label>
              <input
                type="file"
                accept=".docx,.doc,.odt,.pdf"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-kindia-blue text-white font-bold rounded-xl shadow hover:bg-kindia-lightBlue transition"
            >
              {saving ? 'Création...' : 'CRÉER LE TYPE DE DOCUMENT'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: MODÈLES ACTIFS */}
      {activeTab === 'ACTIVE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.filter(t => t.is_active === 1).map(t => (
            <div key={t.code} className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase">{t.code}</span>
                  <h3 className="font-heading font-extrabold text-sm text-slate-800">{t.name}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">ACTIF</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
                <button
                  onClick={() => handleOpenPreview(t, null)}
                  className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl flex items-center justify-center space-x-1"
                >
                  <Eye className="w-4 h-4 text-kindia-blue" />
                  <span>Prévisualiser</span>
                </button>

                <button
                  onClick={() => handleOpenEdit(t, null)}
                  className="py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white rounded-xl shadow flex items-center justify-center space-x-1"
                >
                  <Edit3 className="w-4 h-4 text-kindia-gold" />
                  <span>Personnaliser</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: VERSIONS & HISTORIQUE */}
      {activeTab === 'VERSIONS' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-heading font-extrabold text-base text-slate-800">
                Gestion des Versions — {selectedTemplate?.name || selectedTemplateCode}
              </h3>
              <p className="text-xs text-slate-500">Sélectionnez et prévisualisez le fichier exact correspondant à chaque version (v1, v2, etc.)</p>
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={selectedTemplateCode}
                onChange={(e) => setSelectedTemplateCode(e.target.value)}
                className="p-2 rounded-xl border border-slate-300 text-xs font-bold font-mono"
              >
                {templates.map(t => (
                  <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                ))}
              </select>

              {selectedTemplate && (
                <button
                  onClick={() => handleOpenEdit(selectedTemplate, null)}
                  className="px-4 py-2 bg-kindia-blue text-white font-bold rounded-xl shadow hover:bg-kindia-lightBlue transition flex items-center space-x-1 text-xs"
                >
                  <Edit3 className="w-4 h-4 text-kindia-gold" />
                  <span>Personnaliser v{selectedTemplate.version || 1}</span>
                </button>
              )}
            </div>
          </div>

          {/* Versions List */}
          <div className="space-y-3">
            {templateVersions.length > 0 ? (
              templateVersions.map(v => {
                const isCurrent = v.version_number === (selectedTemplate?.version || 1);
                return (
                  <div key={v.id || v.version_number} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                    <div>
                      <div className="flex items-center space-x-2 font-mono">
                        <span className="bg-kindia-blue text-white px-2.5 py-1 rounded-lg font-bold text-xs">
                          Version v{v.version_number || v.version}
                        </span>
                        <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold text-[10px]">
                          {v.file_type || selectedTemplate?.format || 'DOCX'}
                        </span>
                        {isCurrent && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                            🟢 VERSION ACTUELLE
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 mt-1.5 text-xs font-medium">
                        {v.change_description || 'Mise à jour du modèle officiel.'}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono block mt-1">
                        Créé le : {v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : 'Récent'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 font-bold">
                      <button
                        onClick={() => handleOpenPreview(selectedTemplate, v)}
                        className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl flex items-center space-x-1.5 shadow-sm transition"
                      >
                        <Eye className="w-4 h-4 text-kindia-blue" />
                        <span>👁 Prévisualiser v{v.version_number || v.version}</span>
                      </button>

                      <button
                        onClick={() => handleOpenEdit(selectedTemplate, v)}
                        className="px-3.5 py-2 bg-kindia-blue text-white rounded-xl hover:bg-kindia-lightBlue flex items-center space-x-1.5 shadow"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-kindia-gold" />
                        <span>Personnaliser</span>
                      </button>

                      {!isCurrent && (
                        <button
                          onClick={async () => {
                            try {
                              await api.restoreTemplateVersion(selectedTemplate.id, v.id);
                              setMessage(`Version v${v.version_number} restaurée avec succès.`);
                              loadTemplates();
                              loadTemplateDetail(selectedTemplateCode);
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl flex items-center space-x-1"
                        >
                          <Star className="w-3.5 h-3.5 text-amber-700" />
                          <span>Restaurer en actif</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-slate-800 text-sm block">Version v{selectedTemplate?.version || 1} (Principale)</span>
                  <span className="text-slate-500 font-mono text-[11px]">Format : {selectedTemplate?.format || 'DOCX'}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenPreview(selectedTemplate, null)}
                    className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl flex items-center space-x-1.5 shadow-sm"
                  >
                    <Eye className="w-4 h-4 text-kindia-blue" />
                    <span>Prévisualiser v{selectedTemplate?.version || 1}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(selectedTemplate, null)}
                    className="px-3.5 py-2 bg-kindia-blue text-white rounded-xl hover:bg-kindia-lightBlue flex items-center space-x-1.5 shadow"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>Personnaliser</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Import New Version Form */}
          <form onSubmit={handleFileUpload} className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3 text-xs">
            <h4 className="font-bold text-amber-900 flex items-center text-xs">
              <Upload className="w-4 h-4 mr-2 text-amber-700" />
              Importer une Nouvelle Version de Fichier (DOCX / PDF / ODT)
            </h4>

            <input
              type="file"
              accept=".docx,.pdf,.odt"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue"
              required
            />

            <button
              type="submit"
              disabled={saving || !selectedFile}
              className="px-4 py-2 bg-kindia-blue text-white font-bold rounded-xl shadow hover:bg-kindia-lightBlue transition"
            >
              {saving ? 'Importation en cours...' : 'IMPORTER NOUVELLE VERSION'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 6: DEDICATED PREVIEW DASHBOARD */}
      {activeTab === 'PREVIEW' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-heading font-extrabold text-base text-slate-800">
                Centre de Prévisualisation des Modèles Officiels
              </h3>
              <p className="text-xs text-slate-500">Visualisation exacte des fichiers importés (DOCX, PDF, ODT)</p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-600">Modèle sélectionné :</span>
              <select
                value={selectedTemplateCode}
                onChange={(e) => setSelectedTemplateCode(e.target.value)}
                className="p-2 rounded-xl border border-slate-300 text-xs font-bold font-mono bg-slate-50"
              >
                {templates.map(t => (
                  <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>
          </div>

          {selectedTemplate && (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 max-w-2xl mx-auto text-center">
              <div className="w-14 h-14 bg-kindia-blue text-kindia-gold rounded-2xl flex items-center justify-center mx-auto shadow-md">
                <Eye className="w-7 h-7" />
              </div>

              <div>
                <h4 className="font-heading font-extrabold text-lg text-slate-800">{selectedTemplate.name}</h4>
                <div className="flex items-center justify-center space-x-3 mt-2 font-mono text-xs">
                  <span className="bg-kindia-blue text-white px-2.5 py-0.5 rounded font-bold">Version v{selectedTemplate.version || 1}</span>
                  <span>•</span>
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded font-bold">Format {selectedTemplate.format || 'DOCX'}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                Cliquez ci-dessous pour ouvrir l'interface de prévisualisation grand écran avec outils de zoom, navigation multipage et téléchargement.
              </p>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => handleOpenPreview(selectedTemplate, null)}
                  className="px-6 py-3 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center space-x-2"
                >
                  <Eye className="w-4 h-4 text-kindia-gold" />
                  <span>OUVRIR LA PRÉVISUALISATION DU FICHIER RÉEL</span>
                </button>

                <button
                  onClick={() => handleOpenEdit(selectedTemplate, null)}
                  className="px-5 py-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
                >
                  <Edit3 className="w-4 h-4 text-kindia-blue" />
                  <span>Personnaliser</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OFFICIAL ONLYOFFICE DOCS & VISUAL EDITOR MODAL */}
      {editingTemplateModal && (
        <ErrorBoundary
          onClose={() => setEditingTemplateModal(null)}
          onPreviewFallback={() => {
            const t = editingTemplateModal.template || editingTemplateModal;
            const v = editingTemplateModal.version || null;
            setEditingTemplateModal(null);
            handleOpenPreview(t, v);
          }}
        >
          {((editingTemplateModal.template?.editor_type === 'MS_WORD') || 
            (editingTemplateModal.template?.format === 'DOCX') || 
            (editingTemplateModal.template?.editor_type !== 'UK_GED_EDITOR')) ? (
            <OnlyOfficeEditorModal
              template={editingTemplateModal.template || editingTemplateModal}
              version={editingTemplateModal.version || null}
              onClose={() => setEditingTemplateModal(null)}
              onSaved={() => {
                loadTemplates();
                if (selectedTemplateCode) loadTemplateDetail(selectedTemplateCode);
              }}
              onPreviewFallback={() => {
                const t = editingTemplateModal.template || editingTemplateModal;
                const v = editingTemplateModal.version || null;
                setEditingTemplateModal(null);
                handleOpenPreview(t, v);
              }}
            />
          ) : (
            <TemplateEditorModal
              template={editingTemplateModal.template || editingTemplateModal}
              version={editingTemplateModal.version || null}
              onClose={() => setEditingTemplateModal(null)}
              onSaved={() => {
                loadTemplates();
                if (selectedTemplateCode) loadTemplateDetail(selectedTemplateCode);
              }}
            />
          )}
        </ErrorBoundary>
      )}

      {/* FULLSCREEN PREVIEW MODAL */}
      {previewModalData && (
        <TemplatePreviewModal
          template={previewModalData.template}
          version={previewModalData.version}
          onClose={() => setPreviewModalData(null)}
          onOpenEditor={(tmpl, ver) => handleOpenEdit(tmpl, ver)}
        />
      )}
    </div>
  );
}

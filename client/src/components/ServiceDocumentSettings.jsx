import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Settings, Hash, FileText, AlignCenter, AlignLeft, AlignRight, 
  RotateCcw, Sparkles, Check, Save, History, Eye, ShieldCheck, 
  Building2, Phone, Mail, Globe, MapPin, AlertCircle, CheckCircle2,
  Calendar, Layers, Tag, HelpCircle, Copy, Plus, Trash2, Edit3, AlertTriangle, X
} from 'lucide-react';

export default function ServiceDocumentSettings({ serviceId = null, onSettingsSaved }) {
  const [activeTab, setActiveTab] = useState('reference'); // 'reference' | 'header' | 'footer' | 'custom_fields' | 'preview' | 'history'
  const [settings, setSettings] = useState(null);
  const [hierarchy, setHierarchy] = useState(null);
  const [history, setHistory] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [systemFields, setSystemFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewRef, setPreviewRef] = useState('');
  const [copied, setCopied] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  // Live test values for custom fields preview
  const [sampleCustomValues, setSampleCustomValues] = useState({});

  // Modal State for Add / Edit Custom Field (Rules 2, 5, 17, 19)
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState(null); // null = new, object = edit
  const [fieldName, setFieldName] = useState('');
  const [fieldVarCode, setFieldVarCode] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState('TEXT');
  const [fieldDefaultVal, setFieldDefaultVal] = useState('');
  const [fieldOptions, setFieldOptions] = useState(''); // comma-separated for SELECT
  const [fieldDesc, setFieldDesc] = useState('');
  const [fieldAppliesRef, setFieldAppliesRef] = useState(true);
  const [fieldAppliesHeader, setFieldAppliesHeader] = useState(true);
  const [fieldAppliesFooter, setFieldAppliesFooter] = useState(true);
  const [fieldAppliesDoc, setFieldAppliesDoc] = useState(true);
  const [fieldSaving, setFieldSaving] = useState(false);

  // Delete Impact Modal State (Rule 6)
  const [deleteImpactModal, setDeleteImpactModal] = useState(null); // { field, usageInfo }
  const [deletingField, setDeletingField] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [serviceId]);

  useEffect(() => {
    if (settings) {
      updateLiveRefPreview();
    }
  }, [
    settings?.ref_pattern, 
    settings?.seq_padding, 
    settings?.prefix, 
    settings?.suffix, 
    settings?.type_codes,
    sampleCustomValues
  ]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const [settingsRes, fieldsRes, histRes] = await Promise.all([
        api.getServiceDocumentSettings(serviceId),
        api.getServiceCustomFields(serviceId).catch(() => ({ system_fields: [], custom_fields: [] })),
        api.getServiceSettingsHistory(serviceId).catch(() => ({ history: [] }))
      ]);

      setSettings(settingsRes.settings);
      setHierarchy(settingsRes.hierarchy);
      setSystemFields(fieldsRes.system_fields || []);
      setCustomFields(fieldsRes.custom_fields || []);
      setHistory(histRes.history || []);

      // Initialize default test values for custom fields
      const initialCustomValues = {};
      (fieldsRes.custom_fields || []).forEach(f => {
        initialCustomValues[f.variable_code] = f.default_value || `VAL_${f.variable_code}`;
      });
      setSampleCustomValues(initialCustomValues);

    } catch (err) {
      console.error('Error loading service document settings:', err);
      setError('Erreur lors du chargement des paramètres de documents.');
    } finally {
      setLoading(false);
    }
  };

  const updateLiveRefPreview = async () => {
    if (!settings) return;
    try {
      const res = await api.previewServiceReference({
        service_id: serviceId,
        ref_pattern: settings.ref_pattern,
        seq_padding: settings.seq_padding,
        prefix: settings.prefix,
        suffix: settings.suffix,
        type: 'LET',
        custom_values: sampleCustomValues
      });
      setPreviewRef(res.preview);
    } catch (e) {
      // Local fallback preview computation
      let p = settings.ref_pattern || '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}';
      p = p.replace(/\{UNIV\}|\{\{UNIV\}\}|\{\{UNIVERSITE\}\}/gi, 'UK')
           .replace(/\{FACULTY\}|\{\{FACULTY\}\}|\{\{FACULTE\}\}/gi, hierarchy?.facultyCode || 'FS')
           .replace(/\{DEPT\}|\{\{DEPT\}\}|\{\{DEPARTEMENT\}\}/gi, hierarchy?.deptCode || 'INFO')
           .replace(/\{SERVICE\}|\{\{SERVICE\}\}/gi, hierarchy?.serviceCode || 'INFO')
           .replace(/\{TYPE\}|\{\{TYPE\}\}/gi, 'LET')
           .replace(/\{YEAR\}|\{\{YEAR\}\}|\{\{ANNEE\}\}/gi, '2026')
           .replace(/\{MONTH\}|\{\{MONTH\}\}|\{\{MOIS\}\}/gi, '08')
           .replace(/\{SEQ\}|\{\{SEQ\}\}|\{\{NUMERO_SEQUENTIEL\}\}/gi, String(1).padStart(parseInt(settings.seq_padding) || 4, '0'));
      
      for (const [key, val] of Object.entries(sampleCustomValues)) {
        const regex = new RegExp(`\\{${key}\\}|\\{\\{${key}\\}\\}`, 'gi');
        p = p.replace(regex, val || key);
      }
      setPreviewRef(p);
    }
  };

  const insertPatternToken = (token) => {
    const current = settings?.ref_pattern || '';
    setSettings({ ...settings, ref_pattern: current + token });
  };

  const insertHeaderToken = (token) => {
    const current = settings?.header_custom_text || '';
    setSettings({ ...settings, header_custom_text: current + ' ' + token });
  };

  const insertFooterToken = (token) => {
    const current = settings?.footer_custom_text || '';
    setSettings({ ...settings, footer_custom_text: current + ' ' + token });
  };

  const handleTypeCodeChange = (typeKey, val) => {
    setSettings({
      ...settings,
      type_codes: {
        ...(settings.type_codes || {}),
        [typeKey]: val.toUpperCase()
      }
    });
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const payload = {
        ...settings,
        service_id: serviceId,
        change_summary: changeSummary || `Mise à jour des paramètres par le responsable de service`
      };

      const res = await api.updateServiceDocumentSettings(payload);
      setMessage(res.message || 'Paramètres enregistrés avec succès.');
      setSettings(res.settings);
      setChangeSummary('');
      
      // Reload history
      const histData = await api.getServiceSettingsHistory(serviceId);
      setHistory(histData.history || []);

      if (onSettingsSaved) onSettingsSaved(res.settings);
    } catch (err) {
      console.error('Error saving service document settings:', err);
      setError(err.message || 'Erreur lors de l’enregistrement des paramètres.');
    } finally {
      setSaving(false);
    }
  };

  // Open Add / Edit Custom Field Modal (Rule 2 & 5)
  const openFieldModal = (field = null) => {
    if (field) {
      setEditingField(field);
      setFieldName(field.name);
      setFieldVarCode(field.variable_code);
      setFieldLabel(field.label || field.name);
      setFieldType(field.field_type || 'TEXT');
      setFieldDefaultVal(field.default_value || '');
      setFieldOptions(Array.isArray(field.options) ? field.options.join(', ') : '');
      setFieldDesc(field.description || '');
      setFieldAppliesRef(field.applies_to_reference !== 0);
      setFieldAppliesHeader(field.applies_to_header !== 0);
      setFieldAppliesFooter(field.applies_to_footer !== 0);
      setFieldAppliesDoc(field.applies_to_document !== 0);
    } else {
      setEditingField(null);
      setFieldName('');
      setFieldVarCode('');
      setFieldLabel('');
      setFieldType('TEXT');
      setFieldDefaultVal('');
      setFieldOptions('');
      setFieldDesc('');
      setFieldAppliesRef(true);
      setFieldAppliesHeader(true);
      setFieldAppliesFooter(true);
      setFieldAppliesDoc(true);
    }
    setShowFieldModal(true);
  };

  // Save Custom Field (Add or Edit)
  const handleSaveCustomField = async (e) => {
    e.preventDefault();
    if (!fieldName.trim()) return;

    try {
      setFieldSaving(true);
      setError('');

      const parsedOptions = fieldType === 'SELECT'
        ? fieldOptions.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const payload = {
        service_id: serviceId,
        name: fieldName.trim(),
        variable_code: fieldVarCode.trim() || undefined,
        label: fieldLabel.trim() || fieldName.trim(),
        field_type: fieldType,
        options: parsedOptions,
        default_value: fieldDefaultVal.trim(),
        description: fieldDesc.trim(),
        applies_to_reference: fieldAppliesRef,
        applies_to_header: fieldAppliesHeader,
        applies_to_footer: fieldAppliesFooter,
        applies_to_document: fieldAppliesDoc
      };

      if (editingField) {
        await api.updateServiceCustomField(editingField.id, payload);
        setMessage(`Champ dynamique [${fieldName}] mis à jour avec succès.`);
      } else {
        await api.createServiceCustomField(payload);
        setMessage(`Champ dynamique [${fieldName}] créé avec succès.`);
      }

      // Reload fields list
      const updatedFieldsRes = await api.getServiceCustomFields(serviceId);
      setCustomFields(updatedFieldsRes.custom_fields || []);
      
      // Update sample values map
      setSampleCustomValues(prev => ({
        ...prev,
        [(editingField ? editingField.variable_code : payload.variable_code) || fieldName.toUpperCase()]: fieldDefaultVal || 'VAL_EXEMPLE'
      }));

      setShowFieldModal(false);
    } catch (err) {
      console.error('Save custom field error:', err);
      setError(err.message || 'Erreur lors de l’enregistrement du champ dynamique.');
    } finally {
      setFieldSaving(false);
    }
  };

  // Handle Delete Custom Field with Impact Check (Rule 6)
  const handleDeleteFieldClick = async (field) => {
    try {
      const usageRes = await api.checkServiceCustomFieldUsage(field.id);
      setDeleteImpactModal({
        field,
        usageInfo: usageRes
      });
    } catch (err) {
      console.error('Check usage error:', err);
      // fallback modal
      setDeleteImpactModal({
        field,
        usageInfo: { is_used: false, total_occurrences: 0, usages: [] }
      });
    }
  };

  const handleConfirmDeleteField = async () => {
    if (!deleteImpactModal?.field) return;

    try {
      setDeletingField(true);
      await api.deleteServiceCustomField(deleteImpactModal.field.id);
      setMessage(`Champ [${deleteImpactModal.field.name}] supprimé avec succès.`);
      
      const updatedFieldsRes = await api.getServiceCustomFields(serviceId);
      setCustomFields(updatedFieldsRes.custom_fields || []);
      setDeleteImpactModal(null);
    } catch (err) {
      console.error('Delete field error:', err);
      setError(err.message || 'Erreur lors de la suppression du champ.');
    } finally {
      setDeletingField(false);
    }
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(previewRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-xs text-slate-500 font-medium">Chargement des paramètres de documents du service...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-kindia-blue to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-black text-2xl text-kindia-gold border border-white/20 shadow-inner shrink-0">
            <Settings className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-kindia-gold bg-white/10 px-2.5 py-0.5 rounded-full">
                Configuration de l'Identité Documentaire
              </span>
              <span className="text-xs text-slate-300">
                Version {settings?.version || 1}
              </span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl mt-1 text-white">
              Paramètres des Documents — {hierarchy?.service?.name || 'Mon Service'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Personnalisation des références, en-têtes, pieds de page et champs dynamiques pour votre structure.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-kindia-gold hover:bg-amber-400 text-kindia-blue font-black px-5 py-3 rounded-2xl text-xs transition shadow-lg flex items-center space-x-2 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}</span>
        </button>
      </div>

      {message && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl flex items-center justify-between text-emerald-800 text-xs font-semibold">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl flex items-center justify-between text-rose-800 text-xs font-semibold">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-900">✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 overflow-x-auto">
        <div className="flex items-center space-x-1.5 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('reference')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'reference'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Hash className="w-4 h-4" />
            <span>Numérotation & Références</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom_fields')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'custom_fields'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Tag className="w-4 h-4 text-kindia-gold" />
            <span>Champs dynamiques ({customFields.length + systemFields.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('header')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'header'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>En-tête Officiel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('footer')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'footer'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Pied de page & Pagination</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'preview'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Aperçu Document Officiel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'history'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historique ({history.length})</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1 : NUMÉROTATION & RÉFÉRENCES (RULES 3, 4, 12, 13, 20)     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'reference' && (
        <div className="space-y-6">
          {/* Live Preview Header Card */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-kindia-gold flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Aperçu en direct de la référence générée</span>
              </span>
              <button
                type="button"
                onClick={handleCopyPreview}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
            <div className="p-4 bg-black/30 rounded-2xl border border-white/10 flex items-center justify-between">
              <span className="font-mono text-xl sm:text-2xl font-black tracking-wider text-kindia-gold">
                {previewRef || 'UK/FS/INFO/LET/2026/0001'}
              </span>
              <span className="text-xs text-slate-300 font-medium hidden sm:inline">
                (Exemple en temps réel)
              </span>
            </div>

            {/* Live Custom Values Test Inputs for Reference Preview (Rule 20) */}
            {customFields.filter(f => f.applies_to_reference !== 0).length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  🧪 Tester les valeurs de vos champs personnalisés pour l'aperçu :
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {customFields.filter(f => f.applies_to_reference !== 0).map(cf => (
                    <div key={cf.id} className="flex items-center space-x-1.5 bg-white/10 p-1.5 rounded-lg text-xs">
                      <span className="font-mono text-[10px] text-kindia-gold font-bold">{cf.variable_code}:</span>
                      <input
                        type="text"
                        value={sampleCustomValues[cf.variable_code] || ''}
                        onChange={(e) => setSampleCustomValues({
                          ...sampleCustomValues,
                          [cf.variable_code]: e.target.value
                        })}
                        placeholder={cf.default_value || 'Valeur test'}
                        className="bg-black/30 border border-white/20 rounded px-2 py-0.5 text-xs text-white outline-hidden w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Settings */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-heading font-extrabold text-base text-slate-900">
                Structure et Modèle de la Référence
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('custom_fields')}
                className="text-xs text-kindia-blue font-bold hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5 text-kindia-gold" />
                <span>Gérer les champs dynamiques</span>
              </button>
            </div>

            {/* Pattern Input & Dynamic Tags */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Format de référence personnalisé :
              </label>
              <input
                type="text"
                value={settings?.ref_pattern || ''}
                onChange={(e) => setSettings({ ...settings, ref_pattern: e.target.value })}
                placeholder="{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:ring-2 focus:ring-kindia-blue focus:bg-white outline-hidden"
              />

              {/* Dynamic Tokens Palette (System + Custom) (Rules 4, 16) */}
              <div className="pt-2 space-y-2">
                <span className="text-[11px] font-bold text-slate-600 block">
                  Cliquez sur un champ dynamique pour l'insérer dans votre modèle de référence :
                </span>
                
                {/* System fields */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 self-center mr-1">Système :</span>
                  {[
                    { token: '{{UNIVERSITE}}', label: 'Université' },
                    { token: '{{FACULTE}}', label: 'Faculté' },
                    { token: '{{DEPARTEMENT}}', label: 'Département' },
                    { token: '{{SERVICE}}', label: 'Service' },
                    { token: '{{TYPE}}', label: 'Type acte' },
                    { token: '{{ANNEE}}', label: 'Année' },
                    { token: '{{MOIS}}', label: 'Mois' },
                    { token: '{{NUMERO_SEQUENTIEL}}', label: 'Séquence' }
                  ].map((item) => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => insertPatternToken(item.token)}
                      className="px-2 py-1 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 border border-slate-200 rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1 shadow-2xs"
                    >
                      <span>+ {item.token}</span>
                      <span className="text-[10px] opacity-70 font-sans">({item.label})</span>
                    </button>
                  ))}
                </div>

                {/* Custom service fields */}
                {customFields.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] font-black uppercase text-amber-600 self-center mr-1">Propres au service :</span>
                    {customFields.map((cf) => (
                      <button
                        key={cf.id}
                        type="button"
                        onClick={() => insertPatternToken(`{{${cf.variable_code}}}`)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-kindia-gold hover:text-kindia-blue text-amber-900 border border-amber-300 rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1 shadow-2xs"
                      >
                        <span>+ {`{{${cf.variable_code}}}`}</span>
                        <span className="text-[10px] opacity-80 font-sans">({cf.name})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Padding & Counter Rules (Rule 12) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de chiffres du numéro séquentiel :
                </label>
                <select
                  value={settings?.seq_padding || 4}
                  onChange={(e) => setSettings({ ...settings, seq_padding: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value={3}>3 chiffres (ex: 001, 002...)</option>
                  <option value={4}>4 chiffres (ex: 0001, 0002...)</option>
                  <option value={5}>5 chiffres (ex: 00001...)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Réinitialisation du compteur séquentiel :
                </label>
                <select
                  value={settings?.reset_annually !== 0 ? 1 : 0}
                  onChange={(e) => setSettings({ ...settings, reset_annually: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value={1}>Annuelle (Recommence à 0001 chaque 1er janvier)</option>
                  <option value={0}>Continue (Incrément permanent sans remise à zéro)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2 : BIBLIOTHÈQUE DE CHAMPS DYNAMIQUES DU SERVICE (RULES 1-21) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'custom_fields' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="font-heading font-black text-base text-slate-900 flex items-center space-x-2">
                <Tag className="w-5 h-5 text-kindia-gold" />
                <span>Champs Dynamiques de {hierarchy?.service?.name || 'votre service'}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Créez vos propres variables personnalisées (Code projet, N° de convention, Direction...) utilisables dans les références, en-têtes et modèles.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openFieldModal(null)}
              className="px-4 py-2.5 bg-kindia-blue hover:bg-blue-800 text-white rounded-xl text-xs font-black transition flex items-center space-x-2 shadow-md shrink-0"
            >
              <Plus className="w-4 h-4 text-kindia-gold" />
              <span>+ Ajouter un champ dynamique</span>
            </button>
          </div>

          {/* Custom Fields Table (Rule 18) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Champs personnalisés créés par le service ({customFields.length})
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                Isolation stricte : invisibles pour les autres services
              </span>
            </div>

            {customFields.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Tag className="w-10 h-10 text-slate-300 mx-auto" />
                <h5 className="font-heading font-bold text-sm text-slate-700">Aucun champ personnalisé créé</h5>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Votre service utilise actuellement les champs système par défaut. Vous pouvez créer vos propres champs dynamiques selon vos besoins administratifs.
                </p>
                <button
                  type="button"
                  onClick={() => openFieldModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  + Créer un champ personnalisé
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600">
                      <th className="py-3 px-4">Champ</th>
                      <th className="py-3 px-4">Variable / Balise</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Emplacements</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customFields.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {f.name}
                          {f.label && f.label !== f.name && (
                            <span className="block text-[10px] text-slate-400 font-normal">{f.label}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-kindia-blue">
                          <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {`{{${f.variable_code}}}`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {f.field_type === 'TEXT' ? 'Texte' :
                             f.field_type === 'NUMBER' ? 'Nombre' :
                             f.field_type === 'DATE' ? 'Date' :
                             f.field_type === 'SELECT' ? 'Liste déroulante' :
                             f.field_type === 'AUTO' ? 'Automatique' : f.field_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {f.applies_to_reference !== 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Réf</span>
                            )}
                            {f.applies_to_header !== 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200">En-tête</span>
                            )}
                            {f.applies_to_footer !== 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-800 border border-purple-200">Pied</span>
                            )}
                            {f.applies_to_document !== 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Docs</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                          {f.description || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => openFieldModal(f)}
                            className="p-1.5 text-slate-600 hover:text-kindia-blue hover:bg-slate-100 rounded-lg transition"
                            title="Modifier ce champ"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFieldClick(f)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                            title="Supprimer ce champ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* System Protected Fields Section (Rule 16) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <h4 className="font-heading font-black text-sm text-slate-900">
                  Champs Système Standards (Fournis & Protégés)
                </h4>
                <p className="text-xs text-slate-500">
                  Ces champs sont universellement disponibles et résolus automatiquement par UK-GED.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {systemFields.map(sf => (
                <div key={sf.field_key} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-start justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">{sf.name}</span>
                    <span className="font-mono text-[10px] text-slate-500 font-bold">{`{{${sf.variable_code}}}`}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{sf.label}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-200 text-slate-700">
                    Système
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3 : EN-TÊTE OFFICIEL (RULE 7)                             */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'header' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-heading font-extrabold text-base text-slate-900 border-b pb-3">
            En-tête Officiel du Service
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Titre institutionnel / République :
              </label>
              <textarea
                rows={3}
                value={settings?.header_institution_name || ''}
                onChange={(e) => setSettings({ ...settings, header_institution_name: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Texte personnalisé ou variables spécifiques d'en-tête :
              </label>
              <textarea
                rows={3}
                value={settings?.header_custom_text || ''}
                onChange={(e) => setSettings({ ...settings, header_custom_text: e.target.value })}
                placeholder="Ex: {{UNIVERSITE}} - {{FACULTE}} - {{SERVICE}}"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-hidden"
              />

              {/* Insertion tags for Header */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                <span className="text-[10px] font-bold text-slate-500 self-center">Insérer dans l'en-tête :</span>
                {['{{UNIVERSITE}}', '{{FACULTE}}', '{{DEPARTEMENT}}', '{{SERVICE}}', ...customFields.map(f => `{{${f.variable_code}}}`)].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertHeaderToken(tag)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-kindia-blue hover:text-white border border-slate-200 rounded text-[10px] font-mono font-bold transition"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4 : PIED DE PAGE (RULE 8)                                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'footer' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-heading font-extrabold text-base text-slate-900 border-b pb-3">
            Pied de page Officiel & Confidentialité
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Texte du pied de page :
              </label>
              <textarea
                rows={3}
                value={settings?.footer_custom_text || ''}
                onChange={(e) => setSettings({ ...settings, footer_custom_text: e.target.value })}
                placeholder="Ex: {{SERVICE}} | {{ANNEE}} | Page {PAGE} / {TOTAL_PAGES}"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-hidden"
              />

              {/* Insertion tags for Footer */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                <span className="text-[10px] font-bold text-slate-500 self-center">Insérer dans le pied de page :</span>
                {['{{SERVICE}}', '{{ANNEE}}', 'Page {PAGE} / {TOTAL_PAGES}', ...customFields.map(f => `{{${f.variable_code}}}`)].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertFooterToken(tag)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-kindia-blue hover:text-white border border-slate-200 rounded text-[10px] font-mono font-bold transition"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5 : APERÇU COMPLET                                        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'preview' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 max-w-3xl mx-auto">
          <div className="text-center border-b pb-6 space-y-1">
            <h4 className="font-heading font-black text-sm text-kindia-blue uppercase">
              {settings?.header_institution_name || 'RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA'}
            </h4>
            <p className="text-xs font-bold text-slate-700">
              {hierarchy?.faculty?.name || ''} {hierarchy?.dept ? `— ${hierarchy.dept.name}` : ''}
            </p>
            <p className="text-xs font-mono text-kindia-gold font-bold">
              Réf : {previewRef}
            </p>
          </div>

          <div className="py-12 px-6 border-2 border-dashed border-slate-100 rounded-2xl text-center text-slate-400 text-xs">
            [ Corps du document officiel avec application automatique des variables dynamiques ]
          </div>

          <div className="text-center border-t pt-4 text-[10px] text-slate-500 font-mono">
            {settings?.footer_custom_text || 'UNIVERSITÉ DE KINDIA • BP 164 Kindia, Guinée'}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 6 : HISTORIQUE                                            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-heading font-extrabold text-base text-slate-900 border-b pb-3">
            Historique des Modifications
          </h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900">Version {h.version}</span>
                  <span className="text-slate-500 ml-2">{h.change_summary}</span>
                </div>
                <span className="text-slate-400 text-[10px]">{new Date(h.changed_at).toLocaleString('fr-FR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL : CRÉER / MODIFIER UN CHAMP DYNAMIQUE (RULES 2, 5, 17, 19)*/}
      {/* ============================================================= */}
      {showFieldModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
            
            <div className="px-6 py-4 bg-kindia-blue text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-kindia-gold" />
                <h4 className="font-heading font-black text-base">
                  {editingField ? 'Modifier le champ dynamique' : 'Ajouter un champ dynamique'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowFieldModal(false)}
                className="p-1 text-white/80 hover:text-white rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomField} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom du champ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fieldName}
                  onChange={(e) => {
                    setFieldName(e.target.value);
                    if (!editingField && !fieldVarCode) {
                      setFieldVarCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
                    }
                  }}
                  placeholder="Ex: Code projet"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Variable / Balise :
                  </label>
                  <input
                    type="text"
                    disabled={!!editingField}
                    value={fieldVarCode}
                    onChange={(e) => setFieldVarCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                    placeholder="Ex: CODE_PROJET"
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold outline-hidden ${
                      editingField ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-50 text-kindia-blue border-slate-200'
                    }`}
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Balise : {`{{${fieldVarCode || 'VAR'}}}`}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Type de valeur :
                  </label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                  >
                    <option value="TEXT">Texte libre</option>
                    <option value="NUMBER">Nombre</option>
                    <option value="DATE">Date</option>
                    <option value="SELECT">Liste déroulante (Choix multiples)</option>
                    <option value="AUTO">Valeur automatique</option>
                    <option value="SEQUENCE">Numéro séquentiel</option>
                    <option value="SERVICE_INFO">Information du service</option>
                    <option value="DOC_INFO">Information du document</option>
                  </select>
                </div>
              </div>

              {fieldType === 'SELECT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Options de la liste (séparées par des virgules) :
                  </label>
                  <input
                    type="text"
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    placeholder="Ex: PRJ-ALPHA, PRJ-BETA, PRJ-GAMMA"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valeur par défaut (optionnel) :
                </label>
                <input
                  type="text"
                  value={fieldDefaultVal}
                  onChange={(e) => setFieldDefaultVal(e.target.value)}
                  placeholder="Ex: PRJ-2026-001"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description & Usage :
                </label>
                <input
                  type="text"
                  value={fieldDesc}
                  onChange={(e) => setFieldDesc(e.target.value)}
                  placeholder="Ex: Identifiant interne du projet concerné par le document"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-hidden"
                />
              </div>

              {/* Applications checkboxes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Emplacements où le champ est utilisable :
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldAppliesRef}
                      onChange={(e) => setFieldAppliesRef(e.target.checked)}
                      className="rounded text-kindia-blue"
                    />
                    <span>Références</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldAppliesHeader}
                      onChange={(e) => setFieldAppliesHeader(e.target.checked)}
                      className="rounded text-kindia-blue"
                    />
                    <span>En-têtes</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldAppliesFooter}
                      onChange={(e) => setFieldAppliesFooter(e.target.checked)}
                      className="rounded text-kindia-blue"
                    />
                    <span>Pieds de page</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldAppliesDoc}
                      onChange={(e) => setFieldAppliesDoc(e.target.checked)}
                      className="rounded text-kindia-blue"
                    />
                    <span>Modèles & Docs</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFieldModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={fieldSaving || !fieldName.trim()}
                  className="px-5 py-2 bg-kindia-blue hover:bg-blue-800 text-white rounded-xl text-xs font-black transition shadow-md disabled:opacity-50"
                >
                  {fieldSaving ? 'Enregistrement...' : 'Enregistrer le champ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL : AVERTISSEMENT DE SUPPRESSION AVEC IMPACT (RULE 6)       */}
      {/* ============================================================= */}
      {deleteImpactModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h4 className="font-heading font-black text-base text-slate-900">
                Supprimer le champ [{deleteImpactModal.field.name}] ?
              </h4>
              
              {deleteImpactModal.usageInfo?.is_used ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-left text-xs space-y-1.5">
                  <span className="font-bold text-amber-900 block">
                    ⚠️ Ce champ dynamique est actuellement utilisé dans {deleteImpactModal.usageInfo.total_occurrences} configuration(s) :
                  </span>
                  <ul className="list-disc list-inside text-amber-800 text-[11px] space-y-0.5">
                    {deleteImpactModal.usageInfo.usages.map((u, idx) => (
                      <li key={idx}>{u.label}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-700 pt-1">
                    Voulez-vous vraiment le supprimer ? Les documents existants ne seront pas altérés.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Ce champ n'est actuellement utilisé dans aucun modèle ni référence. Sa suppression est sans risque.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDeleteImpactModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteField}
                disabled={deletingField}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition shadow-md disabled:opacity-50"
              >
                {deletingField ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Settings, Hash, FileText, AlignCenter, AlignLeft, AlignRight, 
  RotateCcw, Sparkles, Check, Save, History, Eye, ShieldCheck, 
  Building2, Phone, Mail, Globe, MapPin, AlertCircle, CheckCircle2,
  Calendar, Layers, Tag, HelpCircle, Copy
} from 'lucide-react';

export default function ServiceDocumentSettings({ serviceId = null, onSettingsSaved }) {
  const [activeTab, setActiveTab] = useState('reference'); // 'reference' | 'header' | 'footer' | 'preview' | 'history'
  const [settings, setSettings] = useState(null);
  const [hierarchy, setHierarchy] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewRef, setPreviewRef] = useState('');
  const [copied, setCopied] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

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
    settings?.type_codes
  ]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getServiceDocumentSettings(serviceId);
      setSettings(data.settings);
      setHierarchy(data.hierarchy);

      // Load history
      try {
        const histData = await api.getServiceSettingsHistory(serviceId);
        setHistory(histData.history || []);
      } catch (e) {
        console.warn('Could not load history:', e);
      }
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
        ref_pattern: settings.ref_pattern,
        seq_padding: settings.seq_padding,
        prefix: settings.prefix,
        suffix: settings.suffix,
        type: 'LET'
      });
      setPreviewRef(res.preview);
    } catch (e) {
      // Local fallback preview computation
      let p = settings.ref_pattern || '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}';
      p = p.replace(/{UNIV}/gi, 'UK')
           .replace(/{FACULTY}/gi, hierarchy?.facultyCode || 'FS')
           .replace(/{DEPT}/gi, hierarchy?.deptCode || 'INFO')
           .replace(/{SERVICE}/gi, hierarchy?.serviceCode || 'INFO')
           .replace(/{TYPE}/gi, 'LET')
           .replace(/{YEAR}/gi, '2026')
           .replace(/{MONTH}/gi, '08')
           .replace(/{SEQ}/gi, String(1).padStart(parseInt(settings.seq_padding) || 4, '0'));
      setPreviewRef(p);
    }
  };

  const insertPatternToken = (token) => {
    const current = settings?.ref_pattern || '';
    setSettings({ ...settings, ref_pattern: current + token });
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
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const payload = {
        ...settings,
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
              Personnalisation des références séquentielles, en-têtes officiels et pieds de page pour votre unité administrative.
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
      {/* TAB 1 : NUMÉROTATION & RÉFÉRENCES */}
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
              <span className="text-xs text-slate-300 font-medium">
                (Exemple : Lettre N°1 en 2026)
              </span>
            </div>
          </div>

          {/* Form Settings */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-heading font-extrabold text-base text-slate-900 border-b pb-3">
              Structure et Modèle de la Référence
            </h3>

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

              <div className="pt-2 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 block">
                  Cliquez sur un élément dynamique pour l'ajouter à votre motif :
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { token: '{UNIV}', label: 'Code Université (UK)' },
                    { token: '{FACULTY}', label: 'Faculté' },
                    { token: '{DEPT}', label: 'Département' },
                    { token: '{SERVICE}', label: 'Service' },
                    { token: '{TYPE}', label: 'Type d’acte' },
                    { token: '{YEAR}', label: 'Année (2026)' },
                    { token: '{MONTH}', label: 'Mois (08)' },
                    { token: '{SEQ}', label: 'Numéro séquentiel' }
                  ].map((item) => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => insertPatternToken(item.token)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 border border-slate-200 rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1 shadow-2xs"
                    >
                      <span>+ {item.token}</span>
                      <span className="text-[10px] opacity-75 font-sans">({item.label})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sequence Padding & Reset Rules */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Nombre de chiffres du compteur séquentiel :
                </label>
                <select
                  value={settings?.seq_padding || 4}
                  onChange={(e) => setSettings({ ...settings, seq_padding: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                >
                  <option value={3}>3 chiffres (ex: 001, 002, 003...)</option>
                  <option value={4}>4 chiffres (ex: 0001, 0002, 0003...)</option>
                  <option value={5}>5 chiffres (ex: 00001, 00002, 00003...)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Règle de réinitialisation de la numérotation :
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="reset_annually"
                      checked={settings?.reset_annually === 1 || settings?.reset_annually === true}
                      onChange={() => setSettings({ ...settings, reset_annually: 1 })}
                      className="text-kindia-blue focus:ring-kindia-blue"
                    />
                    <span><strong>Réinitialisation annuelle</strong> (repart à 0001 chaque 1er janvier)</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="reset_annually"
                      checked={settings?.reset_annually === 0 || settings?.reset_annually === false}
                      onChange={() => setSettings({ ...settings, reset_annually: 0 })}
                      className="text-kindia-blue focus:ring-kindia-blue"
                    />
                    <span><strong>Numérotation continue</strong> (conserve l'incrément d'une année sur l'autre)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Type-specific codes mapping table */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="font-heading font-extrabold text-sm text-slate-900">
                Codes Sigles par Type de Document
              </h4>
              <p className="text-xs text-slate-500">
                Définissez le sigle à injecter dans la balise <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{'{TYPE}'}</code> selon la nature de l'acte :
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[
                  { key: 'LETTRE', label: 'Lettre' },
                  { key: 'DEMANDE', label: 'Demande' },
                  { key: 'SOIT_TRANSMIS', label: 'Soit-Transmis' },
                  { key: 'NOTE_SERVICE', label: 'Note de service' },
                  { key: 'RAPPORT', label: 'Rapport' },
                  { key: 'PROCES_VERBAL', label: 'Procès-Verbal' },
                  { key: 'DECISION', label: 'Décision' },
                  { key: 'ARRETE', label: 'Arrêté' },
                  { key: 'DECRET', label: 'Décret' },
                  { key: 'CIRCULAIRE', label: 'Circulaire' },
                  { key: 'MISSION_ORDER', label: 'Ordre de mission' },
                  { key: 'AUTRE', label: 'Autres actes' }
                ].map((item) => (
                  <div key={item.key} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 block truncate">{item.label}</span>
                    <input
                      type="text"
                      value={settings?.type_codes?.[item.key] || ''}
                      onChange={(e) => handleTypeCodeChange(item.key, e.target.value)}
                      placeholder={item.key.slice(0, 3)}
                      className="w-full mt-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-kindia-blue uppercase outline-hidden"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Change summary */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                Motif ou résumé de cette modification (facultatif) :
              </label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Ex: Harmonisation des références du département pour 2026"
                className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-hidden"
              />
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2 : EN-TÊTE OFFICIEL */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'header' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-heading font-extrabold text-base text-slate-900 border-b pb-3">
            Configuration de l'En-tête Officiel des Documents
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  En-tête institutionnel supérieur :
                </label>
                <textarea
                  rows={3}
                  value={settings?.header_institution_name || ''}
                  onChange={(e) => setSettings({ ...settings, header_institution_name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Nom de la Faculté :
                </label>
                <input
                  type="text"
                  value={settings?.header_faculty_name || ''}
                  onChange={(e) => setSettings({ ...settings, header_faculty_name: e.target.value })}
                  placeholder="FACULTÉ DES SCIENCES"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold uppercase outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Nom du Département :
                </label>
                <input
                  type="text"
                  value={settings?.header_dept_name || ''}
                  onChange={(e) => setSettings({ ...settings, header_dept_name: e.target.value })}
                  placeholder="DÉPARTEMENT D'INFORMATIQUE"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold uppercase outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Nom du Service / Division :
                </label>
                <input
                  type="text"
                  value={settings?.header_service_name || ''}
                  onChange={(e) => setSettings({ ...settings, header_service_name: e.target.value })}
                  placeholder="SERVICE DES RESSOURCES HUMAINES"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold uppercase outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Adresse postale / BP :
                </label>
                <input
                  type="text"
                  value={settings?.header_address || ''}
                  onChange={(e) => setSettings({ ...settings, header_address: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Téléphone :</label>
                  <input
                    type="text"
                    value={settings?.header_phone || ''}
                    onChange={(e) => setSettings({ ...settings, header_phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Email :</label>
                  <input
                    type="email"
                    value={settings?.header_email || ''}
                    onChange={(e) => setSettings({ ...settings, header_email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Site Web officiel :</label>
                <input
                  type="text"
                  value={settings?.header_website || ''}
                  onChange={(e) => setSettings({ ...settings, header_website: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Alignement de l'en-tête :</label>
                <div className="flex space-x-3 mt-1">
                  {[
                    { id: 'CENTER', label: 'Centré officiel', icon: AlignCenter },
                    { id: 'LEFT', label: 'Gauche', icon: AlignLeft },
                    { id: 'SPLIT', label: 'Scindé (Gauche / Droite)', icon: AlignRight }
                  ].map((align) => {
                    const Icon = align.icon;
                    return (
                      <button
                        key={align.id}
                        type="button"
                        onClick={() => setSettings({ ...settings, header_alignment: align.id })}
                        className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                          settings?.header_alignment === align.id
                            ? 'bg-kindia-blue text-white border-kindia-blue shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{align.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3 : PIED DE PAGE & PAGINATION */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'footer' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-heading font-extrabold text-base text-slate-900 border-b pb-3">
            Configuration du Pied de page et de la Pagination
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Texte principal du pied de page :
              </label>
              <input
                type="text"
                value={settings?.footer_custom_text || ''}
                onChange={(e) => setSettings({ ...settings, footer_custom_text: e.target.value })}
                placeholder="Université de Kindia — Faculté des Sciences — Département d'Informatique"
                className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Mention de confidentialité / Avertissement légal :
              </label>
              <input
                type="text"
                value={settings?.footer_confidentiality_note || ''}
                onChange={(e) => setSettings({ ...settings, footer_confidentiality_note: e.target.value })}
                placeholder="Document officiel — Ne pas reproduire sans autorisation"
                className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings?.footer_enable_pagination === 1 || settings?.footer_enable_pagination === true}
                    onChange={(e) => setSettings({ ...settings, footer_enable_pagination: e.target.checked ? 1 : 0 })}
                    className="rounded text-kindia-blue focus:ring-kindia-blue"
                  />
                  <span>Activer la pagination automatique</span>
                </label>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 block">Format de la pagination :</span>
                  <input
                    type="text"
                    value={settings?.footer_pagination_format || 'Page {PAGE} / {TOTAL_PAGES}'}
                    onChange={(e) => setSettings({ ...settings, footer_pagination_format: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">Balises disponibles : {'{PAGE}'}, {'{TOTAL_PAGES}'}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings?.footer_show_separator === 1 || settings?.footer_show_separator === true}
                    onChange={(e) => setSettings({ ...settings, footer_show_separator: e.target.checked ? 1 : 0 })}
                    className="rounded text-kindia-blue focus:ring-kindia-blue"
                  />
                  <span>Afficher la ligne séparatrice au-dessus du pied de page</span>
                </label>

                <div>
                  <span className="text-[11px] text-slate-500 block">Alignement du pied de page :</span>
                  <select
                    value={settings?.footer_alignment || 'SPLIT'}
                    onChange={(e) => setSettings({ ...settings, footer_alignment: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-hidden"
                  >
                    <option value="SPLIT">Scindé (Texte à gauche, Pagination à droite)</option>
                    <option value="CENTER">Centré</option>
                    <option value="LEFT">Aligné à gauche</option>
                    <option value="RIGHT">Aligné à droite</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4 : APERÇU COMPLET DOCUMENT OFFICIEL */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-center justify-between">
            <span className="font-medium">
              Aperçu en rendu réel de la mise en page d'un acte officiel rédigé par votre service.
            </span>
            <span className="font-bold text-kindia-blue">Format A4 Officiel</span>
          </div>

          {/* Realistic A4 Page Simulator */}
          <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-300 shadow-2xl max-w-3xl mx-auto space-y-8 font-serif text-slate-900">
            
            {/* Header section */}
            <div className={`space-y-1 pb-4 ${settings?.header_alignment === 'CENTER' ? 'text-center' : 'text-left'}`}>
              <div className="font-bold text-xs uppercase tracking-wider text-slate-800 whitespace-pre-line leading-snug">
                {settings?.header_institution_name || 'RÉPUBLIQUE DE GUINÉE\nTravail – Justice – Solidarité\n\nUNIVERSITÉ DE KINDIA'}
              </div>
              {settings?.header_faculty_name && (
                <div className="font-extrabold text-sm uppercase text-slate-900 mt-1">
                  {settings.header_faculty_name}
                </div>
              )}
              {settings?.header_dept_name && (
                <div className="font-bold text-xs uppercase text-slate-800">
                  {settings.header_dept_name}
                </div>
              )}
              {settings?.header_service_name && (
                <div className="font-bold text-xs uppercase text-slate-700">
                  {settings.header_service_name}
                </div>
              )}
              <div className="text-[10px] text-slate-500 font-sans mt-1">
                {settings?.header_address} • Tél : {settings?.header_phone} • Email : {settings?.header_email}
              </div>
              <div className="w-24 h-0.5 bg-slate-900 mx-auto mt-2" />
            </div>

            {/* Reference & Date bar */}
            <div className="flex items-center justify-between font-sans text-xs pt-2">
              <div className="font-bold">
                Réf : <span className="font-mono text-kindia-blue">{previewRef || 'UK/FS/INFO/LET/2026/0001'}</span>
              </div>
              <div className="text-slate-600">
                Kindia, le {new Date().toLocaleDateString('fr-FR')}
              </div>
            </div>

            {/* Sample Body Content */}
            <div className="space-y-4 text-xs leading-relaxed font-sans text-slate-800 pt-4">
              <div className="font-bold text-sm text-slate-900 uppercase">
                Objet : Transmission du rapport d'activités et bilan académique
              </div>
              <p>
                Monsieur le Doyen / Monsieur le Recteur,
              </p>
              <p>
                J'ai l'honneur de vous transmettre par la présente le rapport d'activités ainsi que le bilan administratif de notre service pour la période académique en cours.
              </p>
              <p>
                L'ensemble des données et pièces jointes annexées ont été vérifiées et certifiées conformes aux dispositions statutaires de l'Université de Kindia.
              </p>
              <p className="pt-4 font-bold">
                Le Responsable de Service,
              </p>
            </div>

            {/* Footer section */}
            <div className="pt-12 mt-8">
              {settings?.footer_show_separator === 1 && (
                <div className="border-t border-slate-300 mb-2" />
              )}
              <div className={`text-[10px] text-slate-500 font-sans flex items-center justify-between ${
                settings?.footer_alignment === 'CENTER' ? 'justify-center' : ''
              }`}>
                <span>{settings?.footer_custom_text}</span>
                {settings?.footer_enable_pagination === 1 && (
                  <span className="font-bold text-slate-700">Page 1 / 1</span>
                )}
              </div>
              {settings?.footer_confidentiality_note && (
                <div className="text-[9px] text-slate-400 italic text-center mt-1">
                  {settings.footer_confidentiality_note}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5 : HISTORIQUE DES VERSIONS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-heading font-extrabold text-base text-slate-900 border-b pb-3">
            Journal des Versions des Paramètres
          </h3>

          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Aucune modification antérieure enregistrée pour ce service.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 bg-kindia-blue text-white rounded text-xs font-mono font-black">
                        Version {h.version}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {h.change_summary}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      Modifié par {h.first_name} {h.last_name} ({h.email}) le {new Date(h.changed_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

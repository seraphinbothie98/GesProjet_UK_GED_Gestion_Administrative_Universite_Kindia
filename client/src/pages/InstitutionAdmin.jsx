import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Building2, Upload, Save, CheckCircle, Image, Globe, Phone, Mail, MapPin, Hash, Sparkles, AlertCircle, Info, ShieldCheck, FileText, ArrowRight } from 'lucide-react';

export default function InstitutionAdmin() {
  const { refreshInstitution } = useAuth();
  const [settings, setSettings] = useState({
    name: 'UNIVERSITÉ DE KINDIA',
    ministry: 'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION',
    address: 'Quartier Foulayah, BP 164, Kindia, Guinée',
    phone: '+224 622 00 00 00',
    email: 'contact@univ-kindia.edu.gn',
    website: 'www.univ-kindia.edu.gn',
    slogan: 'Savoir - Innovation - Excellence',
    header_text: '',
    footer_text: '',
    ministry_code: 'MESRS',
    institution_code: 'UK',
    structure_name: 'Rectorat',
    structure_code: 'RECT',
    authority_name: 'Secrétaire Général',
    authority_code: 'SG',
    reference_pattern: '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
    sequence_padding: 4,
    show_logo_login: 1,
    show_logo_sidebar: 1,
    show_logo_header: 1,
    show_logo_dashboard: 1,
    show_logo_mission: 1,
    show_logo_docs: 1,
    show_logo_pdf: 1,
    show_logo_qr: 1
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getInstitutionSettings();
      setSettings(prev => ({
        ...prev,
        ...data,
        ministry_code: data.ministry_code || 'MESRS',
        institution_code: data.institution_code || 'UK',
        structure_name: data.structure_name || 'Rectorat',
        structure_code: data.structure_code || 'RECT',
        authority_name: data.authority_name || 'Secrétaire Général',
        authority_code: data.authority_code || 'SG',
        reference_pattern: data.reference_pattern || '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
        sequence_padding: data.sequence_padding || 4
      }));
      if (data.logo_path) setLogoPreview(`${data.logo_path}?v=${Date.now()}`);
    } catch (err) {
      console.error('Failed to load institution settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      let currentLogoUrl = settings.logo_path;

      // Step 1: Upload new logo first if selected
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        const logoRes = await api.uploadUniversityLogo(formData);
        if (!logoRes || !logoRes.logo_url) {
          throw new Error("L'upload du logo a échoué. Veuillez réessayer.");
        }
        currentLogoUrl = logoRes.logo_url;
        setLogoFile(null);
      }

      // Step 2: Save institution info & reference configuration
      await api.updateInstitutionSettings({
        ...settings,
        logo_path: currentLogoUrl
      });

      // Step 3: Refresh global context state and reload persisted settings
      await refreshInstitution();
      const updatedData = await api.getInstitutionSettings();
      setSettings(prev => ({ ...prev, ...updatedData }));
      if (updatedData.logo_path) {
        setLogoPreview(`${updatedData.logo_path}?v=${Date.now()}`);
      }

      setMessage('Paramètres institutionnels et règles de référencement enregistrés avec succès. Les nouveaux documents utiliseront ce format.');
    } catch (err) {
      console.error('Save institution settings error:', err);
      setError(err.message || 'Erreur lors de la sauvegarde des paramètres.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const insertTag = (tag) => {
    setSettings(prev => ({
      ...prev,
      reference_pattern: (prev.reference_pattern || '') + tag
    }));
  };

  // Real-time dynamic preview calculation
  const livePreview = useMemo(() => {
    const year = new Date().getFullYear();
    const padding = parseInt(settings.sequence_padding) || 4;
    const seq = String(1).padStart(padding, '0');
    let ref = settings.reference_pattern || '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}';
    ref = ref.replace(/{YEAR}/g, year);
    ref = ref.replace(/{SEQUENCE}/g, seq);
    ref = ref.replace(/{MINISTRY_CODE}/g, (settings.ministry_code || 'MESRS').trim().toUpperCase());
    ref = ref.replace(/{INSTITUTION_CODE}/g, (settings.institution_code || 'UK').trim().toUpperCase());
    ref = ref.replace(/{STRUCTURE_CODE}/g, (settings.structure_code || 'RECT').trim().toUpperCase());
    ref = ref.replace(/{AUTHORITY_CODE}/g, (settings.authority_code || 'SG').trim().toUpperCase());
    ref = ref.replace(/{TYPE_CODE}/g, 'DOC');
    return ref;
  }, [settings]);

  const livePreviewNext = useMemo(() => {
    const year = new Date().getFullYear();
    const padding = parseInt(settings.sequence_padding) || 4;
    const seq = String(2).padStart(padding, '0');
    let ref = settings.reference_pattern || '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}';
    ref = ref.replace(/{YEAR}/g, year);
    ref = ref.replace(/{SEQUENCE}/g, seq);
    ref = ref.replace(/{MINISTRY_CODE}/g, (settings.ministry_code || 'MESRS').trim().toUpperCase());
    ref = ref.replace(/{INSTITUTION_CODE}/g, (settings.institution_code || 'UK').trim().toUpperCase());
    ref = ref.replace(/{STRUCTURE_CODE}/g, (settings.structure_code || 'RECT').trim().toUpperCase());
    ref = ref.replace(/{AUTHORITY_CODE}/g, (settings.authority_code || 'SG').trim().toUpperCase());
    ref = ref.replace(/{TYPE_CODE}/g, 'DOC');
    return ref;
  }, [settings]);

  const livePreviewExtMiss = useMemo(() => {
    return `${livePreview}/MEX`;
  }, [livePreview]);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Chargement des paramètres institutionnels...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-kindia-blue text-white flex items-center justify-center font-bold shadow-md shadow-kindia-blue/20">
            <Building2 className="w-5 h-5 text-kindia-gold" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-800">Identité Administrative & Système de Référencement</h2>
            <p className="text-xs text-slate-500">Configuration centrale des sigles, structures et format des références officielles</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
        >
          <Save className="w-4 h-4 text-kindia-gold" />
          <span>{saving ? 'Sauvegarde en cours...' : 'Sauvegarder les Paramètres'}</span>
        </button>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center space-x-2 animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-800 text-xs font-bold rounded-2xl border border-red-200 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CARD 1: SYSTÈME CENTRAL DE GESTION DYNAMIQUE DES RÉFÉRENCES (CORE REQUIREMENT) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-kindia-blue via-slate-900 to-kindia-blue text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Hash className="w-5 h-5 text-kindia-gold" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-white flex items-center space-x-2">
                <span>Génération Automatique des Références Administratives</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-kindia-gold text-kindia-blue font-black tracking-wide uppercase">Dynamique</span>
              </h3>
              <p className="text-xs text-slate-300">Modèle personnalisable sans valeur codée en dur — Séquence annuelle sécurisée</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 text-xs text-kindia-gold font-bold">
            <Sparkles className="w-4 h-4" />
            <span>Année active : {new Date().getFullYear()}</span>
          </div>
        </div>

        {/* Live Preview Display Box */}
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                Aperçu en Direct de la Référence Générée
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Numérotation séquentielle automatique (0001, 0002...)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-xl border-2 border-kindia-blue shadow-sm space-y-1">
                <div className="text-[10px] font-bold text-kindia-blue uppercase">1er Document de l'Année</div>
                <div className="font-mono text-base font-extrabold text-slate-900 break-all">{livePreview}</div>
                <div className="text-[10px] text-slate-400">Courriers, Ordres de Mission, Actes</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Document Suivant (N° 2)</div>
                <div className="font-mono text-base font-bold text-slate-700 break-all">{livePreviewNext}</div>
                <div className="text-[10px] text-slate-400">Incrémentation automatique</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-amber-300 shadow-sm space-y-1 bg-amber-50/40">
                <div className="text-[10px] font-bold text-amber-800 uppercase">Ordres de Mission Externes</div>
                <div className="font-mono text-base font-bold text-amber-900 break-all">{livePreviewExtMiss}</div>
                <div className="text-[10px] text-amber-700">Identification missionnaires externes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Reference Form Controls */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Ministry */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Sigle du Ministère *</label>
              <input
                type="text"
                value={settings.ministry_code || ''}
                onChange={(e) => setSettings({ ...settings, ministry_code: e.target.value.toUpperCase() })}
                placeholder="Ex: MESRS"
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-kindia-blue uppercase tracking-wider"
                required
              />
              <span className="text-[10px] text-slate-500 block">Balise : {'{MINISTRY_CODE}'}</span>
            </div>

            {/* Institution */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Code Établissement *</label>
              <input
                type="text"
                value={settings.institution_code || ''}
                onChange={(e) => setSettings({ ...settings, institution_code: e.target.value.toUpperCase() })}
                placeholder="Ex: UK"
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-kindia-blue uppercase tracking-wider"
                required
              />
              <span className="text-[10px] text-slate-500 block">Balise : {'{INSTITUTION_CODE}'}</span>
            </div>

            {/* Structure */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Code Structure *</label>
              <input
                type="text"
                value={settings.structure_code || ''}
                onChange={(e) => setSettings({ ...settings, structure_code: e.target.value.toUpperCase() })}
                placeholder="Ex: RECT"
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-kindia-blue uppercase tracking-wider"
                required
              />
              <span className="text-[10px] text-slate-500 block">Balise : {'{STRUCTURE_CODE}'} (Rectorat)</span>
            </div>

            {/* Authority */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Code Autorité Signataire *</label>
              <input
                type="text"
                value={settings.authority_code || ''}
                onChange={(e) => setSettings({ ...settings, authority_code: e.target.value.toUpperCase() })}
                placeholder="Ex: SG"
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-kindia-blue uppercase tracking-wider"
                required
              />
              <span className="text-[10px] text-slate-500 block">Balise : {'{AUTHORITY_CODE}'} (Secrétaire Général)</span>
            </div>
          </div>

          {/* Pattern Builder */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-800">
                Modèle de Format de Référence Administrative *
              </label>
              <span className="text-[10px] text-slate-500 font-normal">
                Cliquez sur les balises pour les ajouter au modèle
              </span>
            </div>

            <input
              type="text"
              value={settings.reference_pattern || ''}
              onChange={(e) => setSettings({ ...settings, reference_pattern: e.target.value })}
              placeholder="{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}"
              className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-kindia-blue shadow-inner"
              required
            />

            {/* Tag Buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { tag: '{YEAR}', desc: 'Année (2026)' },
                { tag: '{SEQUENCE}', desc: 'N° Séquence (0001)' },
                { tag: '{MINISTRY_CODE}', desc: 'Sigle Ministère' },
                { tag: '{INSTITUTION_CODE}', desc: 'Code Établissement' },
                { tag: '{STRUCTURE_CODE}', desc: 'Code Structure' },
                { tag: '{AUTHORITY_CODE}', desc: 'Code Autorité' },
                { tag: '{TYPE_CODE}', desc: 'Code Type Document' }
              ].map(item => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => insertTag(item.tag)}
                  className="px-2.5 py-1 bg-white hover:bg-kindia-blue hover:text-white text-slate-700 rounded-lg border border-slate-300 text-[11px] font-mono transition flex items-center space-x-1 shadow-sm"
                  title={item.desc}
                >
                  <span className="text-kindia-blue font-bold group-hover:text-white">+</span>
                  <span>{item.tag}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setSettings({ ...settings, reference_pattern: '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}' })}
                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold transition ml-auto"
              >
                Réinitialiser au format officiel par défaut
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nombre de Chiffres de la Séquence (Padding)</label>
              <select
                value={settings.sequence_padding || 4}
                onChange={(e) => setSettings({ ...settings, sequence_padding: parseInt(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
              >
                <option value={3}>3 chiffres (ex: 001, 002...)</option>
                <option value={4}>4 chiffres (ex: 0001, 0002...) — Recommandé</option>
                <option value={5}>5 chiffres (ex: 00001, 00002...)</option>
                <option value={6}>6 chiffres (ex: 000001, 000002...)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Structure Institutionnelle & Autorité Associée</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={settings.structure_name || 'Rectorat'}
                  onChange={(e) => setSettings({ ...settings, structure_name: e.target.value })}
                  placeholder="Nom: Rectorat"
                  className="p-2.5 rounded-xl border border-slate-300"
                />
                <input
                  type="text"
                  value={settings.authority_name || 'Secrétaire Général'}
                  onChange={(e) => setSettings({ ...settings, authority_name: e.target.value })}
                  placeholder="Autorité: Secrétaire Général"
                  className="p-2.5 rounded-xl border border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Institutional Integrity Notice (Rule 4 & 10) */}
          <div className="p-4 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-slate-700 space-y-2">
            <div className="flex items-center font-bold text-kindia-blue">
              <ShieldCheck className="w-4 h-4 mr-1.5 flex-shrink-0" />
              <span>Garanties d'Intégrité et de Traçabilité Administrative :</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
              <li><strong>Immutabilité stricte :</strong> Les références attribuées aux documents existants ne sont <em>JAMAIS</em> modifiées lors des changements futurs de paramètres.</li>
              <li><strong>Historique préservé :</strong> Pour chaque document créé, les paramètres exacts en vigueur ({'{YEAR}'}, {'{MINISTRY_CODE}'}, etc.) sont archivés avec le document.</li>
              <li><strong>Changement d'année automatique :</strong> Au 1er janvier de chaque nouvelle année, le compteur séquentiel redémarre automatiquement à <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono text-kindia-blue">0001</code>.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CARD 2: IDENTITÉ VISUELLE & COORDONNÉES INSTITUTIONNELLES */}
      {/* ========================================================================= */}
      <form onSubmit={handleSave} className="grid lg:grid-cols-3 gap-6">
        
        {/* Left Column: Logo & Visual Assets */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-heading font-bold text-sm text-slate-800 flex items-center">
              <Image className="w-4 h-4 mr-2 text-kindia-blue" />
              Logo Officiel de l'Université
            </h3>

            <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-slate-50">
              {logoPreview ? (
                <div className="space-y-2">
                  <img src={logoPreview} alt="Logo Université" className="h-28 mx-auto object-contain rounded-lg shadow-sm" />
                  <span className="text-[10px] text-emerald-700 font-bold block">✓ Logo Actif Défini</span>
                </div>
              ) : (
                <div className="py-6 text-slate-400">
                  <Upload className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                  <span className="text-xs block">Aucun logo configuré</span>
                </div>
              )}

              <label className="inline-block px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl cursor-pointer shadow transition">
                <span>IMPORTER LE LOGO</span>
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoChange} className="hidden" />
              </label>

              <p className="text-[10px] text-slate-400">Formats acceptés : PNG, JPG, SVG, WEBP (Max 5 MB)</p>
            </div>
          </div>

          {/* Logo Location Toggles */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-heading font-bold text-sm text-slate-800">Emplacements d'Affichage du Logo</h3>
            
            <div className="space-y-2 text-xs">
              {[
                { key: 'show_logo_login', label: 'Page de Connexion' },
                { key: 'show_logo_sidebar', label: 'Menu Latéral (Sidebar)' },
                { key: 'show_logo_header', label: "En-tête de l'application" },
                { key: 'show_logo_dashboard', label: 'Tableau de bord' },
                { key: 'show_logo_mission', label: 'Ordres de mission' },
                { key: 'show_logo_docs', label: 'Documents officiels' },
                { key: 'show_logo_pdf', label: 'PDFs générés' },
                { key: 'show_logo_qr', label: 'Page de vérification QR Code' }
              ].map(item => (
                <label key={item.key} className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer border border-slate-200">
                  <span className="font-semibold text-slate-700">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={settings[item.key] === 1}
                    onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked ? 1 : 0 })}
                    className="rounded text-kindia-blue focus:ring-kindia-blue h-4 w-4"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Columns: Institutional Details & Headers */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-heading font-bold text-sm text-slate-800">Informations & Coordonnées de l'Établissement</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Nom Officiel de l'Université *</label>
                <input
                  type="text"
                  value={settings.name || ''}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-kindia-blue"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Nom Complet du Ministère de Tutelle *</label>
                <input
                  type="text"
                  value={settings.ministry || ''}
                  onChange={(e) => setSettings({ ...settings, ministry: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Adresse Officielle</label>
                <input
                  type="text"
                  value={settings.address || ''}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Téléphone Institutionnel</label>
                <input
                  type="text"
                  value={settings.phone || ''}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Adresse E-mail Officielle</label>
                <input
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Site Web Officiel</label>
                <input
                  type="text"
                  value={settings.website || ''}
                  onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Devise / Slogan Institutionnel</label>
                <input
                  type="text"
                  value={settings.slogan || ''}
                  onChange={(e) => setSettings({ ...settings, slogan: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-heading font-bold text-sm text-slate-800">En-tête et Pied de Page Globaux</h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">En-tête par Défaut des Documents Officiels</label>
                <textarea
                  rows={4}
                  value={settings.header_text || ''}
                  onChange={(e) => setSettings({ ...settings, header_text: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pied de Page par Défaut des Documents Officiels</label>
                <textarea
                  rows={3}
                  value={settings.footer_text || ''}
                  onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Building2, Upload, Save, CheckCircle, Image, Globe, Phone, Mail, MapPin, Hash, Sparkles, AlertCircle, Info, ShieldCheck, FileText, ArrowRight, Award, Quote, RefreshCw, Eye, User, Plus, PlusCircle, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { formatGuineaPhone } from '../utils/phoneUtils';

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
    show_logo_qr: 1,
    rector_name: 'Pr AKOYE MASSA ZOUMANIGUI',
    rector_title: "Recteur de l'Université de Kindia",
    rector_welcome_message: "Bienvenue sur la plateforme numérique officielle UK-GED de l'Université de Kindia. Notre engagement est de garantir la transparence, la célérité et la traçabilité intégrale de nos actes administratifs et académiques.",
    rector_photo_path: '/uploads/logos/rector_portrait.jpg',
    show_rector_login: 1,
    login_background_path: '/uploads/logos/login_bg_default.jpg',
    show_login_background: 1,
    login_background_overlay: 0.15,
    login_background_duration: 6
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // Background Slideshow State
  const [backgroundSlides, setBackgroundSlides] = useState([]);
  const [activeBgPreviewSlide, setActiveBgPreviewSlide] = useState(0);
  const [showAddBgModal, setShowAddBgModal] = useState(false);
  const [newBgTitle, setNewBgTitle] = useState('');
  const [newBgFile, setNewBgFile] = useState(null);
  const [newBgPreview, setNewBgPreview] = useState(null);
  const [savingBg, setSavingBg] = useState(false);

  // Leaders Carousel State
  const [leaders, setLeaders] = useState([]);
  const [activePreviewSlide, setActivePreviewSlide] = useState(0);
  const [showAddLeaderModal, setShowAddLeaderModal] = useState(false);
  const [newLeader, setNewLeader] = useState({
    name: '',
    title: '',
    subtitle: '',
    welcome_message: '',
    photo_path: '/uploads/logos/rector_portrait.jpg',
    is_active: 1
  });
  const [newLeaderPhotoFile, setNewLeaderPhotoFile] = useState(null);
  const [newLeaderPhotoPreview, setNewLeaderPhotoPreview] = useState(null);
  const [savingLeaderId, setSavingLeaderId] = useState(null);

  useEffect(() => {
    loadSettings();
    loadBackgroundSlides();
  }, []);

  const loadBackgroundSlides = async () => {
    try {
      const slides = await api.getAdminBackgrounds();
      setBackgroundSlides(slides || []);
    } catch (bErr) {
      console.warn('Failed to load background slides:', bErr);
    }
  };

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
        sequence_padding: data.sequence_padding || 4,
        rector_name: data.rector_name || 'Pr AKOYE MASSA ZOUMANIGUI',
        rector_title: data.rector_title || "Recteur de l'Université de Kindia",
        rector_welcome_message: data.rector_welcome_message || "Bienvenue sur la plateforme numérique officielle UK-GED de l'Université de Kindia. Notre engagement est de garantir la transparence, la célérité et la traçabilité intégrale de nos actes administratifs et académiques.",
        show_rector_login: data.show_rector_login !== undefined ? data.show_rector_login : 1,
        login_background_path: data.login_background_path || '/uploads/logos/login_bg_default.jpg',
        show_login_background: data.show_login_background !== undefined ? data.show_login_background : 1,
        login_background_overlay: data.login_background_overlay !== undefined ? data.login_background_overlay : 0.15,
        login_background_duration: data.login_background_duration || 6
      }));
      if (data.logo_path) setLogoPreview(`${data.logo_path}?v=${Date.now()}`);

      // Load leaders for the sliding welcome carousel
      try {
        const leadersData = await api.getAdminLeaders();
        setLeaders(leadersData || []);
      } catch (lErr) {
        console.warn('Failed to load leaders:', lErr);
      }
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

      setMessage('✓ Paramètres institutionnels enregistrés avec succès.');
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

  const getLeaderPhotoUrl = (path, timestamp) => {
    if (!path) return '/rector_portrait.jpg';
    const clean = path.split('?')[0];
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('blob:')) {
      return clean;
    }
    return timestamp ? `${clean}?v=${timestamp}` : clean;
  };

  const handleLeaderFieldChange = (id, field, value) => {
    setLeaders(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleSaveSingleLeader = async (leader) => {
    try {
      setSavingLeaderId(leader.id);
      setMessage('');
      setError('');
      const cleanLeader = {
        ...leader,
        photo_path: leader.photo_path ? leader.photo_path.split('?')[0] : leader.photo_path
      };
      await api.updateLeader(leader.id, cleanLeader);
      await refreshInstitution();
      setMessage(`✓ Fiche de « ${leader.name} » mise à jour avec succès !`);
    } catch (err) {
      console.error('Save single leader error:', err);
      setError(err.message || 'Erreur lors de l’enregistrement du responsable.');
    } finally {
      setSavingLeaderId(null);
    }
  };

  const handleLeaderPhotoUpload = async (leaderId, file) => {
    if (!file) return;
    try {
      setSavingLeaderId(leaderId);
      setMessage('');
      setError('');
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.uploadLeaderPhoto(leaderId, formData);
      if (res && res.photo_url) {
        const cleanUrl = res.photo_url.split('?')[0];
        const now = Date.now();
        setLeaders(prev => prev.map(l => l.id === leaderId ? { ...l, photo_path: cleanUrl, _timestamp: now } : l));
        await refreshInstitution();
        setMessage('✓ Photo modifiée et enregistrée avec succès !');
      }
    } catch (err) {
      console.error('Leader photo upload error:', err);
      setError(err.message || 'Erreur lors de l’envoi de la photo.');
    } finally {
      setSavingLeaderId(null);
    }
  };

  const handleCreateLeader = async (e) => {
    e.preventDefault();
    if (!newLeader.name || !newLeader.welcome_message) {
      setError('Veuillez remplir au minimum le nom et le mot de bienvenue.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      setError('');

      const res = await api.createLeader(newLeader);
      if (res && res.leader) {
        let createdId = res.leader.id;

        // If a photo was selected, upload it immediately
        if (newLeaderPhotoFile) {
          const formData = new FormData();
          formData.append('photo', newLeaderPhotoFile);
          const pRes = await api.uploadLeaderPhoto(createdId, formData);
          if (pRes && pRes.photo_url) {
            res.leader.photo_path = pRes.photo_url.split('?')[0];
            res.leader._timestamp = Date.now();
          }
        }

        setLeaders(prev => [...prev, res.leader]);
        setShowAddLeaderModal(false);
        setNewLeader({
          name: '',
          title: '',
          subtitle: '',
          welcome_message: '',
          photo_path: '/uploads/logos/rector_portrait.jpg',
          is_active: 1
        });
        setNewLeaderPhotoFile(null);
        setNewLeaderPhotoPreview(null);
        await refreshInstitution();
        setMessage('✓ Nouveau responsable ajouté avec succès au carrousel !');
      }
    } catch (err) {
      console.error('Create leader error:', err);
      setError(err.message || 'Erreur lors de l’ajout du responsable.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBackground = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newBgFile) {
      setError('Veuillez sélectionner un fichier image.');
      return;
    }
    try {
      setSavingBg(true);
      setError('');
      setMessage('');
      const formData = new FormData();
      formData.append('image', newBgFile);
      formData.append('title', newBgTitle || 'Vue du Campus');
      const res = await api.createBackgroundSlide(formData);
      if (res && res.background) {
        await loadBackgroundSlides();
        setShowAddBgModal(false);
        setNewBgFile(null);
        setNewBgPreview(null);
        setNewBgTitle('');
        await refreshInstitution();
        setMessage('✓ Nouvel arrière-plan ajouté avec succès au carrousel !');
      }
    } catch (err) {
      setError('Erreur lors de l\'ajout de l\'arrière-plan : ' + err.message);
    } finally {
      setSavingBg(false);
    }
  };

  const handleDeleteBackground = async (id, title) => {
    if (!window.confirm(`Supprimer l'arrière-plan « ${title} » ?`)) return;
    try {
      await api.deleteBackgroundSlide(id);
      await loadBackgroundSlides();
      await refreshInstitution();
      setMessage(`✓ L'arrière-plan « ${title} » a été supprimé.`);
    } catch (err) {
      setError('Erreur lors de la suppression : ' + err.message);
    }
  };

  const handleToggleBackgroundActive = async (slide) => {
    try {
      const updated = { ...slide, is_active: slide.is_active ? 0 : 1 };
      await api.updateBackgroundSlide(slide.id, updated);
      await loadBackgroundSlides();
      await refreshInstitution();
    } catch (err) {
      setError('Erreur activation arrière-plan : ' + err.message);
    }
  };

  const handleDeleteLeader = async (id, name) => {
    if (!window.confirm(`Confirmez-vous la suppression de « ${name} » du carrousel de bienvenue ?`)) {
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      setError('');
      await api.deleteLeader(id);
      setLeaders(prev => prev.filter(l => l.id !== id));
      if (activePreviewSlide >= leaders.length - 1) {
        setActivePreviewSlide(Math.max(0, leaders.length - 2));
      }
      await refreshInstitution();
      setMessage(`✓ Le responsable « ${name} » a été supprimé.`);
    } catch (err) {
      console.error('Delete leader error:', err);
      setError(err.message || 'Erreur lors de la suppression.');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveLeader = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= leaders.length) return;

    const updated = [...leaders];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setLeaders(updated);
    setActivePreviewSlide(targetIndex);

    try {
      await api.reorderLeaders(updated.map(l => l.id));
      await refreshInstitution();
    } catch (err) {
      console.error('Reorder error:', err);
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
      {/* ========================================================================= */}
      {/* CARD 2: IDENTITÉ VISUELLE & FILIGRANE OFFICIEL DE L'UNIVERSITÉ */}
      {/* ========================================================================= */}
      <form onSubmit={handleSave} className="grid lg:grid-cols-3 gap-6">
        
        {/* Left Column: Logo & Visual Assets */}
        <div className="space-y-6">
          {/* 1. LOGO OFFICIEL */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm text-slate-800 flex items-center">
                <Image className="w-4 h-4 mr-2 text-kindia-blue" />
                Logo Officiel de l'Université
              </h3>
              <span className="text-[10px] bg-blue-50 text-kindia-blue px-2 py-0.5 rounded-full font-bold">Source Officielle</span>
            </div>

            <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-slate-50">
              {logoPreview ? (
                <div className="space-y-2">
                  <div className="w-32 h-32 mx-auto bg-white rounded-xl p-2 shadow-sm border border-slate-200 flex items-center justify-center">
                    <img 
                      src={logoPreview} 
                      alt="Logo Officiel Université de Kindia" 
                      className="max-h-full max-w-full object-contain" 
                    />
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold block">✓ Logo Actif — Proportions Originales Respectées</span>
                </div>
              ) : (
                <div className="py-6 text-slate-400">
                  <Upload className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                  <span className="text-xs block">Aucun logo configuré</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <label className="w-full sm:w-auto px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl cursor-pointer shadow transition text-center">
                  <span>[ Choisir le logo officiel ]</span>
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" onChange={handleLogoChange} className="hidden" />
                </label>
              </div>

              <p className="text-[10px] text-slate-400">Formats acceptés : PNG, JPG, JPEG, SVG (Max 5 MB)</p>
            </div>
          </div>

          {/* 2. FILIGRANE OFFICIEL « GUINÉE » */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm text-slate-800 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-red-600" />
                Filigrane Officiel (« Guinée »)
              </h3>
              <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-bold">Sécurité & Authenticité</span>
            </div>

            <p className="text-[11px] text-slate-500">
              Image officielle « Guinée » avec le masque Nimba, positionnée en arrière-plan centré derrière le texte.
            </p>

            {/* Aperçu interactif du filigrane */}
            <div className="relative p-4 border-2 border-slate-200 rounded-2xl bg-white overflow-hidden text-center h-44 flex flex-col justify-center items-center shadow-inner">
              {settings.watermark_path ? (
                <>
                  <img 
                    src={settings.watermark_path.startsWith('http') ? settings.watermark_path : settings.watermark_path} 
                    alt="Filigrane Officiel Guinée"
                    style={{
                      opacity: settings.watermark_enabled !== 0 ? (settings.watermark_opacity || 0.12) : 0,
                      width: `${Math.min(220, (settings.watermark_size || 360) * 0.45)}px`,
                      transform: `translate(${settings.watermark_position_x || 0}px, ${settings.watermark_position_y || 0}px) rotate(${settings.watermark_rotation || 0}deg)`
                    }}
                    className="absolute transition-all duration-200 pointer-events-none object-contain"
                  />
                  <div className="relative z-10 space-y-1">
                    <span className="text-xs font-serif font-bold text-slate-800 block">ORDRE DE MISSION</span>
                    <p className="text-[10px] text-slate-600 max-w-xs mx-auto">
                      Exemple de texte administratif restant parfaitement lisible au premier plan.
                    </p>
                    <span className="text-[10px] text-emerald-700 font-bold block pt-1">✓ Filigrane actif à {(settings.watermark_opacity ? settings.watermark_opacity * 100 : 12).toFixed(0)}% d'opacité</span>
                  </div>
                </>
              ) : (
                <div className="text-slate-400">
                  <Upload className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <span className="text-xs block">Aucun filigrane importé</span>
                </div>
              )}
            </div>

            {/* Bouton d'upload du filigrane */}
            <div className="text-center space-y-2">
              <label className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer shadow transition">
                <span>[ Choisir l'image du filigrane ]</span>
                <input 
                  type="file" 
                  accept="image/png,image/jpeg,image/jpg,image/webp" 
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      const formData = new FormData();
                      formData.append('watermark', file);
                      try {
                        const res = await api.uploadOfficialWatermark(formData);
                        if (res.watermark_url) {
                          setSettings(prev => ({ ...prev, watermark_path: res.watermark_url, watermark_enabled: 1 }));
                          setMessage('Filigrane officiel importé avec succès.');
                        }
                      } catch (err) {
                        setError('Erreur lors de l’importation du filigrane: ' + err.message);
                      }
                    }
                  }} 
                  className="hidden" 
                />
              </label>
              <p className="text-[10px] text-slate-400">Image officielle fournie (« Guinée ») • Sans déformation</p>
            </div>

            {/* Contrôles de réglage du filigrane */}
            <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
              <div>
                <div className="flex justify-between text-slate-700 font-bold mb-1">
                  <span>Opacité du filigrane</span>
                  <span className="text-kindia-blue font-mono">{((settings.watermark_opacity !== undefined ? settings.watermark_opacity : 0.12) * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.04" 
                  max="0.30" 
                  step="0.01"
                  value={settings.watermark_opacity !== undefined ? settings.watermark_opacity : 0.12}
                  onChange={(e) => setSettings({ ...settings, watermark_opacity: parseFloat(e.target.value) })}
                  className="w-full accent-kindia-blue cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">Recommandé : 10% à 14% pour une lisibilité parfaite</span>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-bold mb-1">
                  <span>Taille du filigrane</span>
                  <span className="text-kindia-blue font-mono">{settings.watermark_size || 360} pt</span>
                </div>
                <input 
                  type="range" 
                  min="200" 
                  max="500" 
                  step="10"
                  value={settings.watermark_size || 360}
                  onChange={(e) => setSettings({ ...settings, watermark_size: parseInt(e.target.value) })}
                  className="w-full accent-kindia-blue cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700">Activer le filigrane</span>
                <input 
                  type="checkbox"
                  checked={settings.watermark_enabled !== 0}
                  onChange={(e) => setSettings({ ...settings, watermark_enabled: e.target.checked ? 1 : 0 })}
                  className="rounded text-kindia-blue focus:ring-kindia-blue h-4 w-4"
                />
              </div>
            </div>
          </div>

          {/* 3. ARRIÈRE-PLANS MULTIPLES & DIAPORAMA DE CONNEXION */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Image className="w-4 h-4 text-kindia-gold" />
                <h3 className="font-heading font-bold text-sm text-slate-800">
                  Diaporama d'Arrière-plans (Connexion)
                </h3>
              </div>
              <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                {backgroundSlides.length} Vue(s)
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              Défilement automatique en fondu enchaîné de plusieurs images du campus sur la page d'accueil.
            </p>

            {/* Live Interactive Slideshow Preview */}
            <div className="relative border-2 border-slate-200 rounded-2xl overflow-hidden text-center h-48 flex flex-col justify-center items-center shadow-inner bg-slate-900 group">
              {backgroundSlides.length > 0 ? (
                <>
                  <img 
                    src={backgroundSlides[activeBgPreviewSlide]?.image_path || backgroundSlides[0]?.image_path} 
                    alt={backgroundSlides[activeBgPreviewSlide]?.title || "Aperçu arrière-plan"}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div 
                    className="absolute inset-0 transition-opacity"
                    style={{ backgroundColor: `rgba(15, 23, 42, ${settings.login_background_overlay !== undefined ? settings.login_background_overlay : 0.15})` }}
                  />

                  {/* Navigation Arrows on Preview */}
                  {backgroundSlides.length > 1 && (
                    <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex items-center justify-between pointer-events-auto">
                      <button
                        type="button"
                        onClick={() => setActiveBgPreviewSlide((prev) => (prev - 1 + backgroundSlides.length) % backgroundSlides.length)}
                        className="p-1 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white backdrop-blur-sm transition"
                        title="Diapositive précédente"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveBgPreviewSlide((prev) => (prev + 1) % backgroundSlides.length)}
                        className="p-1 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white backdrop-blur-sm transition"
                        title="Diapositive suivante"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Slide Title Banner */}
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-sm p-1.5 rounded-xl border border-white/10 text-[10px] text-white flex items-center justify-between">
                    <span className="font-semibold truncate">
                      {backgroundSlides[activeBgPreviewSlide]?.title || 'Campus Université de Kindia'}
                    </span>
                    <span className="text-kindia-gold font-bold text-[9px] uppercase tracking-wider shrink-0 ml-1">
                      {activeBgPreviewSlide + 1} / {backgroundSlides.length}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-slate-400 p-4">
                  <Upload className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                  <span className="text-xs block">Aucune image configurée</span>
                </div>
              )}
            </div>

            {/* Actions: Add Slide & Quick Duration */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowAddBgModal(true);
                  setNewBgTitle('');
                  setNewBgFile(null);
                  setNewBgPreview(null);
                }}
                className="w-full py-2.5 px-3 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl transition text-center flex items-center justify-center space-x-1.5 shadow-md active:scale-95"
              >
                <PlusCircle className="w-4 h-4 text-kindia-gold" />
                <span>+ Ajouter une photo d'arrière-plan</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.resetLoginBackground();
                    await loadBackgroundSlides();
                    await refreshInstitution();
                    setMessage('✓ Arrière-plans réinitialisés vers les photos officielles du campus.');
                  } catch (err) {
                    setError('Erreur réinitialisation : ' + err.message);
                  }
                }}
                className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium rounded-xl transition text-center flex items-center justify-center space-x-1"
              >
                <RefreshCw className="w-3 h-3 text-slate-400" />
                <span>Rétablir les 3 photos officielles</span>
              </button>
            </div>

            {/* List of Slide Thumbnails */}
            {backgroundSlides.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 block">Galerie des diapositives :</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {backgroundSlides.map((slide, idx) => (
                    <div 
                      key={slide.id} 
                      className={`flex items-center justify-between p-2 rounded-xl border transition ${
                        idx === activeBgPreviewSlide ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div 
                        className="flex items-center space-x-2 min-w-0 cursor-pointer flex-1"
                        onClick={() => setActiveBgPreviewSlide(idx)}
                      >
                        <img 
                          src={slide.image_path} 
                          alt={slide.title} 
                          className="w-10 h-7 object-cover rounded-lg shrink-0 border border-slate-300"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{slide.title}</p>
                          <span className="text-[9px] text-slate-400 block font-mono">Diapo #{idx + 1}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleToggleBackgroundActive(slide)}
                          className={`p-1 rounded-lg text-xs transition ${
                            slide.is_active ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-slate-400 bg-slate-200 hover:bg-slate-300'
                          }`}
                          title={slide.is_active ? 'Actif dans le diaporama' : 'Désactivé'}
                        >
                          {slide.is_active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBackground(slide.id, slide.title)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Supprimer cette diapositive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slide Settings Controls */}
            <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
              {/* Program Duration */}
              <div>
                <div className="flex justify-between text-slate-700 font-bold mb-1">
                  <span>Durée d'affichage par image</span>
                  <span className="text-kindia-blue font-bold font-mono">
                    {settings.login_background_duration || 6} secondes
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[3, 5, 6, 8, 10, 15, 20, 30].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setSettings({ ...settings, login_background_duration: dur })}
                      className={`py-1 rounded-lg text-[11px] font-bold border transition ${
                        (settings.login_background_duration || 6) === dur
                          ? 'bg-kindia-blue text-white border-kindia-blue shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {dur}s
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 block pt-1">
                  Changement automatique en fondu enchaîné
                </span>
              </div>

              {/* Contrast / Darkening */}
              <div>
                <div className="flex justify-between text-slate-700 font-bold mb-1">
                  <span>Assombrissement / Contraste</span>
                  <span className="text-kindia-blue font-mono">{((settings.login_background_overlay !== undefined ? settings.login_background_overlay : 0.15) * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.0" 
                  max="0.60" 
                  step="0.05"
                  value={settings.login_background_overlay !== undefined ? settings.login_background_overlay : 0.15}
                  onChange={(e) => setSettings({ ...settings, login_background_overlay: parseFloat(e.target.value) })}
                  className="w-full accent-kindia-blue cursor-pointer"
                />
              </div>

              {/* Toggle Enable */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700">Activer le diaporama en fond</span>
                <input 
                  type="checkbox"
                  checked={settings.show_login_background !== 0}
                  onChange={(e) => setSettings({ ...settings, show_login_background: e.target.checked ? 1 : 0 })}
                  className="rounded text-kindia-blue focus:ring-kindia-blue h-4 w-4"
                />
              </div>
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
          {/* MULTI-LEADERS WELCOME CAROUSEL CUSTOMIZATION CARD */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-kindia-gold border border-amber-200 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-slate-800 flex items-center space-x-2">
                    <span>Mots de Bienvenue des Responsables (Carrousel Connexion)</span>
                    <span className="text-[10px] bg-amber-100/70 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                      {leaders.length} Responsable(s)
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Défilement automatique (slide) des portraits et messages sur le panneau bleu de la page de connexion
                  </p>
                </div>
              </div>

              {/* + ADD LEADER BUTTON */}
              <button
                type="button"
                onClick={() => {
                  setShowAddLeaderModal(!showAddLeaderModal);
                  setNewLeader({
                    name: '',
                    title: '',
                    subtitle: '',
                    welcome_message: '',
                    photo_path: '/uploads/logos/rector_portrait.jpg',
                    is_active: 1
                  });
                }}
                className="px-4 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md active:scale-95 shrink-0"
              >
                <PlusCircle className="w-4 h-4 text-kindia-gold" />
                <span>+ Ajouter un Responsable</span>
              </button>
            </div>

            {/* Toggle Display on Login */}
            <label className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer border border-slate-200">
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-slate-800 block">Activer le Carrousel des Responsables sur la page de connexion</span>
                <span className="text-[11px] text-slate-500 block">Si activé, les photos, titres et messages défileront en rotation automatique sur l'écran d'accueil</span>
              </div>
              <input
                type="checkbox"
                checked={settings.show_rector_login !== 0}
                onChange={(e) => setSettings({ ...settings, show_rector_login: e.target.checked ? 1 : 0 })}
                className="rounded text-kindia-blue focus:ring-kindia-blue h-5 w-5 ml-4"
              />
            </label>

            {/* ADD LEADER FORM MODAL / PANEL */}
            {showAddLeaderModal && (
              <div className="p-5 rounded-2xl bg-amber-50/70 border-2 border-amber-300 shadow-md space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2.5">
                  <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                    <PlusCircle className="w-4 h-4 text-amber-600" />
                    <span>Nouveau Responsable à ajouter au Carrousel</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddLeaderModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-amber-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateLeader} className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nom Complet & Grade / Titre *</label>
                      <input
                        type="text"
                        placeholder="ex: Dr DOUMBOUYA Mohamed"
                        value={newLeader.name}
                        onChange={(e) => setNewLeader({ ...newLeader, name: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-amber-300 bg-white font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Fonction / Titre Officiel *</label>
                      <input
                        type="text"
                        placeholder="ex: Secrétaire Général de l'Université de Kindia"
                        value={newLeader.title}
                        onChange={(e) => setNewLeader({ ...newLeader, title: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-amber-300 bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Sous-titre / Structure</label>
                      <input
                        type="text"
                        placeholder="ex: Secrétariat Général • Coordination"
                        value={newLeader.subtitle}
                        onChange={(e) => setNewLeader({ ...newLeader, subtitle: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-amber-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Photo / Portrait du Responsable</label>
                      <div className="flex items-center space-x-2">
                        {newLeaderPhotoPreview && (
                          <div className="w-10 h-12 rounded-lg overflow-hidden ring-2 ring-amber-400 shrink-0 bg-slate-900">
                            <img src={newLeaderPhotoPreview} alt="Aperçu" className="w-full h-full object-cover object-top" />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const f = e.target.files[0];
                              setNewLeaderPhotoFile(f);
                              setNewLeaderPhotoPreview(URL.createObjectURL(f));
                            }
                          }}
                          className="w-full text-xs p-2 rounded-xl border border-amber-300 bg-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mot de Bienvenue Personnalisé *</label>
                    <textarea
                      rows={3}
                      placeholder="Saisissez le mot de bienvenue qui apparaîtra sous le portrait de ce responsable..."
                      value={newLeader.welcome_message}
                      onChange={(e) => setNewLeader({ ...newLeader, welcome_message: e.target.value })}
                      className="w-full p-3 rounded-xl border border-amber-300 bg-white font-serif"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddLeaderModal(false)}
                      className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 rounded-xl font-bold border border-slate-300"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow transition flex items-center space-x-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{saving ? 'Ajout en cours...' : 'Enregistrer et Ajouter'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Live Interactive Carousel Preview Box */}
            {leaders.length > 0 && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-kindia-blue via-slate-900 to-slate-950 text-white border border-slate-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center space-x-1.5 text-kindia-gold">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Aperçu du Carrousel (Page de Connexion)</span>
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="bg-white/10 px-2 py-0.5 rounded-full text-white/80">
                      {activePreviewSlide + 1} / {leaders.length}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setActivePreviewSlide((prev) => (prev - 1 + leaders.length) % leaders.length)}
                        className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white"
                        title="Précédent"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePreviewSlide((prev) => (prev + 1) % leaders.length)}
                        className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white"
                        title="Suivant"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview Card */}
                {leaders[activePreviewSlide] && (
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 shadow-2xl">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-3">
                      <div className="relative shrink-0">
                        <div className="w-28 h-32 sm:w-32 sm:h-36 rounded-2xl overflow-hidden ring-4 ring-kindia-gold ring-offset-2 ring-offset-slate-950 shadow-2xl bg-slate-900 flex items-center justify-center">
                          <img
                            key={`${leaders[activePreviewSlide]?.id}_${leaders[activePreviewSlide]?.photo_path}_${leaders[activePreviewSlide]?._timestamp || activePreviewSlide}`}
                            src={getLeaderPhotoUrl(leaders[activePreviewSlide]?.photo_path, leaders[activePreviewSlide]?._timestamp)}
                            alt={leaders[activePreviewSlide]?.name || 'Responsable'}
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              if (!e.target.src.endsWith('/rector_portrait.jpg')) {
                                e.target.onerror = null;
                                e.target.src = '/rector_portrait.jpg';
                              }
                            }}
                          />
                        </div>
                        <span className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-500 to-kindia-gold text-slate-950 font-black p-1.5 rounded-full shadow-lg border-2 border-slate-900">
                          <Award className="w-4 h-4" />
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 text-center sm:text-left space-y-1">
                        <span className="inline-flex items-center space-x-1 text-[9px] font-extrabold uppercase tracking-widest text-kindia-gold bg-kindia-gold/15 px-2.5 py-0.5 rounded-full border border-kindia-gold/40 mb-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Mot de Bienvenue</span>
                        </span>
                        <h4 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-snug">
                          {leaders[activePreviewSlide].name}
                        </h4>
                        <p className="text-[11px] text-amber-200/90 font-semibold leading-tight">
                          {leaders[activePreviewSlide].title}
                        </p>
                        <div className="text-[9px] text-slate-300 font-medium pt-0.5">
                          {leaders[activePreviewSlide].subtitle || "Université de Kindia"}
                        </div>
                      </div>
                    </div>

                    <div className="relative pt-2 border-t border-white/10">
                      <Quote className="w-5 h-5 text-kindia-gold/50 absolute -top-1 -left-1 transform -scale-x-100 pointer-events-none" />
                      <p className="text-xs text-slate-100 italic leading-relaxed pl-3.5 border-l-2 border-kindia-gold font-serif">
                        « {leaders[activePreviewSlide].welcome_message} »
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LIST OF CONFIGURED LEADERS WITH PHOTO UPLOAD & DIRECT SAVE */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                  <User className="w-4 h-4 text-kindia-blue" />
                  <span>Liste des Responsables & Personnalisation Individuelle</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  Glissez/Ordonnez avec les flèches ↑ ↓
                </span>
              </div>

              {leaders.map((leader, index) => (
                <div
                  key={leader.id}
                  className={`p-4 rounded-2xl border transition ${
                    leader.is_active !== 0 ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/80 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-kindia-blue text-white text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-bold text-xs text-slate-800 truncate max-w-xs">{leader.name}</span>
                      <span className="text-[10px] text-slate-500 font-medium">({leader.title})</span>
                    </div>

                    {/* Action buttons: Move up/down, Toggle Active, Delete */}
                    <div className="flex items-center space-x-1 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleMoveLeader(index, -1)}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30"
                        title="Monter dans l'ordre"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveLeader(index, 1)}
                        disabled={index === leaders.length - 1}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30"
                        title="Descendre dans l'ordre"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      <label className="flex items-center space-x-1 px-2 py-1 bg-slate-100 rounded-lg cursor-pointer text-[10px] font-semibold text-slate-700 ml-1">
                        <input
                          type="checkbox"
                          checked={leader.is_active !== 0}
                          onChange={(e) => handleLeaderFieldChange(leader.id, 'is_active', e.target.checked ? 1 : 0)}
                          className="rounded text-kindia-blue focus:ring-kindia-blue h-3.5 w-3.5"
                        />
                        <span>{leader.is_active !== 0 ? 'Actif' : 'Masqué'}</span>
                      </label>

                      {leaders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLeader(leader.id, leader.name)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 ml-1"
                          title="Supprimer ce responsable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                    {/* Photo upload column (3 cols) */}
                    <div className="md:col-span-3 flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-center">
                      <div className="w-20 h-24 rounded-xl overflow-hidden ring-2 ring-kindia-gold shadow bg-slate-900 flex items-center justify-center">
                        <img
                          key={`${leader.id}_${leader.photo_path}_${leader._timestamp || 0}`}
                          src={getLeaderPhotoUrl(leader.photo_path, leader._timestamp)}
                          alt={leader.name || 'Responsable'}
                          className="w-full h-full object-cover object-top"
                          onError={(e) => {
                            if (!e.target.src.endsWith('/rector_portrait.jpg')) {
                              e.target.onerror = null;
                              e.target.src = '/rector_portrait.jpg';
                            }
                          }}
                        />
                      </div>

                      <label className="w-full px-2.5 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-[11px] font-bold rounded-lg cursor-pointer shadow transition text-center flex items-center justify-center space-x-1">
                        <Upload className="w-3 h-3" />
                        <span>Changer Photo</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleLeaderPhotoUpload(leader.id, e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Inputs column (9 cols) */}
                    <div className="md:col-span-9 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-bold text-slate-700 mb-0.5">Nom et Titre Académique *</label>
                          <input
                            type="text"
                            value={leader.name || ''}
                            onChange={(e) => handleLeaderFieldChange(leader.id, 'name', e.target.value)}
                            className="w-full p-2 rounded-xl border border-slate-300 font-bold text-slate-800"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-0.5">Fonction / Titre Officiel *</label>
                          <input
                            type="text"
                            value={leader.title || ''}
                            onChange={(e) => handleLeaderFieldChange(leader.id, 'title', e.target.value)}
                            className="w-full p-2 rounded-xl border border-slate-300 font-semibold"
                            required
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block font-bold text-slate-700 mb-0.5">Sous-titre / Structure de Rattachement</label>
                          <input
                            type="text"
                            value={leader.subtitle || ''}
                            onChange={(e) => handleLeaderFieldChange(leader.id, 'subtitle', e.target.value)}
                            className="w-full p-2 rounded-xl border border-slate-300 text-slate-600"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-0.5">Mot de Bienvenue Personnalisé *</label>
                        <textarea
                          rows={2}
                          value={leader.welcome_message || ''}
                          onChange={(e) => handleLeaderFieldChange(leader.id, 'welcome_message', e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 font-serif text-xs leading-relaxed"
                          required
                        />
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveSingleLeader(leader)}
                          disabled={savingLeaderId === leader.id}
                          className="px-4 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white rounded-xl text-xs font-bold shadow transition flex items-center space-x-1.5 active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5 text-kindia-gold" />
                          <span>{savingLeaderId === leader.id ? 'Enregistrement...' : 'Enregistrer ce Responsable'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
                <label className="block font-bold text-slate-700 mb-1">Téléphone Institutionnel (+224)</label>
                <input
                  type="tel"
                  value={settings.phone || ''}
                  onChange={(e) => setSettings({ ...settings, phone: formatGuineaPhone(e.target.value) })}
                  placeholder="+224 6XX XX XX XX"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-semibold"
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

      {/* MODAL: AJOUTER UNE PHOTO D'ARRIÈRE-PLAN AU CARROUSEL */}
      {showAddBgModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
            <div className="p-5 bg-gradient-to-r from-kindia-blue to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Image className="w-5 h-5 text-kindia-gold" />
                <h3 className="font-heading font-bold text-sm">Ajouter une Photo d'Arrière-Plan</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBgModal(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBackground} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Titre / Description du Visuel *</label>
                <input
                  type="text"
                  value={newBgTitle}
                  onChange={(e) => setNewBgTitle(e.target.value)}
                  placeholder="Ex: Vue Aérienne du Campus, Amphithéâtre..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Sélectionner l'Image (JPG, PNG, WEBP) *</label>
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-2xl text-center bg-slate-50 space-y-2">
                  {newBgPreview ? (
                    <div className="relative rounded-xl overflow-hidden h-36 bg-slate-900 border border-slate-300">
                      <img src={newBgPreview} alt="Aperçu" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="py-4 text-slate-400 space-y-1">
                      <Upload className="w-8 h-8 mx-auto text-slate-300" />
                      <span className="text-xs block">Aucune image sélectionnée</span>
                    </div>
                  )}

                  <label className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl cursor-pointer font-bold shadow-sm transition">
                    <span>Parcourir mon ordinateur</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setNewBgFile(file);
                          setNewBgPreview(URL.createObjectURL(file));
                          if (!newBgTitle) {
                            setNewBgTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBgModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingBg || !newBgFile}
                  className="px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-kindia-gold" />
                  <span>{savingBg ? 'Téléversement...' : 'Ajouter au Carrousel'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

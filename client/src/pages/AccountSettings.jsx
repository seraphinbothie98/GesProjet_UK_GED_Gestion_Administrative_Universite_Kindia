import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePwa } from '../context/PwaContext';
import { api } from '../services/api';
import { 
  User, ShieldCheck, Key, Lock, Mail, Phone, Building2, 
  CheckCircle2, AlertCircle, RefreshCw, LogOut, Laptop, 
  HelpCircle, Eye, EyeOff, Save, Check, X, ShieldAlert, Award,
  Camera, Upload, Trash2, Image as ImageIcon, Download, Smartphone, Monitor
} from 'lucide-react';
import { handleGuineaPhoneChange } from '../utils/phoneUtils';
import { formatFullName } from '../utils/userUtils';

export default function AccountSettings() {
  const { user, login, refreshUser, logout } = useAuth();
  const { isInstalled, promptInstall, openGuideModal, platform, browserName } = usePwa();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'identifier', 'security', 'sessions'

  // Profile Form State
  const [titre, setTitre] = useState('M.');
  const [phone, setPhone] = useState('');
  const [functionTitle, setFunctionTitle] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [photoLoading, setPhotoLoading] = useState(false);

  // Identifier Form State
  const [newMatricule, setNewMatricule] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPasswordForId, setCurrentPasswordForId] = useState('');
  const [idSaving, setIdSaving] = useState(false);
  const [idMsg, setIdMsg] = useState({ type: '', text: '' });

  // Security / Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passSaving, setPassSaving] = useState(false);
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });

  // Sessions State
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [sessionsMsg, setSessionsMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getAccountProfile();
      const u = data.user || user;
      setProfile(u);
      setTitre(u.titre || 'M.');
      setPhone(u.phone || '');
      setFunctionTitle(u.function_title || '');
      setNewMatricule(u.matricule || '');
      setNewEmail(u.email || '');
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileMsg({ type: 'error', text: 'Format invalide. Seules les images (JPG, PNG, WEBP) sont acceptées.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileMsg({ type: 'error', text: 'La taille maximale autorisée est de 5 Mo.' });
      return;
    }

    setPhotoLoading(true);
    setProfileMsg({ type: '', text: '' });
    try {
      const res = await api.uploadAccountPhoto(file);
      setProfile(prev => ({ ...prev, photo_path: res.photo_url }));
      setProfileMsg({ type: 'success', text: 'Photo de profil mise à jour avec succès !' });
      if (refreshUser) refreshUser();
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Erreur lors du téléchargement de la photo.' });
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!window.confirm('Voulez-vous vraiment supprimer votre photo de profil ?')) return;
    setPhotoLoading(true);
    setProfileMsg({ type: '', text: '' });
    try {
      await api.deleteAccountPhoto();
      setProfile(prev => ({ ...prev, photo_path: null }));
      setProfileMsg({ type: 'success', text: 'Photo de profil supprimée.' });
      if (refreshUser) refreshUser();
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Erreur lors de la suppression de la photo.' });
    } finally {
      setPhotoLoading(false);
    }
  };

  // Password strength checker helper
  const getPasswordStrength = (pass) => {
    let score = 0;
    if (!pass) return { score: 0, label: 'Vide', color: 'bg-slate-200' };
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score: 1, label: 'Faible', color: 'bg-red-500' };
    if (score <= 4) return { score: 2, label: 'Moyen', color: 'bg-amber-500' };
    return { score: 3, label: 'Robuste & Conforme', color: 'bg-emerald-500' };
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ type: '', text: '' });

    try {
      const res = await api.updateAccountProfile({ phone, function_title: functionTitle, titre });
      setProfile(res.user);
      if (refreshUser) refreshUser();
      setProfileMsg({ type: 'success', text: 'Informations personnelles et grade universitaire mis à jour avec succès.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Erreur mise à jour profil.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdateIdentifier = async (e) => {
    e.preventDefault();
    if (!currentPasswordForId) {
      setIdMsg({ type: 'error', text: 'Veuillez saisir votre mot de passe actuel pour confirmer.' });
      return;
    }

    setIdSaving(true);
    setIdMsg({ type: '', text: '' });

    try {
      const res = await api.updateAccountIdentifier({
        current_password: currentPasswordForId,
        new_matricule: newMatricule,
        new_email: newEmail
      });
      setProfile(res.user);
      setCurrentPasswordForId('');
      setIdMsg({ type: 'success', text: 'Identifiants modifiés avec succès. Vos documents et droits restent intacts.' });
    } catch (err) {
      setIdMsg({ type: 'error', text: err.message || 'Erreur lors de la modification des identifiants.' });
    } finally {
      setIdSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'La confirmation du mot de passe ne correspond pas.' });
      return;
    }

    setPassSaving(true);
    setPassMsg({ type: '', text: '' });

    try {
      const res = await api.updateAccountPassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      if (res.token) {
        localStorage.setItem('uk_token', res.token);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPassMsg({ type: 'success', text: 'Mot de passe modifié avec succès ! Toutes les autres sessions ont été fermées.' });
    } catch (err) {
      setPassMsg({ type: 'error', text: err.message || 'Erreur lors du changement de mot de passe.' });
    } finally {
      setPassSaving(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!window.confirm('Voulez-vous vraiment déconnecter toutes les autres sessions ouvertes sur d’autres appareils ?')) {
      return;
    }

    setRevokingSessions(true);
    setSessionsMsg({ type: '', text: '' });

    try {
      const res = await api.revokeAccountOtherSessions();
      if (res.token) {
        localStorage.setItem('uk_token', res.token);
      }
      setSessionsMsg({ type: 'success', text: 'Toutes les autres sessions ont été révoquées avec succès.' });
    } catch (err) {
      setSessionsMsg({ type: 'error', text: err.message || 'Erreur lors de la révocation des sessions.' });
    } finally {
      setRevokingSessions(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="animate-spin w-8 h-8 border-3 border-kindia-blue border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-xs font-medium">Chargement des paramètres de votre compte...</p>
      </div>
    );
  }

  const pStrength = getPasswordStrength(newPassword);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-kindia-blue via-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="relative w-16 h-16 rounded-2xl bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center text-2xl font-black text-kindia-gold shadow-inner shrink-0">
            {profile?.photo_path ? (
              <img
                src={profile.photo_path.split('?')[0]}
                alt={formatFullName(profile)}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : null}
            {!profile?.photo_path && (
              <span>{profile?.first_name ? profile.first_name[0] : 'U'}</span>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-heading font-extrabold text-white">
                {formatFullName(profile)}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-extrabold uppercase">
                {profile?.status || 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 flex items-center space-x-2">
              <span>{profile?.function_title || 'Membre Université'}</span>
              <span>•</span>
              <strong className="text-kindia-gold">{profile?.service_name || 'Université de Kindia'}</strong>
              <span>({profile?.role_name})</span>
            </p>
            <div className="mt-2 flex items-center space-x-2 text-[10px] font-mono text-slate-400 bg-black/30 w-fit px-2.5 py-1 rounded-lg border border-white/10">
              <span>ID Interne Immuable :</span>
              <strong className="text-white">{profile?.user_uid || `usr_${profile?.id}`}</strong>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:items-end gap-2.5 shrink-0">
          <div>
            <span className="text-[11px] text-slate-400 block">Dernière connexion :</span>
            <span className="text-xs font-bold text-slate-200">
              {profile?.last_login ? new Date(profile.last_login).toLocaleString('fr-FR') : 'Session active'}
            </span>
          </div>
          <button
            onClick={logout}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            title="Se déconnecter"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'profile'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          <span>1. Profil & Coordonnées</span>
        </button>

        <button
          onClick={() => setActiveTab('identifier')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'identifier'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>2. Identifiants de Connexion</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'security'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>3. Sécurité & Mot de Passe</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'sessions'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>4. Sessions & Sécurité</span>
        </button>

        <button
          onClick={() => setActiveTab('pwa')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'pwa'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>5. Application UK-GED (PWA)</span>
        </button>
      </div>

      {/* TAB 1: Profile & Coordonnées */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Coordonnées et Fonction</h2>
            <p className="text-xs text-slate-500">Mettez à jour vos informations professionnelles de contact et votre photo de profil.</p>
          </div>

          {profileMsg.text && (
            <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${
              profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          {/* Photo Management Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-5 max-w-xl">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white border-2 border-slate-300 shadow-sm shrink-0 flex items-center justify-center">
              {profile?.photo_path ? (
                <img
                  src={profile.photo_path.split('?')[0]}
                  alt="Photo de profil"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-kindia-blue/10 flex flex-col items-center justify-center text-kindia-blue">
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-400 mt-1">Sans photo</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1.5 text-left w-full">
              <label className="block font-bold text-slate-800 text-xs">Votre Photo de Profil</label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer px-3 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center space-x-1.5">
                  <Camera className="w-3.5 h-3.5 text-kindia-gold" />
                  <span>{photoLoading ? 'Téléchargement...' : (profile?.photo_path ? 'Modifier la photo' : 'Ajouter une photo')}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadPhoto} disabled={photoLoading} className="hidden" />
                </label>
                {profile?.photo_path && (
                  <button
                    type="button"
                    onClick={handleDeletePhoto}
                    disabled={photoLoading}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-semibold text-xs border border-rose-200 transition flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400">JPG, PNG ou WEBP (Max 5 Mo). Portrait carré recommandé.</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Titre / Grade Universitaire & Administratif *</label>
              <select
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-kindia-blue outline-none"
              >
                <option value="M.">M. (Monsieur)</option>
                <option value="Mme">Mme (Madame)</option>
                <option value="Mlle">Mlle (Mademoiselle)</option>
                <option value="Dr">Dr (Docteur)</option>
                <option value="Dre">Dre (Docteure)</option>
                <option value="Pr">Pr (Professeur)</option>
                <option value="Pr Titulaire">Pr Titulaire (Professeur Titulaire)</option>
                <option value="MCF">MCF (Maître de Conférences)</option>
                <option value="MA">MA (Maître-Assistant)</option>
                <option value="Ing.">Ing. (Ingénieur)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Prénom</label>
                <input
                  type="text"
                  disabled
                  value={profile?.first_name || ''}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nom</label>
                <input
                  type="text"
                  disabled
                  value={profile?.last_name || ''}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Service d'Appartenance</label>
              <input
                type="text"
                disabled
                value={profile?.service_name || 'Non rattaché'}
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Intitulé de Fonction</label>
              <input
                type="text"
                value={functionTitle}
                onChange={(e) => setFunctionTitle(e.target.value)}
                placeholder="Ex: Chef de Département, Enseignant-Chercheur, Responsable Administratif"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-kindia-blue"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Numéro de Téléphone Professionnel (+224)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => handleGuineaPhoneChange(e, setPhone)}
                placeholder="+224 6XX XX XX XX"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-kindia-blue"
              />
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{profileSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Identifiants de Connexion */}
      {activeTab === 'identifier' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Modification de vos Identifiants</h2>
            <p className="text-xs text-slate-500">
              Vous pouvez modifier votre matricule ou adresse email institutionnelle. Vos documents, archives et signatures resteront strictement associés à votre compte grâce à votre identifiant interne immuable.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Garantie de continuité intégrale :</span> La modification de votre identifiant n'efface aucun document, aucune archive et aucun droit. Vous utiliserez simplement ce nouvel identifiant lors de votre prochaine connexion.
            </div>
          </div>

          {idMsg.text && (
            <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${
              idMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {idMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{idMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdateIdentifier} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Matricule / Identifiant de Connexion <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newMatricule}
                onChange={(e) => setNewMatricule(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-kindia-blue"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Adresse Email Institutionnelle <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-kindia-blue"
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-900 uppercase mb-1">
                Mot de passe actuel obligatoire pour valider <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={currentPasswordForId}
                onChange={(e) => setCurrentPasswordForId(e.target.value)}
                required
                placeholder="Entrez votre mot de passe actuel..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-kindia-blue"
              />
            </div>

            <button
              type="submit"
              disabled={idSaving}
              className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Key className="w-4 h-4 text-kindia-gold" />
              <span>{idSaving ? 'Vérification...' : 'Valider le changement d’identifiants'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Sécurité & Mot de Passe */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Modification du Mot de Passe</h2>
            <p className="text-xs text-slate-500">
              Pour des raisons de sécurité, choisissez un mot de passe robuste conforme à la politique de l’Université.
            </p>
          </div>

          {passMsg.text && (
            <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${
              passMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {passMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{passMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Mot de passe actuel <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-kindia-blue"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nouveau mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-kindia-blue"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {newPassword && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Force du mot de passe :</span>
                    <span className="font-bold">{pStrength.label}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${pStrength.color} transition-all duration-300`} style={{ width: `${(pStrength.score / 3) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Confirmer le nouveau mot de passe <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-kindia-blue"
              />
            </div>

            {/* Requirements list */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <span className="font-bold block text-slate-800">Critères de sécurité obligatoires :</span>
              <div className="grid grid-cols-2 gap-1 pt-1">
                <span className={newPassword.length >= 8 ? 'text-emerald-600 font-bold' : 'text-slate-400'}>✓ Au moins 8 caractères</span>
                <span className={/[A-Z]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400'}>✓ 1 lettre majuscule</span>
                <span className={/[0-9]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400'}>✓ 1 chiffre</span>
                <span className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400'}>✓ 1 caractère spécial</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={passSaving}
              className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Lock className="w-4 h-4 text-kindia-gold" />
              <span>{passSaving ? 'Mise à jour...' : 'Modifier mon mot de passe'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: Sessions Actives */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Gestion des Sessions & Appareils</h2>
            <p className="text-xs text-slate-500">
              Contrôlez les accès connectés à votre compte et déconnectez les sessions ouvertes sur d’autres postes.
            </p>
          </div>

          {sessionsMsg.text && (
            <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${
              sessionsMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {sessionsMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{sessionsMsg.text}</span>
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between max-w-xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Session Actuelle (Ce navigateur)</span>
                <span className="text-[11px] text-slate-400">Version du token : v{profile?.token_version || 1} • Connecté</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
              Actif
            </span>
          </div>

          <div className="pt-4 border-t border-slate-100 max-w-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Déconnexion globale de sécurité
            </h3>
            <p className="text-xs text-slate-500">
              En cliquant sur ce bouton, toutes les sessions ouvertes sur d'autres ordinateurs ou téléphones seront instantanément révoquées et fermées.
            </p>
            <button
              onClick={handleRevokeOtherSessions}
              disabled={revokingSessions}
              className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs transition flex items-center space-x-2 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>{revokingSessions ? 'Révocation en cours...' : 'Déconnecter toutes les autres sessions'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: Application UK-GED (PWA) */}
      {activeTab === 'pwa' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Application UK-GED & Installation (PWA)</h2>
            <p className="text-xs text-slate-500">Gérez l'installation de l'application sur votre ordinateur ou votre smartphone.</p>
          </div>

          {/* App Presentation Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-kindia-blue to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0">
                <img
                  src="/icons/icon-192x192.png"
                  alt="Logo UK-GED"
                  className="w-full h-full object-contain"
                  onError={(e) => { e.currentTarget.src = '/logo_univ_kindia_officiel.png'; }}
                />
              </div>
              <div>
                <span className="text-[10px] font-black text-kindia-gold uppercase tracking-wider block">
                  Application Officielle
                </span>
                <h3 className="text-sm font-extrabold text-white leading-tight">
                  UK-GED — Université de Kindia
                </h3>
                <p className="text-xs text-slate-300">
                  Version Progressive Web App (PWA)
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto">
              {!isInstalled ? (
                <button
                  onClick={() => promptInstall()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-kindia-gold hover:bg-yellow-400 text-kindia-blue text-xs font-black rounded-xl shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Installer UK-GED</span>
                </button>
              ) : (
                <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center justify-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Application installée</span>
                </div>
              )}
            </div>
          </div>

          {/* Status & Diagnostic Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">État de l'installation :</span>
              <div className="flex items-center space-x-2">
                {isInstalled ? (
                  <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mode Application Autonome (Standalone)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-700 bg-slate-200 px-2.5 py-1 rounded-lg">
                    <Monitor className="w-3.5 h-3.5 text-slate-600" />
                    <span>Mode Navigateur Web Classique</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {isInstalled 
                  ? "UK-GED s'exécute actuellement dans une fenêtre applicative dédiée avec toutes les optimisations natives." 
                  : "Vous pouvez installer l'application pour un accès direct depuis le bureau ou votre écran d'accueil sans passer par le navigateur."}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Environnement détecté :</span>
              <div className="text-xs text-slate-700 space-y-1">
                <div>Système : <strong className="uppercase text-kindia-blue">{platform}</strong></div>
                <div>Navigateur : <strong className="capitalize text-slate-900">{browserName}</strong></div>
              </div>
              <button
                type="button"
                onClick={() => openGuideModal()}
                className="text-xs text-kindia-blue font-bold hover:underline flex items-center space-x-1 mt-1"
              >
                <span>Afficher le guide d'installation étape par étape</span>
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Security & Confidentiality Notice */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-kindia-blue shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900 block mb-0.5">Sécurité des données administratives de l'Université de Kindia :</strong>
              L'application installée applique scrupuleusement les mêmes règles de sécurité, de contrôle d'accès (RBAC) et d'authentification que la version web. Aucune donnée confidentielle (courriers, signatures, documents scannés) n'est mise en cache de façon non sécurisée sur votre appareil.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

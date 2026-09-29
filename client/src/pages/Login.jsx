import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePwa } from '../context/PwaContext';
import { api } from '../services/api';
import { ShieldCheck, Lock, Mail, ArrowRight, UserCheck, FileText, Search, Calendar, Eye, EyeOff, Quote, Award, Sparkles, ChevronLeft, ChevronRight, Download, CheckCircle2 } from 'lucide-react';
import PublicMissionRequestModal from '../components/PublicMissionRequestModal';
import PublicMissionTrackingModal from '../components/PublicMissionTrackingModal';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

export default function Login({ onOpenMissionModal, onOpenAppointment, onOpenTracking }) {
  const { login, institution, getLogoUrl, getRectorPhotoUrl, getLoginBackgroundUrl } = useAuth();
  const { isInstalled, promptInstall } = usePwa();
  const logoUrl = getLogoUrl();
  const showLogo = institution?.show_logo_login !== 0 && logoUrl;

  const showRector = institution?.show_rector_login !== 0;
  const showBackground = institution?.show_login_background !== 0;
  const bgOverlay = institution?.login_background_overlay !== undefined ? institution.login_background_overlay : 0.15;
  const slideDurationSeconds = institution?.login_background_duration || 6;

  // Background Slideshow State
  const [backgrounds, setBackgrounds] = useState([]);
  const [currentBgSlide, setCurrentBgSlide] = useState(0);

  // Leaders Carousel State
  const [leaders, setLeaders] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const [identity, setIdentity] = useState('sc@univ-kindia.edu.gn');
  const [password, setPassword] = useState('Agent123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickAccounts, setQuickAccounts] = useState(null);

  const [showPublicModal, setShowPublicModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  useEffect(() => {
    loadQuickAccounts();
    loadLeaders();
    loadBackgrounds();
  }, []);

  const loadBackgrounds = async () => {
    try {
      const list = await api.getPublicBackgrounds();
      if (list && list.length > 0) {
        setBackgrounds(list);
      } else {
        setBackgrounds([
          { id: 1, title: 'Bâtiment Principal & Administration', image_path: '/login_bg_default.jpg' },
          { id: 2, title: 'Campus Universitaire & Espaces Pédagogiques', image_path: '/login_bg_slide_2.jpg' },
          { id: 3, title: 'Rectorat & Bibliothèque Centrale', image_path: '/login_bg_slide_3.jpg' }
        ]);
      }
    } catch (e) {
      console.warn('Could not load background slides:', e);
      setBackgrounds([
        { id: 1, title: 'Bâtiment Principal & Administration', image_path: '/login_bg_default.jpg' },
        { id: 2, title: 'Campus Universitaire & Espaces Pédagogiques', image_path: '/login_bg_slide_2.jpg' },
        { id: 3, title: 'Rectorat & Bibliothèque Centrale', image_path: '/login_bg_slide_3.jpg' }
      ]);
    }
  };

  // Background Slide Rotation (Every `slideDurationSeconds` seconds)
  useEffect(() => {
    if (backgrounds.length <= 1) return;

    const intervalMs = Math.max(2, slideDurationSeconds) * 1000;
    const bgTimer = setInterval(() => {
      setCurrentBgSlide((prev) => (prev + 1) % backgrounds.length);
    }, intervalMs);

    return () => clearInterval(bgTimer);
  }, [backgrounds.length, slideDurationSeconds]);

  const loadLeaders = async () => {
    try {
      const list = await api.getPublicLeaders();
      if (list && list.length > 0) {
        setLeaders(list);
      } else {
        // Fallback default
        setLeaders([
          {
            id: 1,
            name: institution?.rector_name || 'Pr AKOYE MASSA ZOUMANIGUI',
            title: institution?.rector_title || "Recteur de l'Université de Kindia",
            subtitle: "Rectorat • Haute Autorité Académique",
            photo_path: institution?.rector_photo_path || '/uploads/logos/rector_portrait.jpg',
            welcome_message: institution?.rector_welcome_message || "Bienvenue sur la plateforme numérique officielle UK-GED de l'Université de Kindia. Notre engagement est de garantir la transparence, la célérité et la traçabilité intégrale de nos actes administratifs et académiques."
          }
        ]);
      }
    } catch (e) {
      console.warn('Could not load leaders, using fallback:', e);
      setLeaders([
        {
          id: 1,
          name: institution?.rector_name || 'Pr AKOYE MASSA ZOUMANIGUI',
          title: institution?.rector_title || "Recteur de l'Université de Kindia",
          subtitle: "Rectorat • Haute Autorité Académique",
          photo_path: institution?.rector_photo_path || '/uploads/logos/rector_portrait.jpg',
          welcome_message: institution?.rector_welcome_message || "Bienvenue sur la plateforme numérique officielle UK-GED de l'Université de Kindia."
        }
      ]);
    }
  };

  // Leaders Carousel Slide Rotation (every 7 seconds when not paused)
  useEffect(() => {
    if (leaders.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % leaders.length);
    }, 7000);

    return () => clearInterval(timer);
  }, [leaders.length, isPaused]);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + leaders.length) % leaders.length);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % leaders.length);
  };

  const loadQuickAccounts = async () => {
    try {
      const data = await api.getQuickAccounts();
      if (data && data.accounts) {
        setQuickAccounts(data.accounts);
        if (data.accounts.sc?.email) {
          setIdentity(data.accounts.sc.email);
        }
      }
    } catch (e) {
      console.warn('Quick accounts unavailable:', e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(identity, password);
    } catch (err) {
      setError(err.message || 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (email, pass) => {
    setIdentity(email);
    setPassword(pass);
  };

  const getLeaderPhotoUrl = (path) => {
    if (!path) return '/rector_portrait.jpg';
    const clean = path.split('?')[0];
    return clean;
  };

  const activeLeader = leaders[currentSlide] || leaders[0];

  const handleOpenMission = () => {
    if (onOpenMissionModal) onOpenMissionModal();
    else setShowPublicModal(true);
  };

  const handleOpenAppointment = () => {
    if (onOpenAppointment) onOpenAppointment();
    else setDemoAccount('sc@univ-kindia.edu.gn', 'Agent123!');
  };

  const handleOpenTracking = () => {
    if (onOpenTracking) onOpenTracking();
    else setShowTrackingModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-x-hidden">
      
      {/* Full-Screen Customizable Multi-Slide Background */}
      {showBackground && backgrounds.length > 0 && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          {backgrounds.map((bg, idx) => (
            <div
              key={bg.id || idx}
              className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out scale-105 ${
                idx === currentBgSlide ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                backgroundImage: `url(${bg.image_path})`,
                filter: 'brightness(0.95)'
              }}
            />
          ))}

          {/* Subtle Contrast & Atmosphere Tint Overlay */}
          <div 
            className="absolute inset-0 transition-opacity duration-500"
            style={{ 
              backgroundColor: `rgba(15, 23, 42, ${bgOverlay})`,
              backdropFilter: 'blur(0.5px)'
            }}
          />

          {/* Slide Title and Indicator (Bottom Left) */}
          {backgrounds.length > 1 && (
            <div className="absolute bottom-4 left-4 sm:left-6 z-20 hidden sm:flex items-center space-x-2.5 bg-slate-950/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 text-white shadow-xl pointer-events-auto">
              <span className="font-semibold text-[11px] text-amber-200/90 truncate max-w-[240px]">
                {backgrounds[currentBgSlide]?.title || 'Campus Université de Kindia'}
              </span>
              <div className="flex items-center space-x-1 pl-1 border-l border-white/20">
                {backgrounds.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentBgSlide(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentBgSlide ? 'w-4 bg-kindia-gold' : 'w-1.5 bg-white/40 hover:bg-white/80'
                    }`}
                    title={`Vue ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Background Glow Patterns (Soft decorative fallback) */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-kindia-blue rounded-full filter blur-3xl opacity-30 pointer-events-none z-0"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-kindia-gold rounded-full filter blur-3xl opacity-20 pointer-events-none z-0"></div>

      {/* Single Unified Header Action Bar (Top Right) */}
      <header className="w-full max-w-5xl z-20 flex justify-end items-center mb-3">
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/70 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-xl">
          <button
            type="button"
            onClick={handleOpenMission}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-wide shadow-md transition flex items-center space-x-1.5 active:scale-95 border border-emerald-400/30"
            title="Transmettre une demande d'ordre de mission au Secrétariat Central"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-200" />
            <span className="uppercase text-[11px]">Demander un ordre de mission</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAppointment}
            className="px-3.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center space-x-1.5 active:scale-95 border border-white/10"
            title="Prise de contact et audiences institutionnelles"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px]">Rendez-vous</span>
          </button>

          <button
            type="button"
            onClick={handleOpenTracking}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-kindia-gold hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-md transition flex items-center space-x-1.5 active:scale-95 border border-amber-300/40"
            title="Vérifier le statut d'un document ou courrier avec son code de suivi"
          >
            <Search className="w-3.5 h-3.5 text-slate-950" />
            <span className="text-[11px]">Suivi de document</span>
          </button>
        </div>
      </header>

      {/* Main Glassmorphic Login Card */}
      <div className="max-w-5xl w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden grid md:grid-cols-12 relative z-10 border border-white/40 my-auto">
        
        {/* Left Side: Branding & Leaders Welcome Carousel (5 cols) */}
        <div className="md:col-span-5 p-6 sm:p-8 bg-gradient-to-br from-kindia-blue via-slate-900 to-slate-950 text-white flex flex-col justify-between relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-800">
          
          {/* Top Branding */}
          <div className="relative z-10 space-y-3">
            <div className="flex items-center space-x-3">
              {showLogo && (
                <div className="w-12 h-12 bg-white rounded-xl p-1.5 shadow-lg flex items-center justify-center shrink-0">
                  <img src={logoUrl} alt="Logo UK" className="max-h-full max-w-full object-contain" />
                </div>
              )}
              <div>
                <h1 className="font-heading text-xl font-extrabold tracking-wide text-white flex items-center space-x-2">
                  <span>UK-GED</span>
                  <span className="text-[10px] bg-kindia-gold/20 text-kindia-gold border border-kindia-gold/40 font-bold px-2 py-0.5 rounded-full">v2.0</span>
                </h1>
                <p className="text-[11px] text-kindia-gold font-bold uppercase tracking-wider">
                  Université de Kindia
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Plateforme Numérique Officielle de Gestion Électronique des Documents & Ordres de Mission.
            </p>
          </div>

          {/* Center: Sliding Carousel of University Leaders */}
          {showRector && activeLeader && (
            <div 
              className="relative z-10 my-3 bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 shadow-2xl transition-all duration-500"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Carousel Header & Counter Controls */}
              {leaders.length > 1 && (
                <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-white/10">
                  <div className="flex items-center space-x-1">
                    {leaders.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentSlide(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-5 bg-kindia-gold' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
                        title={`Afficher responsable ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[9px] text-amber-200/80 font-mono font-bold">
                      {currentSlide + 1} / {leaders.length}
                    </span>
                    <div className="flex items-center space-x-0.5">
                      <button
                        type="button"
                        onClick={prevSlide}
                        className="p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white transition active:scale-90"
                        title="Responsable précédent"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={nextSlide}
                        className="p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white transition active:scale-90"
                        title="Responsable suivant"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Card Content */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-3">
                {/* Enlarged Prominent Photo Frame */}
                <div className="relative shrink-0 group">
                  <div className="w-28 h-32 sm:w-32 sm:h-36 rounded-2xl overflow-hidden ring-4 ring-kindia-gold ring-offset-2 ring-offset-slate-950 shadow-2xl bg-slate-900 flex items-center justify-center">
                    <img 
                      key={`${activeLeader?.id}_${activeLeader?.photo_path}_${currentSlide}`}
                      src={getLeaderPhotoUrl(activeLeader?.photo_path)} 
                      alt={activeLeader?.name || 'Responsable'} 
                      className="w-full h-full object-cover object-top transition duration-300 group-hover:scale-105"
                      onError={(e) => {
                        if (!e.target.src.endsWith('/rector_portrait.jpg')) {
                          e.target.onerror = null;
                          e.target.src = '/rector_portrait.jpg';
                        }
                      }}
                    />
                  </div>
                  <span className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-500 to-kindia-gold text-slate-950 font-black p-1.5 rounded-full shadow-lg border-2 border-slate-900" title="Autorité Académique">
                    <Award className="w-4 h-4" />
                  </span>
                </div>

                {/* Identity & Badges */}
                <div className="min-w-0 flex-1 text-center sm:text-left space-y-1">
                  <span className="inline-flex items-center space-x-1 text-[9px] font-extrabold uppercase tracking-widest text-kindia-gold bg-kindia-gold/15 px-2.5 py-0.5 rounded-full border border-kindia-gold/40 mb-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Mot de Bienvenue</span>
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-snug">
                    {activeLeader.name}
                  </h3>
                  <p className="text-[11px] text-amber-200/90 font-semibold leading-tight">
                    {activeLeader.title}
                  </p>
                  <div className="text-[9px] text-slate-300 font-medium pt-0.5">
                    {activeLeader.subtitle || "Université de Kindia"}
                  </div>
                </div>
              </div>

              {/* Personalized Message Quote */}
              <div className="relative pt-2 border-t border-white/10">
                <Quote className="w-5 h-5 text-kindia-gold/50 absolute -top-1 -left-1 transform -scale-x-100 pointer-events-none" />
                <p className="text-xs text-slate-100 italic leading-relaxed pl-3.5 border-l-2 border-kindia-gold font-serif">
                  « {activeLeader.welcome_message} »
                </p>
              </div>
            </div>
          )}

          {/* Bottom Security / Trust Indicators */}
          <div className="relative z-10 space-y-2 pt-2">
            <div className="flex items-center space-x-2 text-[11px] text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-kindia-gold shrink-0" />
              <span>Conforme aux Procédures Administratives Universitaires</span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-kindia-gold shrink-0" />
              <span>Signatures Scellées & Traçabilité Intégrale</span>
            </div>
            <div className="text-[9px] text-slate-400 border-t border-white/10 pt-2.5 flex items-center justify-between">
              <span>Plateforme Certifiée 2026</span>
              <span className="text-kindia-gold font-semibold">Université de Kindia</span>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form (7 cols) */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold text-slate-800">Espace de Connexion</h2>
            <p className="text-xs text-slate-500 mt-1">Entrez vos identifiants institutionnels</p>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email / Matricule *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="sc@univ-kindia.edu.gn"
                    required
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue focus:border-kindia-blue"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">Mot de passe *</label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[11px] text-kindia-blue hover:text-kindia-lightBlue font-semibold hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full text-xs pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue focus:border-kindia-blue transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 focus:outline-none rounded-lg hover:bg-slate-100 transition"
                    title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>{loading ? 'Connexion en cours...' : 'SE CONNECTER'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Public Action Card (Without Account) */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider flex items-center space-x-1">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Demandeurs d'ordre de mission :</span>
                  </span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                    Sans compte requis
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed mb-2.5">
                  Enseignants, chercheurs ou membres du personnel (rattachés ou non) : transmettez directement votre demande au Secrétariat Central.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPublicModal(true)}
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center space-x-1.5 shadow-md active:scale-95"
                  >
                    <FileText className="w-4 h-4 text-emerald-200" />
                    <span>DEMANDER UN ORDRE DE MISSION</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTrackingModal(true)}
                    className="py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
                    title="Suivre l'état d'une demande transmise au Secrétariat Central"
                  >
                    <Search className="w-3.5 h-3.5 text-slate-500" />
                    <span>Suivre ma demande</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Demo Accounts Selection */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-500 block mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <UserCheck className="w-3.5 h-3.5 text-kindia-gold" />
                <span>Tester avec un compte préconfiguré :</span>
              </span>
              <span className="text-[9px] text-slate-400 font-semibold">Comptes actifs détectés</span>
            </span>

            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <button 
                type="button"
                onClick={() => setDemoAccount(quickAccounts?.sc?.email || 'sc@univ-kindia.edu.gn', 'Agent123!')} 
                className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-semibold rounded text-left border border-slate-200 transition truncate"
                title={quickAccounts?.sc?.email}
              >
                <div className="font-bold text-kindia-blue">1. Secrétariat Central</div>
                <div className="text-[9px] text-slate-500 truncate">{quickAccounts?.sc?.name || 'Agent SC'}</div>
              </button>

              <button 
                type="button"
                onClick={() => setDemoAccount(quickAccounts?.sg?.email || 'sg@univ-kindia.edu.gn', 'Sg123!')} 
                className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-semibold rounded text-left border border-slate-200 transition truncate"
                title={quickAccounts?.sg?.email}
              >
                <div className="font-bold text-kindia-blue">2. Secrétaire Général</div>
                <div className="text-[9px] text-slate-500 truncate">{quickAccounts?.sg?.name || 'Dr DOUMBOUYA'}</div>
              </button>

              <button 
                type="button"
                onClick={() => setDemoAccount(quickAccounts?.recteur?.email || 'recteur@univ-kindia.edu.gn', 'Recteur123!')} 
                className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-semibold rounded text-left border border-slate-200 transition truncate"
                title={quickAccounts?.recteur?.email}
              >
                <div className="font-bold text-kindia-blue">3. Recteur</div>
                <div className="text-[9px] text-slate-500 truncate">{quickAccounts?.recteur?.name || 'Pr ZOUMANIGUI'}</div>
              </button>

              <button 
                type="button"
                onClick={() => setDemoAccount(quickAccounts?.admin?.email || 'admin@univ-kindia.edu.gn', 'Admin123!')} 
                className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-semibold rounded text-left border border-slate-200 transition truncate"
                title={quickAccounts?.admin?.email}
              >
                <div className="font-bold text-kindia-blue">4. Administrateur</div>
                <div className="text-[9px] text-slate-500 truncate">{quickAccounts?.admin?.name || 'Admin Système'}</div>
              </button>
            </div>
          </div>

          {/* PWA Install Link for Browser Users */}
          {!isInstalled ? (
            <div className="mt-3 pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={() => promptInstall()}
                className="inline-flex items-center space-x-1.5 text-xs text-kindia-blue font-bold hover:underline bg-blue-50/80 hover:bg-blue-100/80 px-3.5 py-1.5 rounded-full border border-blue-200/60 transition shadow-2xs cursor-pointer"
                title="Installer UK-GED sur votre appareil (Ordinateur ou Téléphone)"
              >
                <Download className="w-3.5 h-3.5 text-kindia-blue" />
                <span>Installer UK-GED sur votre appareil</span>
              </button>
            </div>
          ) : (
            <div className="mt-3 pt-2 text-center border-t border-slate-100 flex items-center justify-center space-x-1 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Application installée et prête</span>
            </div>
          )}
        </div>

      </div>

      {/* Modals */}
      <PublicMissionRequestModal isOpen={showPublicModal} onClose={() => setShowPublicModal(false)} />
      <PublicMissionTrackingModal isOpen={showTrackingModal} onClose={() => setShowTrackingModal(false)} />
      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
    </div>
  );
}

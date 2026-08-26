import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, Mail, ArrowRight, UserCheck, FileText, Search, Calendar } from 'lucide-react';
import PublicMissionRequestModal from '../components/PublicMissionRequestModal';
import PublicMissionTrackingModal from '../components/PublicMissionTrackingModal';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

export default function Login() {
  const { login, institution, getLogoUrl } = useAuth();
  const logoUrl = getLogoUrl();
  const showLogo = institution?.show_logo_login !== 0 && logoUrl;

  const [identity, setIdentity] = useState('sc@univ-kindia.edu.gn');
  const [password, setPassword] = useState('Agent123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showPublicModal, setShowPublicModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Graphic Patterns */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-kindia-blue rounded-full filter blur-3xl opacity-50"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-kindia-gold rounded-full filter blur-3xl opacity-20"></div>

      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden grid md:grid-cols-2 relative z-10 border border-slate-700/50">
        
        {/* Left Side: Branding & Info */}
        <div className="p-8 bg-gradient-to-br from-kindia-blue via-slate-900 to-slate-950 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            {showLogo && (
              <div className="w-16 h-16 bg-white rounded-2xl p-2 shadow-lg flex items-center justify-center">
                <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div>
              <h1 className="font-heading text-2xl font-extrabold tracking-wide text-white">
                UK-GED
              </h1>
              <p className="text-xs text-kindia-gold font-bold uppercase tracking-wider mt-0.5">
                Université de Kindia
              </p>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pt-2">
              Système de Gestion Électronique des Documents, Dématérialisation Administrative et Circuits d'Ordres de Mission Certifiés.
            </p>
          </div>

          <div className="relative z-10 py-6 space-y-2">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-kindia-gold shrink-0" />
              <span>Conforme aux Procédures Administratives Universitaires</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-kindia-gold shrink-0" />
              <span>Signatures Scellées & Traçabilité Intégrale</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 border-t border-white/10 pt-4">
            Plateforme Certifiée 2026 • Université de Kindia
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-8 flex flex-col justify-between">
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
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue focus:border-kindia-blue"
                  />
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
            <span className="text-[10px] font-bold text-slate-500 block mb-1.5 flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 text-kindia-gold" />
              <span>Tester avec un compte préconfiguré :</span>
            </span>

            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <button onClick={() => setDemoAccount('sc@univ-kindia.edu.gn', 'Agent123!')} className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-semibold rounded text-left border border-slate-200">
                1. Secrétariat Central
              </button>
              <button onClick={() => setDemoAccount('sg@univ-kindia.edu.gn', 'Sg123!')} className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-semibold rounded text-left border border-slate-200">
                2. Secrétaire Général
              </button>
              <button onClick={() => setDemoAccount('recteur@univ-kindia.edu.gn', 'Recteur123!')} className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-semibold rounded text-left border border-slate-200">
                3. Recteur
              </button>
              <button onClick={() => setDemoAccount('admin@univ-kindia.edu.gn', 'Admin123!')} className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-semibold rounded text-left border border-slate-200">
                4. Administrateur
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Modals */}
      <PublicMissionRequestModal isOpen={showPublicModal} onClose={() => setShowPublicModal(false)} />
      <PublicMissionTrackingModal isOpen={showTrackingModal} onClose={() => setShowTrackingModal(false)} />
      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
    </div>
  );
}

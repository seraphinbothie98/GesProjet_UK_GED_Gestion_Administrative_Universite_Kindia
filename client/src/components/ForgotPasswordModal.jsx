import React, { useState } from 'react';
import { api } from '../services/api';
import { Key, Lock, Mail, ArrowRight, X, CheckCircle2, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [step, setStep] = useState('request'); // 'request' | 'reset'
  const [identity, setIdentity] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!identity.trim()) {
      setError('Veuillez saisir votre identifiant ou adresse email.');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMsg('');

    try {
      const res = await api.requestForgotPassword(identity);
      setInfoMsg(res.message);
      if (res.resetToken) {
        setToken(res.resetToken);
      }
      setStep('reset');
    } catch (err) {
      setError(err.message || 'Erreur lors de la demande de réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Le jeton de réinitialisation est obligatoire.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.resetPasswordWithToken(token.trim(), newPassword);
      setSuccessMsg(res.message || 'Mot de passe réinitialisé avec succès !');
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err) {
      setError(err.message || 'Erreur lors de la réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-kindia-blue to-kindia-lightBlue p-6 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Key className="w-5 h-5 text-kindia-gold" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-white">Récupération de Compte</h2>
              <p className="text-xs text-slate-200">Procédure sécurisée UK-GED</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">{successMsg}</h3>
              <p className="text-xs text-slate-500">Vous pouvez désormais vous connecter avec votre nouveau mot de passe.</p>
            </div>
          ) : step === 'request' ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <p className="text-xs text-slate-600">
                Saisissez votre matricule ou votre adresse email institutionnelle pour initier la réinitialisation sécurisée de votre mot de passe.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Identifiant ou Email Institutionnel *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    required
                    placeholder="sc@univ-kindia.edu.gn ou Matricule"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setStep('reset')}
                  className="text-[11px] text-kindia-blue font-semibold hover:underline"
                >
                  J'ai déjà un jeton de réinitialisation
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {loading ? 'Traitement...' : 'Continuer'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {infoMsg && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl">
                  {infoMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Jeton de Réinitialisation (Token) *
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  placeholder="Collez le jeton sécurisé..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nouveau Mot de Passe *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Min 8 car., 1 maj, 1 min, 1 chiffre, 1 spéc."
                    className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none rounded"
                    title={showNewPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Confirmer le Nouveau Mot de Passe *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none rounded"
                    title={showConfirmPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
                >
                  Retour
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {loading ? 'Validation...' : 'Définir le mot de passe'}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}

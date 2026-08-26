import React, { useState } from 'react';
import { api } from '../services/api';
import { Lock, ShieldAlert, Key, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForcedPasswordChangeModal({ isOpen, onSuccess, user }) {
  const [currentTempPassword, setCurrentTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentTempPassword) {
      setError('Veuillez saisir votre mot de passe temporaire.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.forceChangePassword(currentTempPassword, newPassword);
      if (res.token) {
        localStorage.setItem('uk_token', res.token);
      }
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la définition du nouveau mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-6 text-white flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <ShieldAlert className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-base text-white">
              Changement de Mot de Passe Requis
            </h2>
            <p className="text-xs text-amber-100">
              Sécurité obligatoire • Première connexion
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Votre compte utilise actuellement un <strong>mot de passe temporaire</strong> généré par l'administration. Pour accéder à la plateforme, vous devez obligatoirement définir votre mot de passe personnel définitif.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Mot de passe temporaire actuel <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={currentTempPassword}
              onChange={(e) => setCurrentTempPassword(e.target.value)}
              required
              placeholder="Saisissez le mot de passe temporaire..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Nouveau mot de passe personnel <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Min 8 car., 1 maj, 1 min, 1 chiffre, 1 spéc."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

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
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-lg transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Key className="w-4 h-4" />
            <span>{loading ? 'Validation en cours...' : 'Définir mon mot de passe définitif'}</span>
          </button>
        </form>

      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { api } from '../services/api';
import { X, AlertCircle, Calendar, Clock, CheckCircle, QrCode, Search, UserCheck } from 'lucide-react';
import { StatusBadge } from './Badge';

// 1. Refuser le Rendez-vous Modal
export function RefuseAppointmentModal({ isOpen, onClose, appointment, onSuccess }) {
  const [reason, setReason] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Le motif de refus est obligatoire.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.rejectAppointment(appointment.id, {
        rejection_reason: reason.trim(),
        is_reason_private: isPrivate
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors du refus.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        <div className="bg-red-700 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <h3 className="font-heading font-bold text-sm">Refuser le rendez-vous</h3>
          </div>
          <button onClick={onClose} className="text-red-200 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <span className="block text-slate-500 font-medium">Refus de la demande ref : <strong className="text-slate-800">{appointment.reference}</strong></span>
            <span className="block text-slate-700 font-bold mt-0.5">Demandeur : {appointment.requester_first_name} {appointment.requester_last_name}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Motif du refus <span className="text-red-500">* (Obligatoire)</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Saisissez la raison du refus..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500"
            />
          </div>

          <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500"
            />
            <span>Masquer ce motif au demandeur (Motif confidentiel interne)</span>
          </label>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
            >
              ANNULER
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold shadow hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Enregistrement...' : 'CONFIRMER LE REFUS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 2. Proposer une Autre Date Modal
export function RescheduleAppointmentModal({ isOpen, onClose, appointment, onSuccess }) {
  const [newDate, setNewDate] = useState(appointment?.requested_date || new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState(appointment?.requested_start_time || '14:30');
  const [duration, setDuration] = useState(appointment?.duration || 30);
  const [message, setMessage] = useState('Je vous propose ce nouveau créneau pour notre entretien.');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newDate || !newTime) {
      setError('La date et l’heure sont obligatoires.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.rescheduleAppointment(appointment.id, {
        reschedule_date: newDate,
        reschedule_start_time: newTime,
        duration,
        reschedule_message: message
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la proposition.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        <div className="bg-purple-700 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-purple-200" />
            <h3 className="font-heading font-bold text-sm">Proposer une autre date</h3>
          </div>
          <button onClick={onClose} className="text-purple-200 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 text-xs text-purple-900">
            <span className="block font-bold">Date initialement demandée :</span>
            <span className="block text-purple-700">📅 {appointment.requested_date} à {appointment.requested_start_time}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nouvelle date <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nouvelle heure <span className="text-red-500">*</span></label>
              <input
                type="time"
                required
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Durée</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-600"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Message au demandeur</label>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Indiquez la raison ou des précisions..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-purple-700 text-white text-xs font-bold shadow hover:bg-purple-800 disabled:opacity-50"
            >
              {submitting ? 'Envoi...' : 'PROPOSER CE CRÉNEAU'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 3. Annulation Modal
export function CancelAppointmentModal({ isOpen, onClose, appointment, onSuccess }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Le motif d’annulation est obligatoire.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.cancelAppointment(appointment.id, { cancel_reason: reason.trim() });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’annulation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        <div className="bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <h3 className="font-heading font-bold text-sm">Annuler le rendez-vous</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <span className="block text-slate-700 font-bold">Référence : {appointment.reference}</span>
            <span className="block text-slate-500 mt-0.5">Date : {appointment.requested_date} à {appointment.requested_start_time}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Motif de l'annulation <span className="text-red-500">* (Obligatoire)</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Précisez la raison de l'annulation..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-600"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold shadow hover:bg-black disabled:opacity-50"
            >
              {submitting ? 'Traitement...' : 'CONFIRMER L’ANNULATION'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 4. Scanner & Reception Check-in Modal
export function QRCheckInModal({ isOpen, onClose, onSuccess }) {
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundAppointment, setFoundAppointment] = useState(null);
  const [error, setError] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchInput.trim()) return;
    setError(null);
    setFoundAppointment(null);
    setSearching(true);

    try {
      const res = await api.scanAppointmentQR({ reference: searchInput.trim() });
      if (res.found) {
        setFoundAppointment(res.appointment);
      } else {
        setError('Aucun rendez-vous correspondant.');
      }
    } catch (err) {
      setError(err.message || 'Rendez-vous introuvable.');
    } finally {
      setSearching(false);
    }
  };

  const handleMarkArrived = async () => {
    if (!foundAppointment) return;
    setCheckingIn(true);
    try {
      await api.checkInAppointment(foundAppointment.id);
      setFoundAppointment(prev => ({ ...prev, status: 'EN_COURS' }));
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Erreur lors du check-in.');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-kindia-blue text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-kindia-gold/20 border border-kindia-gold flex items-center justify-center text-kindia-gold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-white">Accueil & Scan QR Code</h3>
              <p className="text-[11px] text-kindia-gold font-medium">Vérification au Secrétariat Central</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Search form */}
          <form onSubmit={handleSearch} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Scanner le QR Code ou saisir la référence (RDV/UK/2026/...)"
                className="w-full pl-9 pr-3 py-2.5 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !searchInput.trim()}
              className="px-4 py-2.5 bg-kindia-blue text-white rounded-xl text-xs font-bold hover:bg-kindia-lightBlue transition disabled:opacity-50"
            >
              {searching ? 'Recherche...' : 'Rechercher'}
            </button>
          </form>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Result Card */}
          {foundAppointment ? (
            <div className="bg-slate-50 border-2 border-emerald-500/30 rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-heading font-extrabold text-sm text-emerald-800 tracking-wide">
                    RENDEZ-VOUS TROUVÉ ✓
                  </span>
                </div>
                <StatusBadge status={foundAppointment.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Demandeur</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {foundAppointment.requester_first_name} {foundAppointment.requester_last_name}
                  </span>
                  <span className="block text-slate-500 text-[11px]">{foundAppointment.requester_organization}</span>
                  <span className="block text-slate-500 text-[11px]">📞 {foundAppointment.requester_phone}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Responsable</span>
                  <span className="font-bold text-kindia-blue text-sm">
                    {foundAppointment.resp_first_name} {foundAppointment.resp_last_name}
                  </span>
                  <span className="block text-slate-500 text-[11px]">{foundAppointment.resp_function}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Date</span>
                  <span className="font-bold text-slate-800">📅 {foundAppointment.requested_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Heure & Durée</span>
                  <span className="font-bold text-slate-800">🕐 {foundAppointment.requested_start_time} ({foundAppointment.duration} min)</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-100">
                  <span className="text-slate-400 text-[10px] block">Objet</span>
                  <span className="font-medium text-slate-700">{foundAppointment.subject}</span>
                </div>
              </div>

              {/* Action Button */}
              {foundAppointment.status === 'EN_COURS' ? (
                <div className="bg-emerald-100 text-emerald-800 p-3 rounded-xl text-center text-xs font-extrabold flex items-center justify-center space-x-2">
                  <span>🟢 DEMANDEUR DÉJÀ MARQUÉ COMME ARRIVÉ</span>
                </div>
              ) : (
                <button
                  onClick={handleMarkArrived}
                  disabled={checkingIn}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-lg hover:bg-emerald-700 transition flex items-center justify-center space-x-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{checkingIn ? 'Enregistrement...' : 'MARQUER COMME ARRIVÉ'}</span>
                </button>
              )}

            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <QrCode className="w-12 h-12 mx-auto text-slate-300 mb-2 animate-pulse" />
              <p className="text-xs font-medium">Scannez un QR code ou entrez une référence pour afficher la fiche de rendez-vous.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

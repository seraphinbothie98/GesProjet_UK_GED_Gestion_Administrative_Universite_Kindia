import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { StatusBadge } from './Badge';
import { RefuseAppointmentModal, RescheduleAppointmentModal, CancelAppointmentModal } from './AppointmentActionModals';
import { 
  X, Calendar, Clock, MapPin, Building, User, FileText, 
  CheckCircle, AlertCircle, QrCode, MessageSquare, History, UserCheck, CheckSquare
} from 'lucide-react';

export default function AppointmentDetailModal({ isOpen, onClose, appointmentId, currentUser, onRefresh }) {
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [showRefuseModal, setShowRefuseModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [internalNoteInput, setInternalNoteInput] = useState('');
  const [showCompleteNote, setShowCompleteNote] = useState(false);

  const fetchDetail = async () => {
    if (!appointmentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAppointmentDetail(appointmentId);
      setAppointment(data);
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des détails.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && appointmentId) {
      fetchDetail();
    }
  }, [isOpen, appointmentId]);

  if (!isOpen) return null;

  const isResponsible = currentUser && appointment && (appointment.responsible_id === currentUser.id || currentUser.role_code === 'ADMINISTRATEUR');
  const isRequester = currentUser && appointment && (appointment.requester_id === currentUser.id || appointment.requester_email === currentUser.email);
  const canCheckIn = currentUser && (currentUser.permissions?.includes('appointments.check_in') || currentUser.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || isResponsible);

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await api.acceptAppointment(appointment.id);
      await fetchDetail();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Erreur lors de l’acceptation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRespondReschedule = async (action) => {
    setActionLoading(true);
    try {
      await api.respondRescheduleAppointment(appointment.id, { action });
      await fetchDetail();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Erreur lors de la réponse.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await api.checkInAppointment(appointment.id);
      await fetchDetail();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Erreur lors du check-in.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      await api.completeAppointment(appointment.id, { internal_note: internalNoteInput });
      setShowCompleteNote(false);
      await fetchDetail();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Erreur lors de la clôture.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-kindia-blue text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-kindia-gold/20 border border-kindia-gold flex items-center justify-center text-kindia-gold text-lg font-bold">
              📅
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-heading font-extrabold text-lg text-white">
                  {appointment ? appointment.reference : 'Chargement...'}
                </h3>
                {appointment && <StatusBadge status={appointment.status} />}
              </div>
              <p className="text-xs text-kindia-gold font-medium">Détails & Historique UK-GED</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-2"></div>
            <span>Chargement des détails...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        ) : appointment ? (
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            
            {/* Top Alert Banner for Reschedule Proposal */}
            {appointment.status === 'NOUVELLE_DATE_PROPOSEE' && isRequester && (
              <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-4 space-y-3">
                <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs">
                  <Calendar className="w-5 h-5 text-purple-700" />
                  <span>Une nouvelle date vous a été proposée par le responsable !</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-purple-200 text-xs grid grid-cols-2 gap-2 text-purple-900">
                  <div>
                    <span className="text-purple-500 text-[10px] block">Nouvelle date proposée</span>
                    <span className="font-bold">📅 {appointment.reschedule_date} à {appointment.reschedule_start_time}</span>
                  </div>
                  <div>
                    <span className="text-purple-500 text-[10px] block">Message</span>
                    <span className="font-medium italic">{appointment.reschedule_message || 'Créneau proposé'}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    onClick={() => handleRespondReschedule('ACCEPT')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow hover:bg-emerald-700 transition"
                  >
                    ✓ ACCEPTER LA NOUVELLE DATE
                  </button>
                  <button
                    onClick={() => handleRespondReschedule('REJECT')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl shadow hover:bg-red-700 transition"
                  >
                    ✕ REFUSER
                  </button>
                </div>
              </div>
            )}

            {/* Grid 1: Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Requester Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Demandeur</span>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                    {appointment.requester_first_name[0]}{appointment.requester_last_name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{appointment.requester_first_name} {appointment.requester_last_name}</h4>
                    <span className="block text-xs text-slate-600 font-medium">{appointment.requester_organization}</span>
                    <span className="block text-[11px] text-slate-500">📞 {appointment.requester_phone} • ✉️ {appointment.requester_email}</span>
                  </div>
                </div>
              </div>

              {/* Responsible Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Responsable Visé</span>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-kindia-gold/20 text-kindia-blue flex items-center justify-center font-bold text-xs">
                    🏛️
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-kindia-blue">{appointment.resp_first_name} {appointment.resp_last_name}</h4>
                    <span className="block text-xs font-semibold text-slate-700">{appointment.resp_function}</span>
                    <span className="block text-[11px] text-slate-500">{appointment.resp_service_name}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Grid 2: Date, Slot & Info */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Date</span>
                <span className="font-bold text-slate-800 text-sm">📅 {appointment.requested_date}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Créneau & Durée</span>
                <span className="font-bold text-slate-800 text-sm">🕐 {appointment.requested_start_time} ({appointment.duration} min)</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Mode</span>
                <span className="font-bold text-slate-800 text-sm">
                  {appointment.mode === 'PRESENTIEL' ? '🏢 Présentiel' : '💻 En ligne'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Lieu</span>
                <span className="font-medium text-slate-700">{appointment.location || 'Secrétariat'}</span>
              </div>

              <div className="col-span-2 md:col-span-4 pt-2 border-t border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Motif & Objet</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{appointment.subject}</p>
                <span className="text-xs text-slate-500 italic block mt-0.5">Catégorie : {appointment.motif}</span>
              </div>
            </div>

            {/* Section 3: Linked UK-GED Document if exists */}
            {appointment.document_reference_input && (
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-kindia-blue" />
                  <div>
                    <span className="text-[10px] font-bold text-kindia-blue uppercase">Document UK-GED Associé</span>
                    <h5 className="text-xs font-bold text-slate-900">{appointment.doc_title || 'Document existant dans la GED'}</h5>
                    <span className="text-[11px] font-mono font-bold text-kindia-blue">{appointment.document_reference_input}</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  Lien Vérifié ✓
                </span>
              </div>
            )}

            {/* Rejection / Cancellation Reason Banner */}
            {appointment.rejection_reason && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-xs text-red-800 space-y-1">
                <span className="font-bold block">❌ Motif du refus :</span>
                <p>{appointment.rejection_reason}</p>
              </div>
            )}

            {appointment.cancel_reason && (
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-300 text-xs text-slate-800 space-y-1">
                <span className="font-bold block">🚫 Motif d'annulation :</span>
                <p>{appointment.cancel_reason}</p>
              </div>
            )}

            {/* QR Code section */}
            {appointment.qr_code_hash && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                    <QrCode className="w-4 h-4 text-kindia-gold" />
                    <span>Pass d'Accès & QR Code Secrétariat</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-1">
                    À présenter au Secrétariat Central lors de votre arrivée.
                  </p>
                </div>
                <img src={appointment.qr_code_hash} alt="QR Code RDV" className="w-20 h-20 bg-white p-1 rounded-lg border shadow-sm" />
              </div>
            )}

            {/* Timeline History */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-kindia-blue uppercase tracking-wider flex items-center space-x-2 border-b border-slate-200 pb-2">
                <History className="w-4 h-4 text-kindia-gold" />
                <span>Historique & Horodatage</span>
              </h4>

              <div className="space-y-2">
                {appointment.history && appointment.history.map((h) => (
                  <div key={h.id} className="flex items-start space-x-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="w-2 h-2 rounded-full bg-kindia-blue mt-1.5 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{h.action}</span>
                        <span className="text-[10px] text-slate-400">{new Date(h.created_at).toLocaleString('fr-FR')}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-0.5">{h.comment}</p>
                      {h.first_name && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">Par : {h.first_name} {h.last_name} ({h.function_title})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Complete Note Modal Input Overlay */}
            {showCompleteNote && (
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-300 space-y-3 animate-in fade-in">
                <h5 className="text-xs font-bold text-emerald-900">Clôturer le rendez-vous (Note interne optionnelle)</h5>
                <textarea
                  rows={2}
                  value={internalNoteInput}
                  onChange={(e) => setInternalNoteInput(e.target.value)}
                  placeholder="Saisissez une note de synthèse ou d'observation..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-emerald-300 focus:ring-2 focus:ring-emerald-600"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setShowCompleteNote(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={actionLoading}
                    className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800"
                  >
                    CONFIRMER LA CLÔTURE
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="pt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
              <div className="flex items-center space-x-2">
                {/* Reception Check-in button */}
                {canCheckIn && (appointment.status === 'CONFIRME' || appointment.status === 'ACCEPTE') && (
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-700 transition flex items-center space-x-1.5"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>MARQUER COMME ARRIVÉ</span>
                  </button>
                )}

                {/* Responsible Actions */}
                {isResponsible && appointment.status === 'EN_ATTENTE' && (
                  <>
                    <button
                      onClick={handleAccept}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-700 transition"
                    >
                      ✓ ACCEPTER
                    </button>
                    <button
                      onClick={() => setShowRefuseModal(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow hover:bg-red-700 transition"
                    >
                      ✕ REFUSER
                    </button>
                    <button
                      onClick={() => setShowRescheduleModal(true)}
                      className="px-4 py-2 bg-purple-700 text-white rounded-xl text-xs font-bold shadow hover:bg-purple-800 transition"
                    >
                      📅 PROPOSER UNE AUTRE DATE
                    </button>
                  </>
                )}

                {/* Complete Appointment button */}
                {isResponsible && (appointment.status === 'EN_COURS' || appointment.status === 'CONFIRME') && !showCompleteNote && (
                  <button
                    onClick={() => setShowCompleteNote(true)}
                    className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold shadow hover:bg-slate-900 transition flex items-center space-x-1.5"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>TERMINER LE RENDEZ-VOUS</span>
                  </button>
                )}
              </div>

              {/* Cancel Button */}
              {['EN_ATTENTE', 'CONFIRME', 'ACCEPTE', 'NOUVELLE_DATE_PROPOSEE'].includes(appointment.status) && (isRequester || isResponsible) && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
                >
                  Annuler le rendez-vous
                </button>
              )}
            </div>

          </div>
        ) : null}

        {/* Action Modals */}
        <RefuseAppointmentModal
          isOpen={showRefuseModal}
          onClose={() => setShowRefuseModal(false)}
          appointment={appointment}
          onSuccess={() => {
            fetchDetail();
            if (onRefresh) onRefresh();
          }}
        />

        <RescheduleAppointmentModal
          isOpen={showRescheduleModal}
          onClose={() => setShowRescheduleModal(false)}
          appointment={appointment}
          onSuccess={() => {
            fetchDetail();
            if (onRefresh) onRefresh();
          }}
        />

        <CancelAppointmentModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          appointment={appointment}
          onSuccess={() => {
            fetchDetail();
            if (onRefresh) onRefresh();
          }}
        />

      </div>
    </div>
  );
}

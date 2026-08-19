import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Calendar, Clock, User, CheckCircle, AlertCircle, X, MapPin } from 'lucide-react';

export default function PublicAppointmentModal({ onClose }) {
  const [responsibles, setResponsibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [subject, setSubject] = useState('');
  const [motif, setMotif] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedStartTime, setRequestedStartTime] = useState('10:00');
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState('PRESENTIEL');
  const [location, setLocation] = useState('Bureau du Responsable');
  const [documentRef, setDocumentRef] = useState('');

  useEffect(() => {
    loadResponsibles();
  }, []);

  const loadResponsibles = async () => {
    try {
      const list = await api.getPublicAppointmentResponsibles();
      setResponsibles(list);
    } catch (err) {
      console.error('Failed to load responsibles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg(null);

    if (!firstName || !lastName || !email || !phone || !responsibleId || !subject || !motif || !requestedDate || !requestedStartTime) {
      setError('Veuillez remplir tous les champs obligatoires (*).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createPublicAppointment({
        requester_first_name: firstName,
        requester_last_name: lastName,
        requester_email: email,
        requester_phone: phone,
        requester_organization: organization || 'Visiteur Extérieur',
        responsible_id: parseInt(responsibleId),
        subject,
        motif,
        requested_date: requestedDate,
        requested_start_time: requestedStartTime,
        duration: parseInt(duration),
        mode,
        location,
        document_reference_input: documentRef
      });

      setSuccessMsg(res);
    } catch (err) {
      setError(err.message || 'Erreur lors de la prise de rendez-vous.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 my-8">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-kindia-blue text-kindia-gold flex items-center justify-center font-bold text-sm">
              📅
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-sm text-slate-800">
                Demande de Rendez-vous en Ligne (Sans Connexion)
              </h3>
              <span className="text-[10px] text-kindia-gold font-bold uppercase tracking-wider block">UNIVERSITÉ DE KINDIA</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
            ×
          </button>
        </div>

        {successMsg ? (
          <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="font-heading font-extrabold text-base text-emerald-900">Demande Enregistrée avec Succès !</h4>
            <p className="text-xs text-emerald-800">{successMsg.message}</p>
            <div className="bg-white p-3 rounded-xl border border-emerald-300 font-mono text-xs text-kindia-blue font-bold">
              Référence : {successMsg.reference}
            </div>
            <p className="text-[11px] text-slate-600">
              Un e-mail de confirmation sera transmis au responsable et vous serez notifié dès la validation de votre rendez-vous.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2.5 bg-kindia-blue text-white font-bold text-xs rounded-xl shadow hover:bg-kindia-lightBlue transition"
            >
              Fermer la fenêtre
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-red-50 text-red-800 text-xs font-bold rounded-xl border border-red-200 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Demandeur Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-xs text-kindia-blue flex items-center">
                <User className="w-4 h-4 mr-1.5" />
                1. Vos Coordonnées
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex : Mariama"
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ex : CAMARA"
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mail *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex : exemple@domain.com"
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone *</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex : +224 621 00 00 00"
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Organisme / Société / Structure</label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Ex : Ministère de l’Enseignement Supérieur, Entreprise X..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 2. Responsable & Motif */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-xs text-kindia-blue flex items-center">
                <Calendar className="w-4 h-4 mr-1.5" />
                2. Destinataire & Motif du Rendez-vous
              </h4>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Sélectionner le Responsable de l’Université *</label>
                <select
                  value={responsibleId}
                  onChange={(e) => setResponsibleId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-kindia-blue"
                  required
                >
                  <option value="">-- Choisir un responsable --</option>
                  {responsibles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.last_name} {r.first_name} — {r.function_title || r.role_name} ({r.service_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Sujet Principal *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex : Demande d’audience officielle / Partenariat"
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motif / Explication de l’Audience *</label>
                <textarea
                  rows={2}
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Ex : Présentation du projet d'équipement informatique pour le campus"
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Référence d'un Document GED Associé (Optionnel)</label>
                <input
                  type="text"
                  value={documentRef}
                  onChange={(e) => setDocumentRef(e.target.value)}
                  placeholder="Ex : UK/SC/CE/2026/000001"
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-mono"
                />
              </div>
            </div>

            {/* 3. Horaires */}
            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-3">
              <h4 className="font-bold text-xs text-amber-900 flex items-center">
                <Clock className="w-4 h-4 mr-1.5 text-amber-700" />
                3. Horaires Souhaités
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-amber-900 mb-1">Date Souhaitée *</label>
                  <input
                    type="date"
                    value={requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-amber-300 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-900 mb-1">Heure de Début *</label>
                  <input
                    type="time"
                    value={requestedStartTime}
                    onChange={(e) => setRequestedStartTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-amber-300 bg-white"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-kindia-blue text-white font-bold rounded-xl shadow hover:bg-kindia-lightBlue transition"
              >
                {submitting ? 'Envoi...' : 'TRANSMETTRE LA DEMANDE DE RENDEZ-VOUS'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

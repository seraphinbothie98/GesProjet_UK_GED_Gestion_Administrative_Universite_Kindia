import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Calendar, Clock, MapPin, CheckCircle, AlertCircle, FileText, User, Building, Phone, Mail } from 'lucide-react';
import { formatGuineaPhone } from '../utils/phoneUtils';

export default function AppointmentFormModal({ isOpen, onClose, onSuccess, initialUser }) {
  const [responsibles, setResponsibles] = useState([]);
  const [loadingResponsibles, setLoadingResponsibles] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    requester_first_name: initialUser ? initialUser.first_name : '',
    requester_last_name: initialUser ? initialUser.last_name : '',
    requester_email: initialUser ? initialUser.email : '',
    requester_phone: initialUser ? initialUser.phone || '' : '',
    requester_organization: initialUser ? initialUser.service_name || 'Université de Kindia' : '',
    responsible_id: '',
    motif: 'Entretien officiel',
    subject: '',
    requested_date: new Date().toISOString().split('T')[0],
    requested_start_time: '10:00',
    duration: 30,
    mode: 'PRESENTIEL',
    location: 'Bureau du Responsable',
    document_reference_input: ''
  });

  // UK-GED Document Verification State
  const [docVerifying, setDocVerifying] = useState(false);
  const [docVerified, setDocVerified] = useState(null); // { exists: boolean, title: string, error?: string }

  useEffect(() => {
    if (isOpen) {
      api.getAppointmentResponsibles()
        .then(data => {
          setResponsibles(data);
          if (data.length > 0) {
            setFormData(prev => ({ ...prev, responsible_id: data[0].id }));
          }
        })
        .catch(err => setError('Impossible de charger la liste des responsables.'))
        .finally(() => setLoadingResponsibles(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVerifyDocument = async () => {
    if (!formData.document_reference_input.trim()) return;
    setDocVerifying(true);
    setDocVerified(null);
    try {
      const res = await api.verifyAppointmentDocument(formData.document_reference_input.trim());
      if (res.exists) {
        setDocVerified({ exists: true, title: res.document.title, reference: res.document.reference });
      } else {
        setDocVerified({ exists: false, error: 'Document non trouvé' });
      }
    } catch (err) {
      setDocVerified({ exists: false, error: err.message || 'Introuvable' });
    } finally {
      setDocVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.createAppointment(formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’envoi de la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="bg-kindia-blue text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-kindia-gold/20 border border-kindia-gold flex items-center justify-center text-kindia-gold font-bold text-lg">
              📅
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-white">Prendre un rendez-vous</h3>
              <p className="text-xs text-kindia-gold font-medium">Formulaire Officiel • Université de Kindia</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Identité du Demandeur */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-kindia-blue uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center space-x-2">
              <User className="w-4 h-4 text-kindia-gold" />
              <span>Coordonnées du Demandeur</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nom <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="requester_last_name"
                  required
                  value={formData.requester_last_name}
                  onChange={handleChange}
                  placeholder="Ex: CAMARA"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prénom <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="requester_first_name"
                  required
                  value={formData.requester_first_name}
                  onChange={handleChange}
                  placeholder="Ex: Sekou"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone (+224) <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  name="requester_phone"
                  required
                  value={formData.requester_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, requester_phone: formatGuineaPhone(e.target.value) }))}
                  placeholder="+224 6XX XX XX XX"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono font-semibold focus:ring-2 focus:ring-kindia-blue focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  name="requester_email"
                  required
                  value={formData.requester_email}
                  onChange={handleChange}
                  placeholder="email@domaine.com"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Service / Organisation</label>
              <input
                type="text"
                name="requester_organization"
                value={formData.requester_organization}
                onChange={handleChange}
                placeholder="Ex: Faculté des Sciences / Ministère de l'Enseignement Supérieur"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue focus:border-transparent"
              />
            </div>
          </div>

          {/* Section 2: Sélection du Responsable & Objet */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-kindia-blue uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center space-x-2">
              <Building className="w-4 h-4 text-kindia-gold" />
              <span>Responsable Visé & Motif</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rendez-vous avec <span className="text-red-500">*</span></label>
                {loadingResponsibles ? (
                  <div className="animate-pulse bg-slate-100 h-9 rounded-lg"></div>
                ) : (
                  <select
                    name="responsible_id"
                    required
                    value={formData.responsible_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue focus:border-transparent bg-white font-medium text-slate-800"
                  >
                    {responsibles.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.function_title} — {r.first_name} {r.last_name} ({r.service_code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Motif principal <span className="text-red-500">*</span></label>
                <select
                  name="motif"
                  value={formData.motif}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue focus:border-transparent bg-white"
                >
                  <option value="Entretien officiel">Entretien officiel</option>
                  <option value="Dépôt / Validation de dossier">Dépôt / Validation de dossier</option>
                  <option value="Audience rectorale">Audience rectorale</option>
                  <option value="Demande d’orientation">Demande d’orientation</option>
                  <option value="Suivi de courrier / Note">Suivi de courrier / Note</option>
                  <option value="Autre motif">Autre motif</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Objet du rendez-vous <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="subject"
                required
                value={formData.subject}
                onChange={handleChange}
                placeholder="Ex: Examen du projet d'équipement informatique pour le CNEU"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue focus:border-transparent font-medium"
              />
            </div>
          </div>

          {/* Section 3: Date, Heure, Durée & Mode */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-kindia-blue uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-kindia-gold" />
              <span>Date, Créneau & Mode</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date souhaitée <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  name="requested_date"
                  required
                  value={formData.requested_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Heure souhaitée <span className="text-red-500">*</span></label>
                <input
                  type="time"
                  name="requested_start_time"
                  required
                  value={formData.requested_start_time}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Durée estimée</label>
                <select
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes (1h)</option>
                  <option value={90}>90 minutes (1h30)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Mode de rendez-vous</label>
                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="PRESENTIEL"
                      checked={formData.mode === 'PRESENTIEL'}
                      onChange={handleChange}
                      className="text-kindia-blue focus:ring-kindia-blue"
                    />
                    <span className="font-medium text-slate-700">🏢 Présentiel</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="EN_LIGNE"
                      checked={formData.mode === 'EN_LIGNE'}
                      onChange={handleChange}
                      className="text-kindia-blue focus:ring-kindia-blue"
                    />
                    <span className="font-medium text-slate-700">💻 En ligne (Visioconférence)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lieu souhaité</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Ex: Secrétariat Général, Bureau 102"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Association avec un Document UK-GED */}
          <div className="space-y-3 pt-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-kindia-blue uppercase tracking-wider flex items-center space-x-2">
              <FileText className="w-4 h-4 text-kindia-gold" />
              <span>Association avec un document UK-GED (Optionnel)</span>
            </h4>
            
            <p className="text-[11px] text-slate-500">
              Saisissez la référence exacte d'un courrier ou dossier UK-GED pour lier ce rendez-vous.
            </p>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                name="document_reference_input"
                value={formData.document_reference_input}
                onChange={(e) => {
                  handleChange(e);
                  setDocVerified(null);
                }}
                placeholder="Ex: UK/SC/CE/2026/000001"
                className="flex-1 px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
              />
              <button
                type="button"
                onClick={handleVerifyDocument}
                disabled={docVerifying || !formData.document_reference_input.trim()}
                className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition disabled:opacity-50"
              >
                {docVerifying ? 'Vérification...' : 'Vérifier'}
              </button>
            </div>

            {/* Verification Result Feedback */}
            {docVerified && docVerified.exists && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold">Document trouvé ✓</span>
                    <span className="block text-[11px] text-emerald-700">Objet : {docVerified.title}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                  {docVerified.reference}
                </span>
              </div>
            )}

            {docVerified && !docVerified.exists && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>⚠️ {docVerified.error}</span>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-kindia-blue text-white text-xs font-bold shadow-lg hover:bg-kindia-lightBlue transition flex items-center space-x-2 disabled:opacity-50"
            >
              {submitting ? (
                <span>Envoi de la demande...</span>
              ) : (
                <>
                  <span>ENVOYER LA DEMANDE</span>
                  <span>🚀</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  FileText, CheckCircle, AlertCircle, X, Upload, Calendar, 
  User, Phone, Mail, Building2, MapPin, Send, Copy, ShieldCheck, Award
} from 'lucide-react';

export default function PublicMissionRequestModal({ isOpen, onClose, defaultUserData = null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submittedData, setSubmittedData] = useState(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const getInitialService = (usr) => {
    if (!usr) return '';
    if (usr.service_name) return usr.service_name;
    if (usr.personnel_category === 'ENSEIGNANT_CHERCHEUR' || !usr.service_id) {
      return usr.academic_structure || 'Aucun service / Enseignant-chercheur';
    }
    return '';
  };

  const getInitialFunction = (usr) => {
    if (!usr) return '';
    if (usr.function_title) return usr.function_title;
    if (usr.personnel_category === 'ENSEIGNANT_CHERCHEUR') return 'Enseignant-Chercheur';
    return '';
  };

  const [formData, setFormData] = useState({
    applicant_last_name: '',
    applicant_first_names: '',
    applicant_function: '',
    applicant_matricule: '',
    applicant_service_name: '',
    applicant_phone: '',
    applicant_email: '',
    applicant_institution: 'Université de Kindia',
    object_of_mission: '',
    destination: '',
    country: 'Guinée',
    exact_location: '',
    start_date: '',
    end_date: '',
    duration_days: '',
    transport_means: 'VÉHICULE OFFICIEL',
    justification_motif: '',
    host_organization: '',
    local_contact: '',
    files: []
  });

  useEffect(() => {
    if (isOpen) {
      setSubmittedData(null);
      setError(null);
      if (defaultUserData) {
        setFormData(prev => ({
          ...prev,
          applicant_last_name: defaultUserData.last_name || '',
          applicant_first_names: defaultUserData.first_name || '',
          applicant_function: getInitialFunction(defaultUserData),
          applicant_matricule: defaultUserData.matricule || '',
          applicant_service_name: getInitialService(defaultUserData),
          applicant_phone: defaultUserData.phone || '',
          applicant_email: defaultUserData.email || '',
          applicant_institution: 'Université de Kindia'
        }));
      }
    }
  }, [isOpen, defaultUserData]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFormData(prev => ({ ...prev, files: Array.from(e.target.files) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'files') {
          formData.files.forEach(f => payload.append('files', f));
        } else if (formData[key] !== null && formData[key] !== undefined) {
          payload.append(key, formData[key]);
        }
      });

      let res;
      if (defaultUserData && defaultUserData.id) {
        res = await api.submitMissionRequest(payload);
      } else {
        res = await api.submitPublicMissionRequest(payload);
      }

      setSubmittedData(res);
    } catch (err) {
      console.error('Submit mission request error:', err);
      setError(err.message || 'Erreur lors de l’enregistrement de votre demande.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-kindia-blue to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-kindia-gold/20 rounded-xl text-kindia-gold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base tracking-wide">
                Demande d’Ordre de Mission
              </h3>
              <p className="text-xs text-slate-300">
                {defaultUserData ? 'Formulaire officiel prérempli avec vos informations du profil' : 'Formulaire public • Accessible avec ou sans compte UK-GED'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {submittedData ? (
            /* Confirmation View */
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-lg font-heading font-extrabold text-slate-800">
                  Votre demande d’ordre de mission a été enregistrée avec succès !
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Elle est transmise au Secrétariat Central de l’Université de Kindia pour traitement administratif.
                </p>
              </div>

              {/* Reference Box */}
              <div className="p-4 bg-white rounded-xl border border-kindia-blue/30 shadow-sm max-w-md mx-auto space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Numéro de Référence Unique :
                </span>
                <div className="flex items-center justify-center space-x-2">
                  <span className="font-mono text-lg font-extrabold text-kindia-blue">
                    {submittedData.reference}
                  </span>
                  <button
                    onClick={() => copyToClipboard(submittedData.reference)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                    title="Copier la référence"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedRef ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between px-2">
                  <span><strong>Statut :</strong> <span className="text-amber-800 font-bold">{submittedData.status}</span></span>
                  <span><strong>Horodatage :</strong> {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs text-left space-y-1">
                <span className="font-bold block">💡 Comment suivre votre demande ?</span>
                <p>
                  Veuillez conserver précieusement ce numéro de référence. Si vous n'avez pas de compte, vous pourrez suivre l'avancement de votre dossier à tout moment depuis la page d'accueil en saisissant votre <strong>Référence ({submittedData.reference})</strong> ainsi que votre <strong>Téléphone ({formData.applicant_phone})</strong> ou <strong>Email</strong>.
                </p>
              </div>

              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl text-xs shadow transition"
              >
                Fermer la fenêtre
              </button>
            </div>
          ) : (
            /* Request Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Applicant Info Section */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <User className="w-4 h-4 text-kindia-gold" />
                  <h4 className="font-heading font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                    1. Informations du Demandeur (Enseignant, Chercheur, Personnel)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nom *</label>
                    <input
                      type="text"
                      name="applicant_last_name"
                      required
                      value={formData.applicant_last_name}
                      onChange={handleInputChange}
                      placeholder="Ex: DIALLO"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Prénoms *</label>
                    <input
                      type="text"
                      name="applicant_first_names"
                      required
                      value={formData.applicant_first_names}
                      onChange={handleInputChange}
                      placeholder="Ex: Amadou Oury"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Fonction *</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {['Enseignant-Chercheur', 'Enseignant', 'Chercheur', 'Chef de Service', 'Personnel Administratif / Technique'].map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, applicant_function: f }))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                            formData.applicant_function === f 
                              ? 'bg-kindia-blue text-white border-kindia-blue shadow-sm' 
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      name="applicant_function"
                      required
                      value={formData.applicant_function}
                      onChange={handleInputChange}
                      placeholder="Ex: Enseignant-Chercheur / Maître de Conférences / Assistant"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Matricule <span className="text-[10px] text-slate-400 font-normal">(si disponible / optionnel)</span>
                    </label>
                    <input
                      type="text"
                      name="applicant_matricule"
                      value={formData.applicant_matricule}
                      onChange={handleInputChange}
                      placeholder="Ex: 248900X (Optionnel)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Service / Département / Faculté <span className="text-[10px] text-slate-400 font-normal">(ou sans rattachement)</span>
                    </label>
                    <input
                      type="text"
                      name="applicant_service_name"
                      value={formData.applicant_service_name}
                      onChange={handleInputChange}
                      placeholder="Ex: Dép. Physique / Faculté Sciences (ou Non rattaché)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Institution de rattachement</label>
                    <input
                      type="text"
                      name="applicant_institution"
                      value={formData.applicant_institution}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Téléphone de contact *</label>
                    <input
                      type="text"
                      name="applicant_phone"
                      required
                      value={formData.applicant_phone}
                      onChange={handleInputChange}
                      placeholder="Ex: +224 622 11 22 33"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Adresse E-mail *</label>
                    <input
                      type="email"
                      name="applicant_email"
                      required
                      value={formData.applicant_email}
                      onChange={handleInputChange}
                      placeholder="Ex: adiallo@univ-kindia.edu.gn"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>
                </div>
              </div>

              {/* Mission Info Section */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <MapPin className="w-4 h-4 text-kindia-gold" />
                  <h4 className="font-heading font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                    2. Informations Relatives à la Mission
                  </h4>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Objet de la Mission *</label>
                  <textarea
                    name="object_of_mission"
                    required
                    rows={2}
                    value={formData.object_of_mission}
                    onChange={handleInputChange}
                    placeholder="Ex: Participation au Colloque International sur les Energies Renouvelables..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Destination / Ville *</label>
                    <input
                      type="text"
                      name="destination"
                      required
                      value={formData.destination}
                      onChange={handleInputChange}
                      placeholder="Ex: Conakry / Labé / Bamako"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Pays</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Lieu exact / Site</label>
                    <input
                      type="text"
                      name="exact_location"
                      value={formData.exact_location}
                      onChange={handleInputChange}
                      placeholder="Ex: Palais du Peuple / Université UGANC"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Moyen de transport prévu</label>
                    <select
                      name="transport_means"
                      value={formData.transport_means}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-bold"
                    >
                      <option value="VÉHICULE OFFICIEL">Véhicule Officiel de l’Université</option>
                      <option value="TRANSPORTS EN COMMUN">Transports en commun / Car</option>
                      <option value="VÉHICULE PERSONNEL">Véhicule Personnel</option>
                      <option value="AVION">Avion (Vol national / international)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date de départ *</label>
                    <input
                      type="date"
                      name="start_date"
                      required
                      value={formData.start_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date de retour *</label>
                    <input
                      type="date"
                      name="end_date"
                      required
                      value={formData.end_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Structure d’accueil sur place</label>
                    <input
                      type="text"
                      name="host_organization"
                      value={formData.host_organization}
                      onChange={handleInputChange}
                      placeholder="Ex: Ministère de l’Enseignement Supérieur"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Personne / Contact à contacter</label>
                    <input
                      type="text"
                      name="local_contact"
                      value={formData.local_contact}
                      onChange={handleInputChange}
                      placeholder="Ex: Dr. Sylla (+224 620 00 00 00)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Motif / Justification de la mission</label>
                  <textarea
                    name="justification_motif"
                    rows={2}
                    value={formData.justification_motif}
                    onChange={handleInputChange}
                    placeholder="Explication synthétique du besoin et de l'intérêt pour l'institution..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              {/* Justificative Attachments Upload */}
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2">
                <label className="block font-extrabold text-indigo-900 text-xs flex items-center space-x-1.5">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>Pièces Justificatives (Invitation, Lettre de mission, Convocation...)</span>
                </label>
                <p className="text-[11px] text-indigo-800">
                  Formats acceptés : PDF, PNG, JPG, JPEG (Taille max par fichier : 10 Mo).
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue cursor-pointer"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl transition flex items-center space-x-2 shadow-lg"
                >
                  {loading ? (
                    <span>Enregistrement en cours...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-kindia-gold" />
                      <span>Soumettre la Demande</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

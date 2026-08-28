import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  FileText, CheckCircle, AlertCircle, X, Upload, Calendar, 
  User, Phone, Mail, Building2, MapPin, Send, Copy, ShieldCheck, 
  KeyRound, Search, HelpCircle, ArrowRight, UserCheck, AlertTriangle
} from 'lucide-react';

export default function PublicMissionRequestModal({ isOpen, onClose, defaultUserData = null }) {
  // Step state: 'IDENTIFY' | 'CLAIM_MATRICULE' | 'FORM' | 'CONFIRMATION'
  const [currentStep, setCurrentStep] = useState('IDENTIFY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successClaimMsg, setSuccessClaimMsg] = useState(null);
  const [submittedData, setSubmittedData] = useState(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Identification step states
  const [identMatricule, setIdentMatricule] = useState('');
  const [identPassword, setIdentPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [accountPreview, setAccountPreview] = useState(null);
  const [verifiedWorker, setVerifiedWorker] = useState(null);
  const [verificationToken, setVerificationToken] = useState(null);
  const [identificationMode, setIdentificationMode] = useState('UK_GED_ACCOUNT');

  // Claim matricule form states
  const [claimData, setClaimData] = useState({
    matricule: '',
    last_name: '',
    first_names: '',
    function_title: '',
    service_name: '',
    phone: '',
    email: '',
    notes: ''
  });

  const getInitialService = (usr) => {
    if (!usr) return '';
    if (usr.service_name) return usr.service_name;
    if (usr.personnel_category === 'ENSEIGNANT_CHERCHEUR' || !usr.service_id) {
      return usr.academic_structure || 'Enseignement / Recherche';
    }
    return 'Université de Kindia';
  };

  const getInitialFunction = (usr) => {
    if (!usr) return '';
    if (usr.function_title) return usr.function_title;
    if (usr.personnel_category === 'ENSEIGNANT_CHERCHEUR') return 'Enseignant-Chercheur';
    return 'Personnel';
  };

  // Main Form Data
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
      setError(null);
      setSubmittedData(null);
      setSuccessClaimMsg(null);
      setIdentPassword('');
      setRequiresPassword(false);
      setAccountPreview(null);
      setVerifiedWorker(null);
      setVerificationToken(null);

      // If user is already authenticated in the app
      if (defaultUserData && (defaultUserData.id || defaultUserData.matricule)) {
        setIdentificationMode('UK_GED_ACCOUNT');
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
        setCurrentStep('FORM');
      } else {
        setIdentMatricule('');
        setCurrentStep('IDENTIFY');
      }
    }
  }, [isOpen, defaultUserData]);

  if (!isOpen) return null;

  // Handle identification verification
  const handleVerifyApplicant = async (e) => {
    if (e) e.preventDefault();
    if (!identMatricule.trim()) {
      setError('Veuillez renseigner votre matricule de travailleur.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.verifyMissionApplicant({
        matricule: identMatricule.trim(),
        password: identPassword ? identPassword.trim() : undefined
      });

      if (res.has_account) {
        if (res.requires_password && !res.authenticated) {
          setRequiresPassword(true);
          setAccountPreview(res.worker_preview);
          setIdentificationMode('UK_GED_ACCOUNT');
          setLoading(false);
          return;
        }

        if (res.authenticated && res.user) {
          // Worker with UK-GED account authenticated
          setIdentificationMode('UK_GED_ACCOUNT');
          setFormData(prev => ({
            ...prev,
            applicant_last_name: res.user.last_name || '',
            applicant_first_names: res.user.first_name || '',
            applicant_function: res.user.function_title || 'Personnel',
            applicant_matricule: res.user.matricule || identMatricule.trim(),
            applicant_service_name: res.user.service_name || 'Université de Kindia',
            applicant_phone: res.user.phone || '',
            applicant_email: res.user.email || '',
            applicant_institution: 'Université de Kindia'
          }));
          setCurrentStep('FORM');
          return;
        }
      } else {
        // Worker WITHOUT UK-GED account identified
        setVerifiedWorker(res.worker);
        setVerificationToken(res.verification_token);
        setIdentificationMode('STAFF_MATRICULE');
        setFormData(prev => ({
          ...prev,
          applicant_last_name: res.worker.last_name || '',
          applicant_first_names: res.worker.first_name || '',
          applicant_function: res.worker.function_title || 'Personnel',
          applicant_matricule: res.worker.matricule || identMatricule.trim(),
          applicant_service_name: res.worker.service_name || 'Services Généraux / Université de Kindia',
          applicant_phone: res.worker.phone || '',
          applicant_email: res.worker.email || '',
          applicant_institution: 'Université de Kindia'
        }));
        setCurrentStep('FORM');
        return;
      }
    } catch (err) {
      console.error('Identification error:', err);
      setError(err.message || 'Erreur lors de la vérification de votre matricule.');
    } finally {
      setLoading(false);
    }
  };

  // Open Claim Matricule Form
  const openClaimForm = () => {
    setClaimData({
      matricule: identMatricule.trim(),
      last_name: '',
      first_names: '',
      function_title: '',
      service_name: '',
      phone: '',
      email: '',
      notes: ''
    });
    setError(null);
    setCurrentStep('CLAIM_MATRICULE');
  };

  // Submit Claim Matricule
  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    if (!claimData.matricule || !claimData.last_name || !claimData.first_names || !claimData.phone) {
      setError('Veuillez renseigner votre matricule, nom, prénoms et numéro de téléphone.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.claimMatriculeVerification(claimData);
      setSuccessClaimMsg(res.message || 'Votre signalement a été transmis au Secrétariat Central et aux Ressources Humaines.');
    } catch (err) {
      console.error('Claim submit error:', err);
      setError(err.message || 'Erreur lors de la transmission du signalement.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFormData(prev => ({ ...prev, files: Array.from(e.target.files) }));
    }
  };

  // Submit Mission Request
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

      if (verificationToken) {
        payload.append('verification_token', verificationToken);
      }

      let res;
      if (defaultUserData && defaultUserData.id) {
        res = await api.submitMissionRequest(payload);
      } else {
        res = await api.submitPublicMissionRequest(payload);
      }

      setSubmittedData(res);
      setCurrentStep('CONFIRMATION');
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
              <h3 className="font-heading font-extrabold text-base tracking-wide flex items-center space-x-2">
                <span>Demande d’Ordre de Mission</span>
                <span className="text-[10px] bg-kindia-gold text-kindia-blue font-black px-2 py-0.5 rounded-full uppercase">
                  Accès Universel
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                {currentStep === 'IDENTIFY' && 'Étape 1/2 : Identification du travailleur universitaire'}
                {currentStep === 'FORM' && 'Étape 2/2 : Informations et justificatifs de la mission'}
                {currentStep === 'CLAIM_MATRICULE' && 'Signalement & Vérification de Matricule'}
                {currentStep === 'CONFIRMATION' && 'Récépissé de transmission'}
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
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start space-x-2 animate-shake">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Contrôle d'accès :</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* STEP 1: UNIVERSAL APPLICANT IDENTIFICATION */}
          {currentStep === 'IDENTIFY' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-kindia-blue font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-kindia-blue" />
                  <span>Vérification préalable de l'appartenance à l'Université</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-xs">
                  Tout travailleur régulier de l’Université de Kindia (cadre, chef de service, enseignant, chauffeur, agent de sécurité, agent de nettoyage, technicien...) est autorisé à créer une demande d’ordre de mission, <strong>même s'il ne possède pas encore de compte UK-GED</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifyApplicant} className="space-y-4 max-w-lg mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5 flex items-center space-x-1.5">
                    <User className="w-4 h-4 text-kindia-blue" />
                    <span>Matricule Professionnel du Travailleur *</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={identMatricule}
                      onChange={(e) => {
                        setIdentMatricule(e.target.value);
                        setRequiresPassword(false);
                        setAccountPreview(null);
                        setError(null);
                      }}
                      placeholder="Ex: UK-DAF-005, UK-CHAUFF-001, UK-SEC-001, UK-NETT-001..."
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-kindia-blue font-mono font-bold text-sm text-slate-800 uppercase"
                    />
                    <Search className="w-5 h-5 text-slate-400 absolute right-3 top-3" />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Saisissez votre matricule officiel attribué par l'Université de Kindia.
                  </span>
                </div>

                {/* If UK-GED Account detected with password required */}
                {requiresPassword && accountPreview && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3 animate-fadeIn">
                    <div className="flex items-center space-x-2 text-indigo-900 font-bold">
                      <UserCheck className="w-4 h-4 text-indigo-600" />
                      <span>Compte UK-GED reconnu : {accountPreview.name}</span>
                    </div>
                    <p className="text-[11px] text-indigo-700">
                      Fonction : <strong>{accountPreview.function_title}</strong> • Structure : <strong>{accountPreview.service_name}</strong>
                    </p>

                    <div>
                      <label className="block font-bold text-indigo-950 mb-1 flex items-center space-x-1">
                        <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Mot de passe de votre compte UK-GED *</span>
                      </label>
                      <input
                        type="password"
                        required
                        autoFocus
                        value={identPassword}
                        onChange={(e) => setIdentPassword(e.target.value)}
                        placeholder="Votre mot de passe UK-GED"
                        className="w-full px-3 py-2.5 bg-white border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-xs uppercase tracking-wider"
                  >
                    {loading ? (
                      <span>Vérification dans le répertoire officiel...</span>
                    ) : (
                      <>
                        <span>{requiresPassword ? 'VALIDER ET ACCÉDER AU FORMULAIRE' : 'VÉRIFIER MON MATRICULE & CONTINUER'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Option to claim matricule if unrecognized */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={openClaimForm}
                  className="text-xs font-bold text-slate-600 hover:text-kindia-blue underline inline-flex items-center space-x-1.5"
                >
                  <HelpCircle className="w-4 h-4 text-kindia-gold" />
                  <span>Matricule non reconnu ou inactif ? Demander la vérification de mon matricule</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP: CLAIM MATRICULE (SIGNALEMENT SANS ORDRE DE MISSION) */}
          {currentStep === 'CLAIM_MATRICULE' && (
            <div className="space-y-5">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1 text-amber-900">
                <div className="flex items-center space-x-2 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>Demande de vérification & régularisation de matricule</span>
                </div>
                <p className="text-xs">
                  Si votre matricule n’est pas encore enregistré dans le répertoire officiel, ce formulaire transmet vos informations directement au <strong>Secrétariat Central</strong> et aux <strong>Ressources Humaines</strong>. Aucune demande d'ordre de mission non authentifiée ne sera créée.
                </p>
              </div>

              {successClaimMsg ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h4 className="font-heading font-extrabold text-sm text-emerald-900">
                    Signalement enregistré avec succès
                  </h4>
                  <p className="text-xs text-emerald-800">
                    {successClaimMsg}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('IDENTIFY')}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
                  >
                    Retour à l'identification
                  </button>
                </div>
              ) : (
                <form onSubmit={handleClaimSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Matricule concerné *</label>
                      <input
                        type="text"
                        required
                        value={claimData.matricule}
                        onChange={(e) => setClaimData(prev => ({ ...prev, matricule: e.target.value }))}
                        placeholder="Ex: UK-9999"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nom de famille *</label>
                      <input
                        type="text"
                        required
                        value={claimData.last_name}
                        onChange={(e) => setClaimData(prev => ({ ...prev, last_name: e.target.value }))}
                        placeholder="Ex: BANGOURA"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Prénoms *</label>
                      <input
                        type="text"
                        required
                        value={claimData.first_names}
                        onChange={(e) => setClaimData(prev => ({ ...prev, first_names: e.target.value }))}
                        placeholder="Ex: Mohamed Lamine"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Fonction / Poste</label>
                      <input
                        type="text"
                        value={claimData.function_title}
                        onChange={(e) => setClaimData(prev => ({ ...prev, function_title: e.target.value }))}
                        placeholder="Ex: Chauffeur, Agent de sécurité, Technicien..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Service / Faculté d’affectation</label>
                      <input
                        type="text"
                        value={claimData.service_name}
                        onChange={(e) => setClaimData(prev => ({ ...prev, service_name: e.target.value }))}
                        placeholder="Ex: Moyens Généraux, Transport, Faculté des Sciences..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Téléphone de contact *</label>
                      <input
                        type="text"
                        required
                        value={claimData.phone}
                        onChange={(e) => setClaimData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Ex: +224 620 00 00 00"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Observations / Précisions</label>
                      <textarea
                        rows={2}
                        value={claimData.notes}
                        onChange={(e) => setClaimData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Précisez votre situation ou la raison du signalement..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentStep('IDENTIFY')}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow"
                    >
                      {loading ? 'Envoi...' : 'Transmettre le signalement'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* STEP 2: MISSION REQUEST FORM */}
          {currentStep === 'FORM' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Verified Identity Banner */}
              <div className="p-4 bg-gradient-to-r from-slate-900 to-kindia-blue text-white rounded-2xl space-y-2.5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-kindia-gold uppercase tracking-wider flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>IDENTITÉ DU DEMANDEUR VÉRIFIÉE ET CERTIFIÉE</span>
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    identificationMode === 'UK_GED_ACCOUNT' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {identificationMode === 'UK_GED_ACCOUNT' ? 'Compte UK-GED' : 'Travailleur Universitaire Identifié'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1 border-t border-white/10">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Nom & Prénoms :</span>
                    <strong className="text-white">{formData.applicant_first_names} {formData.applicant_last_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Matricule :</span>
                    <strong className="font-mono text-kindia-gold">{formData.applicant_matricule}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Fonction / Poste :</span>
                    <span className="text-slate-200">{formData.applicant_function}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Service / Faculté :</span>
                    <span className="text-slate-200">{formData.applicant_service_name}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <Phone className="w-4 h-4 text-kindia-gold" />
                  <h4 className="font-heading font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                    1. Coordonnées de Contact
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Téléphone de contact *</label>
                    <input
                      type="text"
                      name="applicant_phone"
                      required
                      value={formData.applicant_phone}
                      onChange={handleInputChange}
                      placeholder="Ex: +224 622 11 22 33"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
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
                      placeholder="Ex: agent@univ-kindia.edu.gn"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Mission Details */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <MapPin className="w-4 h-4 text-kindia-gold" />
                  <h4 className="font-heading font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                    2. Détails de la Mission
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
                    placeholder="Ex: Déplacement pour transport officiel de la délégation / Mission d'intervention technique..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
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
                      placeholder="Ex: Conakry / Mamou / Labé / Kankan"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Pays</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Lieu exact / Site</label>
                    <input
                      type="text"
                      name="exact_location"
                      value={formData.exact_location}
                      onChange={handleInputChange}
                      placeholder="Ex: Palais du Peuple / Siège MESRSI / Campus"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Structure d’accueil sur place</label>
                    <input
                      type="text"
                      name="host_organization"
                      value={formData.host_organization}
                      onChange={handleInputChange}
                      placeholder="Ex: MESRSI / Université hôte..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Personne / Contact local</label>
                    <input
                      type="text"
                      name="local_contact"
                      value={formData.local_contact}
                      onChange={handleInputChange}
                      placeholder="Ex: Responsable logistique (+224 ...)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-medium"
                  />
                </div>
              </div>

              {/* Attachments */}
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2">
                <label className="block font-extrabold text-indigo-900 text-xs flex items-center space-x-1.5">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>Pièces Justificatives (Optionnelles : Invitation, Note de service, Convocation...)</span>
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue cursor-pointer"
                />
              </div>

              {/* Submit Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                {!defaultUserData && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep('IDENTIFY')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs"
                  >
                    Changer de travailleur
                  </button>
                )}
                <div className="flex items-center space-x-3 ml-auto">
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
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center space-x-2 shadow-lg"
                  >
                    {loading ? (
                      <span>Enregistrement en cours...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-white" />
                        <span>Transmettre au Secrétariat Central</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: CONFIRMATION VIEW */}
          {currentStep === 'CONFIRMATION' && submittedData && (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-lg font-heading font-extrabold text-slate-800">
                  Votre demande d’ordre de mission a été enregistrée avec succès !
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Elle est transmise au <strong>Secrétariat Central</strong> de l’Université de Kindia pour instruction et préparation de l'ordre de mission officiel.
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
                  <span><strong>Demandeur :</strong> <span className="font-bold">{formData.applicant_first_names} {formData.applicant_last_name}</span></span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs text-left space-y-1">
                <span className="font-bold block">💡 Comment suivre votre demande ?</span>
                <p>
                  Veuillez conserver précieusement le numéro <strong>{submittedData.reference}</strong>. Vous pouvez suivre à tout moment son évolution depuis la page d’accueil UK-GED avec votre référence et votre contact (Téléphone ou Email).
                </p>
              </div>

              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl text-xs shadow transition"
              >
                Fermer la fenêtre
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

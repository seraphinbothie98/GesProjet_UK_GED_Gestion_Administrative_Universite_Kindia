import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Award, CheckCircle2, XCircle, AlertTriangle, FileText, 
  Eye, Download, ShieldCheck, Clock, User, Calendar, MapPin, 
  Car, Briefcase, Hash, ExternalLink, RefreshCw, X, AlertCircle
} from 'lucide-react';
import { formatFullName, formatTransportDisplay, formatDriverDisplay } from '../utils/userUtils';

export default function MissionSignatureModal({ 
  documentId, 
  missionData = null, 
  onClose, 
  onSuccess 
}) {
  const { user } = useAuth();
  
  const [doc, setDoc] = useState(missionData);
  const [loading, setLoading] = useState(!missionData);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('VIEWER'); // 'VIEWER' | 'STRUCTURED'
  
  // Correction & Rejection Sub-modals
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [showRejection, setShowRejection] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Active signature info for SG
  const [userSignature, setUserSignature] = useState(null);
  const [signatureLoading, setSignatureLoading] = useState(true);
  const [signingRemarks, setSigningRemarks] = useState('');

  const docId = documentId || missionData?.document_id || missionData?.id;

  useEffect(() => {
    if (docId) {
      loadDocumentDetails();
    }
    loadUserSignature();
  }, [docId]);

  const loadDocumentDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDocumentDetail(docId);
      setDoc(data);
    } catch (err) {
      console.error('Error loading mission document for signature:', err);
      // Fallback: If missionData was passed, use it, otherwise show explicit error
      if (!missionData) {
        setError(`Impossible de charger le document à signer. Référence : ${missionData?.reference || 'Document #' + docId}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserSignature = async () => {
    setSignatureLoading(true);
    try {
      const sig = await api.getMySignature();
      setUserSignature(sig);
    } catch (err) {
      console.warn('Could not load user signature image:', err);
    } finally {
      setSignatureLoading(false);
    }
  };

  // Helper getters
  const reference = doc?.reference || missionData?.reference || `UK/OM/2026/${docId}`;
  const extension = doc?.extension || missionData || {};
  const missionaryName = extension.missionary_name || doc?.sender_name || missionData?.missionary_name || 'Personnel Université de Kindia';
  const destination = extension.destination || missionData?.destination || 'Destination officielle';
  const objectOfMission = extension.object_of_mission || doc?.description || doc?.title || missionData?.object_of_mission || 'Mission officielle';
  const functionTitle = extension.function_title || missionData?.function_title || 'Enseignant-Chercheur / Agent Administratif';
  const serviceName = extension.missionary_service_snapshot || extension.service_name || doc?.current_service_name || 'Université de Kindia';
  const matricule = extension.missionary_matricule_snapshot || extension.matricule || missionData?.matricule || 'N/A';
  const nationality = extension.nationality || missionData?.nationality || 'Guinéenne';
  const departureDate = extension.departure_date || missionData?.departure_date || 'Date de départ';
  const returnDate = extension.return_date || missionData?.return_date || 'Date de retour';
  const rawTransport = extension.transport_mode || missionData?.transport_mode || 'Véhicule service/Personnel';
  const vehicleReg = extension.vehicle_registration || extension.vehicle_registration_snapshot || missionData?.vehicle_registration || '';
  const transportMode = formatTransportDisplay(rawTransport, vehicleReg);
  const rawDriver = extension.driver_name || extension.driver_name_snapshot || missionData?.driver_name;
  const driverName = formatDriverDisplay(rawTransport, rawDriver, extension.driver_option, missionaryName);
  const observations = extension.observations || missionData?.observations || '';
  
  // File paths for real document rendering
  const pdfFilePath = extension.generated_file_path || doc?.file_path || (doc?.attachments && doc.attachments[0]?.file_path) || null;
  const pdfUrl = pdfFilePath ? `/uploads/${pdfFilePath.replace(/\\/g, '/').split('/').pop()}` : null;

  // Calculate duration in days
  const calculateDuration = () => {
    if (departureDate && returnDate) {
      const d1 = new Date(departureDate);
      const d2 = new Date(returnDate);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return `${diffDays} jour(s)`;
      }
    }
    return 'Durée réglementaire';
  };

  // 1. Confirm Electronic Signature
  const handleConfirmSignature = async () => {
    setSigning(true);
    setError('');
    try {
      await api.signMissionOrder(docId);
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Signature failed:', err);
      setError(err.message || 'Erreur lors de la signature numérique du document.');
    } finally {
      setSigning(false);
    }
  };

  // 2. Request Correction from Secrétariat Central
  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!correctionNotes.trim()) {
      setError('Veuillez préciser les notes de correction.');
      return;
    }
    setSubmittingAction(true);
    try {
      await api.requestMissionCorrection(docId, correctionNotes.trim());
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la demande de correction.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // 3. Reject Mission Order
  const handleRejectionSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setError('Le motif de rejet est obligatoire.');
      return;
    }
    setSubmittingAction(true);
    try {
      await api.rejectMissionOrder(docId, rejectionReason.trim());
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors du rejet.');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-kindia-blue to-indigo-950 text-white p-4 sm:p-5 flex justify-between items-center shrink-0 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-kindia-gold/20 border border-kindia-gold/50 flex items-center justify-center text-kindia-gold shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-kindia-gold bg-black/30 px-2 py-0.5 rounded-full border border-kindia-gold/30">
                  ESPACE SIGNATURE OFFICIELLE • SECRÉTAIRE GÉNÉRAL
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                  En attente de signature
                </span>
              </div>
              <h2 className="font-heading font-black text-sm sm:text-base text-white tracking-wide mt-0.5">
                Ordre de Mission — {reference}
              </h2>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert Bar */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 p-3 px-5 text-xs text-red-800 flex items-center justify-between shrink-0 font-medium">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button 
              onClick={() => setError('')} 
              className="text-red-600 hover:text-red-900 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50">
          
          {loading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="animate-spin w-10 h-10 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-xs font-bold text-slate-600">Chargement de l'ordre de mission officiel...</p>
              <p className="text-[11px] text-slate-400 mt-1">Récupération des données personnalisées par le Secrétariat Central</p>
            </div>
          ) : (
            <>
              {/* Mission Summary Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-kindia-blue" />
                    <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-slate-800">
                      Informations Officielles de la Mission
                    </h3>
                  </div>
                  <div className="text-[11px] font-mono font-bold bg-indigo-50 text-kindia-blue px-2.5 py-1 rounded-lg border border-indigo-100">
                    Réf : {reference}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Missionnaire</span>
                    <span className="font-extrabold text-slate-800 text-sm block mt-0.5">{missionaryName}</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">{functionTitle}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">Matricule : {matricule}</span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Lieu & Période</span>
                    <span className="font-extrabold text-kindia-blue text-sm block mt-0.5 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-red-500 inline mr-1" />
                      <span>{destination}</span>
                    </span>
                    <span className="text-[11px] text-slate-600 block mt-0.5">
                      Du <strong>{departureDate}</strong> au <strong>{returnDate}</strong>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                      Durée : {calculateDuration()}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 sm:col-span-2 lg:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Moyen de Transport</span>
                    <span className="font-bold text-slate-800 block mt-0.5 flex items-center space-x-1">
                      <Car className="w-3.5 h-3.5 text-amber-600 inline mr-1" />
                      <span>{transportMode}</span>
                    </span>
                    <span className="text-[11px] text-slate-600 block mt-0.5">
                      Conduit par : <strong>{driverName}</strong>
                    </span>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 text-xs">
                    <span className="text-[10px] font-extrabold text-amber-900 uppercase block">Objet de la mission</span>
                    <p className="font-semibold text-slate-800 mt-1 leading-relaxed">{objectOfMission}</p>
                    {observations && (
                      <p className="text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-amber-200/60">
                        <strong>Observations du Secrétariat Central :</strong> {observations}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* View Format Selector Tabs */}
              <div className="flex items-center justify-between bg-white p-2 px-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('VIEWER')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
                      activeTab === 'VIEWER'
                        ? 'bg-kindia-blue text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Aperçu PDF Réel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('STRUCTURED')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
                      activeTab === 'STRUCTURED'
                        ? 'bg-kindia-blue text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Format Document Administratif</span>
                  </button>
                </div>

                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-kindia-blue hover:text-kindia-lightBlue flex items-center space-x-1 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition"
                  >
                    <span>Plein écran</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Document Rendering Section */}
              {activeTab === 'VIEWER' && pdfUrl ? (
                <div className="bg-white rounded-2xl border border-slate-300 shadow-inner overflow-hidden p-2">
                  <div className="h-[480px] sm:h-[560px] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <iframe
                      src={`${pdfUrl}#toolbar=0&navpanes=0`}
                      className="w-full h-full"
                      title="Prévisualisation Ordre de Mission"
                    />
                  </div>
                </div>
              ) : (
                /* High Fidelity Structured Administrative Document Representation */
                <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-md p-6 sm:p-10 space-y-6 font-serif max-w-3xl mx-auto text-slate-900">
                  {/* Institutional Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                    <div className="text-left space-y-0.5">
                      <div className="w-16 h-16 rounded-xl bg-kindia-gold text-kindia-blue font-black text-xl flex items-center justify-center border border-kindia-blue shadow-sm mb-1 font-sans">
                        UK
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider block">UNIVERSITÉ DE KINDIA</span>
                      <span className="text-[9px] text-slate-500 block">BP 212 Kindia, Guinée</span>
                      <span className="text-[9px] text-slate-500 block">Email : contact@univ-kindia.edu.gn</span>
                    </div>

                    <div className="text-right space-y-0.5 font-sans">
                      <span className="text-xs font-black tracking-wider block">RÉPUBLIQUE DE GUINÉE</span>
                      <div className="text-[9px] font-bold space-x-1">
                        <span className="text-red-600">Travail</span> - 
                        <span className="text-yellow-500"> Justice</span> - 
                        <span className="text-emerald-600"> Solidarité</span>
                      </div>
                      <span className="text-[9px] font-semibold text-slate-600 block mt-1">
                        Ministère de l'Enseignement Supérieur, de la Recherche Scientifique et de l'Innovation
                      </span>
                      <span className="text-[10px] font-extrabold text-kindia-blue block mt-0.5">
                        SECRÉTARIAT GÉNÉRAL
                      </span>
                    </div>
                  </div>

                  {/* Reference & Document Title */}
                  <div className="text-center space-y-1 pt-2">
                    <div className="text-xs font-mono font-bold text-slate-700">
                      N° / {reference} / UK / RECT / SG / 2026
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-wide text-kindia-blue uppercase underline decoration-2 underline-offset-4 font-sans">
                      ORDRE DE MISSION
                    </h1>
                  </div>

                  {/* Body Content Table */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden font-sans text-xs">
                    <table className="w-full text-left">
                      <tbody className="divide-y divide-slate-200">
                        <tr className="bg-slate-50">
                          <td className="p-3 font-bold text-slate-600 w-1/3 border-r border-slate-200">Nom & Prénoms du Missionnaire</td>
                          <td className="p-3 font-extrabold text-slate-900">{missionaryName}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Qualité / Fonction</td>
                          <td className="p-3 font-semibold text-slate-800">{functionTitle}</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Service / Faculté / Institut</td>
                          <td className="p-3 text-slate-800">{serviceName}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Matricule / Nationalité</td>
                          <td className="p-3 text-slate-800">{matricule} • {nationality}</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Destination / Lieu de Mission</td>
                          <td className="p-3 font-extrabold text-kindia-blue">{destination}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Objet de la Mission</td>
                          <td className="p-3 font-semibold text-slate-800 leading-relaxed">{objectOfMission}</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Période & Durée</td>
                          <td className="p-3 text-slate-800">
                            Du <strong>{departureDate}</strong> au <strong>{returnDate}</strong> ({calculateDuration()})
                          </td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Moyen de Transport & Chauffeur</td>
                          <td className="p-3 text-slate-800">
                            {transportMode} — Conducteur : {driverName} (Véhicule : {vehicleReg})
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Signature Zone Representation */}
                  <div className="pt-6 flex justify-between items-end text-xs font-sans">
                    <div className="text-left text-slate-500 text-[11px]">
                      <p>Fait à Kindia, le {new Date().toLocaleDateString('fr-FR')}</p>
                      <p className="mt-1 font-bold text-slate-600">Pour le Secrétariat Central</p>
                      <p className="text-[10px] italic">Document prêt pour signature</p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-slate-800 uppercase tracking-wide">
                        LE SECRÉTAIRE GÉNÉRAL
                      </p>
                      <div className="h-20 my-1 flex items-center justify-end">
                        {userSignature?.signature_image_path ? (
                          <img 
                            src={userSignature.signature_image_path} 
                            alt="Signature SG" 
                            className="h-16 object-contain"
                          />
                        ) : (
                          <div className="text-[10px] text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                            ✍️ Emplacement Signature Électronique Officielle
                          </div>
                        )}
                      </div>
                      <p className="font-extrabold text-slate-900 underline">
                        {formatFullName(user)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Official Electronic Signature Card (Zone Réservée à la Signature du Secrétaire Général) */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-300 p-5 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-amber-200 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
                      ✍️
                    </div>
                    <div>
                      <h4 className="font-heading font-black text-xs sm:text-sm text-amber-950 uppercase tracking-wide">
                        SIGNATURE DU SECRÉTAIRE GÉNÉRAL
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        Apposition de la signature officielle et scellement cryptographique avec QR code
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[10px] font-extrabold flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Certificat UK-GED Actif</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Signer Identity */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Signataire Officiel Connecté</span>
                    <span className="font-black text-slate-800 text-sm block">
                      {formatFullName(user)}
                    </span>
                    <span className="text-[11px] text-slate-600 block">
                      {user?.function_title || 'Secrétaire Général de l’Université de Kindia'}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Email : {user?.email}
                    </span>
                  </div>

                  {/* Electronic Signature Image */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Empreinte & Image de Signature</span>
                      <div className="h-14 flex items-center justify-center my-1 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        {userSignature?.signature_image_path ? (
                          <img 
                            src={userSignature.signature_image_path} 
                            alt="Signature" 
                            className="max-h-12 object-contain" 
                          />
                        ) : signatureLoading ? (
                          <span className="text-[11px] text-slate-400 animate-pulse">Chargement de la signature...</span>
                        ) : (
                          <span className="text-[11px] text-amber-700 font-bold">Signature officielle préconfigurée</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 text-right">
                      Date d'apposition : {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Optional Remarks */}
                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">
                    Observations / Mentions complémentaires du Secrétaire Général (Optionnel)
                  </label>
                  <input
                    type="text"
                    value={signingRemarks}
                    onChange={e => setSigningRemarks(e.target.value)}
                    placeholder="Ex : Vu et approuvé pour exécution."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 shadow-inner"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Controls Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowCorrection(true)}
              className="px-3.5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl transition flex items-center space-x-1 shadow-sm"
              title="Renvoyer avec des remarques pour modification par le Secrétariat Central"
            >
              <span>📝 Demander une correction</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRejection(true)}
              className="px-3.5 py-2.5 bg-red-100 hover:bg-red-200 text-red-900 font-bold text-xs rounded-xl transition flex items-center space-x-1 shadow-sm"
              title="Rejeter cet ordre de mission"
            >
              <span>❌ Rejeter</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Fermer
            </button>

            <button
              type="button"
              onClick={handleConfirmSignature}
              disabled={signing || loading}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center space-x-2 disabled:opacity-50"
            >
              {signing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Signature en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>✍️ SIGNER ET RENVOYER AU SC</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sub-modal: Correction Request */}
        {showCorrection && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-amber-300">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="font-heading font-extrabold text-sm text-amber-900">
                  📝 Demander une correction au Secrétariat Central
                </h3>
                <button onClick={() => setShowCorrection(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleCorrectionSubmit} className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Indiquez les modifications requises sur l'ordre de mission <strong>{reference}</strong>. Le document sera retourné au Secrétariat Central avec le statut <em>Correction demandée</em>.
                </p>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notes de correction obligatoires *</label>
                  <textarea
                    rows={3}
                    required
                    value={correctionNotes}
                    onChange={e => setCorrectionNotes(e.target.value)}
                    placeholder="Ex : Modifier la date de retour au 25 août et préciser le moyen de transport..."
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCorrection(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow"
                  >
                    {submittingAction ? 'Envoi...' : 'Transmettre la demande de correction'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sub-modal: Rejection */}
        {showRejection && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-red-300">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="font-heading font-extrabold text-sm text-red-900">
                  ❌ Rejeter l'Ordre de Mission
                </h3>
                <button onClick={() => setShowRejection(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleRejectionSubmit} className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Veuillez renseigner le motif obligatoire du rejet pour <strong>{reference}</strong>. Le document sera rejeté et retourné au Secrétariat Central.
                </p>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Motif du rejet *</label>
                  <textarea
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    placeholder="Ex : Mission non autorisée par le calendrier académique..."
                    className="w-full p-3 rounded-xl border-2 border-red-200 focus:border-red-600"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRejection(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow"
                  >
                    {submittingAction ? 'Traitement...' : 'Confirmer le rejet'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

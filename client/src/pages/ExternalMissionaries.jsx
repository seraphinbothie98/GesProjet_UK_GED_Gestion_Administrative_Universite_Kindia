import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plane, Plus, Search, Eye, CheckCircle, Send, FileText, 
  Calendar, Building2, User, Phone, Mail, AlertCircle, X, Download, Printer,
  Archive, Clock, Award, CheckSquare, CornerUpLeft, ShieldCheck, ZoomIn, ZoomOut,
  RotateCw, Maximize2, FileCheck, CheckCircle2, Lock, AlertTriangle, ArrowRight,
  Sparkles, Scan
} from 'lucide-react';
import { formatGuineaPhone } from '../utils/phoneUtils';

export default function ExternalMissionaries() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('ALL'); // ALL, TO_SIGN, IN_PROGRESS, READY_TO_ARCHIVE, ARCHIVED
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals & Active Selections
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordHistory, setRecordHistory] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Specific Action Modals
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [arrivalData, setArrivalData] = useState({
    arrival_date: new Date().toISOString().substring(0, 10),
    arrival_time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    observations: ''
  });

  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [departureData, setDepartureData] = useState({
    departure_date: new Date().toISOString().substring(0, 10),
    departure_time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    observations: ''
  });

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Interactive Document Viewer State
  const [showDocModal, setShowDocModal] = useState(false);
  const [docModalVersion, setDocModalVersion] = useState('final'); // original, arrival, signed, departure, final
  const [docZoom, setDocZoom] = useState(100);
  const [docRotation, setDocRotation] = useState(0);

  // Registration Form State
  const [formData, setFormData] = useState({
    last_name: '',
    first_names: '',
    nationality: 'Guinéenne',
    function_title: '',
    origin_institution: '',
    mission_order_ref: '',
    object_of_mission: '',
    location_of_mission: 'Université de Kindia',
    issuing_authority: '',
    host_service_id: '',
    host_responsible_name: '',
    expected_start_date: '',
    expected_end_date: '',
    arrival_date: new Date().toISOString().substring(0, 10),
    arrival_time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    phone: '',
    email: '',
    observations: '',
    original_document: null
  });

  // Client-side file preview before submission
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [fileType, setFileType] = useState(null);

  const isSGOrAdmin = user?.role_code === 'ADMINISTRATEUR' || user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user?.role_code === 'RECTEUR';
  const isSC = user?.service_code === 'SC' || user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user?.role_code === 'SECRETARIAT_CENTRAL' || user?.role_code === 'ADMINISTRATEUR';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      let params = { search: searchQuery };
      if (selectedTab === 'TO_SIGN') {
        params.status = 'TO_SIGN_ARRIVAL';
      } else if (selectedTab === 'IN_PROGRESS') {
        params.status = 'IN_PROGRESS';
      } else if (selectedTab === 'READY_TO_ARCHIVE') {
        params.status = 'READY_TO_ARCHIVE';
      } else if (selectedTab === 'ARCHIVED') {
        params.status = 'ARCHIVED';
      }

      const [missList, servList] = await Promise.all([
        selectedTab === 'TO_SIGN_ALL' && isSGOrAdmin ? api.getExternalMissionariesToSign() : api.getExternalMissionaries(params),
        api.getServices()
      ]);

      setRecords(Array.isArray(missList) ? missList : []);
      setServices(Array.isArray(servList) ? servList : []);
    } catch (err) {
      console.error('Failed to load external missionaries:', err);
      setError(err.message || 'Erreur lors du chargement des ordres de mission externes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTab]);

  const loadRecordDetailAndHistory = async (rec) => {
    setSelectedRecord(rec);
    try {
      const hist = await api.getExternalMissionaryHistory(rec.id);
      setRecordHistory(Array.isArray(hist) ? hist : []);
    } catch (err) {
      console.error('Failed to load history:', err);
      setRecordHistory([]);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({ ...prev, original_document: file }));
      setFileType(file.type);
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.original_document) {
      setError('Veuillez joindre le document numérisé ou le PDF de l’ordre de mission original.');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const payload = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined) {
          payload.append(key, formData[key]);
        }
      });

      const res = await api.createExternalMissionary(payload);
      setSuccessMsg(`Ordre de mission enregistré avec succès (Réf: ${res.reference}). Arrivée actée et dossier transmis au Secrétaire Général.`);
      setShowAddModal(false);
      setFilePreviewUrl(null);
      setFormData({
        last_name: '',
        first_names: '',
        nationality: 'Guinéenne',
        function_title: '',
        origin_institution: '',
        mission_order_ref: '',
        object_of_mission: '',
        location_of_mission: 'Université de Kindia',
        issuing_authority: '',
        host_service_id: '',
        host_responsible_name: '',
        expected_start_date: '',
        expected_end_date: '',
        arrival_date: new Date().toISOString().substring(0, 10),
        arrival_time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        phone: '',
        email: '',
        observations: '',
        original_document: null
      });
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’enregistrement de l’ordre de mission.');
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow Action Handlers
  const handleOpenArrivalModal = (rec) => {
    setSelectedRecord(rec);
    setArrivalData({
      arrival_date: rec.arrival_date ? rec.arrival_date.substring(0, 10) : new Date().toISOString().substring(0, 10),
      arrival_time: rec.arrival_time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      observations: rec.observations || ''
    });
    setShowArrivalModal(true);
  };

  const handleConfirmArrival = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.recordExternalMissionaryArrival(selectedRecord.id, arrivalData);
      setSuccessMsg(res.message || 'Arrivée enregistrée avec succès.');
      setShowArrivalModal(false);
      const updated = await api.getExternalMissionaryById(selectedRecord.id);
      loadRecordDetailAndHistory(updated);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’enregistrement de l’arrivée.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignArrival = async (id) => {
    if (!window.confirm('Confirmer l’apposition du visa et de la signature électronique du Secrétaire Général pour l’ARRIVÉE du missionnaire ?')) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.signExternalMissionaryArrival(id);
      setSuccessMsg(res.message || 'Visa d’arrivée signé avec succès.');
      if (selectedRecord && selectedRecord.id === id) {
        const updated = await api.getExternalMissionaryById(id);
        loadRecordDetailAndHistory(updated);
      }
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la signature d’arrivée.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDepartureModal = (rec) => {
    setSelectedRecord(rec);
    setDepartureData({
      departure_date: new Date().toISOString().substring(0, 10),
      departure_time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      observations: rec.observations || ''
    });
    setShowDepartureModal(true);
  };

  const handleConfirmDeparture = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.recordExternalMissionaryDeparture(selectedRecord.id, departureData);
      setSuccessMsg(res.message || 'Départ enregistré avec succès.');
      setShowDepartureModal(false);
      const updated = await api.getExternalMissionaryById(selectedRecord.id);
      loadRecordDetailAndHistory(updated);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’enregistrement du départ.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignDeparture = async (id) => {
    if (!window.confirm('Confirmer l’apposition du visa de DÉPART et de la deuxième signature du Secrétaire Général pour clôturer la mission ?')) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.signExternalMissionaryDeparture(id);
      setSuccessMsg(res.message || 'Visa de départ signé avec succès. Le document final est prêt pour archivage.');
      if (selectedRecord && selectedRecord.id === id) {
        const updated = await api.getExternalMissionaryById(id);
        loadRecordDetailAndHistory(updated);
      }
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la signature de départ.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!selectedRecord || !rejectionReason.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.rejectExternalMissionary(selectedRecord.id, rejectionReason.trim());
      setSuccessMsg(res.message || 'Dossier retourné au Secrétariat Central.');
      setShowRejectModal(false);
      setRejectionReason('');
      const updated = await api.getExternalMissionaryById(selectedRecord.id);
      loadRecordDetailAndHistory(updated);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors du rejet.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveRecord = async (id) => {
    if (!window.confirm('Confirmez-vous le classement définitif de cet ordre de mission dans les Archives électroniques officielles de l’Université ?')) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.archiveExternalMissionary(id);
      setSuccessMsg(res.message || 'Dossier classé aux archives électroniques avec succès.');
      if (selectedRecord && selectedRecord.id === id) {
        const updated = await api.getExternalMissionaryById(id);
        loadRecordDetailAndHistory(updated);
      }
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’archivage.');
    } finally {
      setActionLoading(false);
    }
  };

  const openDocumentViewer = (rec, version = 'final') => {
    setSelectedRecord(rec);
    setDocModalVersion(version);
    setDocZoom(100);
    setDocRotation(0);
    setShowDocModal(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG':
      case 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE':
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[11px] font-extrabold inline-flex items-center space-x-1 animate-pulse">
            <span>⏳</span>
            <span>Arrivée enregistrée (Attente SG)</span>
          </span>
        );
      case 'ARRIVÉE SIGNÉE – MISSION EN COURS':
      case 'MISSION EN COURS':
      case 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL':
        return (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[11px] font-extrabold inline-flex items-center space-x-1">
            <span>🚶</span>
            <span>Mission en cours (Arrivée signée)</span>
          </span>
        );
      case 'DÉPART ENREGISTRÉ – EN ATTENTE DE SIGNATURE DU SG':
        return (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-[11px] font-extrabold inline-flex items-center space-x-1 animate-pulse">
            <span>⏳</span>
            <span>Départ enregistré (Attente SG)</span>
          </span>
        );
      case 'DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE':
      case 'MISSION TERMINÉE':
        return (
          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-full text-[11px] font-extrabold inline-flex items-center space-x-1">
            <span>✅</span>
            <span>Départ signé (Prêt Archivage)</span>
          </span>
        );
      case 'REJETÉ PAR LE SECRÉTAIRE GÉNÉRAL':
        return (
          <span className="px-2.5 py-1 bg-red-100 text-red-900 border border-red-300 rounded-full text-[11px] font-extrabold inline-flex items-center space-x-1">
            <span>❌</span>
            <span>Retourné par le SG</span>
          </span>
        );
      case 'ARCHIVÉ':
        return (
          <span className="px-2.5 py-1 bg-slate-200 text-slate-800 border border-slate-300 rounded-full text-[11px] font-extrabold inline-flex items-center space-x-1">
            <span>📁</span>
            <span>Classé aux Archives</span>
          </span>
        );
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const getStepNumber = (status) => {
    switch (status) {
      case 'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG':
      case 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE':
        return 2;
      case 'ARRIVÉE SIGNÉE – MISSION EN COURS':
      case 'MISSION EN COURS':
      case 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL':
        return 4;
      case 'DÉPART ENREGISTRÉ – EN ATTENTE DE SIGNATURE DU SG':
        return 5;
      case 'DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE':
      case 'MISSION TERMINÉE':
        return 6;
      case 'ARCHIVÉ':
        return 7;
      default:
        return 1;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 md:px-4 py-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-kindia-blue via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2.5 bg-kindia-gold/20 rounded-xl text-kindia-gold ring-1 ring-kindia-gold/40">
              <Plane className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-heading font-extrabold tracking-wide text-white">
                Ordres de Mission Externes
              </h1>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Circuit Officiel : Secrétariat Central (Arrivée) ➔ Secrétaire Général (Visa Arrivée) ➔ Mission en cours ➔ Secrétariat Central (Départ) ➔ Secrétaire Général (Visa Départ) ➔ Archivage (SC)
              </p>
            </div>
          </div>
        </div>

        {isSC && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-kindia-gold text-kindia-blue hover:bg-yellow-400 font-extrabold rounded-xl shadow-lg transition flex items-center space-x-2 text-xs shrink-0 self-start md:self-auto cursor-pointer"
          >
            <Scan className="w-4 h-4" />
            <span>Numériser / Enregistrer une Arrivée</span>
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start space-x-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">Erreur</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start space-x-3 shadow-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">Succès</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setSelectedTab('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            selectedTab === 'ALL'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Tous les dossiers</span>
        </button>

        {isSGOrAdmin && (
          <button
            onClick={() => setSelectedTab('TO_SIGN_ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
              selectedTab === 'TO_SIGN_ALL'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>À Signer par le SG</span>
          </button>
        )}

        <button
          onClick={() => setSelectedTab('IN_PROGRESS')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            selectedTab === 'IN_PROGRESS'
              ? 'bg-emerald-700 text-white shadow-md'
              : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-300'
          }`}
        >
          <span>🚶 Missions en cours</span>
        </button>

        <button
          onClick={() => setSelectedTab('READY_TO_ARCHIVE')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            selectedTab === 'READY_TO_ARCHIVE'
              ? 'bg-indigo-700 text-white shadow-md'
              : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-300'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Prêts pour Archivage</span>
        </button>

        <button
          onClick={() => setSelectedTab('ARCHIVED')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            selectedTab === 'ARCHIVED'
              ? 'bg-slate-700 text-white shadow-md'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Archives Définitives</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center space-x-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par Réf UK-GED, Nom, Institution, Objet, Réf OM..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-kindia-blue focus:bg-white transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-kindia-blue text-white text-xs font-bold rounded-xl hover:bg-kindia-lightBlue transition cursor-pointer"
          >
            Rechercher
          </button>
        </form>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center">
            <Clock className="w-8 h-8 animate-spin text-kindia-blue mb-2" />
            <span>Chargement des ordres de mission externes...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Plane className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-600">Aucun ordre de mission externe trouvé.</p>
            <p className="text-slate-400 mt-1">Utilisez le bouton ci-dessus pour numériser et enregistrer l’arrivée d’un missionnaire.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Réf UK-GED</th>
                  <th className="py-3 px-4">Missionnaire</th>
                  <th className="py-3 px-4">Institution & Objet</th>
                  <th className="py-3 px-4">Arrivée & Départ</th>
                  <th className="py-3 px-4">Statut & Étape</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((rec) => {
                  const step = getStepNumber(rec.status);
                  const isArrivalSigned = !!rec.arrival_signed_at || rec.status === 'ARRIVÉE SIGNÉE – MISSION EN COURS' || !!rec.signed_at;
                  const isDepartureSigned = !!rec.departure_signed_at || rec.status === 'DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE' || rec.status === 'MISSION TERMINÉE';
                  const isArchived = rec.status === 'ARCHIVÉ';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-kindia-blue">
                        {rec.reference}
                        <div className="text-[10px] text-slate-400 font-normal">
                          Réf OM : {rec.mission_order_ref}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">
                          {rec.last_name} {rec.first_names}
                        </div>
                        <div className="text-[11px] text-slate-500">{rec.function_title}</div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-700 truncate">{rec.origin_institution}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{rec.object_of_mission}</div>
                      </td>

                      <td className="py-3 px-4 text-[11px]">
                        <div className="text-slate-700">
                          <span className="font-bold text-emerald-700">Arrivée :</span>{' '}
                          {rec.arrival_date ? new Date(rec.arrival_date).toLocaleDateString('fr-FR') : 'Non renseignée'}
                          {isArrivalSigned && <span className="ml-1 text-emerald-600 font-bold" title="Visa Arrivée signé">✓</span>}
                        </div>
                        <div className="text-slate-700 mt-0.5">
                          <span className="font-bold text-indigo-700">Départ :</span>{' '}
                          {rec.departure_date ? new Date(rec.departure_date).toLocaleDateString('fr-FR') : 'En cours'}
                          {isDepartureSigned && <span className="ml-1 text-indigo-600 font-bold" title="Visa Départ signé">✓</span>}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {getStatusBadge(rec.status)}
                        <div className="mt-1 text-[10px] text-slate-500 font-medium">
                          Étape {step} sur 7
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Visualiser / Détail */}
                          <button
                            onClick={() => loadRecordDetailAndHistory(rec)}
                            className="p-1.5 text-slate-600 hover:text-kindia-blue hover:bg-slate-100 rounded-lg transition"
                            title="Consulter le dossier & la progression"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Prévisualiser document */}
                          <button
                            onClick={() => openDocumentViewer(rec, isDepartureSigned ? 'final' : (isArrivalSigned ? 'arrival' : 'original'))}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                            title="Prévisualiser le document numérisé / signé"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* SG Actions */}
                          {isSGOrAdmin && (rec.status === 'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG' || rec.status === 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE') && (
                            <button
                              onClick={() => handleSignArrival(rec.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
                              title="Apposer le visa de signature d’Arrivée"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Signer Arrivée</span>
                            </button>
                          )}

                          {isSGOrAdmin && rec.status === 'DÉPART ENREGISTRÉ – EN ATTENTE DE SIGNATURE DU SG' && (
                            <button
                              onClick={() => handleSignDeparture(rec.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
                              title="Apposer le visa de signature de Départ"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Signer Départ</span>
                            </button>
                          )}

                          {/* SC Action : Enregistrer Départ */}
                          {isSC && (rec.status === 'ARRIVÉE SIGNÉE – MISSION EN COURS' || rec.status === 'MISSION EN COURS' || rec.status === 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL') && (
                            <button
                              onClick={() => handleOpenDepartureModal(rec)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
                              title="Enregistrer le départ du missionnaire"
                            >
                              <Plane className="w-3.5 h-3.5" />
                              <span>Enregistrer Départ</span>
                            </button>
                          )}

                          {/* SC Action : Archiver */}
                          {isSC && (isDepartureSigned && !isArchived) && (
                            <button
                              onClick={() => handleArchiveRecord(rec.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-black text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-sm"
                              title="Classer définitivement aux archives"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>Archiver</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Side Panel / Modal for Selected Record */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-kindia-gold font-bold">{selectedRecord.reference}</span>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="text-xs font-semibold text-slate-300">Réf OM Original : {selectedRecord.mission_order_ref}</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {selectedRecord.last_name} {selectedRecord.first_names} — {selectedRecord.function_title}
                </h2>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Stepper Progress Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Progression du Circuit Administratif (7 Étapes)
                </div>
                <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-center text-[10px]">
                  {[
                    { num: 1, label: '1. Arrivée & Scan', done: true },
                    { num: 2, label: '2. Enregistrement Arrivée', done: !!selectedRecord.arrival_date },
                    { num: 3, label: '3. Visa Arrivée SG', done: !!selectedRecord.arrival_signed_at || selectedRecord.status === 'ARRIVÉE SIGNÉE – MISSION EN COURS' || !!selectedRecord.signed_at },
                    { num: 4, label: '4. Mission en cours', done: !!selectedRecord.arrival_signed_at || selectedRecord.status === 'ARRIVÉE SIGNÉE – MISSION EN COURS' },
                    { num: 5, label: '5. Enregistrement Départ', done: !!selectedRecord.departure_date },
                    { num: 6, label: '6. Visa Départ SG', done: !!selectedRecord.departure_signed_at || selectedRecord.status === 'DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE' || selectedRecord.status === 'MISSION TERMINÉE' },
                    { num: 7, label: '7. Archivage Définitif', done: selectedRecord.status === 'ARCHIVÉ' }
                  ].map((s) => (
                    <div
                      key={s.num}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center space-y-1 ${
                        s.done
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-400'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                          s.done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {s.done ? '✓' : s.num}
                      </div>
                      <span className="leading-tight">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Information Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-800 flex items-center space-x-1.5 text-xs text-kindia-blue">
                    <User className="w-4 h-4" />
                    <span>Identité du Missionnaire</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div><span className="text-slate-400">Institution :</span> {selectedRecord.origin_institution}</div>
                    <div><span className="text-slate-400">Nationalité :</span> {selectedRecord.nationality || 'Guinéenne'}</div>
                    <div><span className="text-slate-400">Téléphone :</span> {selectedRecord.phone || 'Non renseigné'}</div>
                    <div><span className="text-slate-400">Email :</span> {selectedRecord.email || 'Non renseigné'}</div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-800 flex items-center space-x-1.5 text-xs text-kindia-blue">
                    <Building2 className="w-4 h-4" />
                    <span>Mission & Accueil</span>
                  </h3>
                  <div className="space-y-1 text-slate-700">
                    <div><span className="text-slate-400">Objet :</span> {selectedRecord.object_of_mission}</div>
                    <div><span className="text-slate-400">Structure d’accueil :</span> {selectedRecord.host_service_name || 'Université de Kindia'} (Resp: {selectedRecord.host_responsible_name || 'SG'})</div>
                    <div><span className="text-slate-400">Période prévue :</span> Du {selectedRecord.expected_start_date || 'N/A'} au {selectedRecord.expected_end_date || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Mentions Apposées */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mention Arrivée */}
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 uppercase text-[10px] tracking-wide flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Visa d’Arrivée</span>
                    </span>
                    {selectedRecord.arrival_signed_at ? (
                      <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-bold text-[10px]">Signé par le SG</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold text-[10px]">En attente SG</span>
                    )}
                  </div>
                  <div className="font-mono text-emerald-950 font-bold bg-white p-2.5 rounded-lg border border-emerald-200 text-[11px]">
                    « Vu à l’arrivée à l’Université de Kindia le {selectedRecord.arrival_date ? new Date(selectedRecord.arrival_date).toLocaleDateString('fr-FR') : 'N/A'} {selectedRecord.arrival_time ? `à ${selectedRecord.arrival_time}` : ''} »
                  </div>
                </div>

                {/* Mention Départ */}
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 uppercase text-[10px] tracking-wide flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Visa de Départ</span>
                    </span>
                    {selectedRecord.departure_signed_at ? (
                      <span className="px-2 py-0.5 bg-indigo-200 text-indigo-900 rounded font-bold text-[10px]">Signé par le SG</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[10px]">Non clôturé</span>
                    )}
                  </div>
                  <div className="font-mono text-indigo-950 font-bold bg-white p-2.5 rounded-lg border border-indigo-200 text-[11px]">
                    {selectedRecord.departure_date ? (
                      `« Vu au départ de l’Université de Kindia le ${new Date(selectedRecord.departure_date).toLocaleDateString('fr-FR')} ${selectedRecord.departure_time ? `à ${selectedRecord.departure_time}` : ''} »`
                    ) : (
                      <span className="text-slate-400 italic">En attente de fin de mission...</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Bar in Modal */}
              <div className="p-4 bg-slate-100 rounded-xl flex flex-wrap items-center justify-between gap-2 border border-slate-200">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openDocumentViewer(selectedRecord, 'final')}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Prévisualiser Document Final</span>
                  </button>

                  <button
                    onClick={() => openDocumentViewer(selectedRecord, 'original')}
                    className="px-3 py-2 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-bold transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Document Original</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  {/* SG Sign Arrival */}
                  {isSGOrAdmin && (selectedRecord.status === 'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG' || selectedRecord.status === 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE') && (
                    <>
                      <button
                        onClick={() => handleSignArrival(selectedRecord.id)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Signer Arrivée (SG)</span>
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-xl transition flex items-center space-x-1 cursor-pointer"
                      >
                        <CornerUpLeft className="w-4 h-4" />
                        <span>Retourner / Rejeter</span>
                      </button>
                    </>
                  )}

                  {/* SG Sign Departure */}
                  {isSGOrAdmin && selectedRecord.status === 'DÉPART ENREGISTRÉ – EN ATTENTE DE SIGNATURE DU SG' && (
                    <>
                      <button
                        onClick={() => handleSignDeparture(selectedRecord.id)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Signer Fin de Mission & Départ (SG)</span>
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-xl transition flex items-center space-x-1 cursor-pointer"
                      >
                        <CornerUpLeft className="w-4 h-4" />
                        <span>Retourner</span>
                      </button>
                    </>
                  )}

                  {/* SC Record Departure */}
                  {isSC && (selectedRecord.status === 'ARRIVÉE SIGNÉE – MISSION EN COURS' || selectedRecord.status === 'MISSION EN COURS' || selectedRecord.status === 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL') && (
                    <button
                      onClick={() => handleOpenDepartureModal(selectedRecord)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Plane className="w-4 h-4" />
                      <span>Enregistrer le Départ (Fin Mission)</span>
                    </button>
                  )}

                  {/* SC Archive */}
                  {isSC && (selectedRecord.status === 'DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE' || selectedRecord.status === 'MISSION TERMINÉE') && (
                    <button
                      onClick={() => handleArchiveRecord(selectedRecord.id)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-extrabold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-lg"
                    >
                      <Archive className="w-4 h-4 text-kindia-gold" />
                      <span>Archiver l’Ordre de Mission</span>
                    </button>
                  )}
                </div>
              </div>

              {/* History Timeline */}
              <div>
                <h3 className="font-bold text-slate-800 text-xs mb-2 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Historique & Traçabilité Officielle</span>
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {recordHistory.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">Aucun historique disponible.</div>
                  ) : (
                    recordHistory.map((h, i) => (
                      <div key={i} className="p-3 bg-white hover:bg-slate-50 flex items-start space-x-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-kindia-blue mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{h.action}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(h.timestamp).toLocaleString('fr-FR')}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-0.5">{h.details}</p>
                          {h.first_name && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Par : {h.first_name} {h.last_name} ({h.function_title || 'Agent'})
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Document Viewer Modal */}
      {showDocModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 md:p-6">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-700 animate-in fade-in">
            {/* Viewer Top Bar */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-kindia-gold font-mono font-bold">
                  {selectedRecord.reference} • {selectedRecord.last_name} {selectedRecord.first_names}
                </div>
                <div className="text-sm font-bold text-white">
                  Prévisualisation du Document ({docModalVersion.toUpperCase()})
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setDocZoom(prev => Math.max(50, prev - 15))}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white"
                  title="Zoom Arrière"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-300 w-12 text-center">{docZoom}%</span>
                <button
                  onClick={() => setDocZoom(prev => Math.min(200, prev + 15))}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white"
                  title="Zoom Avant"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDocRotation(prev => (prev + 90) % 360)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white"
                  title="Pivoter 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <a
                  href={`/api/external-missionaries/${selectedRecord.id}/document/${docModalVersion}?token=${encodeURIComponent(localStorage.getItem('uk_ged_token') || '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white"
                  title="Ouvrir plein écran"
                >
                  <Maximize2 className="w-4 h-4" />
                </a>

                <button
                  onClick={() => setShowDocModal(false)}
                  className="p-2 bg-red-900/80 hover:bg-red-800 rounded-lg text-white ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Version Switcher Tabs */}
            <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-medium mr-2">Version :</span>
              {['final', 'departure', 'arrival', 'original'].map((ver) => (
                <button
                  key={ver}
                  onClick={() => setDocModalVersion(ver)}
                  className={`px-3 py-1 rounded-lg font-bold transition capitalize ${
                    docModalVersion === ver
                      ? 'bg-kindia-blue text-white shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {ver === 'final' ? '📄 Document Final Consolidé' : ver === 'departure' ? '🛫 Visa Départ' : ver === 'arrival' ? '📥 Visa Arrivée' : '📋 Scan Original'}
                </button>
              ))}
            </div>

            {/* Document Frame */}
            <div className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-4">
              <div 
                style={{ 
                  transform: `scale(${docZoom / 100}) rotate(${docRotation}deg)`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out'
                }}
                className="max-w-full max-h-full flex items-center justify-center"
              >
                <iframe
                  src={`/api/external-missionaries/${selectedRecord.id}/document/${docModalVersion}?token=${encodeURIComponent(localStorage.getItem('uk_ged_token') || '')}`}
                  title="Aperçu Document"
                  className="w-[800px] h-[75vh] bg-white rounded-lg shadow-2xl border border-slate-700"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Arrival Recording Modal */}
      {showArrivalModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Plane className="w-4 h-4 text-emerald-600" />
                <span>Enregistrement de l’Arrivée</span>
              </h3>
              <button onClick={() => setShowArrivalModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmArrival} className="space-y-4 text-xs">
              <div className="bg-emerald-50 p-3 rounded-xl text-emerald-900 font-bold border border-emerald-200">
                Mention légale générée automatiquement :
                <div className="mt-1 font-mono text-[11px] text-emerald-950 bg-white p-2 rounded border border-emerald-300">
                  « Vu à l’arrivée à l’Université de Kindia le {arrivalData.arrival_date} à {arrivalData.arrival_time} »
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Date réelle d’arrivée *</label>
                <input
                  type="date"
                  required
                  value={arrivalData.arrival_date}
                  onChange={(e) => setArrivalData(prev => ({ ...prev, arrival_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Heure d’arrivée</label>
                <input
                  type="text"
                  placeholder="ex: 09:30"
                  value={arrivalData.arrival_time}
                  onChange={(e) => setArrivalData(prev => ({ ...prev, arrival_time: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Observations d’arrivée</label>
                <textarea
                  rows="2"
                  placeholder="Observations éventuelles..."
                  value={arrivalData.observations}
                  onChange={(e) => setArrivalData(prev => ({ ...prev, observations: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowArrivalModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center space-x-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Valider et Transmettre au SG</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Departure Recording Modal */}
      {showDepartureModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Plane className="w-4 h-4 text-indigo-600" />
                <span>Enregistrement de la Fin de Mission & Départ</span>
              </h3>
              <button onClick={() => setShowDepartureModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeparture} className="space-y-4 text-xs">
              <div className="bg-indigo-50 p-3 rounded-xl text-indigo-900 font-bold border border-indigo-200">
                Mention légale générée automatiquement :
                <div className="mt-1 font-mono text-[11px] text-indigo-950 bg-white p-2 rounded border border-indigo-300">
                  « Vu au départ de l’Université de Kindia le {departureData.departure_date} à {departureData.departure_time} »
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Date réelle de départ *</label>
                <input
                  type="date"
                  required
                  value={departureData.departure_date}
                  onChange={(e) => setDepartureData(prev => ({ ...prev, departure_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Heure de départ</label>
                <input
                  type="text"
                  placeholder="ex: 16:00"
                  value={departureData.departure_time}
                  onChange={(e) => setDepartureData(prev => ({ ...prev, departure_time: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Observations de clôture de mission</label>
                <textarea
                  rows="2"
                  placeholder="Observations éventuelles..."
                  value={departureData.observations}
                  onChange={(e) => setDepartureData(prev => ({ ...prev, observations: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDepartureModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center space-x-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Valider et Transmettre au SG pour Visa Final</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject / Return Modal */}
      {showRejectModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in">
            <h3 className="font-bold text-red-700 text-sm mb-2 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Retourner le Dossier au Secrétariat Central</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Veuillez spécifier le motif précis du retour pour correction par le Secrétariat Central.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Motif obligatoire *</label>
                <textarea
                  required
                  rows="3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex: Document illisible, erreur sur l'institution d'origine..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold"
                >
                  Confirmer le Retour
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Registration & Document Scan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-kindia-blue to-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-kindia-gold/20 rounded-xl text-kindia-gold">
                  <Scan className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Numérisation et Enregistrement d’Arrivée</h2>
                  <p className="text-xs text-slate-300">Ordre de mission papier externe ➔ UK-GED</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Scan / Upload Section */}
              <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-kindia-blue rounded-2xl transition">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1 text-center md:text-left">
                    <span className="font-extrabold text-slate-800 text-sm block mb-1">
                      Document Papier de l’Ordre de Mission *
                    </span>
                    <p className="text-slate-500 text-[11px] mb-2">
                      Importez le document numérisé (PDF, JPG, PNG) depuis votre scanner ou ordinateur.
                    </p>
                    <input
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileChange}
                      className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue cursor-pointer"
                    />
                  </div>

                  {filePreviewUrl && (
                    <div className="w-40 h-32 bg-slate-200 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center relative shrink-0">
                      {fileType && fileType.includes('pdf') ? (
                        <div className="text-center p-2 text-kindia-blue">
                          <FileText className="w-8 h-8 mx-auto mb-1" />
                          <span className="font-bold text-[10px]">PDF Sélectionné</span>
                        </div>
                      ) : (
                        <img src={filePreviewUrl} alt="Aperçu Scan" className="w-full h-full object-cover" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nom du Missionnaire *</label>
                  <input
                    type="text"
                    required
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    placeholder="ex: KOUYATE"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Prénoms du Missionnaire *</label>
                  <input
                    type="text"
                    required
                    name="first_names"
                    value={formData.first_names}
                    onChange={handleInputChange}
                    placeholder="ex: Abdoulaye"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Fonction *</label>
                  <input
                    type="text"
                    required
                    name="function_title"
                    value={formData.function_title}
                    onChange={handleInputChange}
                    placeholder="ex: Enseignant-Chercheur"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Institution d’origine *</label>
                  <input
                    type="text"
                    required
                    name="origin_institution"
                    value={formData.origin_institution}
                    onChange={handleInputChange}
                    placeholder="ex: Université Gamal Abdel Nasser de Conakry"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Réf Ordre de Mission Original *</label>
                  <input
                    type="text"
                    required
                    name="mission_order_ref"
                    value={formData.mission_order_ref}
                    onChange={handleInputChange}
                    placeholder="ex: OM/UGANC/2026/042"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nationalité</label>
                  <input
                    type="text"
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-slate-700 font-bold mb-1">Objet de la Mission *</label>
                  <input
                    type="text"
                    required
                    name="object_of_mission"
                    value={formData.object_of_mission}
                    onChange={handleInputChange}
                    placeholder="ex: Participation au jury de soutenance de thèse et cours de Master"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Service d’accueil à l’UK</label>
                  <select
                    name="host_service_id"
                    value={formData.host_service_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="">-- Sélectionner le service --</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Date réelle d’arrivée *</label>
                  <input
                    type="date"
                    required
                    name="arrival_date"
                    value={formData.arrival_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Heure d’arrivée</label>
                  <input
                    type="text"
                    name="arrival_time"
                    value={formData.arrival_time}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Date prévue fin</label>
                  <input
                    type="date"
                    name="expected_end_date"
                    value={formData.expected_end_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Téléphone (+224)</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: formatGuineaPhone(e.target.value) }))}
                    placeholder="+224 6XX XX XX XX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="missionnaire@..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Mention Preview */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-medium text-[11px]">
                Mention automatique apposée : <span className="font-bold font-mono">« Vu à l’arrivée à l’Université de Kindia le {formData.arrival_date} à {formData.arrival_time} »</span>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-kindia-blue text-white rounded-xl font-extrabold hover:bg-kindia-lightBlue shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-kindia-gold" />
                  <span>Enregistrer l’Arrivée et Transmettre au SG</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

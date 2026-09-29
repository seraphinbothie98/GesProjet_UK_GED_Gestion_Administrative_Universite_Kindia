import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileCheck, Plus, Award, CheckCircle, ShieldCheck, Eye, Download, X, 
  Printer, Send, Archive, Search, Car, User, FileText, AlertCircle, RefreshCw, 
  XCircle, ArrowRight, Clock, HelpCircle, Building2, Phone, Mail, UploadCloud, Layers,
  Users
} from 'lucide-react';
import ReceiptSuccessModal from '../components/ReceiptSuccessModal';
import TemplatePreviewModal from '../components/TemplatePreviewModal';
import MissionSignatureModal from '../components/MissionSignatureModal';
import PublicMissionRequestModal from '../components/PublicMissionRequestModal';
import ManuscriptScanUploadModal from '../components/ManuscriptScanUploadModal';
import { formatFullName, formatTransportDisplay, formatDriverDisplay } from '../utils/userUtils';

export default function MissionOrders({ onSelectDocument, autoOpenCreate = false }) {
  const { user, hasPermission, institution } = useAuth();

  // Role detection
  const isSC = user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user?.service_code === 'SC' || user?.role_code === 'ADMINISTRATEUR';
  const isSG = user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user?.role_code === 'RECTEUR' || hasPermission('mission.sign');
  const isTeacher = user?.personnel_category === 'ENSEIGNANT_CHERCHEUR' || !user?.service_id;
  const isOtherChef = (user?.role_code === 'CHEF_SERVICE' || user?.role_code === 'RESPONSABLE_ADMINISTRATIF') && !isSC && !isSG;

  // Active Tab State (defaults adapted to role)
  const defaultTab = isSG ? 'TO_SIGN' : (isSC ? 'REQUESTS' : 'MY_REQUESTS');
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Data States
  const [missions, setMissions] = useState([]);
  const [toSignMissions, setToSignMissions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [driversList, setDriversList] = useState([]);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [requestFilter, setRequestFilter] = useState('ACTIVE'); // 'ACTIVE' | 'ALL'

  // Modals
  const [showModal, setShowModal] = useState(autoOpenCreate);

  useEffect(() => {
    if (autoOpenCreate) {
      setShowModal(true);
    }
  }, [autoOpenCreate]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(null);
  const [showTimelineModal, setShowTimelineModal] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(null);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState(null);
  const [showRejectRequestModal, setShowRejectRequestModal] = useState(null);
  const [showComplementModal, setShowComplementModal] = useState(null);
  const [previewTemplateModal, setPreviewTemplateModal] = useState(null);
  const [selectedMissionForSign, setSelectedMissionForSign] = useState(null);
  const [showUploadScanModal, setShowUploadScanModal] = useState(null);
  const [signatureModeInForm, setSignatureModeInForm] = useState('ELECTRONIC');
  const [documentFormatInForm, setDocumentFormatInForm] = useState('WORD_DOCX');

  const [signingId, setSigningId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createModalError, setCreateModalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [createdReceiptData, setCreatedReceiptData] = useState(null);

  // Form State for Official OM Creation
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffMatriculeSearch, setStaffMatriculeSearch] = useState('');
  const [showStaffSearchResults, setShowStaffSearchResults] = useState(false);
  const [missionaryTitre, setMissionaryTitre] = useState('M.');
  const [missionaryName, setMissionaryName] = useState('');
  const [missionaryFirstnames, setMissionaryFirstnames] = useState('');
  const [nationality, setNationality] = useState('Guinéenne');
  const [functionTitle, setFunctionTitle] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [matricule, setMatricule] = useState('');

  const [destination, setDestination] = useState('');
  const [objectOfMission, setObjectOfMission] = useState('');
  const [transportMode, setTransportMode] = useState('Véhicule service/Personnel');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  
  const [driverOption, setDriverOption] = useState('SELF'); // SELF or DRIVER
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverName, setDriverName] = useState('Lui-même');
  const [vehicleId, setVehicleId] = useState('');
  const [selectedPersonalVehicleId, setSelectedPersonalVehicleId] = useState('');
  const [vehicleRegistration, setVehicleRegistration] = useState('');
  const [observations, setObservations] = useState('');
  const [linkedRequestId, setLinkedRequestId] = useState(null);
  const [formParticipants, setFormParticipants] = useState([]);

  // Multi-vehicles & Autonomous Drivers
  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [driversRegistry, setDriversRegistry] = useState([]);
  const [missionaryPersonalVehicles, setMissionaryPersonalVehicles] = useState([]);
  const [missionaryAssignedVehicles, setMissionaryAssignedVehicles] = useState([]);
  const [missionaryAttachedDrivers, setMissionaryAttachedDrivers] = useState([]);

  // Modals Input States
  const [recipientName, setRecipientName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [complementNotes, setComplementNotes] = useState('');

  useEffect(() => {
    loadAllData();
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Official Mission Orders
      const listPromise = api.getMissionOrders().catch(() => []);
      
      // 2. Pending To-Sign for SG
      const toSignPromise = (isSG || isSC) ? api.getPendingMissionsToSign().catch(() => []) : Promise.resolve([]);
      
      // 3. Online Requests for SC & Admin
      const reqsPromise = isSC ? api.getMissionRequests().catch(() => []) : Promise.resolve([]);
      
      // 4. My requests for Teachers / Standard users
      const myReqsPromise = api.getMyMissionRequests().catch(() => []);
      
      // 5. Staff & Drivers
      const staffPromise = isSC ? api.getStaff({ status: 'ACTIF' }).catch(() => []) : Promise.resolve([]);
      const driversPromise = isSC ? api.getStaff({ status: 'ACTIF', is_driver: true }).catch(() => []) : Promise.resolve([]);
      
      // 5b. University Fleet & Drivers Registry
      const fleetPromise = api.getFleetVehicles().catch(() => []);
      const driversRegPromise = api.getDrivers({ active_only: 'true' }).catch(() => []);

      // 6. Template for Mission Order (Strictly Active Default from Official Mission Order Template)
      const templatesPromise = api.getActiveMissionOrderTemplate()
        .then(t => {
          if (!t) return [];
          return [{
            id: t.id,
            name: t.name,
            code: 'ORDRE_001',
            document_type_code: 'MISSION_ORDER',
            version: t.version_number || t.version || 1,
            version_number: t.version_number || t.version || 1,
            file_path: t.file_path,
            file_name: t.file_name,
            is_active: t.status === 'ACTIVE' ? 1 : 0,
            is_default: t.is_default !== undefined ? t.is_default : 1,
            default_document_format: t.default_document_format || 'WORD_DOCX'
          }];
        })
        .catch(() => []);

      const [mList, toSignList, reqList, myReqList, sList, dList, fleetList, drvRegList, tplsList] = await Promise.all([
        listPromise,
        toSignPromise,
        reqsPromise,
        myReqsPromise,
        staffPromise,
        driversPromise,
        fleetPromise,
        driversRegPromise,
        templatesPromise
      ]);

      setMissions(Array.isArray(mList) ? mList : []);
      setToSignMissions(Array.isArray(toSignList) ? toSignList : []);
      setRequests(Array.isArray(reqList) ? reqList : []);
      setMyRequests(Array.isArray(myReqList) ? myReqList : []);
      setStaffDirectory(Array.isArray(sList) ? sList : []);
      setDriversList(Array.isArray(dList) ? dList : []);
      setFleetVehicles(Array.isArray(fleetList) ? fleetList : []);
      setDriversRegistry(Array.isArray(drvRegList) ? drvRegList : []);

      // Set active default template for mission order
      const defaultMissionTpl = Array.isArray(tplsList) && tplsList.length > 0 ? tplsList[0] : null;

      const validTpls = defaultMissionTpl ? [defaultMissionTpl] : [];
      setAvailableTemplates(validTpls);
      if (defaultMissionTpl) {
        setSelectedTemplateId(defaultMissionTpl.id);
        if (defaultMissionTpl.default_document_format) {
          setDocumentFormatInForm(defaultMissionTpl.default_document_format);
        }
      } else {
        setSelectedTemplateId('');
      }
    } catch (err) {
      console.error('Failed to load mission orders data:', err);
      setError('Erreur lors du chargement des données de mission.');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffSelect = async (staffId) => {
    const s = staffDirectory.find(item => item.id === parseInt(staffId));
    if (s) {
      setSelectedStaffId(s.id);
      setMissionaryTitre(s.titre || s.grade || 'M.');
      setMissionaryName(s.nom || '');
      setMissionaryFirstnames(s.prenoms || '');
      setNationality(s.nationality || 'Guinéenne');
      setFunctionTitle(s.fonction || '');
      setServiceName(s.service_name || '');
      setMatricule(s.matricule || '');
      setStaffMatriculeSearch(s.matricule ? `[${s.matricule}] ${s.nom} ${s.prenoms}` : `${s.nom} ${s.prenoms}`);

      // 1. Fetch missionary's active personal vehicles
      try {
        const pVehs = await api.getStaffPersonalVehicles(s.id, true);
        const activePV = Array.isArray(pVehs) ? pVehs : [];
        setMissionaryPersonalVehicles(activePV);

        if (transportMode === 'Véhicule service/Personnel' || transportMode === 'Véhicule personnel' || transportMode === 'Véhicule Personnel') {
          if (activePV.length > 0) {
            setSelectedPersonalVehicleId(String(activePV[0].id));
            setVehicleRegistration(activePV[0].registration_number);
          } else {
            setSelectedPersonalVehicleId('');
            setVehicleRegistration(s.personal_vehicle_registration || '');
          }
          setDriverOption('SELF');
          setDriverName('Lui-même');
        }
      } catch (err) {
        console.warn('Erreur chargement véhicules personnels:', err);
        setMissionaryPersonalVehicles([]);
      }

      // 2. Fetch missionary's assigned fleet vehicles & attached drivers
      try {
        const [assignedVehs, attachedDrvs] = await Promise.all([
          api.getStaffAssignedVehicles(s.id).catch(() => []),
          api.getStaffDrivers(s.id).catch(() => [])
        ]);
        const activeAssigned = Array.isArray(assignedVehs) ? assignedVehs : [];
        const activeAttached = Array.isArray(attachedDrvs) ? attachedDrvs : [];
        setMissionaryAssignedVehicles(activeAssigned);
        setMissionaryAttachedDrivers(activeAttached);

        if (transportMode === 'Véhicule service/Personnel' || transportMode === 'Véhicule de service' || transportMode === 'Véhicule Officiel de l’Université') {
          const primaryVeh = activeAssigned.length > 0 
            ? activeAssigned[0] 
            : (fleetVehicles.find(v => v.assigned_staff_id === s.id) || null);
          if (primaryVeh) {
            setVehicleId(String(primaryVeh.id));
            setSelectedPersonalVehicleId('');
            setVehicleRegistration(primaryVeh.registration_number);
            if (primaryVeh.default_driver_id) {
              setSelectedDriverId(String(primaryVeh.default_driver_id));
              setDriverOption('DRIVER');
              setDriverName(primaryVeh.default_driver_full_name || 'Chauffeur habituel');
            } else if (activeAttached.length > 0) {
              const defDrv = activeAttached.find(d => d.is_default) || activeAttached[0];
              setSelectedDriverId(String(defDrv.id));
              setDriverOption('DRIVER');
              setDriverName(formatFullName(defDrv));
            }
          }
        }
      } catch (err) {
        console.warn('Erreur chargement véhicules de service ou chauffeurs:', err);
      }
    } else {
      setSelectedStaffId('');
      setMissionaryPersonalVehicles([]);
      setMissionaryAssignedVehicles([]);
      setMissionaryAttachedDrivers([]);
      setSelectedPersonalVehicleId('');
      setVehicleRegistration('');
    }
  };

  const handleTransportModeChange = (mode) => {
    setTransportMode(mode);
    if (mode === 'Véhicule service/Personnel' || mode === 'Véhicule de service' || mode === 'Véhicule personnel' || mode === 'Véhicule Personnel' || mode === 'Véhicule Officiel de l’Université') {
      const assigned = missionaryAssignedVehicles.length > 0
        ? missionaryAssignedVehicles[0]
        : (selectedStaffId ? fleetVehicles.find(v => v.assigned_staff_id === parseInt(selectedStaffId)) : null);

      if (assigned) {
        setSelectedPersonalVehicleId('');
        setVehicleId(String(assigned.id));
        setVehicleRegistration(assigned.registration_number);
        if (assigned.default_driver_id) {
          setSelectedDriverId(String(assigned.default_driver_id));
          setDriverOption('DRIVER');
          setDriverName(assigned.default_driver_full_name || 'Chauffeur habituel');
        } else if (missionaryAttachedDrivers.length > 0) {
          const defDrv = missionaryAttachedDrivers.find(d => d.is_default) || missionaryAttachedDrivers[0];
          setSelectedDriverId(String(defDrv.id));
          setDriverOption('DRIVER');
          setDriverName(formatFullName(defDrv));
        } else {
          setDriverOption('SELF');
          setDriverName('Lui-même');
        }
      } else if (missionaryPersonalVehicles.length > 0) {
        const pv = missionaryPersonalVehicles[0];
        setVehicleId('');
        setSelectedPersonalVehicleId(String(pv.id));
        setVehicleRegistration(pv.registration_number);
        setDriverOption('SELF');
        setDriverName('Lui-même');
      } else {
        const s = staffDirectory.find(item => item.id === parseInt(selectedStaffId));
        if (s?.personal_vehicle_registration) {
          setVehicleId('');
          setSelectedPersonalVehicleId('');
          setVehicleRegistration(s.personal_vehicle_registration);
        } else {
          const availableFleet = fleetVehicles.find(v => v.status === 'DISPONIBLE') || fleetVehicles[0];
          if (availableFleet) {
            setVehicleId(String(availableFleet.id));
            setVehicleRegistration(availableFleet.registration_number);
          } else {
            setVehicleId('');
            setVehicleRegistration('');
          }
        }
        setDriverOption('SELF');
        setDriverName('Lui-même');
      }
    } else {
      // Transports en commun, Avion, Autre
      setVehicleId('');
      setSelectedPersonalVehicleId('');
      setVehicleRegistration('');
      setDriverOption('SELF');
      setDriverName('Lui-même');
    }
  };

  const handleDriverSelect = (driverId) => {
    if (!driverId) {
      setSelectedDriverId('');
      setDriverName('');
      return;
    }
    const d = driversRegistry.find(item => item.id === parseInt(driverId)) || driversList.find(item => item.id === parseInt(driverId));
    if (d) {
      setSelectedDriverId(d.id);
      setDriverName(formatFullName(d));
    }
  };

  // Convert Online Request to Official OM (Pre-fills creation modal)
  const handleConvertRequestToOM = async (reqItem) => {
    if (reqItem.official_document_id || reqItem.status === 'DEMANDE ACCEPTÉE' || reqItem.status === 'ORDRE DE MISSION EN PRÉPARATION' || reqItem.status === 'EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL') {
      alert("Un ordre de mission officiel a déjà été créé pour cette demande ou celle-ci a déjà été traitée.");
      return;
    }
    resetForm();
    setLinkedRequestId(reqItem.id);
    setMissionaryTitre(reqItem.applicant_titre || reqItem.titre || reqItem.grade || 'M.');
    setMissionaryName(reqItem.applicant_last_name || '');
    setMissionaryFirstnames(reqItem.applicant_first_names || '');
    setFunctionTitle(reqItem.applicant_function || '');
    setServiceName(reqItem.applicant_service_name || '');
    setMatricule(reqItem.applicant_matricule || '');
    if (reqItem.applicant_matricule) {
      setStaffMatriculeSearch(`[${reqItem.applicant_matricule}] ${reqItem.applicant_last_name || ''} ${reqItem.applicant_first_names || ''}`.trim());
    }
    setDestination(reqItem.destination || '');
    setObjectOfMission(reqItem.object_of_mission || '');
    setDepartureDate(reqItem.start_date ? reqItem.start_date.substring(0, 10) : '');
    setReturnDate(reqItem.end_date ? reqItem.end_date.substring(0, 10) : '');

    // Normalize transportMode to official labels
    const rawMode = reqItem.transport_means || 'Véhicule de service';
    let normMode = 'Véhicule de service';
    if (rawMode === 'TRANSPORTS EN COMMUN' || rawMode.includes('commun')) {
      normMode = 'Transports en commun / Car';
    } else if (rawMode === 'VÉHICULE PERSONNEL' || rawMode.includes('Personnel') || rawMode.includes('personnel')) {
      normMode = 'Véhicule personnel';
    } else if (rawMode === 'AVION' || rawMode.includes('Avion')) {
      normMode = 'Avion (Vol national / international)';
    }
    setTransportMode(normMode);
    setObservations(reqItem.justification_motif || '');
    setDriverOption('SELF');
    setDriverName('Lui-même');

    // Load participants if collective request
    if (reqItem.participants && reqItem.participants.length > 0) {
      setFormParticipants(reqItem.participants);
    } else {
      api.getMissionRequestById(reqItem.id)
        .then(full => {
          if (full?.participants && full.participants.length > 0) {
            setFormParticipants(full.participants);
          }
        })
        .catch(() => {});
    }

    // Lookup matching staff member for vehicle prefill
    const s = staffDirectory.find(item => 
      (item.matricule && reqItem.applicant_matricule && item.matricule.trim().toLowerCase() === reqItem.applicant_matricule.trim().toLowerCase()) ||
      (item.nom && reqItem.applicant_last_name && item.nom.trim().toLowerCase() === reqItem.applicant_last_name.trim().toLowerCase())
    );
    if (s) {
      await handleStaffSelect(s.id);
    }
    setShowModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateModalError('');

    if (!missionaryName || !destination || !objectOfMission || !departureDate || !returnDate) {
      setCreateModalError('Veuillez remplir toutes les informations obligatoires de la mission.');
      return;
    }

    setSubmitting(true);
    try {
      const fullMissionaryName = missionaryFirstnames ? `${missionaryName} ${missionaryFirstnames}` : missionaryName;

      const res = await api.createMissionOrder({
        linked_request_id: linkedRequestId || null,
        template_id: selectedTemplateId || null,
        staff_id: selectedStaffId || null,
        missionary_titre: missionaryTitre || 'M.',
        titre: missionaryTitre || 'M.',
        grade: missionaryTitre || 'M.',
        missionary_name: fullMissionaryName,
        missionary_firstnames: missionaryFirstnames,
        nationality,
        function_title: functionTitle,
        service_id: selectedStaffId ? (staffDirectory.find(s => s.id === parseInt(selectedStaffId))?.service_id) : null,
        matricule,
        destination,
        object_of_mission: objectOfMission,
        transport_mode: transportMode,
        departure_date: departureDate,
        return_date: returnDate,
        driver_option: driverOption,
        driver_id: selectedDriverId || null,
        driver_name: (driverOption === 'SELF' || !driverName || driverName === 'Lui-même') ? 'Lui-même' : driverName,
        vehicle_id: vehicleId || null,
        personal_vehicle_id: selectedPersonalVehicleId || null,
        vehicle_registration: vehicleRegistration,
        observations,
        signature_mode: signatureModeInForm,
        document_format: documentFormatInForm,
        participants: formParticipants && formParticipants.length > 0 ? formParticipants : undefined
      });

      const modeText = signatureModeInForm === 'MANUSCRIPT' 
        ? 'Ordre de mission créé avec succès (Mode Manuscrit : prêt pour impression et signature physique du SG).' 
        : 'Ordre de mission créé avec succès et transmis au Secrétaire Général pour signature électronique.';

      setSuccessMsg(modeText);
      setShowModal(false);
      resetForm();
      await loadAllData();
      setActiveTab(signatureModeInForm === 'MANUSCRIPT' ? 'ALL' : 'PENDING_SIGN');

      if (res && res.reference) {
        setCreatedReceiptData({
          reference: res.reference,
          receipt: res.receipt,
          documentType: 'MISSION_ORDER'
        });
      }
    } catch (err) {
      setCreateModalError(err.message || 'Erreur lors de la création de l’ordre de mission.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Mission Request (For Teachers, Non-attached Staff, and other Users)
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!destination || !objectOfMission || !departureDate || !returnDate) {
      setError('Veuillez renseigner la destination, l’objet et les dates de mission.');
      return;
    }

    setSubmitting(true);
    try {
      const isTeacherUser = user?.personnel_category === 'ENSEIGNANT_CHERCHEUR' || !user?.service_id;
      const res = await api.submitMissionRequest({
        missionary_name: formatFullName(user),
        function_title: user?.function_title || (isTeacherUser ? 'Enseignant-Chercheur' : 'Agent Administratif'),
        personnel_category: user?.personnel_category || (isTeacherUser ? 'ENSEIGNANT_CHERCHEUR' : 'PERSONNEL_ADMINISTRATIF'),
        faculty_dept: user?.academic_structure || (user?.service_name ? `Service : ${user.service_name}` : 'Non rattaché à un service administratif'),
        destination,
        object_of_mission: objectOfMission,
        transport_mode: transportMode,
        departure_date: departureDate,
        return_date: returnDate,
        observations
      });

      setSuccessMsg(res.message || 'Votre demande d’ordre de mission a été transmise avec succès au Secrétariat Central.');
      setShowRequestModal(false);
      resetForm();
      await loadAllData();
      setActiveTab('MY_REQUESTS');
    } catch (err) {
      setError(err.message || 'Erreur lors de la transmission de la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCreateModalError('');
    setSelectedStaffId('');
    setStaffMatriculeSearch('');
    setShowStaffSearchResults(false);
    setMissionaryTitre('M.');
    setMissionaryName('');
    setMissionaryFirstnames('');
    setNationality('Guinéenne');
    setFunctionTitle('');
    setServiceName('');
    setMatricule('');
    setDestination('');
    setObjectOfMission('');
    setTransportMode('Véhicule service/Personnel');
    setDepartureDate('');
    setReturnDate('');
    setDriverOption('SELF');
    setSelectedDriverId('');
    setDriverName('Lui-même');
    setVehicleId('');
    setSelectedPersonalVehicleId('');
    setVehicleRegistration('');
    setObservations('');
    setLinkedRequestId(null);
    setFormParticipants([]);
    setSignatureModeInForm('ELECTRONIC');
    setMissionaryPersonalVehicles([]);
    setMissionaryAssignedVehicles([]);
    setMissionaryAttachedDrivers([]);
  };

  const openNewMissionModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenRequestDetail = async (reqItem) => {
    setSelectedRequestDetail(reqItem);
    try {
      const fullDetail = await api.getMissionRequestById(reqItem.id);
      if (fullDetail) {
        setSelectedRequestDetail(fullDetail);
      }
    } catch (e) {
      // Keep initial reqItem
    }
  };

  // Secrétaire Général: Signature Action - Opens Full Dedicated Signature Interface
  const handleSign = (m) => {
    if (typeof m === 'object' && m !== null) {
      setSelectedMissionForSign(m);
    } else {
      const found = missions.find(item => item.document_id === m || item.id === m) || toSignMissions.find(item => item.document_id === m || item.id === m);
      if (found) {
        setSelectedMissionForSign(found);
      } else {
        setSelectedMissionForSign({ document_id: m });
      }
    }
  };

  const handleModeSwitch = async (m, newMode) => {
    try {
      const res = await api.setMissionSignatureMode(m.document_id, newMode);
      setSuccessMsg(res.message || 'Mode de signature mis à jour.');
      loadAllData();
    } catch (err) {
      alert('Erreur lors du changement de mode : ' + err.message);
    }
  };

  const handleMarkManuscriptSigned = async (m) => {
    if (!window.confirm(`Confirmez-vous que l'Ordre de mission ${m.reference} a été signé manuellement et cacheté par le Secrétaire Général ?`)) {
      return;
    }
    try {
      const res = await api.markMissionManuscriptSigned(m.document_id);
      setSuccessMsg(res.message || 'Signature manuscrite enregistrée. Prêt pour numérisation.');
      loadAllData();
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) return alert('Motif de rejet obligatoire.');

    try {
      await api.rejectMissionOrder(showRejectModal.document_id, rejectionReason);
      setShowRejectModal(null);
      setRejectionReason('');
      setSuccessMsg('Ordre de mission rejeté.');
      loadAllData();
    } catch (err) {
      alert('Erreur lors du rejet : ' + err.message);
    }
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!correctionNotes.trim()) return alert('Notes de correction obligatoires.');

    try {
      await api.requestMissionCorrection(showCorrectionModal.document_id, correctionNotes);
      setShowCorrectionModal(null);
      setCorrectionNotes('');
      setSuccessMsg('Demande de correction transmise au Secrétariat Central.');
      loadAllData();
    } catch (err) {
      alert('Erreur lors de la demande de correction : ' + err.message);
    }
  };

  const handlePrint = async (m) => {
    try {
      const res = await api.printMissionOrder(m.document_id, 'Impression officielle pour remise');
      if (res.pdf_url) {
        window.open(res.pdf_url, '_blank');
      } else if (m.signed_pdf_path) {
        window.open(`/uploads/${m.signed_pdf_path}`, '_blank');
      }
      loadAllData();
    } catch (err) {
      alert('Erreur lors de l’impression : ' + err.message);
    }
  };

  const handleDeliverSubmit = async (e) => {
    e.preventDefault();
    if (!showDeliverModal) return;

    try {
      await api.deliverMissionOrder(showDeliverModal.document_id, {
        recipient_name: recipientName || showDeliverModal.missionary_name
      });

      setShowDeliverModal(null);
      setRecipientName('');
      setSuccessMsg('Ordre de mission marqué comme remis au demandeur avec succès.');
      loadAllData();
    } catch (err) {
      alert('Erreur lors de la remise : ' + err.message);
    }
  };

  const handleArchive = async (m) => {
    if (m.status !== 'REMIS AU DEMANDEUR') {
      alert("⚠️ ACTION IMPOSSIBLE : L'ordre de mission doit d'abord être imprimé et remis au demandeur.");
      return;
    }

    if (!window.confirm(`Confirmez-vous le classement définitif aux archives électroniques de l'ordre de mission ${m.reference} ?`)) {
      return;
    }

    try {
      await api.archiveDocument(m.document_id);
      setSuccessMsg('Ordre de mission classé aux archives électroniques avec succès.');
      loadAllData();
    } catch (err) {
      alert('Erreur lors de l’archivage : ' + err.message);
    }
  };

  // Filtered Lists
  const pendingRequestsCount = requests.filter(r => 
    (r.status === 'EN_ATTENTE_SC' || r.status === 'DEMANDE ENREGISTRÉE' || r.status === 'EN ATTENTE' || r.status === 'DEMANDE REÇUE') && 
    !r.official_document_id
  ).length;
  const pendingSignCount = missions.filter(m => !m.is_signed && (m.status === 'PENDING' || m.status === 'EN ATTENTE')).length;
  const returnedCount = missions.filter(m => m.status === 'RETOURNÉ AU SECRÉTARIAT CENTRAL').length;
  const deliveredCount = missions.filter(m => m.status === 'REMIS AU DEMANDEUR').length;
  const archivedCount = missions.filter(m => m.status === 'ARCHIVÉ' || m.status === 'ARCHIVED').length;
  const signedCount = missions.filter(m => m.is_signed).length;

  const filteredMissions = missions.filter(m => {
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      const match = (m.reference && m.reference.toLowerCase().includes(term)) ||
                    (m.missionary_name && m.missionary_name.toLowerCase().includes(term)) ||
                    (m.destination && m.destination.toLowerCase().includes(term)) ||
                    (m.object_of_mission && m.object_of_mission.toLowerCase().includes(term));
      if (!match) return false;
    }

    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING_SIGN') return !m.is_signed && (m.status === 'PENDING' || m.status === 'EN ATTENTE');
    if (activeTab === 'SIGNED') return m.is_signed && m.status !== 'ARCHIVÉ' && m.status !== 'ARCHIVED';
    if (activeTab === 'RETURNED') return m.status === 'RETOURNÉ AU SECRÉTARIAT CENTRAL';
    if (activeTab === 'DELIVERED') return m.status === 'REMIS AU DEMANDEUR';
    if (activeTab === 'ARCHIVED') return m.status === 'ARCHIVÉ' || m.status === 'ARCHIVED';
    if (activeTab === 'TO_SIGN') return !m.is_signed && (m.status === 'PENDING' || m.status === 'EN ATTENTE');
    return true;
  });

  const filteredRequests = requests.filter(r => {
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      const match = (r.reference && r.reference.toLowerCase().includes(term)) ||
                    (r.applicant_last_name && r.applicant_last_name.toLowerCase().includes(term)) ||
                    (r.applicant_first_names && r.applicant_first_names.toLowerCase().includes(term)) ||
                    (r.destination && r.destination.toLowerCase().includes(term)) ||
                    (r.object_of_mission && r.object_of_mission.toLowerCase().includes(term));
      if (!match) return false;
    }
    if (requestFilter === 'ACTIVE') {
      return (r.status === 'EN_ATTENTE_SC' || r.status === 'DEMANDE ENREGISTRÉE' || r.status === 'EN ATTENTE' || r.status === 'DEMANDE REÇUE') && !r.official_document_id;
    }
    return true;
  });

  return (
    <div className="space-y-6 w-full max-w-full pb-16">
      {/* Alert Messages */}
      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl text-emerald-800 text-xs font-bold flex justify-between items-center shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 font-extrabold text-sm">×</button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl text-rose-800 text-xs font-bold flex justify-between items-center shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-900 font-extrabold text-sm">×</button>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-kindia-blue text-kindia-gold flex items-center justify-center font-extrabold shadow shrink-0">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-kindia-gold uppercase tracking-wider block">
              UNIVERSITÉ DE KINDIA • {institution?.name ? institution.name.split(' ')[0] : 'UK'}
            </span>
            <h2 className="font-heading font-extrabold text-lg text-slate-800 leading-tight">
              {isSC 
                ? 'Gestion Administrative des Ordres de Mission' 
                : (isSG 
                  ? 'Validation & Signature des Ordres de Mission' 
                  : 'Mes Ordres de Mission & Demandes')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Connecté en tant que : <strong className="text-kindia-blue">{formatFullName(user)}</strong> ({user?.role_name || user?.service_name || 'Enseignant'})
            </p>
          </div>
        </div>

        {/* Action Button: Tailored by Role */}
        <div className="flex items-center space-x-2.5 w-full md:w-auto">
          {isSC ? (
            <button
              onClick={openNewMissionModal}
              className="w-full md:w-auto bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow transition flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4 text-kindia-gold" />
              <span>🧾 ÉTABLIR UN ORDRE DE MISSION (SC)</span>
            </button>
          ) : (
            <button
              onClick={() => { resetForm(); setShowRequestModal(true); }}
              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow transition flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4 text-white" />
              <span>📝 DEMANDER UN ORDRE DE MISSION</span>
            </button>
          )}
        </div>
      </div>

      {/* Role-Specific Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm text-xs font-bold">
        {isSC && (
          <>
            <button
              onClick={() => setActiveTab('REQUESTS')}
              className={`px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'REQUESTS' ? 'bg-kindia-blue text-white shadow-sm font-extrabold' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📥 Demandes d'ordre de mission reçues</span>
              {pendingRequestsCount > 0 && (
                <span className="bg-kindia-gold text-kindia-blue px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-2 rounded-xl transition ${
                activeTab === 'ALL' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📋 Tous les ordres ({missions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('PENDING_SIGN')}
              className={`px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'PENDING_SIGN' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>⏳ Transmis au SG ({pendingSignCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('RETURNED')}
              className={`px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'RETURNED' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📬 Retournés signés au SC ({returnedCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('DELIVERED')}
              className={`px-3.5 py-2 rounded-xl transition ${
                activeTab === 'DELIVERED' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🤝 Remis ({deliveredCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('ARCHIVED')}
              className={`px-3.5 py-2 rounded-xl transition ${
                activeTab === 'ARCHIVED' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📁 Archivés ({archivedCount})</span>
            </button>
          </>
        )}

        {isSG && (
          <>
            <button
              onClick={() => setActiveTab('TO_SIGN')}
              className={`px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'TO_SIGN' ? 'bg-amber-600 text-white shadow-sm font-extrabold' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>✍️ En attente de ma signature ({toSignMissions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('SIGNED')}
              className={`px-3.5 py-2 rounded-xl transition ${
                activeTab === 'SIGNED' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>✅ Signés & Validés ({signedCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-2 rounded-xl transition ${
                activeTab === 'ALL' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📋 Historique complet ({missions.length})</span>
            </button>
          </>
        )}

        {!isSC && !isSG && (
          <>
            <button
              onClick={() => setActiveTab('MY_REQUESTS')}
              className={`px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'MY_REQUESTS' ? 'bg-kindia-blue text-white shadow-sm font-extrabold' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4 text-kindia-gold" />
              <span>Mes demandes transmises ({myRequests.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('MY_MISSIONS')}
              className={`px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'MY_MISSIONS' ? 'bg-kindia-blue text-white shadow-sm font-extrabold' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Mes ordres de mission officiels</span>
            </button>
          </>
        )}
      </div>

      {/* SG Signature Box Highlight (Direct display when SG opens to sign) */}
      {isSG && activeTab === 'TO_SIGN' && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-xl space-y-4">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-6 h-6 text-white shrink-0" />
            <div>
              <h3 className="font-heading font-extrabold text-sm tracking-wide uppercase">
                BOÎTE À SIGNER — {user?.function_title || 'SECRÉTAIRE GÉNÉRAL'} ({toSignMissions.length} Ordre(s) en attente)
              </h3>
              <p className="text-xs text-amber-100">
                Examinez et apposez votre signature électronique officielle pour validation et retour automatique au Secrétariat Central.
              </p>
            </div>
          </div>

          {toSignMissions.length === 0 ? (
            <div className="bg-white/10 p-6 rounded-xl text-center text-xs text-white/90">
              ✨ Aucun ordre de mission en attente de votre signature pour le moment.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {toSignMissions.map(m => (
                <div key={m.document_id} className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-xs text-yellow-200">{m.reference}</span>
                      <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded font-medium">{m.destination}</span>
                    </div>
                    <h4 className="font-bold text-sm text-white mt-1">{m.missionary_name}</h4>
                    <p className="text-xs text-amber-100 mt-0.5"><strong>Objet :</strong> {m.object_of_mission}</p>
                    <p className="text-[11px] text-white/80 mt-0.5"><strong>Dates :</strong> Du {m.departure_date} au {m.return_date}</p>
                    <p className="text-[10px] text-white/70"><strong>Émis par :</strong> Secrétariat Central</p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10 text-xs">
                    <button
                      onClick={() => handleSign(m)}
                      className="flex-1 px-3 py-2 bg-white text-amber-900 font-extrabold rounded-lg shadow hover:bg-kindia-gold hover:text-kindia-blue transition flex items-center justify-center space-x-1 text-xs"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>✍️ SIGNER ET RETOURNER AU SC</span>
                    </button>

                    <button
                      onClick={() => setShowCorrectionModal(m)}
                      className="px-2.5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition text-xs"
                      title="Demander une correction au Secrétariat Central"
                    >
                      📝 Correction
                    </button>

                    <button
                      onClick={() => setShowRejectModal(m)}
                      className="px-2.5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg transition text-xs"
                      title="Rejeter avec motif obligatoire"
                    >
                      ❌ Rejeter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Secrétariat Central: Online Requests Register View */}
      {isSC && activeTab === 'REQUESTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-heading font-extrabold text-sm text-slate-800">
                Demandes d'ordre de mission reçues ({filteredRequests.length})
              </h3>
              <p className="text-xs text-slate-500">
                Boîte de réception du Secrétariat Central • Examinez la demande et cliquez sur « Créer l'ordre de mission »
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRequestFilter('ACTIVE')}
                  className={`px-3 py-1 rounded-lg transition ${
                    requestFilter === 'ACTIVE'
                      ? 'bg-kindia-blue text-white shadow-sm font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  À traiter ({pendingRequestsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRequestFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition ${
                    requestFilter === 'ALL'
                      ? 'bg-kindia-blue text-white shadow-sm font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Toutes ({requests.length})
                </button>
              </div>

              <div className="w-full sm:w-56">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher demandeur..."
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Requests Feed for Mobile & Table for Desktop */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Chargement des demandes...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {requestFilter === 'ACTIVE' 
                  ? 'Aucune demande d\'ordre de mission en attente de traitement.' 
                  : 'Aucune demande d\'ordre de mission trouvée.'}
              </div>
            ) : (
              filteredRequests.map(r => (
                <div key={r.id} className="p-4 space-y-3 hover:bg-slate-50 transition">
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-xs text-kindia-blue bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {r.reference}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.official_document_id 
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        : (r.status === 'EN_ATTENTE_SC' || r.status === 'DEMANDE ENREGISTRÉE' || r.status === 'EN ATTENTE' || r.status === 'DEMANDE REÇUE'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200 animate-pulse'
                          : (r.status === 'DEMANDE ACCEPTÉE'
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : 'bg-slate-100 text-slate-700'))
                    }`}>
                      {r.official_document_id ? 'OM ÉTABLI' : (r.status === 'EN_ATTENTE_SC' ? 'EN ATTENTE SC' : r.status)}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-slate-800">
                      {r.applicant_last_name} {r.applicant_first_names}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">{r.applicant_function} • {r.applicant_service_name || 'Enseignant-chercheur'}</p>
                  </div>

                  <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-0.5">
                    <div><strong>Destination :</strong> {r.destination}</div>
                    <div><strong>Objet :</strong> {r.object_of_mission}</div>
                    <div className="text-[11px] text-slate-500"><strong>Période :</strong> Du {r.start_date ? r.start_date.substring(0, 10) : ''} au {r.end_date ? r.end_date.substring(0, 10) : ''}</div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {(!r.official_document_id && (r.status === 'EN_ATTENTE_SC' || r.status === 'DEMANDE ENREGISTRÉE' || r.status === 'EN ATTENTE' || r.status === 'DEMANDE REÇUE')) ? (
                      <button
                        onClick={() => handleConvertRequestToOM(r)}
                        className="w-full py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-extrabold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow"
                      >
                        <Plus className="w-3.5 h-3.5 text-kindia-gold" />
                        <span>🧾 CRÉER L'ORDRE DE MISSION</span>
                      </button>
                    ) : (
                      <div className="w-full py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center space-x-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{r.official_doc_reference ? `OM: ${r.official_doc_reference}` : 'Demande traitée'}</span>
                      </div>
                    )}
                    <button
                      onClick={() => handleOpenRequestDetail(r)}
                      className="flex-1 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs"
                    >
                      👁 Détails
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Réf. Demande</th>
                  <th className="p-3.5">Demandeur</th>
                  <th className="p-3.5">Structure / Service</th>
                  <th className="p-3.5">Destination</th>
                  <th className="p-3.5">Dates Prévues</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 text-right">Action (Secrétariat Central)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">Chargement des demandes...</td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {requestFilter === 'ACTIVE' 
                        ? 'Aucune demande d\'ordre de mission en attente de traitement.' 
                        : 'Aucune demande d\'ordre de mission trouvée.'}
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-mono font-bold text-kindia-blue">{r.reference}</td>
                      <td className="p-3.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-slate-800">{r.applicant_last_name} {r.applicant_first_names}</span>
                          {(r.mission_type === 'COLLECTIF' || (r.participants_count && r.participants_count > 1)) && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-black whitespace-nowrap">
                              👥 {r.participants_count || '2+'}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">{r.applicant_function}</span>
                      </td>
                      <td className="p-3.5 text-slate-600">{r.applicant_service_name || 'Enseignant non rattaché'}</td>
                      <td className="p-3.5 font-semibold text-slate-700">{r.destination}</td>
                      <td className="p-3.5 text-slate-600">
                        {r.start_date ? r.start_date.substring(0, 10) : ''} au {r.end_date ? r.end_date.substring(0, 10) : ''}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.official_document_id 
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            : (r.status === 'EN_ATTENTE_SC' || r.status === 'DEMANDE ENREGISTRÉE' || r.status === 'EN ATTENTE' || r.status === 'DEMANDE REÇUE'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : (r.status === 'DEMANDE ACCEPTÉE'
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : 'bg-slate-100 text-slate-700'))
                        }`}>
                          {r.official_document_id ? 'OM ÉTABLI' : (r.status === 'EN_ATTENTE_SC' ? 'EN ATTENTE SC' : r.status)}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenRequestDetail(r)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px]"
                          title="Voir les pièces et détails"
                        >
                          👁 Détails
                        </button>

                        {(!r.official_document_id && (r.status === 'EN_ATTENTE_SC' || r.status === 'DEMANDE ENREGISTRÉE' || r.status === 'EN ATTENTE' || r.status === 'DEMANDE REÇUE')) ? (
                          <button
                            onClick={() => handleConvertRequestToOM(r)}
                            className="px-2.5 py-1 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-extrabold rounded-lg text-[11px] shadow-sm inline-flex items-center space-x-1"
                            title="Créer l'ordre de mission officiel avec les informations de la demande"
                          >
                            <Plus className="w-3 h-3 text-kindia-gold" />
                            <span>🧾 Créer l'ordre de mission</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[11px] font-bold">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>{r.official_doc_reference ? `OM: ${r.official_doc_reference}` : 'Demande traitée'}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Official Mission Orders Table / Feed (For SC, SG, and Archive Views) */}
      {(activeTab !== 'REQUESTS' && activeTab !== 'MY_REQUESTS') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-heading font-extrabold text-sm text-slate-800">
                {activeTab === 'PENDING_SIGN' ? 'Ordres de Mission Transmis au Secrétaire Général' :
                 activeTab === 'RETURNED' ? 'Ordres Signés Retournés au Secrétariat Central' :
                 activeTab === 'DELIVERED' ? 'Ordres Remis aux Missionnaires' :
                 activeTab === 'ARCHIVED' ? 'Archives Électroniques des Ordres de Mission' :
                 'Registre Général des Ordres de Mission'} ({filteredMissions.length})
              </h3>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filtrer réf, missionnaire, ville..."
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          {/* Mobile Feed */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Chargement...</div>
            ) : filteredMissions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Aucun ordre de mission dans cette section.</div>
            ) : (
              filteredMissions.map(m => (
                <div key={m.document_id} className="p-4 space-y-3 hover:bg-slate-50 transition">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs font-black text-kindia-blue bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {m.reference}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.status === 'ARCHIVÉ' || m.status === 'ARCHIVED'
                          ? 'bg-slate-200 text-slate-800'
                          : m.status === 'REMIS AU DEMANDEUR'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : m.is_signed
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {m.status}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        m.signature_mode === 'MANUSCRIPT'
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                      }`}>
                        {m.signature_mode === 'MANUSCRIPT' ? '✍️ Mode Manuscrit' : '⚡ Mode Électronique'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-heading font-extrabold text-xs text-slate-800">{m.missionary_name}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">{m.function_title}</p>
                  </div>

                  <div className="text-xs text-slate-700 space-y-0.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div><strong>Destination :</strong> {m.destination}</div>
                    <div><strong>Objet :</strong> {m.object_of_mission || 'Mission officielle'}</div>
                    <div className="text-[11px] text-slate-500"><strong>Dates :</strong> {m.departure_date} au {m.return_date}</div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
                    <button
                      onClick={() => onSelectDocument(m.document_id)}
                      className="flex-1 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-center"
                    >
                      👁 Voir
                    </button>

                    <button
                      onClick={() => setShowTimelineModal(m)}
                      className="flex-1 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-center"
                    >
                      🔎 Cheminement
                    </button>

                    {/* Mode Switcher if unsigned */}
                    {!m.is_signed && isSC && (
                      <button
                        onClick={() => handleModeSwitch(m, m.signature_mode === 'MANUSCRIPT' ? 'ELECTRONIC' : 'MANUSCRIPT')}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px]"
                        title="Changer le mode de signature"
                      >
                        🔄 {m.signature_mode === 'MANUSCRIPT' ? 'Passer en Électronique' : 'Passer en Manuscrit'}
                      </button>
                    )}

                    {/* Mode Manuscrit Actions for SC */}
                    {m.signature_mode === 'MANUSCRIPT' && !m.is_signed && isSC && (
                      <>
                        <button
                          onClick={() => handlePrint(m)}
                          className="px-2.5 py-1.5 bg-slate-800 text-white font-bold rounded-lg text-center flex items-center space-x-1"
                          title="Imprimer le document pour signature physique par le SG"
                        >
                          <Printer className="w-3 h-3 text-kindia-gold" />
                          <span>Imprimer pour SG</span>
                        </button>

                        {m.status === 'EN ATTENTE DE SIGNATURE MANUSCRITE' && (
                          <button
                            onClick={() => handleMarkManuscriptSigned(m)}
                            className="px-2.5 py-1.5 bg-amber-600 text-white font-bold rounded-lg text-center"
                            title="Confirmer que le SG a signé manuellement"
                          >
                            ✍️ Signé par SG
                          </button>
                        )}

                        <button
                          onClick={() => setShowUploadScanModal(m)}
                          className="px-2.5 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-center flex items-center space-x-1"
                          title="Importer le scan signé et cacheté"
                        >
                          <UploadCloud className="w-3 h-3 text-white" />
                          <span>Importer scan</span>
                        </button>
                      </>
                    )}

                    {/* Mode Electronique Actions for SG */}
                    {m.signature_mode !== 'MANUSCRIPT' && !m.is_signed && isSG && (
                      <button
                        onClick={() => handleSign(m)}
                        className="px-3 py-1.5 bg-kindia-blue text-white font-bold rounded-lg text-center"
                      >
                        ✍️ Signer
                      </button>
                    )}

                    {m.signed_pdf_path && (
                      <button
                        onClick={() => handlePrint(m)}
                        className="px-3 py-1.5 bg-kindia-blue text-white font-bold rounded-lg text-center"
                      >
                        🖨️ Imprimer
                      </button>
                    )}

                    {isSC && m.is_signed && m.status !== 'REMIS AU DEMANDEUR' && m.status !== 'ARCHIVÉ' && m.status !== 'ARCHIVED' && (
                      <button
                        onClick={() => { setRecipientName(m.missionary_name); setShowDeliverModal(m); }}
                        className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg text-center"
                      >
                        🤝 Remettre
                      </button>
                    )}

                    {isSC && m.status === 'REMIS AU DEMANDEUR' && (
                      <button
                        onClick={() => handleArchive(m)}
                        className="px-3 py-1.5 bg-slate-700 text-white font-bold rounded-lg text-center"
                      >
                        📁 Archiver
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Référence OM</th>
                  <th className="p-3.5">Missionnaire(s)</th>
                  <th className="p-3.5">Fonction</th>
                  <th className="p-3.5">Destination</th>
                  <th className="p-3.5">Dates</th>
                  <th className="p-3.5">Mode Signature</th>
                  <th className="p-3.5">Statut / Workflow</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">Chargement...</td>
                  </tr>
                ) : filteredMissions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">Aucun ordre de mission dans cette section.</td>
                  </tr>
                ) : (
                  filteredMissions.map(m => (
                    <tr key={m.document_id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-bold font-mono text-kindia-blue">{m.reference}</td>
                      <td className="p-3.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-800 font-bold">{m.missionary_name}</span>
                          {(m.mission_type === 'COLLECTIF' || (m.participants_count && m.participants_count > 1)) && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-black whitespace-nowrap">
                              👥 {m.participants_count} pers.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-600">{m.function_title}</td>
                      <td className="p-3.5 text-slate-700 font-semibold">{m.destination}</td>
                      <td className="p-3.5 text-slate-600">{m.departure_date} au {m.return_date}</td>
                      <td className="p-3.5">
                        <div className="flex items-center space-x-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.signature_mode === 'MANUSCRIPT'
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                          }`}>
                            {m.signature_mode === 'MANUSCRIPT' ? '✍️ Manuscrite' : '⚡ Électronique'}
                          </span>
                          {!m.is_signed && isSC && (
                            <button
                              onClick={() => handleModeSwitch(m, m.signature_mode === 'MANUSCRIPT' ? 'ELECTRONIC' : 'MANUSCRIPT')}
                              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 text-[10px]"
                              title="Basculer le mode de signature"
                            >
                              🔄
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.status === 'ARCHIVÉ' || m.status === 'ARCHIVED'
                            ? 'bg-slate-200 text-slate-800'
                            : m.status === 'REMIS AU DEMANDEUR'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : m.is_signed
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => onSelectDocument(m.document_id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px]"
                          title="Consulter les détails"
                        >
                          👁 Voir
                        </button>

                        <button
                          onClick={() => setShowTimelineModal(m)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px]"
                          title="Cheminement"
                        >
                          🔎 Cheminement
                        </button>

                        {/* MODE MANUSCRIT SPECIFIC BUTTONS */}
                        {m.signature_mode === 'MANUSCRIPT' && !m.is_signed && isSC && (
                          <>
                            <button
                              onClick={() => handlePrint(m)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition text-[11px] inline-flex items-center space-x-1"
                              title="Imprimer pour signature physique du SG"
                            >
                              <Printer className="w-3 h-3 text-kindia-gold" />
                              <span>Imprimer SG</span>
                            </button>

                            {m.status === 'EN ATTENTE DE SIGNATURE MANUSCRITE' && (
                              <button
                                onClick={() => handleMarkManuscriptSigned(m)}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition text-[11px]"
                                title="Déclarer que le SG a signé physiquement sur papier"
                              >
                                ✍️ Signé SG
                              </button>
                            )}

                            <button
                              onClick={() => setShowUploadScanModal(m)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-[11px] shadow-sm inline-flex items-center space-x-1"
                              title="Importer le document signé et cacheté scanné"
                            >
                              <UploadCloud className="w-3 h-3 text-white" />
                              <span>📥 Importer Scan</span>
                            </button>
                          </>
                        )}

                        {/* MODE ÉLECTRONIQUE SPECIFIC BUTTON */}
                        {m.signature_mode !== 'MANUSCRIPT' && !m.is_signed && isSG && (
                          <button
                            onClick={() => handleSign(m)}
                            className="px-2.5 py-1 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-lg transition text-[11px]"
                            title="Signer électroniquement dans UK-GED"
                          >
                            ✍️ Signer
                          </button>
                        )}

                        {m.signed_pdf_path && (
                          <button
                            onClick={() => handlePrint(m)}
                            className="px-2.5 py-1 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-lg transition inline-flex items-center space-x-1 text-[11px]"
                            title="Imprimer le PDF officiel scellé"
                          >
                            <Printer className="w-3 h-3 text-kindia-gold" />
                            <span>🖨️ Imprimer</span>
                          </button>
                        )}

                        {isSC && m.is_signed && m.status !== 'REMIS AU DEMANDEUR' && m.status !== 'ARCHIVÉ' && m.status !== 'ARCHIVED' && (
                          <button
                            onClick={() => { setRecipientName(m.missionary_name); setShowDeliverModal(m); }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition text-[11px]"
                            title="Remettre au demandeur"
                          >
                            🤝 Remettre
                          </button>
                        )}

                        {isSC && (
                          <button
                            onClick={() => handleArchive(m)}
                            className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
                              m.status === 'REMIS AU DEMANDEUR'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                            title={m.status === 'REMIS AU DEMANDEUR' ? 'Archiver' : 'Archive bloquée (Remise au demandeur requise - Rule 26)'}
                          >
                            📁 Archiver
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teachers / Standard Users: My Requests View */}
      {activeTab === 'MY_REQUESTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-heading font-extrabold text-sm text-slate-800">
                Suivi de mes Demandes d'Ordres de Mission ({myRequests.length})
              </h3>
              <p className="text-xs text-slate-500">
                Consultez en temps réel l'avancement de vos demandes soumises au Secrétariat Central
              </p>
            </div>
            <button
              onClick={() => { resetForm(); setShowRequestModal(true); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition flex items-center space-x-2"
            >
              <Send className="w-4 h-4 text-white" />
              <span>📝 Nouvelle demande</span>
            </button>
          </div>

          {myRequests.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-600">Vous n'avez soumis aucune demande pour le moment.</p>
              <p className="text-[11px] text-slate-400">Cliquez sur « Demander un ordre de mission » pour transmettre votre demande au Secrétariat Central.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {myRequests.map(r => (
                <div key={r.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-xs text-kindia-blue bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {r.reference}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      {r.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Mission vers : {r.destination}</h4>
                    <p className="text-xs text-slate-600 mt-0.5"><strong>Objet :</strong> {r.object_of_mission}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5"><strong>Dates :</strong> Du {r.departure_date || (r.start_date ? r.start_date.substring(0, 10) : '')} au {r.return_date || (r.end_date ? r.end_date.substring(0, 10) : '')}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                    <span>Transmis au Secrétariat Central</span>
                    <button
                      onClick={() => onSelectDocument(r.document_id || r.id)}
                      className="text-kindia-blue font-bold hover:underline"
                    >
                      Détails →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Creation Modal for Secrétariat Central */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar border border-slate-200 space-y-4 p-6 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue">
                🧾 ÉTABLIR UN ORDRE DE MISSION OFFICIEL (Secrétariat Central)
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-6 text-xs">
              {createModalError && <div className="p-3 bg-red-50 text-red-700 font-bold rounded-xl border border-red-200">{createModalError}</div>}

              {/* 0. MODÈLE DE DOCUMENT OFFICIEL */}
              {availableTemplates.length > 0 ? (
                <div className={`p-4 rounded-xl border space-y-3 transition-colors ${
                  documentFormatInForm === 'DIRECT_PDF'
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-blue-50/80 border-blue-200 text-slate-900'
                }`}>
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs flex items-center gap-1.5">
                      <FileCheck className={`w-4 h-4 ${documentFormatInForm === 'DIRECT_PDF' ? 'text-emerald-700' : 'text-kindia-blue'}`} />
                      <span className={documentFormatInForm === 'DIRECT_PDF' ? 'text-emerald-950' : 'text-kindia-blue'}>
                        MODÈLE DE DOCUMENT OFFICIEL PAR DÉFAUT
                      </span>
                    </h4>
                    {availableTemplates.find(t => t.id === parseInt(selectedTemplateId)) && (
                      <button
                        type="button"
                        onClick={() => {
                          const activeTpl = availableTemplates.find(t => t.id === parseInt(selectedTemplateId));
                          if (activeTpl?.id) {
                            const dlName = documentFormatInForm === 'DIRECT_PDF'
                              ? (activeTpl.file_name || activeTpl.name).replace(/\.docx$/i, '.pdf')
                              : (activeTpl.file_name || activeTpl.name);
                            api.downloadOfficialMissionTemplate(activeTpl.id, dlName);
                          }
                        }}
                        className={`px-2.5 py-1 bg-white font-bold rounded-lg border shadow-sm flex items-center space-x-1 text-[11px] ${
                          documentFormatInForm === 'DIRECT_PDF'
                            ? 'hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'hover:bg-slate-100 text-kindia-blue border-blue-200'
                        }`}
                      >
                        <Eye className={`w-3.5 h-3.5 ${documentFormatInForm === 'DIRECT_PDF' ? 'text-emerald-700' : 'text-kindia-blue'}`} />
                        <span>Consulter le fichier officiel</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Modèle sélectionné</label>
                      <select
                        value={selectedTemplateId}
                        onChange={e => setSelectedTemplateId(e.target.value)}
                        className={`w-full p-2.5 rounded-xl border font-bold bg-white ${
                          documentFormatInForm === 'DIRECT_PDF'
                            ? 'border-emerald-300 text-emerald-900'
                            : 'border-slate-300 text-kindia-blue'
                        }`}
                      >
                        {availableTemplates.map(t => (
                          <option key={t.id} value={t.id}>
                            {documentFormatInForm === 'DIRECT_PDF'
                              ? `${(t.file_name || t.name).replace(/\.docx$/i, '.pdf')} ★ Modèle PDF Direct actif`
                              : `${t.name} (v${t.version || 1}) ★ Modèle Word DOCX actif`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {availableTemplates.find(t => t.id === parseInt(selectedTemplateId)) && (
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Document :</span>
                          <span className="font-bold text-slate-800 truncate max-w-[170px]" title={availableTemplates.find(t => t.id === parseInt(selectedTemplateId)).file_name}>
                            {documentFormatInForm === 'DIRECT_PDF'
                              ? (availableTemplates.find(t => t.id === parseInt(selectedTemplateId)).file_name || 'Modèle_Officiel.pdf').replace(/\.docx$/i, '.pdf')
                              : (availableTemplates.find(t => t.id === parseInt(selectedTemplateId)).file_name || availableTemplates.find(t => t.id === parseInt(selectedTemplateId)).name)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Format actif :</span>
                          {documentFormatInForm === 'DIRECT_PDF' ? (
                            <span className="font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded text-[10px]">
                              ⚡ Format PDF Direct (Rapide)
                            </span>
                          ) : (
                            <span className="font-bold text-blue-800 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded text-[10px]">
                              📝 Modèle Word DOCX
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Statut :</span>
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">Configuré par l'Admin</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center space-y-1">
                  <span className="font-bold text-xs text-amber-800 block">
                    « Aucun modèle par défaut n'est configuré pour ce type de document. »
                  </span>
                  <span className="text-[11px] text-amber-700/80 block">
                    Veuillez définir un modèle officiel par défaut dans l'espace Administration des Modèles.
                  </span>
                </div>
              )}

              {/* 1. MISSIONNAIRE */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-kindia-blue flex items-center">
                    <User className="w-4 h-4 mr-1.5" />
                    1. MISSIONNAIRE (Personnel ou Enseignant-Chercheur)
                  </h4>
                  {selectedStaffId && (
                    <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Personnel identifié
                    </span>
                  )}
                </div>

                {/* Information banner if collective mission order */}
                {formParticipants && formParticipants.length > 1 && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-amber-700" />
                        <span>ORDRE DE MISSION COLLECTIF ({formParticipants.length} participants)</span>
                      </span>
                      <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-2 py-0.5 rounded-full">
                        Demande en ligne
                      </span>
                    </div>
                    <div className="space-y-1">
                      {formParticipants.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] bg-white p-2 rounded-lg border border-amber-200">
                          <div>
                            <span className="font-bold text-slate-800">{p.nom} {p.prenoms}</span>
                            {p.is_requester ? <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">Demandeur</span> : null}
                            <span className="text-slate-500 ml-2">({p.matricule || 'Sans matricule'} • {p.service_name || 'UK'})</span>
                          </div>
                          <span className="font-bold text-kindia-blue">{p.fonction}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CHAMP DE RECHERCHE RAPIDE PAR MATRICULE OU NOM */}
                <div className="bg-white p-3 rounded-xl border-2 border-indigo-200 shadow-sm space-y-2 relative">
                  <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-indigo-950 font-bold">
                      <Search className="w-4 h-4 text-indigo-600" />
                      Rechercher par Matricule ou Nom / Prénoms :
                    </span>
                    <span className="text-[10px] font-normal text-slate-500">
                      Tapez un matricule (ex: UK-EC-001) pour auto-remplir
                    </span>
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      value={staffMatriculeSearch}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStaffMatriculeSearch(val);
                        setShowStaffSearchResults(true);
                        // Auto-lookup exact matricule if typed
                        const exact = staffDirectory.find(s => s.matricule && s.matricule.trim().toLowerCase() === val.trim().toLowerCase());
                        if (exact) {
                          handleStaffSelect(exact.id);
                        }
                      }}
                      onFocus={() => setShowStaffSearchResults(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const matches = staffDirectory.filter(s => {
                            const q = staffMatriculeSearch.toLowerCase().trim();
                            const mat = (s.matricule || '').toLowerCase();
                            const nom = (s.nom || '').toLowerCase();
                            const prenoms = (s.prenoms || '').toLowerCase();
                            return mat.includes(q) || nom.includes(q) || prenoms.includes(q);
                          });
                          if (matches.length > 0) {
                            handleStaffSelect(matches[0].id);
                            setShowStaffSearchResults(false);
                          }
                        }
                      }}
                      placeholder="Saisissez le matricule (ex: UK-EC-001) ou le nom pour rechercher..."
                      className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 font-medium text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                    <Search className="w-4 h-4 text-indigo-400 absolute left-2.5 top-2.5 pointer-events-none" />

                    {staffMatriculeSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setStaffMatriculeSearch('');
                          setShowStaffSearchResults(false);
                        }}
                        className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
                        title="Effacer la recherche"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Menu flottant des résultats de recherche instantanée */}
                    {showStaffSearchResults && staffMatriculeSearch.trim().length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-56 overflow-y-auto">
                        {(() => {
                          const q = staffMatriculeSearch.toLowerCase().trim();
                          const results = staffDirectory.filter(s => {
                            const mat = (s.matricule || '').toLowerCase();
                            const nom = (s.nom || '').toLowerCase();
                            const prenoms = (s.prenoms || '').toLowerCase();
                            const fullName = `${nom} ${prenoms}`.toLowerCase();
                            const func = (s.fonction || '').toLowerCase();
                            const srv = (s.service_name || '').toLowerCase();
                            return mat.includes(q) || nom.includes(q) || prenoms.includes(q) || fullName.includes(q) || func.includes(q) || srv.includes(q);
                          });

                          if (results.length === 0) {
                            return (
                              <div className="p-3 text-center text-xs text-slate-500">
                                Aucun personnel trouvé avec le matricule ou nom <strong className="text-slate-700">"{staffMatriculeSearch}"</strong>. Vous pouvez saisir manuellement les informations ci-dessous.
                              </div>
                            );
                          }

                          return (
                            <div className="py-1 divide-y divide-slate-100">
                              <div className="px-3 py-1 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                {results.length} résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''} (Cliquez pour sélectionner) :
                              </div>
                              {results.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    handleStaffSelect(s.id);
                                    setShowStaffSearchResults(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors flex items-center justify-between gap-2 ${
                                    selectedStaffId === s.id ? 'bg-indigo-50/80 font-bold' : ''
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">
                                      {s.nom} {s.prenoms}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      {s.fonction} {s.service_name ? `• ${s.service_name}` : ''}
                                    </span>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    {s.matricule ? (
                                      <span className="font-mono text-[11px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold border border-indigo-200">
                                        {s.matricule}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">Sans matricule</span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Confirmation / Badge du personnel sélectionné */}
                  {selectedStaffId && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div className="text-emerald-900 truncate">
                          <span className="font-bold">{missionaryName} {missionaryFirstnames}</span>
                          {matricule && <span className="font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded ml-1.5">Matricule : {matricule}</span>}
                          {functionTitle && <span className="text-emerald-700 ml-1 text-[11px]">({functionTitle})</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStaffId('');
                          setStaffMatriculeSearch('');
                          setMissionaryName('');
                          setMissionaryFirstnames('');
                          setFunctionTitle('');
                          setMatricule('');
                          setServiceName('');
                        }}
                        className="text-emerald-700 hover:text-red-600 font-bold text-[11px] underline ml-2 flex-shrink-0"
                      >
                        Dissocier
                      </button>
                    </div>
                  )}
                </div>

                {/* SÉLECTION CLASSIQUE DANS LE RÉPERTOIRE */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Ou sélectionner directement dans la liste déroulante :
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => handleStaffSelect(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-kindia-blue bg-white text-xs"
                  >
                    <option value="">-- Choisir dans le répertoire ou saisir manuellement ci-dessous --</option>
                    {staffDirectory.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nom} {s.prenoms} — {s.fonction} ({s.service_name || 'N/A'}) [Matricule: {s.matricule || 'N/A'}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* CHAMPS DÉTAILLÉS ÉDITABLES */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Titre / Grade *</label>
                    <select
                      value={missionaryTitre}
                      onChange={e => setMissionaryTitre(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-300 font-bold text-xs bg-white text-kindia-blue"
                    >
                      <option value="Pr">Pr (Professeur)</option>
                      <option value="Pr Titulaire">Pr Titulaire (Professeur Titulaire)</option>
                      <option value="Dre">Dre (Docteure)</option>
                      <option value="Dr">Dr (Docteur)</option>
                      <option value="MCF">MCF (Maître de Conférences)</option>
                      <option value="MA">MA (Maître-Assistant)</option>
                      <option value="Ing.">Ing. (Ingénieur)</option>
                      <option value="M.">M. (Monsieur)</option>
                      <option value="Mme">Mme (Madame)</option>
                      <option value="Mlle">Mlle (Mademoiselle)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Nom de famille *</label>
                    <input
                      type="text"
                      value={missionaryName}
                      onChange={e => setMissionaryName(e.target.value)}
                      placeholder="Ex: DIALLO"
                      className="w-full p-2 rounded-xl border border-slate-300 font-bold text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Prénoms</label>
                    <input
                      type="text"
                      value={missionaryFirstnames}
                      onChange={e => setMissionaryFirstnames(e.target.value)}
                      placeholder="Ex: Mamadou Oury"
                      className="w-full p-2 rounded-xl border border-slate-300 font-bold text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Qualité / Fonction *</label>
                    <input
                      type="text"
                      value={functionTitle}
                      onChange={e => setFunctionTitle(e.target.value)}
                      placeholder="Ex: Enseignant-Chercheur / Maître de Conférences"
                      className="w-full p-2 rounded-xl border border-slate-300 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs flex items-center justify-between">
                      <span>Matricule</span>
                      {matricule && <span className="text-[10px] font-normal text-slate-400">Identifiant</span>}
                    </label>
                    <input
                      type="text"
                      value={matricule}
                      onChange={e => {
                        const val = e.target.value;
                        setMatricule(val);
                        // Auto-link if exact match typed in matricule input
                        const exact = staffDirectory.find(s => s.matricule && s.matricule.trim().toLowerCase() === val.trim().toLowerCase());
                        if (exact) {
                          handleStaffSelect(exact.id);
                        }
                      }}
                      placeholder="Ex: UK-EC-001"
                      className="w-full p-2 rounded-xl border border-slate-300 font-mono text-xs font-bold text-indigo-900 bg-indigo-50/30"
                    />
                  </div>
                </div>
              </div>

              {/* 2. MISSION */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs text-kindia-blue flex items-center">
                  <FileText className="w-4 h-4 mr-1.5" />
                  2. INFORMATIONS DE LA MISSION
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Destination / Lieu de Mission *</label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Ex: Conakry, Guinée"
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Moyen de Transport *</label>
                    <select
                      value={transportMode}
                      onChange={(e) => handleTransportModeChange(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-bold bg-white text-slate-800 focus:ring-2 focus:ring-kindia-blue"
                    >
                      <option value="Véhicule service/Personnel">Véhicule service/Personnel</option>
                      <option value="Transports en commun / Car">Transports en commun / Car</option>
                      <option value="Avion (Vol national / international)">Avion (Vol national / international)</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Objet de la Mission *</label>
                    <textarea
                      rows={2}
                      value={objectOfMission}
                      onChange={(e) => setObjectOfMission(e.target.value)}
                      placeholder="Ex: Mission officielle de supervision des examens"
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date de Départ *</label>
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date de Retour Prévue *</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 3. TRANSPORT & CONDUCTEUR DÉTAILLÉS */}
              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-amber-900 flex items-center">
                    <Car className="w-4 h-4 mr-1.5 text-amber-700" />
                    3. VÉHICULE & CONDUCTEUR ({transportMode})
                  </h4>
                  <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-200">
                    {vehicleRegistration ? `Immatriculation : ${vehicleRegistration}` : transportMode}
                  </span>
                </div>

                {/* VÉHICULE SERVICE / PERSONNEL */}
                {(transportMode === 'Véhicule service/Personnel' || transportMode === 'Véhicule de service' || transportMode === 'Véhicule personnel' || transportMode === 'Véhicule Personnel' || transportMode === 'Véhicule Officiel de l’Université') && (
                  <div className="space-y-3.5 bg-white p-3.5 rounded-xl border border-amber-200">
                    <div>
                      <label className="block font-bold text-slate-800 text-xs mb-1">
                        Sélectionner le Véhicule (Attribué, Parc UK ou Personnel) :
                      </label>
                      <select
                        value={vehicleId ? `FLEET_${vehicleId}` : (selectedPersonalVehicleId ? `PV_${selectedPersonalVehicleId}` : '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith('FLEET_')) {
                            const vId = val.replace('FLEET_', '');
                            setVehicleId(vId);
                            setSelectedPersonalVehicleId('');
                            const veh = missionaryAssignedVehicles.find(v => String(v.id) === String(vId)) || fleetVehicles.find(v => String(v.id) === String(vId));
                            if (veh) {
                              setVehicleRegistration(veh.registration_number);
                              if (veh.default_driver_id) {
                                setSelectedDriverId(String(veh.default_driver_id));
                                setDriverOption('DRIVER');
                                setDriverName(veh.default_driver_full_name || 'Chauffeur habituel');
                              } else if (missionaryAttachedDrivers.length > 0) {
                                const defDrv = missionaryAttachedDrivers.find(d => d.is_default) || missionaryAttachedDrivers[0];
                                setSelectedDriverId(String(defDrv.id));
                                setDriverOption('DRIVER');
                                setDriverName(formatFullName(defDrv));
                              }
                            }
                          } else if (val.startsWith('PV_')) {
                            const pvId = val.replace('PV_', '');
                            setSelectedPersonalVehicleId(pvId);
                            setVehicleId('');
                            const pv = missionaryPersonalVehicles.find(v => String(v.id) === String(pvId));
                            if (pv) {
                              setVehicleRegistration(pv.registration_number);
                            }
                            setDriverOption('SELF');
                            setDriverName('Lui-même');
                          } else {
                            setVehicleId('');
                            setSelectedPersonalVehicleId('');
                          }
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-kindia-blue bg-slate-50"
                      >
                        <option value="">-- Sélectionner un véhicule ou saisir l'immatriculation ci-dessous --</option>
                        {missionaryAssignedVehicles.length > 0 && (
                          <optgroup label="⭐ Véhicules de service attribués au missionnaire">
                            {missionaryAssignedVehicles.map(v => (
                              <option key={`FLEET_${v.id}`} value={`FLEET_${v.id}`}>
                                🚙 {v.registration_number} — {v.brand} {v.model || ''} {v.default_driver_full_name ? `(Chauffeur: ${v.default_driver_full_name})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {missionaryPersonalVehicles.length > 0 && (
                          <optgroup label="🚗 Véhicules personnels du missionnaire">
                            {missionaryPersonalVehicles.map(pv => (
                              <option key={`PV_${pv.id}`} value={`PV_${pv.id}`}>
                                🚗 {pv.registration_number} — {pv.brand} {pv.model || ''} ({pv.vehicle_type || 'Voiture'}{pv.color ? `, ${pv.color}` : ''})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {fleetVehicles.filter(v => !missionaryAssignedVehicles.some(av => av.id === v.id)).length > 0 && (
                          <optgroup label="🏢 Autres véhicules de service du parc de l'Université">
                            {fleetVehicles.filter(v => !missionaryAssignedVehicles.some(av => av.id === v.id)).map(v => (
                              <option key={`FLEET_${v.id}`} value={`FLEET_${v.id}`}>
                                🚙 {v.registration_number} — {v.brand} {v.model || ''} [{v.status}] {v.assigned_staff_name ? `(Affecté à: ${v.assigned_staff_name})` : ''} {v.default_driver_full_name ? `• Chauffeur: ${v.default_driver_full_name}` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Numéro d'immatriculation dynamique */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Numéro d'Immatriculation du Véhicule *
                        </label>
                        <input
                          type="text"
                          value={vehicleRegistration}
                          onChange={(e) => setVehicleRegistration(e.target.value)}
                          placeholder="Ex : RC-1234-A ou VA-4421-GN"
                          className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold uppercase bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Aperçu Dynamique du Moyen de Transport
                        </label>
                        <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 truncate">
                          {formatTransportDisplay(transportMode, vehicleRegistration)}
                        </div>
                      </div>
                    </div>

                    {/* Choix du Conducteur : Lui-même vs Chauffeur */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="block text-xs font-bold text-slate-700">Option de Conduite :</label>
                      <div className="flex flex-wrap gap-6 font-bold text-slate-700">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="driverOption"
                            value="SELF"
                            checked={driverOption === 'SELF'}
                            onChange={() => {
                              setDriverOption('SELF');
                              setDriverName('Lui-même');
                            }}
                            className="text-kindia-blue"
                          />
                          <span>○ Lui-même (Le missionnaire conduit)</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="driverOption"
                            value="DRIVER"
                            checked={driverOption === 'DRIVER'}
                            onChange={() => {
                              setDriverOption('DRIVER');
                              if (selectedDriverId) {
                                const d = driversRegistry.find(item => String(item.id) === String(selectedDriverId)) || driversList.find(item => String(item.id) === String(selectedDriverId)) || missionaryAttachedDrivers.find(item => String(item.id) === String(selectedDriverId));
                                setDriverName(d ? formatFullName(d) : '');
                              } else if (missionaryAttachedDrivers.length > 0) {
                                const defDrv = missionaryAttachedDrivers.find(d => d.is_default) || missionaryAttachedDrivers[0];
                                setSelectedDriverId(String(defDrv.id));
                                setDriverName(formatFullName(defDrv));
                              } else {
                                setDriverName('');
                              }
                            }}
                            className="text-kindia-blue"
                          />
                          <span>○ Chauffeur désigné</span>
                        </label>
                      </div>

                      {driverOption === 'DRIVER' && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <label className="block text-xs font-bold text-slate-700">
                            Sélectionner le Chauffeur Professionnel :
                          </label>
                          <select
                            value={selectedDriverId}
                            onChange={(e) => handleDriverSelect(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white"
                          >
                            <option value="">-- Choisir un chauffeur dans le registre --</option>
                            {missionaryAttachedDrivers.length > 0 && (
                              <optgroup label="⭐ Chauffeurs habituels rattachés au missionnaire">
                                {missionaryAttachedDrivers.map(d => (
                                  <option key={`att-${d.id}`} value={d.id}>
                                    ⭐ {formatFullName(d)} {d.is_default ? '(Habituel)' : ''} {d.telephone ? `(Tél: ${d.telephone})` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Tous les chauffeurs de l'Université">
                              {driversRegistry.map(d => (
                                <option key={d.id} value={d.id}>
                                  👨‍✈️ {d.matricule ? `[${d.matricule}] ` : ''}{formatFullName(d)} {d.telephone ? `(Tél: ${d.telephone})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CAS C: TRANSPORTS EN COMMUN / AVION / AUTRE */}
                {transportMode !== 'Véhicule service/Personnel' && transportMode !== 'Véhicule personnel' && transportMode !== 'Véhicule Personnel' && transportMode !== 'Véhicule de service' && transportMode !== 'Véhicule Officiel de l’Université' && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-kindia-blue shrink-0" />
                    <span>Déplacement via transport externe. Aucune immatriculation ni chauffeur officiel du parc n'est requis.</span>
                  </div>
                )}

                {/* RÉCAPITULATIF INJECTION DOCUMENT OFFICIEL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 bg-amber-100/70 p-3 rounded-xl border border-amber-300/80">
                  <div>
                    <span className="block text-[10px] font-bold text-amber-900 uppercase">Conducteur injecté :</span>
                    <span className="font-extrabold text-xs text-slate-900">
                      {formatDriverDisplay(transportMode, driverName, driverOption, missionaryName)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-amber-900 uppercase">Transport / Immatriculation :</span>
                    <span className="font-mono font-extrabold text-xs text-kindia-blue">
                      {formatTransportDisplay(transportMode, vehicleRegistration)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. MODE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL */}
              <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-200 space-y-3">
                <h4 className="font-bold text-xs text-kindia-blue flex items-center">
                  <Award className="w-4 h-4 mr-1.5 text-kindia-blue" />
                  4. MODE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start space-x-2.5 ${
                    signatureModeInForm === 'ELECTRONIC'
                      ? 'border-kindia-blue bg-white shadow-sm ring-1 ring-kindia-blue'
                      : 'border-slate-200 bg-white/60 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="formSignatureMode"
                      value="ELECTRONIC"
                      checked={signatureModeInForm === 'ELECTRONIC'}
                      onChange={() => setSignatureModeInForm('ELECTRONIC')}
                      className="mt-0.5 text-kindia-blue"
                    />
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 block">
                        ⚡ Signature Électronique
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        SG en déplacement • Signature numérique directement dans UK-GED
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start space-x-2.5 ${
                    signatureModeInForm === 'MANUSCRIPT'
                      ? 'border-amber-600 bg-white shadow-sm ring-1 ring-amber-600'
                      : 'border-slate-200 bg-white/60 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="formSignatureMode"
                      value="MANUSCRIPT"
                      checked={signatureModeInForm === 'MANUSCRIPT'}
                      onChange={() => setSignatureModeInForm('MANUSCRIPT')}
                      className="mt-0.5 text-amber-600"
                    />
                    <div>
                      <span className="font-extrabold text-xs text-amber-900 block">
                        ✍️ Signature Manuscrite & Scan
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        SG au bureau • Impression papier, signature & cachet manuels, puis réintégration du scan par le SC
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 6. OBSERVATIONS */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">6. Observations Particulières</label>
                <textarea
                  rows={2}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ex: Prise en charge carburant selon barème officiel"
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-kindia-blue text-white font-bold rounded-xl shadow hover:bg-kindia-lightBlue transition">
                  {submitting ? 'Enregistrement...' : 'ENREGISTRER & TRANSMETTRE AU SG (OM/UK/SG/...)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Universal Mission Request Modal */}
      <PublicMissionRequestModal
        isOpen={showRequestModal}
        onClose={() => {
          setShowRequestModal(false);
          loadData();
        }}
        defaultUserData={user}
      />

      {/* Handover Confirmation Modal */}
      {showDeliverModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="font-heading font-extrabold text-sm text-kindia-blue border-b border-slate-200 pb-2">
              🤝 REMISE DE L'ORDRE DE MISSION AU DEMANDEUR
            </h3>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><span className="font-bold text-slate-500">Référence :</span> <span className="font-mono font-bold text-kindia-blue">{showDeliverModal.reference}</span></p>
              <p><span className="font-bold text-slate-500">Demandeur :</span> <span className="font-bold text-slate-800">{showDeliverModal.missionary_name}</span></p>
              <p><span className="font-bold text-slate-500">Destination :</span> <span>{showDeliverModal.destination}</span></p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom du Réceptionnaire (Demandeur) *</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                required
              />
            </div>

            <p className="text-[11px] text-slate-600 italic">
              Confirmez-vous que l'ordre de mission officiel imprimé et signé a bien été remis en main propre au demandeur ?
            </p>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
              <button onClick={() => setShowDeliverModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">
                Annuler
              </button>

              <button onClick={handleDeliverSubmit} className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl shadow hover:bg-amber-700 transition">
                CONFIRMER LA REMISE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Timeline Modal */}
      {showTimelineModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue">
                🔎 CHEMINEMENT DE L'ORDRE DE MISSION ({showTimelineModal.reference})
              </h3>
              <button onClick={() => setShowTimelineModal(null)} className="text-slate-400 font-bold text-lg">×</button>
            </div>

            <div className="space-y-4 text-xs font-medium py-2">
              {[
                { title: 'Créé & Préparé', detail: 'Secrétariat Central', done: true },
                { title: 'Envoyé pour signature', detail: 'Secrétariat Général', done: true },
                { title: 'Signé numériquement', detail: 'Secrétaire Général', done: showTimelineModal.is_signed === 1 },
                { title: 'Retourné au Secrétariat Central', detail: 'Secrétariat Central', done: showTimelineModal.status === 'RETOURNÉ AU SECRÉTARIAT CENTRAL' || showTimelineModal.status === 'REMIS AU DEMANDEUR' || showTimelineModal.status === 'ARCHIVÉ' || showTimelineModal.status === 'ARCHIVED' },
                { title: 'Imprimé officiellement', detail: 'Secrétariat Central', done: showTimelineModal.printed_at || showTimelineModal.status === 'REMIS AU DEMANDEUR' || showTimelineModal.status === 'ARCHIVÉ' },
                { title: 'Remis au demandeur', detail: 'Secrétariat Central', done: showTimelineModal.status === 'REMIS AU DEMANDEUR' || showTimelineModal.status === 'ARCHIVÉ' },
                { title: 'Classé aux archives électroniques', detail: 'Secrétariat Central', done: showTimelineModal.status === 'ARCHIVÉ' || showTimelineModal.status === 'ARCHIVED' }
              ].map((step, idx) => (
                <div key={idx} className="flex items-start space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[10px] mt-0.5 ${
                    step.done ? 'bg-emerald-600 shadow' : 'bg-slate-300'
                  }`}>
                    {step.done ? '✓' : idx + 1}
                  </div>
                  <div>
                    <p className={`font-bold ${step.done ? 'text-slate-800' : 'text-slate-400'}`}>{step.title}</p>
                    <p className="text-[10px] text-slate-500">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button onClick={() => setShowTimelineModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal for SG */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-300">
            <h3 className="font-heading font-extrabold text-sm text-rose-800 border-b border-rose-200 pb-2">
              ❌ REJETER L'ORDRE DE MISSION ({showRejectModal.reference})
            </h3>

            <p className="text-xs text-slate-600">Veuillez indiquer le motif obligatoire du rejet :</p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Objet non conforme au calendrier des activités"
              className="w-full p-3 rounded-xl border border-slate-300 text-xs shadow-inner"
              required
            />

            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={() => setShowRejectModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">
                Annuler
              </button>

              <button onClick={handleRejectSubmit} className="px-4 py-2 bg-rose-700 text-white font-bold text-xs rounded-xl shadow">
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correction Modal for SG */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-amber-300">
            <h3 className="font-heading font-extrabold text-sm text-amber-800 border-b border-amber-200 pb-2">
              📝 DEMANDER UNE CORRECTION ({showCorrectionModal.reference})
            </h3>

            <p className="text-xs text-slate-600">Précisez les modifications demandées au Secrétariat Central :</p>
            <textarea
              rows={3}
              value={correctionNotes}
              onChange={(e) => setCorrectionNotes(e.target.value)}
              placeholder="Ex: Corriger la date de retour et préciser le moyen de transport"
              className="w-full p-3 rounded-xl border border-slate-300 text-xs shadow-inner"
              required
            />

            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={() => setShowCorrectionModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">
                Annuler
              </button>

              <button onClick={handleCorrectionSubmit} className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl shadow">
                Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Detail Modal (for SC viewing applicant request) */}
      {selectedRequestDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-kindia-blue">{selectedRequestDetail.reference}</span>
                <h3 className="font-heading font-extrabold text-sm text-slate-800">Détails de la Demande de Mission</h3>
              </div>
              <button onClick={() => setSelectedRequestDetail(null)} className="text-slate-400 font-bold text-lg">×</button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-500 font-bold">Demandeur :</span> <span className="font-bold text-slate-800">{selectedRequestDetail.applicant_last_name} {selectedRequestDetail.applicant_first_names}</span></div>
                <div><span className="text-slate-500 font-bold">Fonction :</span> <span>{selectedRequestDetail.applicant_function}</span></div>
                <div><span className="text-slate-500 font-bold">Structure :</span> <span>{selectedRequestDetail.applicant_service_name}</span></div>
                <div><span className="text-slate-500 font-bold">Contact :</span> <span>{selectedRequestDetail.applicant_phone}</span></div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <p><strong>Destination :</strong> {selectedRequestDetail.destination}</p>
                <p><strong>Objet :</strong> {selectedRequestDetail.object_of_mission}</p>
                <p><strong>Dates :</strong> {selectedRequestDetail.start_date ? selectedRequestDetail.start_date.substring(0, 10) : ''} au {selectedRequestDetail.end_date ? selectedRequestDetail.end_date.substring(0, 10) : ''}</p>
                {selectedRequestDetail.justification_motif && (
                  <p className="mt-1 text-slate-600 italic"><strong>Motif :</strong> {selectedRequestDetail.justification_motif}</p>
                )}
              </div>
            </div>

            {/* Participants list if present or collective */}
            {selectedRequestDetail.participants && selectedRequestDetail.participants.length > 0 && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <span className="font-bold text-slate-800 text-[11px] uppercase flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>Participants à la mission ({selectedRequestDetail.participants.length})</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedRequestDetail.participants.length > 1 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-900'
                  }`}>
                    {selectedRequestDetail.participants.length > 1 ? 'OM Collectif' : 'OM Individuel'}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedRequestDetail.participants.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <div>
                        <span className="font-bold text-slate-800">{p.nom} {p.prenoms}</span>
                        {p.is_requester ? <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">Demandeur</span> : null}
                        <div className="text-[10px] text-slate-500 font-medium">{p.service_name || ''} {p.matricule ? `• Matr: ${p.matricule}` : ''}</div>
                      </div>
                      <span className="text-[11px] font-bold text-kindia-blue">{p.fonction}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedRequestDetail(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  const reqItem = selectedRequestDetail;
                  setSelectedRequestDetail(null);
                  handleConvertRequestToOM(reqItem);
                }}
                className="px-4 py-2 bg-kindia-blue text-white font-extrabold text-xs rounded-xl shadow hover:bg-kindia-lightBlue transition flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-kindia-gold" />
                <span>🧾 CRÉER L'ORDRE DE MISSION</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Receipt Success Modal with QR Code */}
      {createdReceiptData && (
        <ReceiptSuccessModal
          documentType="MISSION_ORDER"
          reference={createdReceiptData.reference}
          receipt={createdReceiptData.receipt}
          onClose={() => setCreatedReceiptData(null)}
        />
      )}

      {/* Template Preview Modal */}
      {previewTemplateModal && (
        <TemplatePreviewModal
          template={previewTemplateModal.template}
          version={previewTemplateModal.version}
          onClose={() => setPreviewTemplateModal(null)}
        />
      )}

      {/* Dedicated Mission Signature Modal */}
      {selectedMissionForSign && (
        <MissionSignatureModal
          documentId={selectedMissionForSign.document_id || selectedMissionForSign.id}
          missionData={selectedMissionForSign}
          onClose={() => setSelectedMissionForSign(null)}
          onSuccess={() => {
            setSelectedMissionForSign(null);
            setSuccessMsg('Ordre de mission signé numériquement avec succès et retourné au Secrétariat Central !');
            loadAllData();
          }}
        />
      )}

      {/* Manuscript Signed & Stamped Scan Upload Modal (Secrétariat Central) */}
      {showUploadScanModal && (
        <ManuscriptScanUploadModal
          mission={showUploadScanModal}
          onClose={() => setShowUploadScanModal(null)}
          onSuccess={(res) => {
            setShowUploadScanModal(null);
            setSuccessMsg(res?.message || 'Document scanné réintégré avec succès dans UK-GED.');
            loadAllData();
          }}
        />
      )}
    </div>
  );
}

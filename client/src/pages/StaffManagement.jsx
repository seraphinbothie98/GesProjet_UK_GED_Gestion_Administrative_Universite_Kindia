import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { STANDARD_POSTES, isChefPosition } from '../constants/postes';
import { 
  Users, Plus, Search, UserCheck, UserX, Car, AlertTriangle, Eye, Edit3, 
  CheckCircle, FileText, X, Shield, Key, Lock, Trash2, Copy, Check, 
  UserPlus, RefreshCw, AlertCircle, Phone, Mail, Building2, ShieldCheck, 
  CheckCircle2, Laptop, FileSpreadsheet, Download, UploadCloud, Award,
  KeyRound, ShieldAlert, Sparkles, Filter, AlertOctagon, Briefcase, History,
  Calendar, ArrowRightLeft, CheckSquare, Layers, Building, HelpCircle
} from 'lucide-react';
import { handleGuineaPhoneChange } from '../utils/phoneUtils';
import { formatFullName } from '../utils/userUtils';

export default function StaffManagement() {
  const { user, refreshUser } = useAuth();
  const isAdmin = user?.role_code === 'ADMINISTRATEUR';
  const isSecCentral = user?.role_code === 'SECRETARIAT_CENTRAL';

  const [staffList, setStaffList] = useState([]);
  const [services, setServices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [positionsList, setPositionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  
  // Navigation Tabs: 'ALL' | 'CHEFS_SERVICE' | 'SYSTEM_USERS' | 'DRIVERS' | 'POSITIONS'
  const [activeTab, setActiveTab] = useState('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [staffAssignments, setStaffAssignments] = useState([]);
  const [staffMissions, setStaffMissions] = useState([]);
  const [staffPersonalVehicles, setStaffPersonalVehicles] = useState([]);
  const [staffAssignedVehicles, setStaffAssignedVehicles] = useState([]);
  const [staffAttachedDrivers, setStaffAttachedDrivers] = useState([]);

  // Mutation Modal State (Changer d'affectation)
  const [showMutationModal, setShowMutationModal] = useState(false);
  const [mutationData, setMutationData] = useState({
    position_id: '',
    service_id: '',
    start_date: new Date().toISOString().split('T')[0],
    reference_decision: '',
    notes: ''
  });
  const [mutationLoading, setMutationLoading] = useState(false);
  const [mutationError, setMutationError] = useState('');

  // Termination Modal State (Mettre fin à l'affectation)
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminationTarget, setTerminationTarget] = useState(null);
  const [terminationData, setTerminationData] = useState({
    end_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [terminationLoading, setTerminationLoading] = useState(false);
  const [terminationError, setTerminationError] = useState('');

  // Career Events Modal State (Retraite, Limogeage, Suspension, Mutation, Réintégration)
  const [showCareerEventModal, setShowCareerEventModal] = useState(false);
  const [careerEventStaff, setCareerEventStaff] = useState(null);
  const [careerEventData, setCareerEventData] = useState({
    event_type: 'MUTATION',
    effective_date: new Date().toISOString().split('T')[0],
    position_id: '',
    service_id: '',
    role_id: '',
    reference_decision: '',
    motive: ''
  });
  const [careerEventLoading, setCareerEventLoading] = useState(false);
  const [careerEventError, setCareerEventError] = useState('');

  // Institutional Position Modal State (Gestion des postes)
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [positionFormData, setPositionFormData] = useState({
    id: null,
    code: '',
    title: '',
    category: 'ADMINISTRATIF',
    service_id: '',
    rank_order: 10,
    description: ''
  });
  const [positionFormLoading, setPositionFormLoading] = useState(false);
  const [positionFormError, setPositionFormError] = useState('');
  const [positionCategoryFilter, setPositionCategoryFilter] = useState('');
  const [positionSearchQuery, setPositionSearchQuery] = useState('');
  
  // Personal Vehicle Modal State
  const [showAddPersonalVehModal, setShowAddPersonalVehModal] = useState(false);
  const [newPersonalVehData, setNewPersonalVehData] = useState({
    registration_number: '',
    brand: '',
    model: '',
    color: '',
    vehicle_type: 'Voiture',
    year: ''
  });
  const [personalVehError, setPersonalVehError] = useState('');
  const [personalVehLoading, setPersonalVehLoading] = useState(false);

  // Fleet Vehicle Assignment Modal State
  const [showAssignFleetVehModal, setShowAssignFleetVehModal] = useState(false);
  const [fleetVehiclesList, setFleetVehiclesList] = useState([]);
  const [selectedFleetVehId, setSelectedFleetVehId] = useState('');
  const [fleetAssignDriverId, setFleetAssignDriverId] = useState('');
  const [fleetAssignReason, setFleetAssignReason] = useState('');
  const [fleetAssignLoading, setFleetAssignLoading] = useState(false);
  const [fleetAssignError, setFleetAssignError] = useState('');

  // Driver Attachment Modal State
  const [showAttachDriverModal, setShowAttachDriverModal] = useState(false);
  const [availableDriversList, setAvailableDriversList] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isDefaultDriverAttachment, setIsDefaultDriverAttachment] = useState(false);
  const [driverAttachmentNotes, setDriverAttachmentNotes] = useState('');
  const [attachDriverLoading, setAttachDriverLoading] = useState(false);
  const [attachDriverError, setAttachDriverError] = useState('');

  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [serviceChefConflict, setServiceChefConflict] = useState(null);
  const [checkingChef, setCheckingChef] = useState(false);

  // Form State (Unified Staff + User Account)
  const [titre, setTitre] = useState('M.');
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [nationality, setNationality] = useState('Guinéenne');
  const [selectedPoste, setSelectedPoste] = useState('');
  const [fonction, setFonction] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [matricule, setMatricule] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('ACTIF');
  
  // Hierarchical Organizational Assignment States (Structure -> Rattachement -> Unité)
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [selectedAttachmentId, setSelectedAttachmentId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  
  // User Account & RBAC Credentials
  const [enableSystemAccess, setEnableSystemAccess] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [isChefService, setIsChefService] = useState(false);

  // Signature States
  const [sigFile, setSigFile] = useState(null);
  const [sigPreview, setSigPreview] = useState(null);
  const [existingSigUrl, setExistingSigUrl] = useState('');

  // CSV Import Modal State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [csvResult, setCsvResult] = useState(null);
  const [importingCsv, setImportingCsv] = useState(false);
  
  // Delete Modal
  const [deletingStaff, setDeletingStaff] = useState(null);
  const [deleteLinkedUser, setDeleteLinkedUser] = useState(true);
  
  // Security Modal
  const [securityStaff, setSecurityStaff] = useState(null);
  const [securityInfo, setSecurityInfo] = useState(null);
  const [generatedTempPassword, setGeneratedTempPassword] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [securityRoleId, setSecurityRoleId] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMsg, setSecurityMsg] = useState({ type: '', text: '' });
  const [copied, setCopied] = useState(false);
  
  // Quick Create Account Modal for Staff without user_id
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [newAccountStaff, setNewAccountStaff] = useState(null);
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountRoleId, setNewAccountRoleId] = useState('');
  
  // Notification states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter, searchQuery, serviceFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffData, servicesData, rolesData, positionsData] = await Promise.all([
        api.getStaff({ status: statusFilter, query: searchQuery, service_id: serviceFilter || undefined }),
        api.getServices().catch(() => []),
        api.getRoles().catch(() => []),
        api.getPositions().catch(() => [])
      ]);
      setStaffList(Array.isArray(staffData) ? staffData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setPositionsList(Array.isArray(positionsData) ? positionsData : []);
    } catch (err) {
      console.error('Failed to load staff directory:', err);
    } finally {
      setLoading(false);
    }
  };

  // Base Structures (Niveau 1 de l'organisation : parent_id est null)
  const baseStructures = useMemo(() => {
    return services
      .filter(s => !s.parent_id || s.code === 'UK' || s.structure_type === 'UNIVERSITE')
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
  }, [services]);

  // Structures de rattachement (Niveau 2 : filles directes de la structure sélectionnée)
  const attachmentOptions = useMemo(() => {
    if (!selectedStructureId) return [];
    const structId = Number(selectedStructureId);
    return services
      .filter(s => s.parent_id === structId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
  }, [services, selectedStructureId]);

  // Unités / Services inférieurs (Niveau 3 : filles directes du rattachement sélectionné)
  const unitOptions = useMemo(() => {
    if (!selectedAttachmentId) return [];
    const attId = Number(selectedAttachmentId);
    return services
      .filter(s => s.parent_id === attId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
  }, [services, selectedAttachmentId]);

  // Synchronisation dynamique du service_id effectif selon le niveau le plus fin choisi
  useEffect(() => {
    if (selectedUnitId) {
      setServiceId(selectedUnitId);
    } else if (selectedAttachmentId) {
      setServiceId(selectedAttachmentId);
    } else if (selectedStructureId) {
      setServiceId(selectedStructureId);
    } else {
      setServiceId('');
    }
  }, [selectedStructureId, selectedAttachmentId, selectedUnitId]);

  // Live conflict detection for Chef de Service assignment
  useEffect(() => {
    let isCancelled = false;
    const checkConflict = async () => {
      if (!serviceId) {
        setServiceChefConflict(null);
        return;
      }

      const selectedRole = roles.find(r => String(r.id) === String(roleId));
      const roleCode = selectedRole?.code;
      const isTargetingChef = isChefPosition(fonction, roleCode, isChefService);

      if (!isTargetingChef) {
        setServiceChefConflict(null);
        return;
      }

      const currentStaff = staffList.find(s => String(s.id) === String(editingStaffId));

      // Check local staffList first for instant UI feedback
      const localChef = staffList.find(s => 
        String(s.service_id) === String(serviceId) &&
        String(s.id) !== String(editingStaffId) &&
        (currentStaff?.user_id ? String(s.user_id) !== String(currentStaff.user_id) : true) &&
        s.status === 'ACTIF' &&
        isChefPosition(s.fonction, s.role_code, s.role_code === 'CHEF_SERVICE' || s.is_chef_service === 1 || s.is_chef_service === true)
      );

      if (localChef) {
        const srv = services.find(s => String(s.id) === String(serviceId));
        setServiceChefConflict({
          has_chef: true,
          chef_name: `${localChef.nom || ''} ${localChef.prenoms || ''}`.trim() || 'Chef de service',
          chef_matricule: localChef.matricule || 'N/A',
          service_name: srv?.name || localChef.service_name || 'Service sélectionné'
        });
        return;
      }

      // Query backend for full cross-check across staff and users
      setCheckingChef(true);
      try {
        const res = await api.checkServiceChef({
          service_id: serviceId,
          exclude_staff_id: editingStaffId || undefined,
          exclude_user_id: currentStaff?.user_id || undefined
        });
        if (!isCancelled) {
          if (res.has_chef && res.chef) {
            const c = res.chef;
            setServiceChefConflict({
              has_chef: true,
              chef_name: c.chef_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Chef de service',
              chef_matricule: c.matricule || 'N/A',
              service_name: c.service_name || services.find(s => String(s.id) === String(serviceId))?.name || 'Service sélectionné'
            });
          } else {
            setServiceChefConflict(null);
          }
        }
      } catch (err) {
        console.warn('Chef check error:', err);
      } finally {
        if (!isCancelled) setCheckingChef(false);
      }
    };

    checkConflict();
    return () => { isCancelled = true; };
  }, [serviceId, fonction, roleId, isChefService, editingStaffId, staffList, services, roles]);

  const handleCreateSubmit = async (e, forceCreate = false) => {
    if (e) e.preventDefault();
    setError('');
    setMessage('');

    if (!nom || !prenoms || !fonction) {
      setError('Nom, prénoms et fonction sont obligatoires.');
      return;
    }

    // Block duplicate Chef de Service
    const selectedRole = roles.find(r => String(r.id) === String(roleId));
    const roleCode = selectedRole?.code;
    const isTargetingChef = isChefPosition(fonction, roleCode, isChefService);

    if (serviceId && isTargetingChef) {
      if (serviceChefConflict?.has_chef) {
        setError(`⛔ Enregistrement refusé : Le service "${serviceChefConflict.service_name}" possède déjà un Chef de Service officiel actif (${serviceChefConflict.chef_name}, Matricule: ${serviceChefConflict.chef_matricule}). Un service ne peut avoir qu'un seul Chef de Service.`);
        return;
      }

      try {
        const currentStaff = staffList.find(s => String(s.id) === String(editingStaffId));
        const checkRes = await api.checkServiceChef({
          service_id: serviceId,
          exclude_staff_id: editingStaffId || undefined,
          exclude_user_id: currentStaff?.user_id || undefined
        });
        if (checkRes.has_chef && checkRes.chef) {
          const c = checkRes.chef;
          const conflictObj = {
            has_chef: true,
            chef_name: c.chef_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Chef de service',
            chef_matricule: c.matricule || 'N/A',
            service_name: c.service_name || services.find(s => String(s.id) === String(serviceId))?.name || 'Service sélectionné'
          };
          setServiceChefConflict(conflictObj);
          setError(`⛔ Enregistrement refusé : Le service "${conflictObj.service_name}" possède déjà un Chef de Service actif (${conflictObj.chef_name}, Matricule: ${conflictObj.chef_matricule}).`);
          return;
        }
      } catch (err) {
        console.warn('Preflight chef check error:', err);
      }
    }

    if (!forceCreate && !editingStaffId) {
      try {
        const dupRes = await api.checkDuplicateStaff({ matricule, nom, prenoms, email });
        if (dupRes.duplicate && (dupRes.staff || dupRes.user)) {
          setDuplicateWarning(dupRes.staff || dupRes.user);
          return;
        }
      } catch (err) {
        console.warn('Duplicate check error:', err.message);
      }
    }

    setSubmitting(true);
    try {
      let payload;
      if (sigFile) {
        payload = new FormData();
        payload.append('titre', titre);
        payload.append('nom', nom);
        payload.append('prenoms', prenoms);
        payload.append('nationality', nationality);
        payload.append('fonction', fonction);
        payload.append('service_id', serviceId || '');
        payload.append('matricule', matricule);
        payload.append('telephone', telephone);
        payload.append('email', email);
        payload.append('status', status);
        payload.append('signature', sigFile);
        payload.append('create_account', enableSystemAccess ? 'true' : 'false');
        payload.append('role_id', roleId || '');
        payload.append('password', accountPassword || '');
        payload.append('is_chef_service', isChefService ? 'true' : 'false');
      } else {
        payload = {
          titre,
          nom,
          prenoms,
          nationality,
          fonction,
          service_id: serviceId || null,
          matricule,
          telephone,
          email,
          status,
          create_account: enableSystemAccess,
          role_id: roleId || null,
          password: accountPassword || null,
          is_chef_service: isChefService
        };
      }

      if (editingStaffId) {
        await api.updateStaff(editingStaffId, payload);
        setMessage(`Membre du personnel mis à jour avec succès.${sigFile ? ' Signature électronique synchronisée.' : ''}`);
      } else {
        await api.createStaff(payload);
        setMessage(`Membre du personnel ${titre ? `${titre} ` : ''}${nom} ${prenoms} enregistré avec succès.${enableSystemAccess ? ' Compte utilisateur créé.' : ''}${sigFile ? ' Signature activée.' : ''}`);
      }

      setShowAddModal(false);
      setDuplicateWarning(null);
      resetForm();
      loadData();
      if (refreshUser) refreshUser();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’enregistrement.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingStaffId(null);
    setTitre('M.');
    setNom('');
    setPrenoms('');
    setNationality('Guinéenne');
    setSelectedPoste('');
    setFonction('');
    setServiceId('');
    setSelectedStructureId('');
    setSelectedAttachmentId('');
    setSelectedUnitId('');
    setMatricule('');
    setTelephone('');
    setEmail('');
    setStatus('ACTIF');
    setEnableSystemAccess(false);
    setRoleId('');
    setAccountPassword('');
    setIsChefService(false);
    setSigFile(null);
    setSigPreview(null);
    setExistingSigUrl('');
    setServiceChefConflict(null);
  };

  const openAddModal = (forChef = false) => {
    resetForm();
    if (forChef || activeTab === 'CHEFS_SERVICE') {
      const chefRole = roles.find(r => r.code === 'CHEF_SERVICE');
      if (chefRole) setRoleId(String(chefRole.id));
      setIsChefService(true);
      setEnableSystemAccess(true);
      setSelectedPoste('Chef de Service');
      setFonction('Chef de Service');
    }
    setShowAddModal(true);
  };

  const handleEdit = async (staff) => {
    setEditingStaffId(staff.id);
    
    // Auto-detect or use saved titre
    const KNOWN_TITLES = ['M.', 'Mme', 'Mlle', 'Dr', 'Dre', 'Pr', 'Pr Titulaire', 'MCF', 'MA', 'Ing.'];
    let rawNom = staff.nom || '';
    let extractedTitre = staff.titre || 'M.';
    if (!staff.titre) {
      for (const t of KNOWN_TITLES) {
        if (rawNom.startsWith(t + ' ') || rawNom.startsWith(t + '.')) {
          extractedTitre = t;
          rawNom = rawNom.substring(t.length).trim();
          break;
        }
      }
    }
    setTitre(extractedTitre);
    setNom(rawNom);
    setPrenoms(staff.prenoms || '');
    setNationality(staff.nationality || 'Guinéenne');
    
    // Match position with standard list
    const foundPoste = STANDARD_POSTES.find(p => p.value.toLowerCase() === (staff.fonction || '').trim().toLowerCase());
    if (foundPoste) {
      setSelectedPoste(foundPoste.value);
    } else {
      setSelectedPoste('AUTRE');
    }
    setFonction(staff.fonction || '');
    setServiceId(staff.service_id ? String(staff.service_id) : '');
    
    // Déduction automatique de l'arborescence (Structure -> Rattachement -> Unité)
    if (staff.service_id) {
      const sId = Number(staff.service_id);
      const currentSrv = services.find(s => s.id === sId);
      if (currentSrv) {
        if (currentSrv.parent_id) {
          const parentSrv = services.find(s => s.id === currentSrv.parent_id);
          if (parentSrv && parentSrv.parent_id) {
            // Niveau 3 (Unité dépendante d'un rattachement)
            setSelectedStructureId(String(parentSrv.parent_id));
            setSelectedAttachmentId(String(parentSrv.id));
            setSelectedUnitId(String(currentSrv.id));
          } else if (parentSrv) {
            // Niveau 2 (Structure de rattachement)
            setSelectedStructureId(String(parentSrv.id));
            setSelectedAttachmentId(String(currentSrv.id));
            setSelectedUnitId('');
          } else {
            // Niveau 1 direct
            setSelectedStructureId(String(currentSrv.id));
            setSelectedAttachmentId('');
            setSelectedUnitId('');
          }
        } else {
          // Niveau 1 racine
          setSelectedStructureId(String(currentSrv.id));
          setSelectedAttachmentId('');
          setSelectedUnitId('');
        }
      } else {
        setSelectedStructureId(String(staff.service_id));
        setSelectedAttachmentId('');
        setSelectedUnitId('');
      }
    } else {
      setSelectedStructureId('');
      setSelectedAttachmentId('');
      setSelectedUnitId('');
    }

    setMatricule(staff.matricule || '');
    setTelephone(staff.telephone || '');
    setEmail(staff.email || '');
    setStatus(staff.status || 'ACTIF');
    
    // System account detection
    const hasAccount = Boolean(staff.user_id || staff.linked_user_id);
    setEnableSystemAccess(hasAccount);
    setRoleId(staff.role_id ? String(staff.role_id) : '');
    setIsChefService(staff.role_code === 'CHEF_SERVICE' || staff.is_chef_service === 1 || staff.is_chef_service === true);
    setAccountPassword('');
    setServiceChefConflict(null);

    setSigFile(null);
    setSigPreview(null);
    setExistingSigUrl(staff.signature_image_path || '');

    // Attempt to fetch fresh signature
    try {
      const sigData = await api.getStaffSignature(staff.id);
      if (sigData && sigData.signature_image_path) {
        setExistingSigUrl(sigData.signature_image_path);
      }
    } catch (e) {
      // ignore
    }

    setShowAddModal(true);
  };

  const handleView = async (staff) => {
    setViewingStaff(staff);
    try {
      const [detail, assignments] = await Promise.all([
        api.getStaffDetail(staff.id).catch(() => null),
        api.getStaffAssignments(staff.id).catch(() => [])
      ]);
      if (detail) {
        setStaffMissions(Array.isArray(detail.missions) ? detail.missions : []);
        setStaffPersonalVehicles(Array.isArray(detail.personal_vehicles) ? detail.personal_vehicles : []);
        setStaffAssignedVehicles(Array.isArray(detail.assigned_vehicles) ? detail.assigned_vehicles : []);
        setStaffAttachedDrivers(Array.isArray(detail.attached_drivers) ? detail.attached_drivers : []);
      }
      setStaffAssignments(Array.isArray(assignments) ? assignments : []);
    } catch (err) {
      console.warn('Failed to load full staff detail:', err);
    }
  };

  // Mutation Handlers
  const openMutationModal = (staff) => {
    setMutationError('');
    setMutationData({
      position_id: '',
      service_id: staff?.service_id ? String(staff.service_id) : '',
      start_date: new Date().toISOString().split('T')[0],
      reference_decision: '',
      notes: ''
    });
    setShowMutationModal(true);
  };

  const handleExecuteMutation = async (e) => {
    if (e) e.preventDefault();
    if (!mutationData.position_id) {
      setMutationError('Veuillez sélectionner un poste');
      return;
    }
    setMutationLoading(true);
    setMutationError('');
    try {
      await api.assignStaffPosition(viewingStaff.id, {
        position_id: Number(mutationData.position_id),
        service_id: mutationData.service_id ? Number(mutationData.service_id) : null,
        start_date: mutationData.start_date,
        reference_decision: mutationData.reference_decision,
        notes: mutationData.notes
      });
      setMessage(`Mutation de ${viewingStaff.nom} ${viewingStaff.prenoms} enregistrée avec succès.`);
      setShowMutationModal(false);
      
      // Refresh assignments for current modal
      const updatedAssignments = await api.getStaffAssignments(viewingStaff.id);
      setStaffAssignments(Array.isArray(updatedAssignments) ? updatedAssignments : []);
      
      // Refresh viewingStaff
      const updatedStaffList = await api.getStaff({ status: statusFilter, query: searchQuery, service_id: serviceFilter || undefined });
      setStaffList(Array.isArray(updatedStaffList) ? updatedStaffList : []);
      const updated = updatedStaffList.find(s => s.id === viewingStaff.id);
      if (updated) setViewingStaff(updated);
      loadData();
    } catch (err) {
      setMutationError(err.message || 'Erreur lors de la mutation');
    } finally {
      setMutationLoading(false);
    }
  };

  // Termination Handlers
  const openTerminateModal = (assignment) => {
    setTerminationTarget(assignment);
    setTerminationError('');
    setTerminationData({
      end_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowTerminateModal(true);
  };

  const handleExecuteTermination = async (e) => {
    if (e) e.preventDefault();
    if (!terminationTarget) return;
    setTerminationLoading(true);
    setTerminationError('');
    try {
      await api.terminateStaffAssignment(viewingStaff.id, terminationTarget.id, {
        end_date: terminationData.end_date,
        notes: terminationData.notes
      });
      setMessage('Affectation clôturée avec succès. Le poste est désormais VACANT.');
      setShowTerminateModal(false);
      setTerminationTarget(null);
      
      const updatedAssignments = await api.getStaffAssignments(viewingStaff.id);
      setStaffAssignments(Array.isArray(updatedAssignments) ? updatedAssignments : []);
      
      const updatedStaffList = await api.getStaff({ status: statusFilter, query: searchQuery, service_id: serviceFilter || undefined });
      setStaffList(Array.isArray(updatedStaffList) ? updatedStaffList : []);
      const updated = updatedStaffList.find(s => s.id === viewingStaff.id);
      if (updated) setViewingStaff(updated);
      loadData();
    } catch (err) {
      setTerminationError(err.message || 'Erreur lors de la clôture de l’affectation');
    } finally {
      setTerminationLoading(false);
    }
  };

  // Career Event Handlers (Retraite, Limogeage, Suspension, Mutation, Réintégration)
  const openCareerEventModal = (staff, defaultType = 'MUTATION') => {
    setCareerEventStaff(staff);
    setCareerEventError('');
    setCareerEventData({
      event_type: defaultType,
      effective_date: new Date().toISOString().split('T')[0],
      position_id: '',
      service_id: staff?.service_id ? String(staff.service_id) : '',
      role_id: '',
      reference_decision: '',
      motive: ''
    });
    setShowCareerEventModal(true);
  };

  const handleExecuteCareerEvent = async (e) => {
    if (e) e.preventDefault();
    if (!careerEventStaff) return;
    if (careerEventData.event_type === 'MUTATION' && !careerEventData.position_id) {
      setCareerEventError('Veuillez sélectionner le nouveau poste pour la mutation.');
      return;
    }

    setCareerEventLoading(true);
    setCareerEventError('');
    try {
      const res = await api.recordStaffCareerEvent(careerEventStaff.id, {
        event_type: careerEventData.event_type,
        effective_date: careerEventData.effective_date,
        position_id: careerEventData.position_id ? Number(careerEventData.position_id) : null,
        service_id: careerEventData.service_id ? Number(careerEventData.service_id) : null,
        role_id: careerEventData.role_id ? Number(careerEventData.role_id) : null,
        reference_decision: careerEventData.reference_decision,
        motive: careerEventData.motive
      });

      setMessage(res.message || `Événement de carrière [${careerEventData.event_type}] enregistré avec succès.`);
      setShowCareerEventModal(false);
      if (refreshUser) refreshUser();
      
      // If viewing staff details
      if (viewingStaff && viewingStaff.id === careerEventStaff.id) {
        const updatedAssignments = await api.getStaffAssignments(viewingStaff.id);
        setStaffAssignments(Array.isArray(updatedAssignments) ? updatedAssignments : []);
        const updatedStaffList = await api.getStaff({ status: statusFilter, query: searchQuery, service_id: serviceFilter || undefined });
        const updated = updatedStaffList.find(s => s.id === viewingStaff.id);
        if (updated) setViewingStaff(updated);
      }
      loadData();
    } catch (err) {
      setCareerEventError(err.message || 'Erreur lors de l’enregistrement de l’événement.');
    } finally {
      setCareerEventLoading(false);
    }
  };

  // Position CRUD Handlers
  const openCreatePositionModal = () => {
    setPositionFormError('');
    setPositionFormData({
      id: null,
      code: '',
      title: '',
      category: 'ADMINISTRATIF',
      service_id: '',
      rank_order: 10,
      description: ''
    });
    setShowPositionModal(true);
  };

  const openEditPositionModal = (pos) => {
    setPositionFormError('');
    setPositionFormData({
      id: pos.id,
      code: pos.code,
      title: pos.title,
      category: pos.category || 'ADMINISTRATIF',
      service_id: pos.service_id ? String(pos.service_id) : '',
      rank_order: pos.rank_order || 10,
      description: pos.description || ''
    });
    setShowPositionModal(true);
  };

  const handleSavePosition = async (e) => {
    if (e) e.preventDefault();
    if (!positionFormData.code.trim() || !positionFormData.title.trim()) {
      setPositionFormError('Le code et le titre du poste sont obligatoires.');
      return;
    }
    setPositionFormLoading(true);
    setPositionFormError('');
    try {
      if (positionFormData.id) {
        await api.updatePosition(positionFormData.id, {
          code: positionFormData.code.trim().toUpperCase(),
          title: positionFormData.title.trim(),
          category: positionFormData.category,
          service_id: positionFormData.service_id ? Number(positionFormData.service_id) : null,
          rank_order: Number(positionFormData.rank_order) || 10,
          description: positionFormData.description
        });
        setMessage('Poste institutionnel modifié avec succès.');
      } else {
        await api.createPosition({
          code: positionFormData.code.trim().toUpperCase(),
          title: positionFormData.title.trim(),
          category: positionFormData.category,
          service_id: positionFormData.service_id ? Number(positionFormData.service_id) : null,
          rank_order: Number(positionFormData.rank_order) || 10,
          description: positionFormData.description
        });
        setMessage('Poste institutionnel créé avec succès.');
      }
      setShowPositionModal(false);
      loadData();
    } catch (err) {
      setPositionFormError(err.message || 'Erreur lors de l’enregistrement du poste.');
    } finally {
      setPositionFormLoading(false);
    }
  };

  const handleDeletePosition = async (posId, posTitle) => {
    if (!window.confirm(`Confirmez-vous la suppression du poste "${posTitle}" ?`)) return;
    try {
      await api.deletePosition(posId);
      setMessage(`Poste "${posTitle}" supprimé avec succès.`);
      loadData();
    } catch (err) {
      alert('Impossible de supprimer ce poste : ' + err.message);
    }
  };

  const handleAddPersonalVehicle = async (e) => {
    e.preventDefault();
    setPersonalVehError('');
    if (!newPersonalVehData.registration_number.trim()) {
      setPersonalVehError("L'immatriculation est obligatoire");
      return;
    }

    try {
      setPersonalVehLoading(true);
      await api.createPersonalVehicle({
        ...newPersonalVehData,
        staff_id: viewingStaff?.id || editingStaffId
      });
      setShowAddPersonalVehModal(false);
      setNewPersonalVehData({
        registration_number: '',
        brand: '',
        model: '',
        color: '',
        vehicle_type: 'Voiture',
        year: ''
      });
      if (viewingStaff) {
        const pVeh = await api.getStaffPersonalVehicles(viewingStaff.id);
        setStaffPersonalVehicles(Array.isArray(pVeh) ? pVeh : []);
      }
      loadData();
    } catch (err) {
      setPersonalVehError(err.message);
    } finally {
      setPersonalVehLoading(false);
    }
  };

  const handleDeactivatePersonalVehicle = async (pvId) => {
    if (!window.confirm('Confirmez-vous la désactivation de ce véhicule personnel ? Il ne sera plus sélectionnable pour les nouveaux ordres de mission.')) return;
    try {
      await api.deactivatePersonalVehicle(pvId);
      if (viewingStaff) {
        const pVeh = await api.getStaffPersonalVehicles(viewingStaff.id);
        setStaffPersonalVehicles(Array.isArray(pVeh) ? pVeh : []);
      }
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // Fleet Vehicle Assignment Handlers
  const openAssignFleetVehModal = async () => {
    setFleetAssignError('');
    setSelectedFleetVehId('');
    setFleetAssignDriverId('');
    setFleetAssignReason('');
    try {
      const vehicles = await api.getFleetVehicles();
      setFleetVehiclesList(Array.isArray(vehicles) ? vehicles : []);
      const drivers = await api.getDrivers({ active_only: 'true' });
      setAvailableDriversList(Array.isArray(drivers) ? drivers : []);
      setShowAssignFleetVehModal(true);
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleAssignFleetVehicle = async (e) => {
    e.preventDefault();
    if (!selectedFleetVehId) {
      setFleetAssignError('Veuillez sélectionner un véhicule de service');
      return;
    }
    setFleetAssignLoading(true);
    setFleetAssignError('');
    try {
      await api.assignStaffVehicle(viewingStaff.id, {
        vehicle_id: selectedFleetVehId,
        default_driver_id: fleetAssignDriverId || null,
        reason: fleetAssignReason || `Affectation administrative à ${viewingStaff.prenoms} ${viewingStaff.nom}`
      });
      setShowAssignFleetVehModal(false);
      const aVeh = await api.getStaffAssignedVehicles(viewingStaff.id);
      setStaffAssignedVehicles(Array.isArray(aVeh) ? aVeh : []);
      loadData();
    } catch (err) {
      setFleetAssignError(err.message);
    } finally {
      setFleetAssignLoading(false);
    }
  };

  const handleUnassignFleetVehicle = async (vehicleId) => {
    if (!window.confirm('Confirmez-vous le retrait de l’affectation de ce véhicule de service ?')) return;
    try {
      await api.unassignStaffVehicle(viewingStaff.id, vehicleId);
      const aVeh = await api.getStaffAssignedVehicles(viewingStaff.id);
      setStaffAssignedVehicles(Array.isArray(aVeh) ? aVeh : []);
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // Driver Attachment Handlers
  const openAttachDriverModal = async () => {
    setAttachDriverError('');
    setSelectedDriverId('');
    setIsDefaultDriverAttachment(false);
    setDriverAttachmentNotes('');
    try {
      const drivers = await api.getDrivers({ active_only: 'true' });
      setAvailableDriversList(Array.isArray(drivers) ? drivers : []);
      setShowAttachDriverModal(true);
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleAttachDriver = async (e) => {
    e.preventDefault();
    if (!selectedDriverId) {
      setAttachDriverError('Veuillez sélectionner un chauffeur');
      return;
    }
    setAttachDriverLoading(true);
    setAttachDriverError('');
    try {
      await api.attachStaffDriver(viewingStaff.id, {
        driver_id: selectedDriverId,
        is_default: isDefaultDriverAttachment,
        notes: driverAttachmentNotes
      });
      setShowAttachDriverModal(false);
      const drivers = await api.getStaffDrivers(viewingStaff.id);
      setStaffAttachedDrivers(Array.isArray(drivers) ? drivers : []);
      loadData();
    } catch (err) {
      setAttachDriverError(err.message);
    } finally {
      setAttachDriverLoading(false);
    }
  };

  const handleDetachDriver = async (driverId) => {
    if (!window.confirm('Confirmez-vous le détachement de ce chauffeur ?')) return;
    try {
      await api.detachStaffDriver(viewingStaff.id, driverId);
      const drivers = await api.getStaffDrivers(viewingStaff.id);
      setStaffAttachedDrivers(Array.isArray(drivers) ? drivers : []);
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleToggleStatus = async (staffId) => {
    try {
      await api.toggleStaffStatus(staffId);
      setMessage('Statut modifié avec succès.');
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors du changement de statut.');
    }
  };

  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;
    try {
      await api.deleteStaff(deletingStaff.id, { 
        delete_user: deleteLinkedUser,
        delete_linked_user: deleteLinkedUser 
      });
      setMessage(`Membre du personnel ${deletingStaff.nom} ${deletingStaff.prenoms} supprimé.`);
      setDeletingStaff(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la suppression.');
    }
  };

  // Helper to parse CSV string in client for live preview
  const parseCsvText = (csvString) => {
    if (!csvString) return [];
    let cleanStr = csvString.replace(/^\uFEFF/, '').trim();
    const lines = cleanStr.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    let delimiter = ',';
    if (headerLine.includes(';') && (headerLine.split(';').length >= headerLine.split(',').length)) {
      delimiter = ';';
    } else if (headerLine.includes('\t')) {
      delimiter = '\t';
    }

    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.every(c => !c)) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = cols[idx] !== undefined ? cols[idx] : '';
      });
      parsed.push(obj);
    }
    return parsed;
  };

  const handleCsvFileChange = (e) => {
    setCsvError('');
    setCsvResult(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target.result;
          const rows = parseCsvText(content);
          if (rows.length === 0) {
            setCsvError('Le fichier CSV est vide ou ne contient aucune ligne de données.');
          }
          setCsvRows(rows);
        } catch (err) {
          setCsvError('Erreur lors de la lecture du fichier CSV : ' + err.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const csvContent = 'matricule,prenom,nom,grade_titre,role_titre,direction_service,email,telephone,type_personnel,permis_conduire,disponible\n' +
      'UK-ENS-001,Mamadou Oury,DIALLO,Docteur,Chef de Département,Faculté des Sciences,m.diallo@univ-kindia.edu.gn,+224 621 11 22 33,ENSEIGNANT_CHERCHEUR,,true\n' +
      'UK-CHAUFF-002,Sekouba,CAMARA,Chauffeur,Chauffeur Principal,Rectorat,s.camara@univ-kindia.edu.gn,+224 622 44 55 66,CHAUFFEUR,B-8945,true\n' +
      'UK-CADRE-003,Aissatou,BAH,Cadre,Chef de Division,Secrétariat Général,a.bah@univ-kindia.edu.gn,+224 623 77 88 99,PERSONNEL_ADMINISTRATIF,,true\n';

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modele_import_personnel_uk.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteCsvImport = async () => {
    if (!csvFile && csvRows.length === 0) {
      setCsvError('Veuillez sélectionner un fichier CSV.');
      return;
    }

    setImportingCsv(true);
    setCsvError('');
    setCsvResult(null);

    try {
      let res;
      if (csvFile) {
        const formData = new FormData();
        formData.append('csv_file', csvFile);
        res = await api.importStaffCsv(formData);
      } else {
        res = await api.importStaffCsv({ rows: csvRows });
      }

      setCsvResult(res);
      setMessage(res.message || 'Importation terminée avec succès.');
      loadData();
    } catch (err) {
      setCsvError(err.message || 'Erreur lors de l’importation CSV.');
    } finally {
      setImportingCsv(false);
    }
  };

  // Security Modal Handler
  const openSecurityModal = async (staff) => {
    setSecurityStaff(staff);
    setSecurityInfo(null);
    setGeneratedTempPassword('');
    setCustomPassword('');
    setSecurityRoleId(staff.role_id ? String(staff.role_id) : '');
    setSecurityMsg({ type: '', text: '' });
    setCopied(false);
    setSecurityLoading(true);

    try {
      const targetUserId = staff.user_id || staff.linked_user_id;
      if (targetUserId) {
        const info = await api.getUserSecurityInfo(targetUserId);
        setSecurityInfo(info);
      }
    } catch (err) {
      console.error('Failed to load user security info:', err);
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleGenerateTempPassword = async () => {
    if (!securityStaff) return;
    const targetUserId = securityStaff.user_id || securityStaff.linked_user_id;
    if (!targetUserId) return;

    setSecurityLoading(true);
    setSecurityMsg({ type: '', text: '' });
    try {
      const res = await api.resetUserPassword(targetUserId, { type: 'TEMPORARY' });
      setGeneratedTempPassword(res.temporary_password);
      setSecurityMsg({ type: 'success', text: 'Nouveau mot de passe temporaire généré. L’utilisateur devra le changer à la première connexion.' });
      loadData();
    } catch (err) {
      setSecurityMsg({ type: 'error', text: err.message || 'Erreur lors de la génération du mot de passe.' });
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleApplyCustomPassword = async () => {
    if (!securityStaff || !customPassword.trim()) return;
    const targetUserId = securityStaff.user_id || securityStaff.linked_user_id;
    if (!targetUserId) return;

    setSecurityLoading(true);
    setSecurityMsg({ type: '', text: '' });
    try {
      await api.resetUserPassword(targetUserId, { type: 'CUSTOM', password: customPassword.trim() });
      setSecurityMsg({ type: 'success', text: 'Mot de passe mis à jour avec succès.' });
      setCustomPassword('');
      loadData();
    } catch (err) {
      setSecurityMsg({ type: 'error', text: err.message || 'Erreur lors de la mise à jour.' });
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleUnlockAccount = async () => {
    if (!securityStaff) return;
    const targetUserId = securityStaff.user_id || securityStaff.linked_user_id;
    if (!targetUserId) return;

    setSecurityLoading(true);
    try {
      await api.unlockUserAccount(targetUserId);
      setSecurityMsg({ type: 'success', text: 'Compte utilisateur débloqué avec succès.' });
      const info = await api.getUserSecurityInfo(targetUserId);
      setSecurityInfo(info);
      loadData();
    } catch (err) {
      setSecurityMsg({ type: 'error', text: err.message || 'Erreur lors du déblocage.' });
    } finally {
      setSecurityLoading(false);
    }
  };

  // Quick Account Creator for Staff without user_id
  const handleQuickCreateAccount = async (e) => {
    if (e) e.preventDefault();
    if (!newAccountStaff) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await api.createUserForStaff(newAccountStaff.id, {
        email: newAccountEmail,
        password: newAccountPassword,
        role_id: newAccountRoleId
      });
      setMessage(res.message || 'Compte utilisateur créé avec succès.');
      setShowCreateAccountModal(false);
      setNewAccountStaff(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du compte.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered List based on Active Tab
  const filteredStaffList = staffList.filter(item => {
    if (activeTab === 'CHEFS_SERVICE') {
      return item.role_code === 'CHEF_SERVICE' || 
             item.fonction?.toLowerCase().includes('chef') || 
             item.fonction?.toLowerCase().includes('doyen') ||
             item.fonction?.toLowerCase().includes('recteur') ||
             item.fonction?.toLowerCase().includes('directeur');
    }
    if (activeTab === 'SYSTEM_USERS') {
      return Boolean(item.user_id || item.linked_user_id);
    }
    if (activeTab === 'DRIVERS') {
      return Boolean(item.is_driver === 1 || item.is_driver === true);
    }
    return true;
  });

  // Dynamic Statistics
  const totalStaff = staffList.length;
  const activeStaff = staffList.filter(s => s.status === 'ACTIF').length;
  const linkedUsersCount = staffList.filter(s => s.user_id || s.linked_user_id).length;
  const chefsCount = staffList.filter(s => 
    s.role_code === 'CHEF_SERVICE' || 
    s.fonction?.toLowerCase().includes('chef') || 
    s.fonction?.toLowerCase().includes('doyen') ||
    s.fonction?.toLowerCase().includes('directeur')
  ).length;
  const driversCount = staffList.filter(s => s.is_driver === 1 || s.is_driver === true).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-kindia-blue text-kindia-gold flex items-center justify-center shadow-inner shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-kindia-blue">
                RÉPERTOIRE OFFICIEL & HABILITATIONS SYSTÈME • UK
              </span>
              {isAdmin && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  Mode Administrateur
                </span>
              )}
            </div>
            <h2 className="font-heading font-extrabold text-xl text-slate-800">
              Gestion du Personnel & des Comptes Utilisateurs
            </h2>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setCsvFile(null);
                setCsvRows([]);
                setCsvError('');
                setCsvResult(null);
                setShowCsvModal(true);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-300 shadow-xs transition flex items-center space-x-2"
              title="Importer une liste de personnel par fichier CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>IMPORTER UNE LISTE (.CSV)</span>
            </button>

            <button
              onClick={() => openAddModal(false)}
              className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2"
            >
              <Plus className="w-4 h-4 text-kindia-gold" />
              <span>AJOUTER UN MEMBRE / UTILISATEUR</span>
            </button>
          </div>
        )}
      </div>

      {/* Dynamic Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveTab('ALL')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer shadow-xs flex items-center justify-between ${
            activeTab === 'ALL' ? 'ring-2 ring-kindia-blue border-transparent' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Personnel</p>
            <h3 className="text-xl font-bold text-slate-800">{totalStaff}</h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('CHEFS_SERVICE')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer shadow-xs flex items-center justify-between ${
            activeTab === 'CHEFS_SERVICE' ? 'ring-2 ring-amber-500 border-transparent' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Chefs de Service & Doyens</p>
            <h3 className="text-xl font-bold text-amber-600">{chefsCount}</h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('SYSTEM_USERS')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer shadow-xs flex items-center justify-between ${
            activeTab === 'SYSTEM_USERS' ? 'ring-2 ring-indigo-600 border-transparent' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Comptes Système</p>
            <h3 className="text-xl font-bold text-indigo-600">{linkedUsersCount}</h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('DRIVERS')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer shadow-xs flex items-center justify-between ${
            activeTab === 'DRIVERS' ? 'ring-2 ring-emerald-600 border-transparent' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Chauffeurs Autorisés</p>
            <h3 className="text-xl font-bold text-emerald-600">{driversCount}</h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Car className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-2 rounded-t-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`pb-3 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'ALL'
              ? 'border-kindia-blue text-kindia-blue'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Tous les Personnels ({totalStaff})</span>
        </button>

        <button
          onClick={() => setActiveTab('CHEFS_SERVICE')}
          className={`pb-3 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'CHEFS_SERVICE'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4 text-amber-500" />
          <span>Chefs de Service & Doyens ({chefsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('SYSTEM_USERS')}
          className={`pb-3 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'SYSTEM_USERS'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <span>Comptes Système ({linkedUsersCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('DRIVERS')}
          className={`pb-3 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'DRIVERS'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Car className="w-4 h-4 text-emerald-600" />
          <span>Chauffeurs ({driversCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('POSITIONS')}
          className={`pb-3 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'POSITIONS'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4 text-purple-600" />
          <span>Postes Institutionnels ({positionsList.length})</span>
        </button>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-emerald-600 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB CONTENT: POSTES INSTITUTIONNELS                          */}
      {/* ============================================================ */}
      {activeTab === 'POSITIONS' ? (
        <div className="space-y-4">
          {/* Positions Filter Bar & Actions */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={positionSearchQuery}
                onChange={(e) => setPositionSearchQuery(e.target.value)}
                placeholder="Rechercher un poste (Code, Titre, Titulaire)..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-kindia-blue focus:bg-white transition outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <select
                value={positionCategoryFilter}
                onChange={(e) => setPositionCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-hidden focus:ring-2 focus:ring-kindia-blue"
              >
                <option value="">-- Toutes les catégories --</option>
                <option value="DIRECTION">Direction & Rectorat</option>
                <option value="FACULTE">Facultés & Décanats</option>
                <option value="DEPARTEMENT">Départements</option>
                <option value="SERVICE">Services Centraux</option>
                <option value="ADMINISTRATIF">Administratif</option>
                <option value="ENSEIGNEMENT">Enseignement / Recherche</option>
              </select>

              <button
                onClick={() => { setPositionSearchQuery(''); setPositionCategoryFilter(''); }}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                title="Réinitialiser les filtres"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Effacer</span>
              </button>

              {isAdmin && (
                <button
                  onClick={openCreatePositionModal}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouveau Poste</span>
                </button>
              )}
            </div>
          </div>

          {/* Positions Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Code & Rang</th>
                    <th className="py-3.5 px-4">Intitulé du Poste</th>
                    <th className="py-3.5 px-4">Structure / Service</th>
                    <th className="py-3.5 px-4">Catégorie</th>
                    <th className="py-3.5 px-4">Statut d'Occupation</th>
                    <th className="py-3.5 px-4">Titulaire Actuel</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {positionsList.filter(p => {
                    if (positionCategoryFilter && p.category !== positionCategoryFilter) return false;
                    if (positionSearchQuery) {
                      const q = positionSearchQuery.toLowerCase();
                      return (
                        p.code?.toLowerCase().includes(q) ||
                        p.title?.toLowerCase().includes(q) ||
                        p.occupant_name?.toLowerCase().includes(q) ||
                        p.service_name?.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400">
                        Aucun poste institutionnel ne correspond aux critères.
                      </td>
                    </tr>
                  ) : (
                    positionsList.filter(p => {
                      if (positionCategoryFilter && p.category !== positionCategoryFilter) return false;
                      if (positionSearchQuery) {
                        const q = positionSearchQuery.toLowerCase();
                        return (
                          p.code?.toLowerCase().includes(q) ||
                          p.title?.toLowerCase().includes(q) ||
                          p.occupant_name?.toLowerCase().includes(q) ||
                          p.service_name?.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    }).map(pos => {
                      const isOccupied = pos.is_occupied === 1 || pos.is_occupied === true;
                      return (
                        <tr key={pos.id} className="hover:bg-slate-50/80 transition group">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] border border-slate-200">
                                #{pos.rank_order || 10}
                              </span>
                              <span>{pos.code}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            {pos.title}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {pos.service_name || <span className="text-slate-400 italic">Université (Général)</span>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200">
                              {pos.category || 'ADMINISTRATIF'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {isOccupied ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                ● OCCUPÉ
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ○ VACANT
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {isOccupied && pos.occupant_name ? (
                              <div className="text-slate-800">
                                <span className="font-bold">{pos.occupant_name}</span>
                                {pos.occupant_matricule && (
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    Matricule : {pos.occupant_matricule}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Aucun titulaire assigné</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isAdmin && (
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => openEditPositionModal(pos)}
                                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                                  title="Modifier le poste"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {!isOccupied && (
                                  <button
                                    onClick={() => handleDeletePosition(pos.id, pos.title)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                                    title="Supprimer ce poste vacant"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* TAB CONTENT: STAFF MEMBERS DIRECTORY                         */
        /* ============================================================ */
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher (Nom, Matricule, Fonction, Email)..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-kindia-blue focus:bg-white transition outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Service Selector */}
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-hidden focus:ring-2 focus:ring-kindia-blue"
              >
                <option value="">-- Toutes les structures ({services.length}) --</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-hidden focus:ring-2 focus:ring-kindia-blue"
              >
                <option value="">-- Tous les statuts --</option>
                <option value="ACTIF">Actifs uniquement</option>
                <option value="INACTIF">Inactifs uniquement</option>
              </select>

              <button
                onClick={() => { setSearchQuery(''); setServiceFilter(''); setStatusFilter(''); }}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                title="Réinitialiser les filtres"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Effacer</span>
              </button>
            </div>
          </div>

          {/* Directory Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Matricule</th>
                    <th className="py-3.5 px-4">Nom & Prénoms</th>
                    <th className="py-3.5 px-4">Fonction</th>
                    <th className="py-3.5 px-4">Service / Structure</th>
                    <th className="py-3.5 px-4">Compte Système</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4">Chauffeur ?</th>
                    <th className="py-3.5 px-4">Statut</th>
                    <th className="py-3.5 px-4 text-right">Actions & Sécurité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-slate-400">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-4 h-4 border-2 border-kindia-blue border-t-transparent rounded-full animate-spin"></div>
                          <span>Chargement du personnel...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredStaffList.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-slate-400">
                        Aucun membre du personnel correspondant aux critères.
                      </td>
                    </tr>
                  ) : (
                    filteredStaffList.map(s => {
                      const hasAccount = Boolean(s.user_id || s.linked_user_id);
                      const isChef = s.role_code === 'CHEF_SERVICE' || s.fonction?.toLowerCase().includes('chef') || s.fonction?.toLowerCase().includes('doyen');

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition group">
                          {/* Matricule */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {s.matricule || <span className="text-slate-400 font-normal italic">Non assigné</span>}
                          </td>

                          {/* Nom & Prenoms */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2.5">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                isChef ? 'bg-amber-100 text-amber-800' : (hasAccount ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600')
                              }`}>
                                {s.nom ? s.nom[0] : 'P'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                  <span>{formatFullName(s)}</span>
                                  {isChef && (
                                    <span className="bg-amber-50 text-amber-700 text-[9px] font-black px-1.5 py-0.2 rounded border border-amber-300">
                                      CHEF
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 block">{s.email || 'Aucun email'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Fonction */}
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {s.fonction}
                          </td>

                          {/* Service / Structure */}
                          <td className="py-3.5 px-4">
                            {s.service_name ? (
                              <span className="font-semibold text-slate-700">{s.service_name}</span>
                            ) : (
                              <span className="text-slate-400 italic">Non affecté</span>
                            )}
                          </td>

                          {/* Compte Système / Rôle RBAC */}
                          <td className="py-3.5 px-4">
                            {hasAccount ? (
                              <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <ShieldCheck className="w-3 h-3" />
                                <span>{s.role_name || s.role_code || 'Actif'}</span>
                              </div>
                            ) : (
                              <span className="inline-block text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                Fiche uniquement
                              </span>
                            )}
                          </td>

                          {/* Contact */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                            {s.telephone ? (
                              <div className="flex items-center space-x-1">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{s.telephone}</span>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Chauffeur */}
                          <td className="py-3.5 px-4">
                            {s.is_driver ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Car className="w-3 h-3 mr-1" />
                                Chauffeur
                              </span>
                            ) : (
                              <span className="text-slate-400">Non</span>
                            )}
                          </td>

                          {/* Statut */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === 'ACTIF'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {s.status}
                            </span>
                          </td>

                          {/* Actions & Sécurité */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* 1. Consulter Fiche & Missions */}
                              <button
                                onClick={() => handleView(s)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                                title="Consulter la fiche & le parcours administratif"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Actions Administrateur */}
                              {isAdmin && (
                                <>
                                  {/* 2. Modifier */}
                                  <button
                                    onClick={() => handleEdit(s)}
                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                                    title="Modifier la fiche & les habilitations"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* 3. Sécurité / Compte Système */}
                                  {hasAccount ? (
                                    <button
                                      onClick={() => openSecurityModal(s)}
                                      className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition"
                                      title="Gérer la sécurité et le mot de passe"
                                    >
                                      <Key className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setNewAccountStaff(s);
                                        setNewAccountEmail(s.email || '');
                                        setNewAccountPassword('');
                                        setNewAccountRoleId(roles[0]?.id || '');
                                        setShowCreateAccountModal(true);
                                      }}
                                      className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition"
                                      title="Créer un compte d'accès utilisateur pour cet agent"
                                    >
                                      <UserPlus className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* 4. Événement de carrière (Retraite, Limogeage, Suspension, Mutation...) */}
                                  <button
                                    onClick={() => openCareerEventModal(s)}
                                    className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition"
                                    title="Gérer un événement de carrière (Retraite, Limogeage, Suspension, Mutation...)"
                                  >
                                    <Briefcase className="w-3.5 h-3.5" />
                                  </button>

                                  {/* 5. Activer / Désactiver */}
                                  <button
                                    onClick={() => handleToggleStatus(s.id)}
                                    className={`p-1.5 rounded-lg transition ${
                                      s.status === 'ACTIF' 
                                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                    title={s.status === 'ACTIF' ? 'Désactiver' : 'Réactiver'}
                                  >
                                    {s.status === 'ACTIF' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                  </button>

                                  {/* 6. Supprimer */}
                                  <button
                                    onClick={() => setDeletingStaff(s)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                                    title="Supprimer définitivement"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: ADD / EDIT UNIFIED STAFF & USER ACCOUNT             */}
      {/* ============================================================ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-base text-kindia-blue flex items-center gap-2">
                <Users className="w-5 h-5 text-kindia-gold" />
                <span>{editingStaffId ? '✏️ Modifier la Fiche & Compte Utilisateur' : '➕ Enregistrer un Personnel / Utilisateur'}</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-800 text-xs font-bold rounded-xl border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* SECTION 1: ÉTAT CIVIL & IDENTITÉ */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs text-slate-800 flex items-center">
                  <Users className="w-4 h-4 mr-1.5 text-kindia-blue" />
                  👤 1. Informations Personnelles & Civiles
                </h4>
                {/* Ligne 1 : Titre/Grade, Nom de Famille et Prénoms bien alignés et lisibles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Titre / Grade *</label>
                    <select
                      value={titre}
                      onChange={(e) => setTitre(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                      title="Sélectionner le titre ou grade universitaire / administratif"
                    >
                      <option value="M.">M. (Monsieur)</option>
                      <option value="Mme">Mme (Madame)</option>
                      <option value="Mlle">Mlle (Mademoiselle)</option>
                      <option value="Dr">Dr (Docteur)</option>
                      <option value="Dre">Dre (Docteure)</option>
                      <option value="Pr">Pr (Professeur)</option>
                      <option value="Pr Titulaire">Pr Titulaire</option>
                      <option value="MCF">MCF (Maître de Conférences)</option>
                      <option value="MA">MA (Maître-Assistant)</option>
                      <option value="Ing.">Ing. (Ingénieur)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nom de Famille *</label>
                    <input
                      type="text"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Ex : CAMARA"
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-bold uppercase bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Prénoms *</label>
                    <input
                      type="text"
                      value={prenoms}
                      onChange={(e) => setPrenoms(e.target.value)}
                      placeholder="Ex : Ibrahima"
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Matricule Unique</label>
                    <input
                      type="text"
                      value={matricule}
                      onChange={(e) => setMatricule(e.target.value)}
                      placeholder="Ex : UK-000245"
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nationalité *</label>
                    <input
                      type="text"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                      required
                    />
                  </div>
                </div>

                {/* BLOC AFFECTATION ORGANISATIONNELLE DYNAMIQUE EN CASCADE (Structure -> Rattachement -> Unité) */}
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                    <Building className="w-4 h-4 text-kindia-blue" />
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">Affectation Organisationnelle Hiérarchique</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Niveau 1 : Structure */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Structure <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedStructureId}
                        onChange={(e) => {
                          setSelectedStructureId(e.target.value);
                          setSelectedAttachmentId('');
                          setSelectedUnitId('');
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden text-slate-800"
                        required
                      >
                        <option value="">-- Sélectionner une structure --</option>
                        {baseStructures.map(s => (
                          <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-0.5">Niveau de base issu de Gestion des services.</p>
                    </div>

                    {/* Niveau 2 : Structure de rattachement */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Structure de rattachement
                      </label>
                      <select
                        value={selectedAttachmentId}
                        disabled={!selectedStructureId || attachmentOptions.length === 0}
                        onChange={(e) => {
                          setSelectedAttachmentId(e.target.value);
                          setSelectedUnitId('');
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">
                          {!selectedStructureId 
                            ? "Sélectionnez d'abord une structure" 
                            : attachmentOptions.length === 0 
                            ? "Aucune structure de rattachement (affectation directe)" 
                            : "-- Affectation directe ou choisir un rattachement --"}
                        </option>
                        {attachmentOptions.map(att => (
                          <option key={att.id} value={att.id}>➜ {att.name} {att.code ? `(${att.code})` : ''}</option>
                        ))}
                      </select>
                      {selectedStructureId && attachmentOptions.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-0.5">Filtré selon la structure sélectionnée.</p>
                      )}
                    </div>

                    {/* Niveau 3 : Unité / Service / Département (Affichage conditionnel) */}
                    {selectedAttachmentId && unitOptions.length > 0 && (
                      <div className="sm:col-span-2 animate-in fade-in duration-200">
                        <label className="block font-bold text-slate-700 mb-1">
                          Unité / Service / Département
                        </label>
                        <select
                          value={selectedUnitId}
                          onChange={(e) => setSelectedUnitId(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden text-slate-800"
                        >
                          <option value="">-- Affectation au rattachement ou choisir une unité ({unitOptions.length}) --</option>
                          {unitOptions.map(u => (
                            <option key={u.id} value={u.id}>↳ {u.name} {u.code ? `(${u.code})` : ''}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-0.5">Sous-unité organisationnelle dépendante.</p>
                      </div>
                    )}

                    {/* Case à cocher : Désigné comme chef de ce Poste */}
                    <div className="sm:col-span-2 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChefService}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsChefService(checked);
                            if (checked && !roleId) {
                              const chefRole = roles.find(r => r.code === 'CHEF_SERVICE');
                              if (chefRole) setRoleId(String(chefRole.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-kindia-blue focus:ring-kindia-blue cursor-pointer"
                        />
                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span>Désigné comme chef de ce Poste</span>
                          {isChefService && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              ⭐ Responsable officiel du service
                            </span>
                          )}
                        </span>
                      </label>
                      <span className="text-[10px] text-slate-400 italic">
                        {isChefService ? "Attribuera la responsabilité de ce service" : "Agent / Personnel régulier"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Poste / Fonction officielle */}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Poste / Fonction officielle *</label>
                    <input
                      type="text"
                      value={fonction}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFonction(val);
                        const isChef = isChefPosition(val, null, false);
                        setIsChefService(isChef);
                        if (isChef && !roleId) {
                          const chefRole = roles.find(r => r.code === 'CHEF_SERVICE');
                          if (chefRole) {
                            setRoleId(String(chefRole.id));
                          }
                        }
                      }}
                      placeholder="Ex : Agent Administratif, Secrétaire, Enseignant-Chercheur, Chef de Département..."
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden text-slate-800"
                      required
                    />
                  </div>

                  {/* Conflict Alert Banner: Service already has a Chef de Service */}
                  {serviceChefConflict?.has_chef && (
                    <div className="sm:col-span-2 p-3.5 bg-red-50 border-2 border-red-300 rounded-2xl text-red-900 text-xs flex items-start space-x-3 shadow-xs animate-in fade-in duration-200">
                      <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-extrabold text-red-800 flex items-center space-x-1.5">
                          <span>Poste Chef de Service déjà pourvu pour cette structure !</span>
                        </div>
                        <p className="text-[11px] text-red-700 leading-relaxed">
                          La structure <strong>{serviceChefConflict.service_name}</strong> a déjà un Chef de Service officiel actif : <strong className="underline">{serviceChefConflict.chef_name}</strong> {serviceChefConflict.chef_matricule ? `(Matricule: ${serviceChefConflict.chef_matricule})` : ''}.
                        </p>
                        <p className="text-[10px] text-red-600 font-bold">
                          ⛔ Règle institutionnelle : Un service ne peut avoir qu'un seul Chef de Service. L'enregistrement sous ce titre sera refusé.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Téléphone / Contact (+224)</label>
                    <input
                      type="tel"
                      value={telephone}
                      onChange={(e) => handleGuineaPhoneChange(e, setTelephone)}
                      placeholder="+224 6XX XX XX XX"
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-semibold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">E-mail Professionnel</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex : agent@univ-kindia.edu.gn"
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: ACCÈS SYSTÈME & HABILITATIONS RBAC */}
              <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-indigo-900 flex items-center">
                    <Shield className="w-4 h-4 mr-1.5 text-indigo-600" />
                    🛡️ 2. Accès Système & Habilitations (Compte Utilisateur)
                  </h4>
                  <label className="flex items-center space-x-2 font-bold text-xs text-indigo-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSystemAccess}
                      onChange={(e) => setEnableSystemAccess(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>Activer l'accès au système UK-GED</span>
                  </label>
                </div>

                {enableSystemAccess && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-200/60">
                    <div>
                      <label className="block font-bold text-indigo-950 mb-1">Rôle RBAC *</label>
                      <select
                        value={roleId}
                        onChange={(e) => {
                          setRoleId(e.target.value);
                          const sel = roles.find(r => String(r.id) === e.target.value);
                          setIsChefService(sel?.code === 'CHEF_SERVICE');
                        }}
                        className="w-full p-2.5 rounded-xl border border-indigo-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      >
                        <option value="">-- Sélectionner un rôle ({roles.length}) --</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-indigo-950 mb-1">
                        {editingStaffId ? 'Modifier Mot de passe (Optionnel)' : 'Mot de passe initial *'}
                      </label>
                      <input
                        type="password"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        placeholder={editingStaffId ? 'Laisser vide pour ne pas changer' : 'UnivKindia@2026'}
                        className="w-full p-2.5 rounded-xl border border-indigo-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: SIGNATURE ÉLECTRONIQUE */}
              <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-sky-900 flex items-center">
                    <Award className="w-4 h-4 mr-1.5 text-sky-600" />
                    ✍️ 3. Attribution d'une Signature Électronique (Optionnel)
                  </h4>
                  <span className="text-[10px] text-sky-700 bg-sky-100 font-semibold px-2 py-0.5 rounded-full">
                    Module Signature Électronique
                  </span>
                </div>
                <p className="text-[11px] text-sky-800">
                  Si vous attribuez ou mettez à jour la signature manuscrite de cet agent, elle s'ajoutera et s'activera automatiquement dans le module <strong>Signatures Électroniques</strong> des responsables.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-sky-900 mb-1">Téléverser l'image de la signature</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setSigFile(file);
                          setSigPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">PNG transparent recommandé</span>
                  </div>

                  <div className="flex items-center justify-center p-3 border border-dashed border-sky-300 rounded-xl bg-white min-h-[70px]">
                    {sigPreview ? (
                      <img src={sigPreview} alt="Aperçu signature" className="max-h-16 object-contain" />
                    ) : existingSigUrl ? (
                      <div className="text-center">
                        <img src={existingSigUrl} alt="Signature actuelle" className="max-h-14 object-contain mx-auto" />
                        <span className="text-[9px] text-emerald-600 font-bold block">Signature active enregistrée</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Aucune signature attribuée</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold transition shadow-md flex items-center space-x-1.5"
                >
                  {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>{editingStaffId ? 'Mettre à jour' : 'Enregistrer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: CSV IMPORT MODAL                                     */}
      {/* ============================================================ */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-base text-kindia-blue flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Importer une Liste de Personnel (.CSV)</span>
              </h3>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 text-emerald-900 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs font-medium">
              <div>
                <p className="font-bold">Format attendu : Fichier CSV avec encodage UTF-8</p>
                <p className="text-[11px] text-emerald-700">Colonnes : <code>matricule, prenom, nom, grade_titre, role_titre, direction_service, email, telephone, type_personnel</code></p>
              </div>
              <button
                onClick={handleDownloadCsvTemplate}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center space-x-1 shrink-0 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Modèle CSV</span>
              </button>
            </div>

            {csvError && (
              <div className="p-3 bg-red-50 text-red-800 text-xs font-bold rounded-xl border border-red-200">
                {csvError}
              </div>
            )}

            {csvResult && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
                {csvResult.message}
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Sélectionner le fichier CSV sur votre ordinateur</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileChange}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
              />
            </div>

            {csvRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Aperçu des données ({csvRows.length} lignes détectées)</span>
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 font-bold text-slate-600">
                      <tr>
                        <th className="p-2">Matricule</th>
                        <th className="p-2">Nom & Prénoms</th>
                        <th className="p-2">Fonction</th>
                        <th className="p-2">Service</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {csvRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-mono">{row.matricule || '—'}</td>
                          <td className="p-2 font-semibold">{row.nom || row.last_name || ''} {row.prenom || row.prenoms || row.first_name || ''}</td>
                          <td className="p-2">{row.fonction || row.grade_titre || row.role_titre || '—'}</td>
                          <td className="p-2">{row.service || row.direction_service || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition text-xs"
              >
                Fermer
              </button>
              <button
                onClick={handleExecuteCsvImport}
                disabled={importingCsv || (!csvFile && csvRows.length === 0)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-md flex items-center space-x-1.5 text-xs disabled:opacity-50"
              >
                {importingCsv && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                <span>Lancer l'importation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: SECURITY & PASSWORD MANAGEMENT                       */}
      {/* ============================================================ */}
      {securityStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-600" />
                <span>Sécurité & Accès : {securityStaff.nom} {securityStaff.prenoms}</span>
              </h3>
              <button onClick={() => setSecurityStaff(null)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {securityMsg.text && (
              <div className={`p-3 rounded-xl text-xs font-bold border ${
                securityMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                {securityMsg.text}
              </div>
            )}

            {/* Generated Temporary Password Display */}
            {generatedTempPassword && (
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-2">
                <p className="text-[11px] font-bold text-purple-900 uppercase">Mot de passe temporaire généré</p>
                <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-purple-200">
                  <span className="font-mono font-black text-sm text-purple-700">{generatedTempPassword}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedTempPassword);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg text-xs font-bold flex items-center space-x-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleGenerateTempPassword}
                disabled={securityLoading}
                className="w-full p-3 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold rounded-2xl border border-purple-200 text-xs flex items-center justify-center space-x-2 transition"
              >
                <KeyRound className="w-4 h-4" />
                <span>Générer un nouveau mot de passe temporaire</span>
              </button>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-700">Définir un mot de passe personnalisé</label>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Nouveau mot de passe"
                    className="flex-1 p-2 bg-white rounded-xl border border-slate-300 text-xs font-mono"
                  />
                  <button
                    onClick={handleApplyCustomPassword}
                    disabled={securityLoading || !customPassword.trim()}
                    className="px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                  >
                    Appliquer
                  </button>
                </div>
              </div>

              {securityInfo?.locked_until && (
                <button
                  onClick={handleUnlockAccount}
                  disabled={securityLoading}
                  className="w-full p-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-2xl border border-amber-200 text-xs flex items-center justify-center space-x-2 transition"
                >
                  <Lock className="w-4 h-4" />
                  <span>Débloquer le compte utilisateur</span>
                </button>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setSecurityStaff(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: QUICK USER ACCOUNT CREATION MODAL                   */}
      {/* ============================================================ */}
      {showCreateAccountModal && newAccountStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>Créer un compte d'accès UK-GED</span>
              </h3>
              <button onClick={() => setShowCreateAccountModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Attribution d'un compte de connexion pour <strong>{newAccountStaff.nom} {newAccountStaff.prenoms}</strong>.
            </p>

            <form onSubmit={handleQuickCreateAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Professionnel *</label>
                <input
                  type="email"
                  value={newAccountEmail}
                  onChange={(e) => setNewAccountEmail(e.target.value)}
                  placeholder="agent@univ-kindia.edu.gn"
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Rôle RBAC *</label>
                <select
                  value={newAccountRoleId}
                  onChange={(e) => setNewAccountRoleId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold"
                  required
                >
                  <option value="">-- Sélectionner un rôle --</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mot de passe initial (Optionnel)</label>
                <input
                  type="password"
                  value={newAccountPassword}
                  onChange={(e) => setNewAccountPassword(e.target.value)}
                  placeholder="UnivKindia@2026 (par défaut)"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateAccountModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-md"
                >
                  Créer le compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: DETAIL VIEW & RESOURCE MANAGEMENT (FICHE PERSONNEL)  */}
      {/* ============================================================ */}
      {viewingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-base text-kindia-blue flex items-center gap-2">
                <Users className="w-5 h-5 text-kindia-gold" />
                <span>Fiche Détaillée & Parcours Administratif : {formatFullName(viewingStaff)}</span>
              </h3>
              <button onClick={() => setViewingStaff(null)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SECTION 1: INFORMATIONS PERSONNELLES & IDENTITÉ */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-kindia-blue" />
                  <span>1. Identité & Informations Personnelles</span>
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  viewingStaff.status === 'ACTIF' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  Statut : {viewingStaff.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Matricule :</span> <strong className="font-mono">{viewingStaff.matricule || 'Non renseigné'}</strong></div>
                <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Titre / Grade :</span> <strong>{viewingStaff.titre || 'M.'}</strong></div>
                <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Nom de Famille :</span> <strong>{viewingStaff.nom}</strong></div>
                <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Prénoms :</span> <strong>{viewingStaff.prenoms}</strong></div>
                <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Nationalité :</span> <strong>{viewingStaff.nationality}</strong></div>
                <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Téléphone :</span> <strong className="font-mono">{viewingStaff.telephone || '—'}</strong></div>
                <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Email :</span> <strong>{viewingStaff.email || '—'}</strong></div>
                <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Chauffeur officiel :</span> <strong>{viewingStaff.is_driver ? 'Oui' : 'Non'}</strong></div>
              </div>

              {viewingStaff.signature_image_path && (
                <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-200 flex items-center space-x-3 mt-2">
                  <Award className="w-5 h-5 text-sky-600 shrink-0" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-sky-900">Signature électronique enregistrée</span>
                    <img src={viewingStaff.signature_image_path} alt="Signature" className="max-h-8 object-contain" />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: COMPTE UTILISATEUR & HABILITATIONS RBAC */}
            <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>2. Compte Utilisateur & Habilitations RBAC</span>
                </h4>
                {viewingStaff.user_id ? (
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                    Compte Système Actif
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full">
                    Fiche Seule (Sans accès GED)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-indigo-800 block text-[10px] uppercase font-bold">Identifiant de connexion :</span>
                  <strong className="text-slate-900">{viewingStaff.email || 'Aucun email'}</strong>
                </div>
                <div>
                  <span className="text-indigo-800 block text-[10px] uppercase font-bold">Rôle RBAC Attribué :</span>
                  <strong className="text-indigo-900">{viewingStaff.role_name || viewingStaff.role_code || 'Aucun rôle'}</strong>
                </div>
                <div className="flex items-end justify-start sm:justify-end">
                  {isAdmin && viewingStaff.user_id && (
                    <button
                      onClick={() => openSecurityModal(viewingStaff)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Sécurité & Mot de passe</span>
                    </button>
                  )}
                  {isAdmin && !viewingStaff.user_id && (
                    <button
                      onClick={() => {
                        setNewAccountStaff(viewingStaff);
                        setNewAccountEmail(viewingStaff.email || '');
                        setNewAccountPassword('');
                        setNewAccountRoleId(roles[0]?.id || '');
                        setShowCreateAccountModal(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Créer un compte d'accès</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: AFFECTATION ACTUELLE */}
            <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>3. Affectation Actuelle & Poste Institutionnel</span>
                </h4>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded-full">
                  ● AFFECTATION EN COURS
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-xl border border-blue-200">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Poste Actuel :</span>
                  <strong className="text-slate-900 text-sm">{viewingStaff.fonction || 'Agent'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Structure / Service :</span>
                  <strong className="text-blue-900">{viewingStaff.service_name || 'Non affecté'}</strong>
                </div>
                <div className="flex items-center space-x-2 justify-start sm:justify-end pt-1 sm:pt-0">
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => openCareerEventModal(viewingStaff)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                        title="Gérer un événement de carrière officiel (Retraite, Limogeage, Suspension...)"
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Événement Carrière</span>
                      </button>

                      <button
                        onClick={() => openMutationModal(viewingStaff)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                        title="Muter cet agent vers un autre poste sans dupliquer son identité"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Muter</span>
                      </button>

                      {staffAssignments.find(a => a.status === 'ACTIVE') && (
                        <button
                          onClick={() => openTerminateModal(staffAssignments.find(a => a.status === 'ACTIVE'))}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                          title="Clôturer l'affectation actuelle et libérer le poste"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Clôturer</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 4: HISTORIQUE DES AFFECTATIONS & MUTATIONS */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-purple-600" />
                    <span>4. Historique des Affectations & Mutations ({staffAssignments.length})</span>
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Traçabilité complète des postes occupés, arrêtés de nomination et dates de service.
                  </p>
                </div>
              </div>

              {staffAssignments.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Aucun historique d'affectation formel enregistré dans le nouveau registre.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200">
                        <th className="py-2.5 px-3">Poste & Code</th>
                        <th className="py-2.5 px-3">Structure / Service</th>
                        <th className="py-2.5 px-3">Période</th>
                        <th className="py-2.5 px-3">Statut</th>
                        <th className="py-2.5 px-3">Décision / Arrêté</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffAssignments.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block">{a.position_title || 'Poste'}</span>
                            <span className="text-[10px] font-mono text-purple-700">{a.position_code || ''}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {a.service_name || 'Université (Général)'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                            {a.start_date || '—'} → {a.end_date || <span className="text-emerald-700 font-bold">Actuel</span>}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              a.status === 'ACTIVE' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : (a.status === 'MUTATED' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600')
                            }`}>
                              {a.status === 'ACTIVE' ? 'Actif' : (a.status === 'MUTATED' ? 'Muté' : 'Terminé')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {a.reference_decision || a.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SECTION A: VÉHICULES PERSONNELS */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-amber-600" />
                    <span>5. Véhicules Personnels ({staffPersonalVehicles.length})</span>
                  </h4>
                  <p className="text-[10px] text-slate-500">Propriété personnelle de l’agent, utilisable pour les missions avec transport personnel.</p>
                </div>
                {(isAdmin || isSecCentral) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPersonalVehError('');
                      setShowAddPersonalVehModal(true);
                    }}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Ajouter un véhicule</span>
                  </button>
                )}
              </div>

              {staffPersonalVehicles.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Aucun véhicule personnel enregistré pour cet employé.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {staffPersonalVehicles.map(pv => (
                    <div key={pv.id} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50 text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-slate-800 bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-lg border border-amber-200">
                            {pv.registration_number}
                          </span>
                          <span className="font-bold text-slate-800">
                            {pv.brand || ''} {pv.model || ''}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {pv.vehicle_type || 'Voiture'} {pv.color ? `• Couleur : ${pv.color}` : ''} {pv.year ? `• Année : ${pv.year}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {pv.status === 'ACTIF' ? (
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                            Actif
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-medium rounded-full">
                            Inactif
                          </span>
                        )}
                        {pv.status === 'ACTIF' && (isAdmin || isSecCentral) && (
                          <button
                            type="button"
                            onClick={() => handleDeactivatePersonalVehicle(pv.id)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg border border-rose-200 transition"
                            title="Désactiver ce véhicule"
                          >
                            Désactiver
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION B: VÉHICULES DE SERVICE ATTRIBUÉS */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>6. Véhicules de Service Attribués ({staffAssignedVehicles.length})</span>
                  </h4>
                  <p className="text-[10px] text-slate-500">Véhicules appartenant à l'Université de Kindia, affectés durablement à ce responsable.</p>
                </div>
                {(isAdmin || isSecCentral) && (
                  <button
                    type="button"
                    onClick={openAssignFleetVehModal}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Affecter un véhicule de service</span>
                  </button>
                )}
              </div>

              {staffAssignedVehicles.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Aucun véhicule de service officiel de l’Université actuellement affecté à cet agent.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {staffAssignedVehicles.map(v => (
                    <div key={v.id} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50 text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                            {v.registration_number}
                          </span>
                          <span className="font-bold text-slate-800">
                            {v.brand || 'Véhicule'} {v.model || ''}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Propriété Université de Kindia {v.assigned_at ? `• Affecté le ${new Date(v.assigned_at).toLocaleDateString('fr-FR')}` : ''}
                          {v.default_driver_full_name && ` • Chauffeur habituel : ${v.default_driver_full_name}`}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">
                          Affecté
                        </span>
                        {(isAdmin || isSecCentral) && (
                          <button
                            type="button"
                            onClick={() => handleUnassignFleetVehicle(v.id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-[10px] font-bold rounded-lg border border-slate-300 hover:border-rose-300 transition"
                            title="Retirer l'affectation"
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION C: CHAUFFEURS RATTACHÉS */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>7. Chauffeurs Rattachés ({staffAttachedDrivers.length})</span>
                  </h4>
                  <p className="text-[10px] text-slate-500">Chauffeurs officiels rattachés à ce responsable pour la conduite lors des missions.</p>
                </div>
                {(isAdmin || isSecCentral) && (
                  <button
                    type="button"
                    onClick={openAttachDriverModal}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Rattacher un chauffeur</span>
                  </button>
                )}
              </div>

              {staffAttachedDrivers.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Aucun chauffeur rattaché à cet agent.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {staffAttachedDrivers.map(d => (
                    <div key={d.staff_driver_id || d.driver_id} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50 text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800">
                            {d.full_name || `${d.prenoms || ''} ${d.nom || ''}`}
                          </span>
                          {d.is_default === 1 && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                              Chauffeur par défaut
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Tél : {d.telephone || 'Non renseigné'} {d.license_number ? `• Permis : ${d.license_number}` : ''} {d.driver_service_name ? `• Service : ${d.driver_service_name}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {(isAdmin || isSecCentral) && (
                          <button
                            type="button"
                            onClick={() => handleDetachDriver(d.driver_id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-[10px] font-bold rounded-lg border border-slate-300 hover:border-rose-300 transition"
                            title="Détacher ce chauffeur"
                          >
                            Détacher
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION D: HISTORIQUE DES MISSIONS */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <h4 className="font-bold text-xs text-slate-800">8. Historique des Ordres de Mission ({staffMissions.length})</h4>
              {staffMissions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucun ordre de mission enregistré pour cet agent.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs">
                  {staffMissions.map(m => (
                    <div key={m.id} className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <span className="font-bold font-mono">{m.reference_number || `OM-${m.id}`}</span>
                        <span className="text-slate-500 text-[11px] block">{m.destination} ({m.start_date} → {m.end_date})</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{m.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setViewingStaff(null)}
                className="px-4 py-2 rounded-xl bg-kindia-blue text-white font-bold text-xs shadow-md"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: MUTATION / CHANGEMENT D'AFFECTATION                   */}
      {/* ============================================================ */}
      {showMutationModal && viewingStaff && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-purple-200 animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-purple-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-purple-600" />
                <span>Muter / Changer d'affectation : {viewingStaff.nom} {viewingStaff.prenoms}</span>
              </h3>
              <button onClick={() => setShowMutationModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Principe Institutionnel : Une personne = Une identité</span>
              </p>
              <p className="text-[11px] text-purple-800 leading-relaxed">
                Cette opération clôturera l'affectation précédente de l'agent et créera sa nouvelle affectation sans modifier son identité, ni créer de doublon de compte ou de dossier.
              </p>
            </div>

            {mutationError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
                {mutationError}
              </div>
            )}

            <form onSubmit={handleExecuteMutation} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nouveau Poste Institutionnel <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={mutationData.position_id}
                  onChange={(e) => {
                    setMutationData({ ...mutationData, position_id: e.target.value });
                    const selPos = positionsList.find(p => String(p.id) === e.target.value);
                    if (selPos?.service_id) {
                      setMutationData(prev => ({ ...prev, position_id: e.target.value, service_id: String(selPos.service_id) }));
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-purple-600 outline-hidden"
                >
                  <option value="">-- Sélectionner le nouveau poste ({positionsList.length}) --</option>
                  {positionsList.map(pos => (
                    <option key={pos.id} value={pos.id}>
                      {pos.title} ({pos.code}) {pos.is_occupied ? `[Actuellement occupé par: ${pos.occupant_name}]` : '[VACANT]'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nouvelle Structure / Service de rattachement
                </label>
                <select
                  value={mutationData.service_id}
                  onChange={(e) => setMutationData({ ...mutationData, service_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-600 outline-hidden"
                >
                  <option value="">-- Même structure ou Université (Général) --</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Date de prise de fonction <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={mutationData.start_date}
                  onChange={(e) => setMutationData({ ...mutationData, start_date: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-purple-600 outline-hidden"
                >
                </input>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Référence de la Décision / Arrêté de nomination
                </label>
                <input
                  type="text"
                  placeholder="Ex : Arrêté Rectoral N° 2026/042/UK"
                  value={mutationData.reference_decision}
                  onChange={(e) => setMutationData({ ...mutationData, reference_decision: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Observations / Motif de la mutation
                </label>
                <textarea
                  rows="2"
                  placeholder="Ex : Nomination suite à la restructuration..."
                  value={mutationData.notes}
                  onChange={(e) => setMutationData({ ...mutationData, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-hidden"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowMutationModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={mutationLoading || !mutationData.position_id}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-md flex items-center space-x-1.5"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>{mutationLoading ? 'Enregistrement...' : 'Valider la Mutation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: TERMINATE ASSIGNMENT (CLÔTURE D'AFFECTATION)          */}
      {/* ============================================================ */}
      {showTerminateModal && terminationTarget && viewingStaff && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-amber-200 animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-amber-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600" />
                <span>Mettre fin à l'affectation</span>
              </h3>
              <button onClick={() => setShowTerminateModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Confirmez-vous la fin d'affectation de <strong>{viewingStaff.nom} {viewingStaff.prenoms}</strong> au poste de <strong>{terminationTarget.position_title || viewingStaff.fonction}</strong> ? Le poste redeviendra immédiatement <strong className="text-emerald-700">VACANT</strong>.
            </p>

            {terminationError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
                {terminationError}
              </div>
            )}

            <form onSubmit={handleExecuteTermination} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Date de fin effective <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={terminationData.end_date}
                  onChange={(e) => setTerminationData({ ...terminationData, end_date: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motif de fin de fonction / Observations
                </label>
                <textarea
                  rows="2"
                  placeholder="Ex : Fin de mandat, départ en retraite, mutation externe..."
                  value={terminationData.notes}
                  onChange={(e) => setTerminationData({ ...terminationData, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-hidden"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTerminateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={terminationLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-md"
                >
                  {terminationLoading ? 'Clôture en cours...' : 'Confirmer la fin d\'affectation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CAREER EVENT (MUTATION, RETRAITE, LIMOGEAGE, ETC.)    */}
      {/* ============================================================ */}
      {showCareerEventModal && careerEventStaff && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-indigo-200 animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-slate-800">
                    Événement de Carrière & Mouvement
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    {careerEventStaff.nom} {careerEventStaff.prenoms} ({careerEventStaff.matricule || 'Sans matricule'})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowCareerEventModal(false)} 
                className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {careerEventError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{careerEventError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteCareerEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Type d'événement <span className="text-red-500">*</span>
                </label>
                <select
                  value={careerEventData.event_type}
                  onChange={(e) => setCareerEventData({ ...careerEventData, event_type: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-600 outline-hidden"
                >
                  <option value="MUTATION">🔄 Mutation / Changement de Poste ou Service</option>
                  <option value="RETRAITE">👴 Départ à la Retraite</option>
                  <option value="LIMOGEAGE">🛑 Fin de Fonction / Limogeage</option>
                  <option value="SUSPENSION">⏸️ Suspension Administrative</option>
                  <option value="REINTEGRATION">✅ Réintégration / Rétablissement</option>
                </select>
              </div>

              {/* Impact Banner */}
              <div className={`p-3 rounded-2xl border text-xs font-medium space-y-1 ${
                careerEventData.event_type === 'MUTATION' ? 'bg-indigo-50 border-indigo-200 text-indigo-900' :
                careerEventData.event_type === 'RETRAITE' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                careerEventData.event_type === 'LIMOGEAGE' ? 'bg-rose-50 border-rose-200 text-rose-900' :
                careerEventData.event_type === 'SUSPENSION' ? 'bg-orange-50 border-orange-200 text-orange-900' :
                'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Impact sur le Personnel et le Compte Système :</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {careerEventData.event_type === 'MUTATION' && "Clôture l'affectation précédente, crée une nouvelle affectation active et synchronise immédiatement le dossier de l'agent et son compte utilisateur."}
                  {careerEventData.event_type === 'RETRAITE' && "Passe le statut à RETRAITÉ, libère tout poste de direction de service occupé et désactive l'accès au compte utilisateur (INACTIVE)."}
                  {careerEventData.event_type === 'LIMOGEAGE' && "Passe le statut à INACTIF, clôture l'affectation active, libère la tête de service et désactive le compte utilisateur lié."}
                  {careerEventData.event_type === 'SUSPENSION' && "Passe le statut à SUSPENDU et désactive temporairement le compte utilisateur associé."}
                  {careerEventData.event_type === 'REINTEGRATION' && "Rétablit le statut à ACTIF et réactive le compte utilisateur lié au système."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Date d'effet <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={careerEventData.effective_date}
                    onChange={(e) => setCareerEventData({ ...careerEventData, effective_date: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-indigo-600 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    N° Décision / Réf. Arrêté
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : Arrêté N°2026/045/UK"
                    value={careerEventData.reference_decision}
                    onChange={(e) => setCareerEventData({ ...careerEventData, reference_decision: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold uppercase bg-white focus:ring-2 focus:ring-indigo-600 outline-hidden"
                  />
                </div>
              </div>

              {/* MUTATION FIELDS */}
              {careerEventData.event_type === 'MUTATION' && (
                <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nouveau Poste Institutionnel <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={careerEventData.position_id}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const pos = positionsList.find(p => String(p.id) === String(pid));
                        setCareerEventData({
                          ...careerEventData,
                          position_id: pid,
                          service_id: pos?.service_id ? String(pos.service_id) : careerEventData.service_id
                        });
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-600 outline-hidden"
                    >
                      <option value="">-- Sélectionner le nouveau poste --</option>
                      {positionsList.map(pos => (
                        <option key={pos.id} value={pos.id}>
                          {pos.title} ({pos.category}) {pos.current_holder_name ? `[Actuellement: ${pos.current_holder_name}]` : '[VACANT]'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Service / Département
                      </label>
                      <select
                        value={careerEventData.service_id}
                        onChange={(e) => setCareerEventData({ ...careerEventData, service_id: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-indigo-600 outline-hidden"
                      >
                        <option value="">-- Aucun service --</option>
                        {services.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Nouveau Rôle Système (Optionnel)
                      </label>
                      <select
                        value={careerEventData.role_id}
                        onChange={(e) => setCareerEventData({ ...careerEventData, role_id: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-indigo-600 outline-hidden"
                      >
                        <option value="">-- Conserver le rôle actuel --</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motif / Justification & Observations
                </label>
                <textarea
                  rows="2"
                  placeholder="Ex : Réorganisation des services, fin de mandat rectoral, réaffectation interne..."
                  value={careerEventData.motive}
                  onChange={(e) => setCareerEventData({ ...careerEventData, motive: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-600 outline-hidden"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCareerEventModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={careerEventLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-md flex items-center space-x-2"
                >
                  {careerEventLoading ? (
                    <span>Enregistrement en cours...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmer l'événement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE / EDIT INSTITUTIONAL POSITION                  */}
      {/* ============================================================ */}
      {showPositionModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-purple-200 animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-purple-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-purple-600" />
                <span>{positionFormData.id ? 'Modifier le Poste Institutionnel' : 'Créer un Nouveau Poste Institutionnel'}</span>
              </h3>
              <button onClick={() => setShowPositionModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {positionFormError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
                {positionFormError}
              </div>
            )}

            <form onSubmit={handleSavePosition} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Code Unique du Poste <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : RECTEUR, DOYEN_FAS..."
                    value={positionFormData.code}
                    onChange={(e) => setPositionFormData({ ...positionFormData, code: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold uppercase focus:ring-2 focus:ring-purple-600 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Catégorie <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={positionFormData.category}
                    onChange={(e) => setPositionFormData({ ...positionFormData, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-purple-600 outline-hidden"
                  >
                    <option value="DIRECTION">Direction & Rectorat</option>
                    <option value="FACULTE">Facultés & Décanats</option>
                    <option value="DEPARTEMENT">Départements</option>
                    <option value="SERVICE">Services Centraux</option>
                    <option value="ADMINISTRATIF">Administratif</option>
                    <option value="ENSEIGNEMENT">Enseignement / Recherche</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Intitulé Officiel du Poste <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Recteur de l'Université de Kindia"
                  value={positionFormData.title}
                  onChange={(e) => setPositionFormData({ ...positionFormData, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-purple-600 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Structure / Service associé
                  </label>
                  <select
                    value={positionFormData.service_id}
                    onChange={(e) => setPositionFormData({ ...positionFormData, service_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-600 outline-hidden"
                  >
                    <option value="">-- Université (Général) --</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Rang Hiérarchique (1 = Plus élevé)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={positionFormData.rank_order}
                    onChange={(e) => setPositionFormData({ ...positionFormData, rank_order: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-purple-600 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description / Attributions du poste
                </label>
                <textarea
                  rows="2"
                  placeholder="Ex : Direction exécutive de l'établissement..."
                  value={positionFormData.description}
                  onChange={(e) => setPositionFormData({ ...positionFormData, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-hidden"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPositionModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={positionFormLoading}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-md"
                >
                  {positionFormLoading ? 'Enregistrement...' : 'Enregistrer le poste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ADD PERSONAL VEHICLE TO STAFF                         */}
      {/* ============================================================ */}
      {showAddPersonalVehModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue flex items-center gap-2">
                <Car className="w-4 h-4 text-amber-600" />
                <span>Ajouter un véhicule personnel</span>
              </h3>
              <button onClick={() => setShowAddPersonalVehModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPersonalVehicle} className="space-y-3 text-xs">
              {personalVehError && (
                <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold">
                  {personalVehError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Immatriculation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : RC-1234-A"
                  value={newPersonalVehData.registration_number}
                  onChange={(e) => setNewPersonalVehData({ ...newPersonalVehData, registration_number: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold uppercase focus:ring-2 focus:ring-kindia-blue outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Marque</label>
                  <input
                    type="text"
                    placeholder="Ex : Toyota"
                    value={newPersonalVehData.brand}
                    onChange={(e) => setNewPersonalVehData({ ...newPersonalVehData, brand: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Modèle</label>
                  <input
                    type="text"
                    placeholder="Ex : Corolla"
                    value={newPersonalVehData.model}
                    onChange={(e) => setNewPersonalVehData({ ...newPersonalVehData, model: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Couleur</label>
                  <input
                    type="text"
                    placeholder="Ex : Grise"
                    value={newPersonalVehData.color}
                    onChange={(e) => setNewPersonalVehData({ ...newPersonalVehData, color: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Année</label>
                  <input
                    type="text"
                    placeholder="Ex : 2020"
                    value={newPersonalVehData.year}
                    onChange={(e) => setNewPersonalVehData({ ...newPersonalVehData, year: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddPersonalVehModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={personalVehLoading}
                  className="px-5 py-2 rounded-xl bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold transition shadow-md"
                >
                  {personalVehLoading ? 'Enregistrement...' : 'Ajouter le véhicule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ASSIGN FLEET SERVICE VEHICLE TO STAFF                 */}
      {/* ============================================================ */}
      {showAssignFleetVehModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Affecter un véhicule de service de l'Université</span>
              </h3>
              <button onClick={() => setShowAssignFleetVehModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignFleetVehicle} className="space-y-3 text-xs">
              {fleetAssignError && (
                <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold">
                  {fleetAssignError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Véhicule de service du Parc <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedFleetVehId}
                  onChange={(e) => {
                    setSelectedFleetVehId(e.target.value);
                    const veh = fleetVehiclesList.find(v => String(v.id) === e.target.value);
                    if (veh?.default_driver_id) {
                      setFleetAssignDriverId(String(veh.default_driver_id));
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                >
                  <option value="">-- Sélectionner un véhicule du parc ({fleetVehiclesList.length}) --</option>
                  {fleetVehiclesList.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.registration_number} — {v.brand || ''} {v.model || ''} ({v.status}) {v.assigned_staff_nom ? `[Actuellement affecté: ${v.assigned_staff_nom}]` : '[Disponible]'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chauffeur habituel associé (Optionnel)
                </label>
                <select
                  value={fleetAssignDriverId}
                  onChange={(e) => setFleetAssignDriverId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                >
                  <option value="">-- Aucun chauffeur habituel défini --</option>
                  {availableDriversList.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.prenoms} {d.nom} ({d.telephone || 'Sans tél'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motif ou Référence de l'affectation
                </label>
                <input
                  type="text"
                  placeholder="Ex : Décision Rectorale N°..."
                  value={fleetAssignReason}
                  onChange={(e) => setFleetAssignReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAssignFleetVehModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={fleetAssignLoading || !selectedFleetVehId}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md"
                >
                  {fleetAssignLoading ? 'Affectation...' : 'Affecter au personnel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ATTACH DRIVER TO STAFF                                */}
      {/* ============================================================ */}
      {showAttachDriverModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Rattacher un chauffeur au personnel</span>
              </h3>
              <button onClick={() => setShowAttachDriverModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAttachDriver} className="space-y-3 text-xs">
              {attachDriverError && (
                <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold">
                  {attachDriverError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Sélectionner un chauffeur enregistré <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                >
                  <option value="">-- Choisir un chauffeur ({availableDriversList.length}) --</option>
                  {availableDriversList.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.prenoms} {d.nom} ({d.telephone || 'Sans tél'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 font-bold text-slate-800 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={isDefaultDriverAttachment}
                    onChange={(e) => setIsDefaultDriverAttachment(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>Désigner comme chauffeur principal / par défaut de l'agent</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Observations / Notes
                </label>
                <input
                  type="text"
                  placeholder="Ex : Chauffeur attitré du Rectorat..."
                  value={driverAttachmentNotes}
                  onChange={(e) => setDriverAttachmentNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAttachDriverModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={attachDriverLoading || !selectedDriverId}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-md"
                >
                  {attachDriverLoading ? 'Rattachement...' : 'Rattacher le chauffeur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: MUTATION / NOUVELLE AFFECTATION D'UN AGENT             */}
      {/* ============================================================ */}
      {showMutationModal && viewingStaff && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                <span>Muter / Changer d'affectation : {viewingStaff.nom} {viewingStaff.prenoms}</span>
              </h3>
              <button onClick={() => setShowMutationModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Cette opération clôturera automatiquement le poste actuel et enregistrera le parcours dans l'historique administratif de l'agent sans modifier son identité.
            </p>

            {mutationError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
                {mutationError}
              </div>
            )}

            <form onSubmit={handleExecuteMutation} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nouveau Poste Institutionnel <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={mutationData.position_id}
                  onChange={(e) => {
                    const posId = e.target.value;
                    const pos = positionsList.find(p => String(p.id) === posId);
                    setMutationData({
                      ...mutationData,
                      position_id: posId,
                      service_id: pos?.service_id ? String(pos.service_id) : mutationData.service_id
                    });
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                >
                  <option value="">-- Sélectionner le poste ({positionsList.length}) --</option>
                  {positionsList.map(pos => (
                    <option key={pos.id} value={pos.id}>
                      {pos.code} — {pos.title} {pos.is_occupied ? `[Actuellement occupé]` : `[Vacant]`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Structure / Service d'affectation
                </label>
                <select
                  value={mutationData.service_id}
                  onChange={(e) => setMutationData({ ...mutationData, service_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                >
                  <option value="">-- Aucun service spécifique (Université globale) --</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Date d'effet / Début de prise de service <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={mutationData.start_date}
                  onChange={(e) => setMutationData({ ...mutationData, start_date: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Référence de la décision ou Arrêté de nomination
                </label>
                <input
                  type="text"
                  placeholder="Ex : Arrêté N°2026/045/RECT/UK"
                  value={mutationData.reference_decision}
                  onChange={(e) => setMutationData({ ...mutationData, reference_decision: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Observations / Notes administratives
                </label>
                <textarea
                  rows="2"
                  placeholder="Ex : Mutation suite au redéploiement des effectifs..."
                  value={mutationData.notes}
                  onChange={(e) => setMutationData({ ...mutationData, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowMutationModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={mutationLoading || !mutationData.position_id}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-md flex items-center space-x-1.5"
                >
                  {mutationLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>Valider la mutation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: TERMINATION D'AFFECTATION                              */}
      {/* ============================================================ */}
      {showTerminateModal && terminationTarget && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>Clôturer l'affectation : {terminationTarget.position_title}</span>
              </h3>
              <button onClick={() => setShowTerminateModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Cette action libérera le poste qui redeviendra <strong>VACANT</strong>. La date de fin sera consignée dans le dossier de l'agent.
            </p>

            {terminationError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
                {terminationError}
              </div>
            )}

            <form onSubmit={handleExecuteTermination} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Date de fin de fonction <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={terminationData.end_date}
                  onChange={(e) => setTerminationData({ ...terminationData, end_date: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motif de fin de fonction / Décision
                </label>
                <textarea
                  rows="2"
                  placeholder="Ex : Fin de mandat rectoral, mise en disponibilité..."
                  value={terminationData.notes}
                  onChange={(e) => setTerminationData({ ...terminationData, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTerminateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={terminationLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-md flex items-center space-x-1.5"
                >
                  {terminationLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>Confirmer la libération du poste</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: INSTITUTIONAL POSITION CRUD                           */}
      {/* ============================================================ */}
      {showPositionModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-purple-600" />
                <span>{positionFormData.id ? 'Modifier le Poste Institutionnel' : 'Nouveau Poste Institutionnel'}</span>
              </h3>
              <button onClick={() => setShowPositionModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {positionFormError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
                {positionFormError}
              </div>
            )}

            <form onSubmit={handleSavePosition} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Code Unique du Poste <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : RECTEUR, SEC_GENERAL"
                    value={positionFormData.code}
                    onChange={(e) => setPositionFormData({ ...positionFormData, code: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Catégorie Institutionnelle <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={positionFormData.category}
                    onChange={(e) => setPositionFormData({ ...positionFormData, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  >
                    <option value="DIRECTION">Direction & Rectorat</option>
                    <option value="FACULTE">Faculté & Décanat</option>
                    <option value="DEPARTEMENT">Département</option>
                    <option value="SERVICE">Service Central</option>
                    <option value="ADMINISTRATIF">Administratif</option>
                    <option value="ENSEIGNEMENT">Enseignement & Recherche</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Intitulé / Titre officiel du Poste <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Recteur de l'Université, Chef de Service de la Scolarité..."
                  value={positionFormData.title}
                  onChange={(e) => setPositionFormData({ ...positionFormData, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-kindia-blue outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Structure / Service de rattachement
                  </label>
                  <select
                    value={positionFormData.service_id}
                    onChange={(e) => setPositionFormData({ ...positionFormData, service_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  >
                    <option value="">-- Aucun (Niveau Université globale) --</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Rang de préséance hiérarchique
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={positionFormData.rank_order}
                    onChange={(e) => setPositionFormData({ ...positionFormData, rank_order: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-kindia-blue outline-hidden"
                    title="1 = Recteur, 2 = VRE/VRF, 3 = Secrétaire Général, 10 = Chef de service..."
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description / Attributions du Poste
                </label>
                <textarea
                  rows="2"
                  placeholder="Ex : Direction stratégique et administrative de l'institution..."
                  value={positionFormData.description}
                  onChange={(e) => setPositionFormData({ ...positionFormData, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPositionModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={positionFormLoading}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-md flex items-center space-x-1.5"
                >
                  {positionFormLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>{positionFormData.id ? 'Enregistrer les modifications' : 'Créer le poste'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 6: DELETE CONFIRMATION                                 */}
      {/* ============================================================ */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-heading font-extrabold text-base text-slate-900">
                Supprimer {deletingStaff.nom} {deletingStaff.prenoms} ?
              </h3>
              <p className="text-xs text-slate-600">
                Cette action supprimera la fiche du répertoire. Les documents et ordres de mission historiques signés par cet agent resteront scellés et valides.
              </p>
            </div>

            {deletingStaff.user_id && (
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900">
                <label className="flex items-center space-x-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteLinkedUser}
                    onChange={(e) => setDeleteLinkedUser(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Supprimer également le compte d'accès utilisateur UK-GED</span>
                </label>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setDeletingStaff(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteStaff}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

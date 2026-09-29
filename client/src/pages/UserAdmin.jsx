import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { STANDARD_POSTES, isChefPosition } from '../constants/postes';
import { 
  Users, Plus, Edit, Power, X, Award, Check, Shield, Key, Lock, 
  Laptop, CheckCircle2, AlertCircle, Copy, Trash2, AlertOctagon, 
  Building, Camera, Upload, Image as ImageIcon 
} from 'lucide-react';
import { handleGuineaPhoneChange } from '../utils/phoneUtils';
import { formatFullName } from '../utils/userUtils';

export default function UserAdmin() {
  const { refreshUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tab view: 'ALL' | 'CHEFS_SERVICE'
  const [activeTab, setActiveTab] = useState('CHEFS_SERVICE');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [securityUser, setSecurityUser] = useState(null);
  const [securityInfo, setSecurityInfo] = useState(null);
  const [generatedTempPassword, setGeneratedTempPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMsg, setSecurityMsg] = useState({ type: '', text: '' });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [serviceChefConflict, setServiceChefConflict] = useState(null);

  // Profile Photo state
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [quickPhotoUser, setQuickPhotoUser] = useState(null);
  const [quickPhotoFile, setQuickPhotoFile] = useState(null);
  const [quickPhotoPreview, setQuickPhotoPreview] = useState(null);
  const [quickPhotoLoading, setQuickPhotoLoading] = useState(false);
  const [quickPhotoMsg, setQuickPhotoMsg] = useState({ type: '', text: '' });

  // Form State for Create & Edit
  const [matricule, setMatricule] = useState('');
  const [titre, setTitre] = useState('M.');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPoste, setSelectedPoste] = useState('');
  const [functionTitle, setFunctionTitle] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [selectedAttachmentId, setSelectedAttachmentId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [isChefService, setIsChefService] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const u = await api.getUsers();
      setUsers(u);
      const s = await api.getServices();
      setServices(s.filter(srv => srv.status === 'ACTIVE'));
      const r = await api.getRoles();
      setRoles(r);
    } catch (err) {
      console.error('Failed to load users data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Base Structures (Niveau 1 : parent_id est null)
  const baseStructures = useMemo(() => {
    return services
      .filter(s => !s.parent_id || s.code === 'UK' || s.structure_type === 'UNIVERSITE')
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
  }, [services]);

  // Structures de rattachement (Niveau 2 : filles de la structure choisie)
  const attachmentOptions = useMemo(() => {
    if (!selectedStructureId) return [];
    const structId = Number(selectedStructureId);
    return services
      .filter(s => s.parent_id === structId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
  }, [services, selectedStructureId]);

  // Unités / Services inférieurs (Niveau 3 : filles du rattachement choisi)
  const unitOptions = useMemo(() => {
    if (!selectedAttachmentId) return [];
    const attId = Number(selectedAttachmentId);
    return services
      .filter(s => s.parent_id === attId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
  }, [services, selectedAttachmentId]);

  // Synchronisation du serviceId effectif
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
      const isTargetingChef = isChefPosition(functionTitle, roleCode, isChefService);

      if (!isTargetingChef) {
        setServiceChefConflict(null);
        return;
      }

      // Check local users list first
      const localChef = users.find(u =>
        String(u.service_id) === String(serviceId) &&
        String(u.id) !== String(editingUser?.id) &&
        u.status === 'ACTIVE' &&
        isChefPosition(u.function_title, u.role_code, u.role_code === 'CHEF_SERVICE')
      );

      if (localChef) {
        const srv = services.find(s => String(s.id) === String(serviceId));
        setServiceChefConflict({
          has_chef: true,
          chef_name: `${localChef.first_name || ''} ${localChef.last_name || ''}`.trim(),
          chef_matricule: localChef.matricule || 'N/A',
          service_name: srv?.name || 'Service sélectionné'
        });
        return;
      }

      // Server preflight
      try {
        const res = await api.checkServiceChef({
          service_id: serviceId,
          exclude_user_id: editingUser?.id || undefined
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
        console.warn('Chef check error in UserAdmin:', err);
      }
    };

    checkConflict();
    return () => { isCancelled = true; };
  }, [serviceId, functionTitle, roleId, isChefService, editingUser, users, services, roles]);

  const getUserPhotoUrl = (photoPath, timestamp) => {
    if (!photoPath) return null;
    const clean = photoPath.split('?')[0];
    return `${clean}${timestamp ? `?t=${timestamp}` : ''}`;
  };

  const handlePhotoFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('La taille de l’image ne doit pas dépasser 5 Mo.');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = async () => {
    if (photoFile) {
      setPhotoFile(null);
      setPhotoPreview(editingUser?.photo_path ? getUserPhotoUrl(editingUser.photo_path) : null);
      return;
    }
    if (editingUser?.photo_path) {
      if (!window.confirm('Voulez-vous vraiment supprimer la photo de profil de cet utilisateur ?')) return;
      try {
        setPhotoUploading(true);
        await api.deleteUserPhoto(editingUser.id);
        setPhotoPreview(null);
        setEditingUser(prev => ({ ...prev, photo_path: null }));
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, photo_path: null } : u));
        setSuccessMsg('Photo de profil supprimée avec succès.');
        if (refreshUser) refreshUser();
      } catch (err) {
        setError(err.message || 'Erreur lors de la suppression de la photo.');
      } finally {
        setPhotoUploading(false);
      }
    }
  };

  // Quick Photo Modal Handlers
  const openQuickPhotoModal = (u) => {
    setQuickPhotoUser(u);
    setQuickPhotoFile(null);
    setQuickPhotoPreview(u.photo_path ? getUserPhotoUrl(u.photo_path) : null);
    setQuickPhotoMsg({ type: '', text: '' });
    setQuickPhotoLoading(false);
  };

  const handleQuickPhotoFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setQuickPhotoMsg({ type: 'error', text: 'Format de fichier invalide (JPG, PNG, WEBP requis).' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setQuickPhotoMsg({ type: 'error', text: 'La taille maximale autorisée est de 5 Mo.' });
        return;
      }
      setQuickPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setQuickPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickPhotoSave = async () => {
    if (!quickPhotoUser || !quickPhotoFile) return;
    setQuickPhotoLoading(true);
    setQuickPhotoMsg({ type: '', text: '' });

    try {
      const res = await api.uploadUserPhoto(quickPhotoUser.id, quickPhotoFile);
      const newPath = res.photo_url || res.photo_path;
      setUsers(prev => prev.map(u => u.id === quickPhotoUser.id ? { ...u, photo_path: newPath } : u));
      setQuickPhotoUser(prev => ({ ...prev, photo_path: newPath }));
      setQuickPhotoMsg({ type: 'success', text: 'Photo de profil enregistrée avec succès !' });
      setQuickPhotoFile(null);
      if (refreshUser) refreshUser();
      setTimeout(() => {
        setQuickPhotoUser(null);
        loadData();
      }, 1200);
    } catch (err) {
      setQuickPhotoMsg({ type: 'error', text: err.message || 'Erreur lors de l’envoi de la photo.' });
    } finally {
      setQuickPhotoLoading(false);
    }
  };

  const handleQuickPhotoDelete = async () => {
    if (!quickPhotoUser) return;
    if (!window.confirm(`Confirmez-vous la suppression de la photo de profil de ${formatFullName(quickPhotoUser)} ?`)) return;

    setQuickPhotoLoading(true);
    setQuickPhotoMsg({ type: '', text: '' });

    try {
      await api.deleteUserPhoto(quickPhotoUser.id);
      setUsers(prev => prev.map(u => u.id === quickPhotoUser.id ? { ...u, photo_path: null } : u));
      setQuickPhotoUser(prev => ({ ...prev, photo_path: null }));
      setQuickPhotoPreview(null);
      setQuickPhotoFile(null);
      setQuickPhotoMsg({ type: 'success', text: 'Photo de profil supprimée.' });
      if (refreshUser) refreshUser();
      setTimeout(() => {
        setQuickPhotoUser(null);
        loadData();
      }, 1000);
    } catch (err) {
      setQuickPhotoMsg({ type: 'error', text: err.message || 'Erreur lors de la suppression.' });
    } finally {
      setQuickPhotoLoading(false);
    }
  };

  const openCreateModal = () => {
    resetForm();
    if (activeTab === 'CHEFS_SERVICE') {
      const chefRole = roles.find(r => r.code === 'CHEF_SERVICE');
      if (chefRole) setRoleId(String(chefRole.id));
      setIsChefService(true);
      setSelectedPoste('Chef de Service');
      setFunctionTitle('Chef de Service');
    }
    setShowCreateModal(true);
  };

  const openEditModal = (u) => {
    setError('');
    setSuccessMsg('');
    setEditingUser(u);
    setPhotoFile(null);
    setPhotoPreview(u.photo_path ? getUserPhotoUrl(u.photo_path) : null);
    setMatricule(u.matricule || '');
    setTitre(u.titre || 'M.');
    setFirstName(u.first_name || '');
    setLastName(u.last_name || '');
    setEmail(u.email || '');
    setPhone(u.phone || '');
    
    const foundPoste = STANDARD_POSTES.find(p => p.value.toLowerCase() === (u.function_title || '').trim().toLowerCase());
    if (foundPoste) {
      setSelectedPoste(foundPoste.value);
    } else {
      setSelectedPoste('AUTRE');
    }
    setFunctionTitle(u.function_title || '');
    setServiceId(String(u.service_id || ''));

    // Déduction automatique de l'arborescence (Structure -> Rattachement -> Unité)
    if (u.service_id) {
      const sId = Number(u.service_id);
      const currentSrv = services.find(s => s.id === sId);
      if (currentSrv) {
        if (currentSrv.parent_id) {
          const parentSrv = services.find(s => s.id === currentSrv.parent_id);
          if (parentSrv && parentSrv.parent_id) {
            setSelectedStructureId(String(parentSrv.parent_id));
            setSelectedAttachmentId(String(parentSrv.id));
            setSelectedUnitId(String(currentSrv.id));
          } else if (parentSrv) {
            setSelectedStructureId(String(parentSrv.id));
            setSelectedAttachmentId(String(currentSrv.id));
            setSelectedUnitId('');
          } else {
            setSelectedStructureId(String(currentSrv.id));
            setSelectedAttachmentId('');
            setSelectedUnitId('');
          }
        } else {
          setSelectedStructureId(String(currentSrv.id));
          setSelectedAttachmentId('');
          setSelectedUnitId('');
        }
      } else {
        setSelectedStructureId(String(u.service_id));
        setSelectedAttachmentId('');
        setSelectedUnitId('');
      }
    } else {
      setSelectedStructureId('');
      setSelectedAttachmentId('');
      setSelectedUnitId('');
    }

    setRoleId(String(u.role_id || ''));
    setStatus(u.status || 'ACTIVE');
    setIsChefService(u.role_code === 'CHEF_SERVICE');
    setServiceChefConflict(null);
  };

  const openSecurityModal = async (u) => {
    setSecurityUser(u);
    setSecurityInfo(null);
    setGeneratedTempPassword('');
    setSecurityMsg({ type: '', text: '' });
    setCopied(false);
    setSecurityLoading(true);

    try {
      const info = await api.getUserSecurityInfo(u.id);
      setSecurityInfo(info);
    } catch (err) {
      console.error('Failed to load user security info:', err);
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleAdminResetPassword = async () => {
    if (!securityUser) return;
    const formattedName = formatFullName(securityUser);
    if (!window.confirm(`Confirmez-vous la réinitialisation du mot de passe de ${formattedName} ? Un mot de passe temporaire sera généré et ses sessions actives seront déconnectées.`)) {
      return;
    }

    setSecurityLoading(true);
    setSecurityMsg({ type: '', text: '' });
    setGeneratedTempPassword('');

    try {
      const res = await api.adminResetUserPassword(securityUser.id);
      setGeneratedTempPassword(res.temporaryPassword);
      setSecurityMsg({ type: 'success', text: 'Mot de passe temporaire généré avec succès ! Transmettez-le de manière confidentielle à l’utilisateur.' });
      const info = await api.getUserSecurityInfo(securityUser.id);
      setSecurityInfo(info);
    } catch (err) {
      setSecurityMsg({ type: 'error', text: err.message || 'Erreur lors de la réinitialisation.' });
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleAdminRevokeSessions = async () => {
    if (!securityUser) return;
    const formattedName = formatFullName(securityUser);
    if (!window.confirm(`Voulez-vous déconnecter immédiatement toutes les sessions actives de ${formattedName} ?`)) {
      return;
    }

    setSecurityLoading(true);
    setSecurityMsg({ type: '', text: '' });

    try {
      await api.adminRevokeUserSessions(securityUser.id);
      setSecurityMsg({ type: 'success', text: 'Toutes les sessions de l’utilisateur ont été révoquées.' });
      const info = await api.getUserSecurityInfo(securityUser.id);
      setSecurityInfo(info);
    } catch (err) {
      setSecurityMsg({ type: 'error', text: err.message || 'Erreur lors de la révocation des sessions.' });
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleCopyPassword = () => {
    if (generatedTempPassword) {
      navigator.clipboard.writeText(generatedTempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const resetForm = () => {
    setError('');
    setSuccessMsg('');
    setEditingUser(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoUploading(false);
    setMatricule('');
    setTitre('M.');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setSelectedPoste('');
    setFunctionTitle('');
    setServiceId('');
    setSelectedStructureId('');
    setSelectedAttachmentId('');
    setSelectedUnitId('');
    setRoleId('');
    setStatus('ACTIVE');
    setIsChefService(false);
    setPassword('');
    setServiceChefConflict(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    // Block duplicate Chef de Service
    const selectedRole = roles.find(r => String(r.id) === String(roleId));
    const roleCode = selectedRole?.code;
    const isTargetingChef = isChefPosition(functionTitle, roleCode, isChefService);

    if (serviceId && isTargetingChef) {
      if (serviceChefConflict?.has_chef) {
        setError(`⛔ Enregistrement refusé : Le service "${serviceChefConflict.service_name}" possède déjà un Chef de Service actif (${serviceChefConflict.chef_name}, Matricule: ${serviceChefConflict.chef_matricule}).`);
        return;
      }

      try {
        const checkRes = await api.checkServiceChef({
          service_id: serviceId
        });
        if (checkRes.has_chef) {
          setServiceChefConflict(checkRes);
          setError(`⛔ Enregistrement refusé : Le service "${checkRes.service_name}" possède déjà un Chef de Service actif (${checkRes.chef_name}, Matricule: ${checkRes.chef_matricule}).`);
          return;
        }
      } catch (err) {
        console.warn('Preflight chef check error:', err);
      }
    }

    try {
      const createdRes = await api.createUser({
        matricule,
        titre,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        function_title: functionTitle,
        service_id: serviceId,
        role_id: roleId,
        password,
        is_chef_service: isChefService
      });

      if (photoFile && createdRes?.id) {
        try {
          await api.uploadUserPhoto(createdRes.id, photoFile);
        } catch (photoErr) {
          console.warn('Could not upload photo on create:', photoErr);
        }
      }

      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la création.');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Block duplicate Chef de Service
    const selectedRole = roles.find(r => String(r.id) === String(roleId));
    const roleCode = selectedRole?.code;
    const isTargetingChef = isChefPosition(functionTitle, roleCode, isChefService);

    if (serviceId && isTargetingChef) {
      if (serviceChefConflict?.has_chef) {
        setError(`⛔ Enregistrement refusé : Le service "${serviceChefConflict.service_name}" possède déjà un Chef de Service actif (${serviceChefConflict.chef_name}, Matricule: ${serviceChefConflict.chef_matricule}).`);
        return;
      }

      try {
        const checkRes = await api.checkServiceChef({
          service_id: serviceId,
          exclude_user_id: editingUser.id
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

    try {
      const res = await api.updateUser(editingUser.id, {
        matricule,
        titre,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        function_title: functionTitle,
        service_id: parseInt(serviceId),
        role_id: parseInt(roleId),
        status,
        is_chef_service: isChefService
      });

      if (photoFile) {
        try {
          await api.uploadUserPhoto(editingUser.id, photoFile);
        } catch (photoErr) {
          console.warn('Could not upload photo on update:', photoErr);
        }
      }

      setSuccessMsg(`Modifications enregistrées avec succès (${res.changesCount || 0} champs modifiés et inscrits dans l'audit).`);
      if (refreshUser) refreshUser();
      setTimeout(() => {
        setEditingUser(null);
        resetForm();
        loadData();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Erreur lors de la modification.');
    }
  };

  const handleToggleStatus = async (userObj) => {
    const nextStatus = userObj.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const formattedName = formatFullName(userObj);
    if (!window.confirm(`Confirmez-vous le passage du statut de ${formattedName} à ${nextStatus} ?`)) return;

    try {
      await api.toggleUserStatus(userObj.id, nextStatus);
      if (refreshUser) refreshUser();
      loadData();
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  const handleDeleteUser = async (userObj) => {
    if (userObj.id === 1) {
      alert("Le compte administrateur principal système ne peut pas être supprimé.");
      return;
    }

    const userName = formatFullName(userObj) || userObj.matricule || 'cet utilisateur';
    if (!window.confirm(`⚠️ SUPPRESSION DÉFINITIVE D'UTILISATEUR\n\nÊtes-vous sûr de vouloir supprimer définitivement le compte de : ${userName} (Matricule: ${userObj.matricule || 'N/A'}, Email: ${userObj.email}) ?\n\nCette action supprimera également sa fiche associée dans le répertoire du personnel.`)) {
      return;
    }

    try {
      await api.deleteUser(userObj.id);
      setSuccessMsg(`Compte utilisateur [${userName}] supprimé avec succès.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadData();
    } catch (err) {
      alert('Erreur lors de la suppression : ' + err.message);
    }
  };

  const filteredUsers = users.filter(u => {
    if (activeTab === 'CHEFS_SERVICE') {
      return u.role_code === 'CHEF_SERVICE' || u.function_title.toLowerCase().includes('chef') || u.function_title.toLowerCase().includes('directeur');
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-kindia-blue text-white flex items-center justify-center font-bold shadow">
            <Users className="w-5 h-5 text-kindia-gold" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-800">
              Administration — Utilisateurs & Chefs de service
            </h2>
            <p className="text-xs text-slate-500">
              Gestion des informations, fonctions, affectations aux 30 services et journal d’audit
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4 text-kindia-gold" />
          <span>Créer un Utilisateur / Chef</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-xl flex items-center space-x-2 border border-emerald-200 shadow-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveTab('CHEFS_SERVICE')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'CHEFS_SERVICE'
              ? 'border-kindia-blue text-kindia-blue bg-white shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award className="w-4 h-4 text-kindia-gold" />
          <span>Chefs de Service ({users.filter(u => u.role_code === 'CHEF_SERVICE' || u.function_title.toLowerCase().includes('chef') || u.function_title.toLowerCase().includes('directeur')).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'ALL'
              ? 'border-kindia-blue text-kindia-blue bg-white shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Tous les Personnels ({users.length})</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Utilisateur (Photo & Nom)</th>
                <th className="p-3.5">Email / Téléphone</th>
                <th className="p-3.5">Fonction</th>
                <th className="p-3.5">Service</th>
                <th className="p-3.5">Rôle RBAC</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Chargement des utilisateurs...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Aucun utilisateur trouvé.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="relative group/avatar cursor-pointer shrink-0"
                          onClick={() => openQuickPhotoModal(u)}
                          title="Cliquer pour changer la photo de profil"
                        >
                          {u.photo_path ? (
                            <img 
                              src={getUserPhotoUrl(u.photo_path)} 
                              alt={`${u.first_name} ${u.last_name}`} 
                              className="w-10 h-10 rounded-xl object-cover border-2 border-slate-200 group-hover/avatar:border-kindia-blue shadow-xs transition"
                              onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div 
                            className={`w-10 h-10 rounded-xl bg-kindia-blue text-white font-black text-xs items-center justify-center border-2 border-slate-200 group-hover/avatar:border-kindia-gold shadow-xs transition ${u.photo_path ? 'hidden' : 'flex'}`}
                          >
                            {u.first_name ? u.first_name[0].toUpperCase() : 'U'}{u.last_name ? u.last_name[0].toUpperCase() : ''}
                          </div>
                          <div className="absolute inset-0 bg-slate-900/60 rounded-xl opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white transition">
                            <Camera className="w-4 h-4 text-kindia-gold" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{formatFullName(u)}</span>
                            {u.role_code === 'CHEF_SERVICE' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-kindia-gold/20 text-kindia-blue font-extrabold uppercase">Chef</span>
                            )}
                          </div>
                          <span className="text-[10px] text-kindia-blue font-bold font-mono block">{u.matricule}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {u.email} <span className="block text-[10px] text-slate-400">{u.phone || 'Non renseigné'}</span>
                    </td>
                    <td className="p-3.5 text-slate-700 font-semibold">{u.function_title}</td>
                    <td className="p-3.5 font-bold text-slate-800">{u.service_name}</td>
                    <td className="p-3.5 font-semibold text-kindia-gold">{u.role_name}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => openQuickPhotoModal(u)}
                        className="p-1.5 rounded-lg bg-blue-50 text-kindia-blue hover:bg-kindia-blue hover:text-white transition"
                        title="Mettre à jour la photo de profil"
                      >
                        <Camera className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => openSecurityModal(u)}
                        className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition"
                        title="Sécurité du compte, mot de passe et sessions"
                      >
                        <Key className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1.5 rounded-lg bg-kindia-blue/10 text-kindia-blue hover:bg-kindia-blue hover:text-white transition"
                        title="Modifier les informations du chef/utilisateur"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`p-1.5 rounded-lg transition ${u.status === 'ACTIVE' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                        title={u.status === 'ACTIVE' ? 'Désactiver le compte' : 'Activer le compte'}
                      >
                        <Power className="w-4 h-4" />
                      </button>

                      {u.id !== 1 && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition"
                          title="Supprimer définitivement l'utilisateur et son doublon"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Edit User / Chef de Service Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar border border-slate-200">
            <div className="bg-kindia-blue p-5 text-white flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-kindia-gold" />
                <h3 className="font-heading font-bold text-sm">
                  Modifier {editingUser.role_code === 'CHEF_SERVICE' ? 'le Chef de service' : 'l’Utilisateur'}
                </h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4 text-xs">
              {error && <div className="p-3 bg-red-50 text-red-700 font-semibold rounded-xl">{error}</div>}
              {successMsg && <div className="p-3 bg-emerald-50 text-emerald-800 font-bold rounded-xl flex items-center space-x-2"><Check className="w-4 h-4" /><span>{successMsg}</span></div>}

              {/* Profile Photo Upload Zone in Edit Modal */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white border-2 border-slate-300 shadow-sm shrink-0 flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-kindia-blue/10 flex flex-col items-center justify-center text-kindia-blue">
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-400 mt-1">Sans photo</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1.5 text-left w-full">
                  <label className="block font-bold text-slate-800 text-xs">Photo de profil officielle</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer px-3 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center space-x-1.5">
                      <Camera className="w-3.5 h-3.5 text-kindia-gold" />
                      <span>{photoPreview ? 'Changer la photo' : 'Ajouter une photo'}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoFileSelect} className="hidden" />
                    </label>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={photoUploading}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-semibold text-xs border border-rose-200 transition flex items-center space-x-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">JPG, PNG ou WEBP (Max 5 Mo). Portrait carré recommandé.</p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Titre / Grade Universitaire & Administratif *</label>
                <select value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-kindia-blue bg-white">
                  <option value="M.">M. (Monsieur)</option>
                  <option value="Mme">Mme (Madame)</option>
                  <option value="Mlle">Mlle (Mademoiselle)</option>
                  <option value="Dr">Dr (Docteur)</option>
                  <option value="Dre">Dre (Docteure)</option>
                  <option value="Pr">Pr (Professeur)</option>
                  <option value="Pr Titulaire">Pr Titulaire (Professeur Titulaire)</option>
                  <option value="MCF">MCF (Maître de Conférences)</option>
                  <option value="MA">MA (Maître-Assistant)</option>
                  <option value="Ing.">Ing. (Ingénieur)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prénom *</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nom *</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Matricule *</label>
                  <input type="text" value={matricule} onChange={(e) => setMatricule(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Poste / Fonction officielle *</label>
                  <input
                    type="text"
                    value={functionTitle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFunctionTitle(val);
                      const isChef = isChefPosition(val, null, false);
                      setIsChefService(isChef);
                      if (isChef && !roleId) {
                        const chefRole = roles.find(r => r.code === 'CHEF_SERVICE');
                        if (chefRole) setRoleId(String(chefRole.id));
                      }
                    }}
                    placeholder="Ex : Agent Administratif, Secrétaire, Chef de Service..."
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Conflict Alert in Edit Modal */}
              {serviceChefConflict?.has_chef && (
                <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-2xl text-red-900 text-xs flex items-start space-x-3 shadow-xs animate-in fade-in duration-200">
                  <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-extrabold text-red-800">
                      Poste Chef de Service déjà pourvu pour ce service !
                    </div>
                    <p className="text-[11px] text-red-700 leading-relaxed">
                      La structure <strong>{serviceChefConflict.service_name}</strong> possède déjà un Chef de Service actif : <strong className="underline">{serviceChefConflict.chef_name}</strong> {serviceChefConflict.chef_matricule ? `(Matricule: ${serviceChefConflict.chef_matricule})` : ''}.
                    </p>
                    <p className="text-[10px] text-red-600 font-bold">
                      ⛔ Règle : Un service ne peut avoir qu'un seul Chef de Service.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Professionnel *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone (+224)</label>
                  <input type="tel" value={phone} onChange={(e) => handleGuineaPhoneChange(e, setPhone)} placeholder="+224 6XX XX XX XX" className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-semibold focus:ring-2 focus:ring-kindia-blue" />
                </div>
              </div>

              {/* Hierarchical Organizational Assignment Selector */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-200">
                  <Building className="w-4 h-4 text-kindia-blue" />
                  <span className="font-bold text-xs text-slate-800">Affectation Organisationnelle</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Structure *</label>
                    <select
                      value={selectedStructureId}
                      onChange={(e) => {
                        setSelectedStructureId(e.target.value);
                        setSelectedAttachmentId('');
                        setSelectedUnitId('');
                      }}
                      required
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-kindia-blue"
                    >
                      <option value="">-- Sélectionner une structure --</option>
                      {baseStructures.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Structure de rattachement</label>
                    <select
                      value={selectedAttachmentId}
                      disabled={!selectedStructureId || attachmentOptions.length === 0}
                      onChange={(e) => {
                        setSelectedAttachmentId(e.target.value);
                        setSelectedUnitId('');
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-kindia-blue disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">
                        {!selectedStructureId ? "Sélectionnez d'abord une structure" : attachmentOptions.length === 0 ? "Aucun rattachement (affectation directe)" : "-- Choisir un rattachement --"}
                      </option>
                      {attachmentOptions.map(att => (
                        <option key={att.id} value={att.id}>➜ {att.name} {att.code ? `(${att.code})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {selectedAttachmentId && unitOptions.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Unité / Service / Département</label>
                      <select
                        value={selectedUnitId}
                        onChange={(e) => setSelectedUnitId(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-kindia-blue"
                      >
                        <option value="">-- Affectation au rattachement ou choisir une unité ({unitOptions.length}) --</option>
                        {unitOptions.map(u => (
                          <option key={u.id} value={u.id}>↳ {u.name} {u.code ? `(${u.code})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Case à cocher : Désigné comme chef de ce Poste */}
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
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
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                            ⭐ Responsable officiel
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Rôle RBAC *</label>
                <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue font-bold">
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Statut du Compte</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-bold">
                    <option value="ACTIVE">Actif (Accès autorisé)</option>
                    <option value="INACTIVE">Inactif (Accès désactivé)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={isChefService} onChange={(e) => setIsChefService(e.target.checked)} className="w-4 h-4 rounded text-kindia-blue focus:ring-kindia-blue" />
                    <span className="font-bold text-slate-700 text-xs">Désigner comme Chef de service officiel</span>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500">
                💡 Toute modification importante génère automatiquement une entrée dans le journal d'audit conformément à la règle d'imputabilité (`users.manage_service_heads`).
              </div>

              <div className="pt-4 flex justify-end space-x-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 font-semibold text-slate-600">Annuler</button>
                <button type="submit" className="px-5 py-2.5 bg-kindia-blue text-white font-bold rounded-xl shadow-lg hover:bg-kindia-lightBlue">Enregistrer & Archiver Audit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar border border-slate-200">
            <div className="bg-kindia-blue p-5 text-white flex justify-between items-center sticky top-0 z-10">
              <h3 className="font-heading font-bold text-sm">Créer un Nouvel Utilisateur / Chef de Service</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-3 text-xs">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl font-semibold">{error}</div>}

              {/* Profile Photo Upload Zone in Create Modal */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white border-2 border-slate-300 shadow-sm shrink-0 flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-kindia-blue/10 flex flex-col items-center justify-center text-kindia-blue">
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-400 mt-1">Optionnelle</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1.5 text-left w-full">
                  <label className="block font-bold text-slate-800 text-xs">Photo de profil officielle</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer px-3 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center space-x-1.5">
                      <Camera className="w-3.5 h-3.5 text-kindia-gold" />
                      <span>{photoPreview ? 'Changer la photo' : 'Sélectionner une photo'}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoFileSelect} className="hidden" />
                    </label>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-semibold text-xs border border-rose-200 transition flex items-center space-x-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Retirer</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">JPG, PNG ou WEBP (Max 5 Mo). Portrait carré recommandé.</p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Titre / Grade Universitaire & Administratif *</label>
                <select value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-bold bg-white">
                  <option value="M.">M. (Monsieur)</option>
                  <option value="Mme">Mme (Madame)</option>
                  <option value="Mlle">Mlle (Mademoiselle)</option>
                  <option value="Dr">Dr (Docteur)</option>
                  <option value="Dre">Dre (Docteure)</option>
                  <option value="Pr">Pr (Professeur)</option>
                  <option value="Pr Titulaire">Pr Titulaire (Professeur Titulaire)</option>
                  <option value="MCF">MCF (Maître de Conférences)</option>
                  <option value="MA">MA (Maître-Assistant)</option>
                  <option value="Ing.">Ing. (Ingénieur)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Matricule *</label>
                  <input type="text" value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="UK-DAF-010" required className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Professionnel *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="chef@univ-kindia.edu.gn" required className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prénom *</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nom *</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Poste / Fonction officielle *</label>
                  <input
                    type="text"
                    value={functionTitle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFunctionTitle(val);
                      const isChef = isChefPosition(val, null, false);
                      setIsChefService(isChef);
                      if (isChef && !roleId) {
                        const chefRole = roles.find(r => r.code === 'CHEF_SERVICE');
                        if (chefRole) setRoleId(String(chefRole.id));
                      }
                    }}
                    placeholder="Ex : Agent Administratif, Secrétaire, Chef de Service..."
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone (+224)</label>
                  <input type="tel" value={phone} onChange={(e) => handleGuineaPhoneChange(e, setPhone)} placeholder="+224 6XX XX XX XX" className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-semibold" />
                </div>
              </div>

              {/* Conflict Alert in Create Modal */}
              {serviceChefConflict?.has_chef && (
                <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-2xl text-red-900 text-xs flex items-start space-x-3 shadow-xs animate-in fade-in duration-200">
                  <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-extrabold text-red-800">
                      Poste Chef de Service déjà pourvu pour ce service !
                    </div>
                    <p className="text-[11px] text-red-700 leading-relaxed">
                      La structure <strong>{serviceChefConflict.service_name}</strong> possède déjà un Chef de Service actif : <strong className="underline">{serviceChefConflict.chef_name}</strong> {serviceChefConflict.chef_matricule ? `(Matricule: ${serviceChefConflict.chef_matricule})` : ''}.
                    </p>
                    <p className="text-[10px] text-red-600 font-bold">
                      ⛔ Règle : Un service ne peut avoir qu'un seul Chef de Service. L'enregistrement sera refusé.
                    </p>
                  </div>
                </div>
              )}

              {/* Hierarchical Organizational Assignment Selector */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-200">
                  <Building className="w-4 h-4 text-kindia-blue" />
                  <span className="font-bold text-xs text-slate-800">Affectation Organisationnelle</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Structure *</label>
                    <select
                      value={selectedStructureId}
                      onChange={(e) => {
                        setSelectedStructureId(e.target.value);
                        setSelectedAttachmentId('');
                        setSelectedUnitId('');
                      }}
                      required
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800"
                    >
                      <option value="">-- Sélectionner une structure --</option>
                      {baseStructures.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Structure de rattachement</label>
                    <select
                      value={selectedAttachmentId}
                      disabled={!selectedStructureId || attachmentOptions.length === 0}
                      onChange={(e) => {
                        setSelectedAttachmentId(e.target.value);
                        setSelectedUnitId('');
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">
                        {!selectedStructureId ? "Sélectionnez d'abord une structure" : attachmentOptions.length === 0 ? "Aucun rattachement (affectation directe)" : "-- Choisir un rattachement --"}
                      </option>
                      {attachmentOptions.map(att => (
                        <option key={att.id} value={att.id}>➜ {att.name} {att.code ? `(${att.code})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {selectedAttachmentId && unitOptions.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Unité / Service / Département</label>
                      <select
                        value={selectedUnitId}
                        onChange={(e) => setSelectedUnitId(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                      >
                        <option value="">-- Affectation au rattachement ou choisir une unité ({unitOptions.length}) --</option>
                        {unitOptions.map(u => (
                          <option key={u.id} value={u.id}>↳ {u.name} {u.code ? `(${u.code})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Case à cocher : Désigné comme chef de ce Poste */}
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
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
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                            ⭐ Responsable officiel
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Rôle RBAC *</label>
                <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300">
                  <option value="">-- Sélectionner un rôle --</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mot de passe initial *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300" />
              </div>

              <div className="pt-4 flex justify-end space-x-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 font-semibold text-slate-600">Annuler</button>
                <button type="submit" className="px-5 py-2.5 bg-kindia-blue text-white font-bold rounded-xl shadow">Créer l'utilisateur</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Security Management Modal */}
      {securityUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar border border-slate-200 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-kindia-blue to-slate-950 p-5 text-white flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                  <Key className="w-4 h-4 text-kindia-gold" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-white">
                    Sécurité du Compte & Identifiants
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {formatFullName(securityUser)} ({securityUser.role_name})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSecurityUser(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              
              {/* Feedback messages */}
              {securityMsg.text && (
                <div className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 ${
                  securityMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {securityMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{securityMsg.text}</span>
                </div>
              )}

              {/* Account details card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Identifiant / Matricule :</span>
                  <span className="font-bold text-slate-800">{securityUser.matricule}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Adresse Email :</span>
                  <span className="font-bold text-slate-800">{securityUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">ID Interne Immuable :</span>
                  <span className="font-mono font-bold text-kindia-blue">{securityInfo?.user_uid || `usr_${securityUser.id}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Dernière connexion :</span>
                  <span className="text-slate-700 font-medium">
                    {securityInfo?.last_login ? new Date(securityInfo.last_login).toLocaleString('fr-FR') : 'Aucune'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Version des sessions actives :</span>
                  <span className="font-mono text-slate-700">v{securityInfo?.token_version || 1}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-medium">Statut du mot de passe :</span>
                  {securityInfo?.must_change_password ? (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                      Mot de passe temporaire actif
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      Mot de passe personnel défini
                    </span>
                  )}
                </div>
              </div>

              {/* Temporary Password Box when Generated */}
              {generatedTempPassword && (
                <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-amber-900 uppercase block">
                    Nouveau Mot de Passe Temporaire Généré :
                  </span>
                  <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-200">
                    <span className="font-mono text-sm font-black text-slate-900 tracking-wider">
                      {generatedTempPassword}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copié !' : 'Copier'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-800">
                    * Transmettez ce mot de passe à l'utilisateur. Lors de sa première connexion, le système lui demandera obligatoirement de définir son mot de passe personnel.
                  </p>
                </div>
              )}

              {/* Action 1: Reset Password */}
              <div className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition space-y-2 bg-white">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-slate-800">
                    Réinitialiser le Mot de Passe de l'Utilisateur
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500">
                  Génère un mot de passe temporaire sécurisé, révoque immédiatement toutes ses sessions actives et active le statut de changement obligatoire.
                </p>
                <button
                  type="button"
                  onClick={handleAdminResetPassword}
                  disabled={securityLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{securityLoading ? 'Génération...' : 'Générer un mot de passe temporaire'}</span>
                </button>
              </div>

              {/* Action 2: Revoke Sessions */}
              <div className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition space-y-2 bg-white">
                <div className="flex items-center space-x-2">
                  <Laptop className="w-4 h-4 text-red-600" />
                  <h4 className="text-xs font-bold text-slate-800">
                    Déconnecter les Sessions Actives (Révocation Immédiate)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500">
                  Invalide tous les jetons JWT en circulation pour cet utilisateur afin de forcer sa reconnexion sur tous les terminaux.
                </p>
                <button
                  type="button"
                  onClick={handleAdminRevokeSessions}
                  disabled={securityLoading}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{securityLoading ? 'Traitement...' : 'Révoquer toutes ses sessions'}</span>
                </button>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSecurityUser(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Quick Profile Photo Modal */}
      {quickPhotoUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="bg-kindia-blue p-5 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                  <Camera className="w-4 h-4 text-kindia-gold" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-white">Photo de profil du compte</h3>
                  <p className="text-[11px] text-slate-300">{formatFullName(quickPhotoUser)} (Matricule: {quickPhotoUser.matricule})</p>
                </div>
              </div>
              <button onClick={() => setQuickPhotoUser(null)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-center">
              {quickPhotoMsg.text && (
                <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 text-left ${
                  quickPhotoMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {quickPhotoMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
                  <span>{quickPhotoMsg.text}</span>
                </div>
              )}

              <div className="flex flex-col items-center justify-center">
                <div className="relative w-36 h-36 rounded-3xl overflow-hidden border-4 border-slate-100 shadow-lg bg-slate-50 flex items-center justify-center">
                  {quickPhotoPreview ? (
                    <img src={quickPhotoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-4">
                      <ImageIcon className="w-12 h-12 text-slate-300 mb-1" />
                      <span className="text-xs font-bold">Aucune photo</span>
                      <span className="text-[10px] text-slate-400">Avatar par défaut</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <label className="w-full sm:w-auto cursor-pointer px-4 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center space-x-2">
                  <Upload className="w-4 h-4 text-kindia-gold" />
                  <span>{quickPhotoPreview ? 'Choisir une autre photo' : 'Sélectionner une photo'}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQuickPhotoFileSelect} className="hidden" />
                </label>

                {quickPhotoPreview && (
                  <button
                    type="button"
                    onClick={handleQuickPhotoDelete}
                    disabled={quickPhotoLoading}
                    className="w-full sm:w-auto px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer</span>
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                Format supporté : JPG, PNG, WEBP (Max 5 Mo). La photo est enregistrée pour ce compte dans tout le système.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setQuickPhotoUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                Fermer
              </button>
              {quickPhotoFile && (
                <button
                  type="button"
                  onClick={handleQuickPhotoSave}
                  disabled={quickPhotoLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{quickPhotoLoading ? 'Enregistrement...' : 'Enregistrer la photo'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

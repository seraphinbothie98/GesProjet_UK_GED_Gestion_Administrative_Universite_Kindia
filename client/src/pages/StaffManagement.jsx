import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Users, Plus, Search, UserCheck, UserX, Car, AlertTriangle, Eye, Edit3, 
  CheckCircle, FileText, X, Shield, Key, Lock, Trash2, Copy, Check, 
  UserPlus, RefreshCw, AlertCircle, Phone, Mail, Building2, ShieldCheck, 
  CheckCircle2, Laptop
} from 'lucide-react';

export default function StaffManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role_code === 'ADMINISTRATEUR';
  const isSecCentral = user?.role_code === 'SECRETARIAT_CENTRAL';

  const [staffList, setStaffList] = useState([]);
  const [services, setServices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [staffMissions, setStaffMissions] = useState([]);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  
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
  
  // Create Account for Staff without user_id
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [newAccountStaff, setNewAccountStaff] = useState(null);
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountRoleId, setNewAccountRoleId] = useState('');
  
  // Notification states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Form State
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [nationality, setNationality] = useState('Guinéenne');
  const [fonction, setFonction] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [matricule, setMatricule] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('ACTIF');
  const [isDriver, setIsDriver] = useState(false);
  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter, searchQuery, serviceFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffData, servicesData, rolesData] = await Promise.all([
        api.getStaff({ status: statusFilter, query: searchQuery, service_id: serviceFilter || undefined }),
        api.getServices().catch(() => []),
        api.getRoles().catch(() => [])
      ]);
      setStaffList(Array.isArray(staffData) ? staffData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch (err) {
      console.error('Failed to load staff directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e, forceCreate = false) => {
    if (e) e.preventDefault();
    setError('');
    setMessage('');

    if (!nom || !prenoms || !fonction) {
      setError('Nom, prénoms et fonction sont obligatoires.');
      return;
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
      const payload = {
        nom,
        prenoms,
        nationality,
        fonction,
        service_id: serviceId || null,
        matricule,
        telephone,
        email,
        status,
        is_driver: isDriver,
        vehicle_registration: vehicleReg,
        vehicle_brand: vehicleBrand,
        vehicle_model: vehicleModel
      };

      if (editingStaffId) {
        await api.updateStaff(editingStaffId, payload);
        setMessage(`Membre du personnel mis à jour avec succès.`);
      } else {
        await api.createStaff(payload);
        setMessage(`Membre du personnel ${nom} ${prenoms} ajouté au répertoire avec succès.`);
      }

      setShowAddModal(false);
      setDuplicateWarning(null);
      resetForm();
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’enregistrement.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingStaffId(null);
    setNom('');
    setPrenoms('');
    setNationality('Guinéenne');
    setFonction('');
    setServiceId('');
    setMatricule('');
    setTelephone('');
    setEmail('');
    setStatus('ACTIF');
    setIsDriver(false);
    setVehicleReg('');
    setVehicleBrand('');
    setVehicleModel('');
  };

  const handleEdit = (staff) => {
    setEditingStaffId(staff.id);
    setNom(staff.nom || '');
    setPrenoms(staff.prenoms || '');
    setNationality(staff.nationality || 'Guinéenne');
    setFonction(staff.fonction || '');
    setServiceId(staff.service_id || '');
    setMatricule(staff.matricule || '');
    setTelephone(staff.telephone || '');
    setEmail(staff.email || '');
    setStatus(staff.status || 'ACTIF');
    setIsDriver(staff.is_driver === 1 || staff.is_driver === true);
    setVehicleReg(staff.vehicle_registration || '');
    setVehicleBrand(staff.vehicle_brand || '');
    setVehicleModel(staff.vehicle_model || '');
    setShowAddModal(true);
  };

  const handleToggleStatus = async (staffId) => {
    try {
      await api.toggleStaffStatus(staffId);
      setMessage('Statut du membre du personnel modifié avec succès.');
      loadData();
    } catch (err) {
      alert('Erreur lors du changement de statut : ' + err.message);
    }
  };

  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;
    setSubmitting(true);
    try {
      await api.deleteStaff(deletingStaff.id, { delete_linked_user: deleteLinkedUser });
      setMessage(`Membre du personnel ${deletingStaff.nom} ${deletingStaff.prenoms} supprimé avec succès.`);
      setDeletingStaff(null);
      loadData();
    } catch (err) {
      alert('Erreur lors de la suppression : ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewCard = async (staffId) => {
    try {
      const data = await api.getStaffDetail(staffId);
      setViewingStaff(data.staff);
      setStaffMissions(data.missions || []);
    } catch (err) {
      alert('Erreur lors du chargement de la fiche : ' + err.message);
    }
  };

  // Open Security Modal for Linked User
  const handleOpenSecurityModal = async (staff) => {
    setSecurityStaff(staff);
    setSecurityMsg({ type: '', text: '' });
    setGeneratedTempPassword('');
    setCustomPassword('');
    setCopied(false);
    
    if (staff.linked_user_id || staff.user_id) {
      const userId = staff.linked_user_id || staff.user_id;
      setSecurityLoading(true);
      try {
        const info = await api.getUserSecurityInfo(userId);
        setSecurityInfo(info);
        setSecurityRoleId(staff.role_id || (info?.user?.role_id) || '');
      } catch (err) {
        setSecurityMsg({ type: 'error', text: err.message });
      } finally {
        setSecurityLoading(false);
      }
    }
  };

  const handleAdminResetPassword = async () => {
    if (!securityStaff) return;
    const userId = securityStaff.linked_user_id || securityStaff.user_id;
    setSecurityLoading(true);
    setSecurityMsg({ type: '', text: '' });
    try {
      const res = await api.adminResetUserPassword(userId, customPassword || null);
      setGeneratedTempPassword(res.temporary_password);
      setSecurityMsg({ 
        type: 'success', 
        text: `Mot de passe réinitialisé. L'utilisateur devra obligatoirement le modifier à sa prochaine connexion.` 
      });
      setCustomPassword('');
      const info = await api.getUserSecurityInfo(userId);
      setSecurityInfo(info);
    } catch (err) {
      setSecurityMsg({ type: 'error', text: err.message || 'Erreur réinitialisation mot de passe' });
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!securityStaff) return;
    const userId = securityStaff.linked_user_id || securityStaff.user_id;
    setSecurityLoading(true);
    setSecurityMsg({ type: '', text: '' });
    try {
      await api.adminRevokeUserSessions(userId);
      setSecurityMsg({ type: 'success', text: 'Toutes les sessions actives de l’utilisateur ont été révoquées avec succès.' });
      const info = await api.getUserSecurityInfo(userId);
      setSecurityInfo(info);
    } catch (err) {
      setSecurityMsg({ type: 'error', text: err.message || 'Erreur révocation sessions' });
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleCreateAccountForStaff = async (e) => {
    e.preventDefault();
    if (!newAccountStaff || !newAccountEmail || !newAccountPassword || !newAccountRoleId) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createUser({
        matricule: newAccountStaff.matricule || `UK-${Date.now().toString().slice(-6)}`,
        first_name: newAccountStaff.prenoms,
        last_name: newAccountStaff.nom,
        email: newAccountEmail.trim(),
        phone: newAccountStaff.telephone || '',
        function_title: newAccountStaff.fonction,
        service_id: newAccountStaff.service_id || services[0]?.id || 1,
        role_id: parseInt(newAccountRoleId),
        password: newAccountPassword
      });
      setMessage(`Compte utilisateur créé pour ${newAccountStaff.nom} ${newAccountStaff.prenoms}.`);
      setShowCreateAccountModal(false);
      setNewAccountStaff(null);
      loadData();
    } catch (err) {
      alert('Erreur lors de la création du compte : ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Stats calculation
  const totalStaff = staffList.length;
  const activeStaff = staffList.filter(s => s.status === 'ACTIF').length;
  const linkedUsersCount = staffList.filter(s => s.linked_user_id || s.user_id).length;
  const driversCount = staffList.filter(s => s.is_driver === 1 || s.is_driver === true).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-kindia-blue text-white flex items-center justify-center font-bold shadow-md">
            <Users className="w-6 h-6 text-kindia-gold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-kindia-gold uppercase tracking-wider block">
                {isAdmin ? 'GESTION ADMINISTRATIVE & SÉCURITÉ DU PERSONNEL • UK' : 'RÉPERTOIRE OFFICIEL DU PERSONNEL • UK'}
              </span>
              {isAdmin && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  Mode Administrateur
                </span>
              )}
            </div>
            <h2 className="font-heading font-bold text-lg text-slate-800">
              {isAdmin ? 'Gestion du Personnel et des Comptes Utilisateurs' : 'Répertoire du Personnel de l’Université'}
            </h2>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4 text-kindia-gold" />
            <span>AJOUTER UN MEMBRE DU PERSONNEL</span>
          </button>
        )}
      </div>

      {/* Stats Cards (For Admin) */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Personnel</p>
              <h3 className="text-xl font-bold text-slate-800">{totalStaff}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Personnel Actif</p>
              <h3 className="text-xl font-bold text-emerald-600">{activeStaff}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Comptes Système</p>
              <h3 className="text-xl font-bold text-indigo-600">{linkedUsersCount}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Chauffeurs Autorisés</p>
              <h3 className="text-xl font-bold text-amber-600">{driversCount}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-emerald-600 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}

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

      {/* Staff List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Matricule</th>
                <th className="p-3.5">Nom & Prénoms</th>
                <th className="p-3.5">Fonction</th>
                <th className="p-3.5">Service / Structure</th>
                <th className="p-3.5">Compte Système</th>
                <th className="p-3.5">Contact</th>
                <th className="p-3.5">Chauffeur ?</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5 text-right">{isAdmin ? 'Actions & Sécurité' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-kindia-blue" />
                      <span>Chargement du répertoire du personnel...</span>
                    </div>
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Users className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold">Aucun membre du personnel correspondant aux critères.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                staffList.map(s => {
                  const hasAccount = Boolean(s.linked_user_id || s.user_id);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-kindia-blue">
                        {s.matricule || 'N/A'}
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">
                        <div>
                          <span>{s.nom} {s.prenoms}</span>
                          {s.email && (
                            <span className="block text-[10px] text-slate-400 font-normal flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {s.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-600">{s.fonction}</td>
                      <td className="p-3.5 text-slate-600 font-semibold">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px] text-slate-700 inline-block max-w-[180px] truncate" title={s.service_name}>
                          {s.service_name || 'Non affecté'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {hasAccount ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{s.role_name || 'Utilisateur Système'}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-500">
                            Fiche uniquement
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                        {s.telephone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {s.telephone}
                          </span>
                        ) : 'N/A'}
                      </td>
                      <td className="p-3.5">
                        {s.is_driver === 1 || s.is_driver === true ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Car className="w-3 h-3 mr-1" /> Chauffeur
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Non</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'ACTIF' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      
                      {/* Actions Column */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* 1. Consulter Fiche (Pour tous les rôles) */}
                          <button
                            onClick={() => handleViewCard(s.id)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                            title="Consulter la fiche détaillée"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Options réservées aux Administrateurs */}
                          {isAdmin && (
                            <>
                              {/* 2. Modifier */}
                              <button
                                onClick={() => handleEdit(s)}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition"
                                title="Modifier la fiche"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* 3. Sécurité du Compte */}
                              {hasAccount ? (
                                <button
                                  onClick={() => handleOpenSecurityModal(s)}
                                  className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition font-bold"
                                  title="Gérer la sécurité du compte (Mot de passe, Sessions, Rôles)"
                                >
                                  <Shield className="w-3.5 h-3.5" />
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

                              {/* 4. Activer / Désactiver */}
                              <button
                                onClick={() => handleToggleStatus(s.id)}
                                className={`p-1.5 rounded-lg transition ${
                                  s.status === 'ACTIF' 
                                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                                title={s.status === 'ACTIF' ? 'Désactiver le membre du personnel' : 'Réactiver'}
                              >
                                {s.status === 'ACTIF' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </button>

                              {/* 5. Supprimer */}
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

      {/* ============================================================ */}
      {/* MODAL 1: ADD / EDIT STAFF                                     */}
      {/* ============================================================ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue flex items-center gap-2">
                <Users className="w-4 h-4 text-kindia-gold" />
                <span>{editingStaffId ? '✏️ Modifier la Fiche du Personnel' : '➕ Enregistrer un Membre du Personnel'}</span>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nom de Famille *</label>
                  <input
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Ex : CAMARA"
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold uppercase focus:ring-2 focus:ring-kindia-blue outline-hidden"
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
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-kindia-blue outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Matricule Unique</label>
                  <input
                    type="text"
                    value={matricule}
                    onChange={(e) => setMatricule(e.target.value)}
                    placeholder="Ex : UK-000245"
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nationalité *</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fonction *</label>
                  <input
                    type="text"
                    value={fonction}
                    onChange={(e) => setFonction(e.target.value)}
                    placeholder="Ex : Enseignant-Chercheur, Chef de service..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-kindia-blue outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service de Rattachement</label>
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  >
                    <option value="">-- Sélectionner un service ({services.length}) --</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone / Contact</label>
                  <input
                    type="text"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="Ex : +224 621 00 11 22"
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mail Professionnel</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex : agent@univ-kindia.edu.gn"
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>
              </div>

              {/* Chauffeur Toggle */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2">
                <label className="flex items-center space-x-2 font-bold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDriver}
                    onChange={(e) => setIsDriver(e.target.checked)}
                    className="rounded-sm text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <span>Autorisé comme chauffeur (is_driver = true)</span>
                </label>
                <p className="text-[10px] text-amber-800">
                  Si cette option est cochée, cet agent pourra être sélectionné comme chauffeur lors de la création d'ordres de mission.
                </p>
              </div>

              {/* Vehicle Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs text-slate-800 flex items-center">
                  <Car className="w-4 h-4 mr-1.5 text-kindia-blue" />
                  🚗 Informations de Transport & Véhicule (Optionnel)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Immatriculation</label>
                    <input
                      type="text"
                      value={vehicleReg}
                      onChange={(e) => setVehicleReg(e.target.value)}
                      placeholder="Ex : RC-4587-GN"
                      className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Marque</label>
                    <input
                      type="text"
                      value={vehicleBrand}
                      onChange={(e) => setVehicleBrand(e.target.value)}
                      placeholder="Ex : Toyota"
                      className="w-full p-2 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Modèle</label>
                    <input
                      type="text"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      placeholder="Ex : Land Cruiser"
                      className="w-full p-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-kindia-blue text-white font-bold rounded-xl shadow-md hover:bg-kindia-lightBlue transition"
                >
                  {submitting ? 'Enregistrement...' : (editingStaffId ? 'Mettre à jour' : 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: USER ACCOUNT SECURITY (For Admin)                   */}
      {/* ============================================================ */}
      {securityStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-slate-800">
                    Sécurité & Accès Utilisateur
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {securityStaff.nom} {securityStaff.prenoms} ({securityStaff.email || securityStaff.matricule})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSecurityStaff(null)} 
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {securityMsg.text && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                securityMsg.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {securityMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />}
                <span>{securityMsg.text}</span>
              </div>
            )}

            {/* Generated Temporary Password Alert */}
            {generatedTempPassword && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-amber-700" />
                    NOUVEAU MOT DE PASSE TEMPORAIRE
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedTempPassword);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 3000);
                    }}
                    className="text-[10px] bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold px-2 py-1 rounded-md flex items-center gap-1 transition"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
                <div className="font-mono text-sm font-bold bg-white p-2.5 rounded-lg border border-amber-200 text-slate-800 tracking-wider text-center select-all">
                  {generatedTempPassword}
                </div>
                <p className="text-[10px] text-amber-800 font-medium">
                  ⚠️ Transmettez ce mot de passe à l'utilisateur. Il lui sera demandé de le modifier immédiatement dès sa prochaine connexion.
                </p>
              </div>
            )}

            {/* Account Status Info */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Rôle Système :</span>
                <span className="font-bold text-slate-800">{securityStaff.role_name || 'Personnel Système'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Statut du Compte :</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  securityStaff.status === 'ACTIF' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {securityStaff.status}
                </span>
              </div>
              {securityInfo?.user?.last_login && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Dernière Connexion :</span>
                  <span className="font-mono text-slate-700 text-[11px]">{new Date(securityInfo.user.last_login).toLocaleString('fr-FR')}</span>
                </div>
              )}
            </div>

            {/* Action 1: Reset Password */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-kindia-blue" />
                Réinitialisation du Mot de Passe
              </h4>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Mot de passe personnalisé (Laisser vide pour générer un mot de passe aléatoire sécurisé)
                </label>
                <input
                  type="text"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Ex : Kindia2026! (ou vide)"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-purple-500 outline-hidden"
                />
              </div>

              <button
                type="button"
                onClick={handleAdminResetPassword}
                disabled={securityLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center space-x-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${securityLoading ? 'animate-spin' : ''}`} />
                <span>{securityLoading ? 'Traitement en cours...' : '⚡ Réinitialiser le mot de passe'}</span>
              </button>
            </div>

            {/* Action 2: Revoke Active Sessions */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-slate-600" />
                Sessions Actives & Déconnexion
              </h4>
              <p className="text-[11px] text-slate-500">
                Déconnecte immédiatement l'utilisateur de tous ses appareils (PC, tablettes, smartphones).
              </p>
              <button
                type="button"
                onClick={handleRevokeSessions}
                disabled={securityLoading}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center space-x-2"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Forcer la déconnexion de toutes les sessions</span>
              </button>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSecurityStaff(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: CREATE USER ACCOUNT FOR STAFF WITHOUT ACCOUNT       */}
      {/* ============================================================ */}
      {showCreateAccountModal && newAccountStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-extrabold text-sm text-slate-800">
                  Créer un Compte d'Accès Système
                </h3>
              </div>
              <button 
                onClick={() => setShowCreateAccountModal(false)} 
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <p className="font-bold text-slate-800">{newAccountStaff.nom} {newAccountStaff.prenoms}</p>
              <p className="text-slate-500">Matricule : {newAccountStaff.matricule || 'N/A'}</p>
              <p className="text-slate-500">Fonction : {newAccountStaff.fonction}</p>
            </div>

            <form onSubmit={handleCreateAccountForStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email de Connexion *</label>
                <input
                  type="email"
                  value={newAccountEmail}
                  onChange={(e) => setNewAccountEmail(e.target.value)}
                  placeholder="agent@univ-kindia.edu.gn"
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue outline-hidden font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Rôle d'Accès Système *</label>
                <select
                  value={newAccountRoleId}
                  onChange={(e) => setNewAccountRoleId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  required
                >
                  <option value="">-- Sélectionner un Rôle --</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mot de Passe Initial *</label>
                <input
                  type="text"
                  value={newAccountPassword}
                  onChange={(e) => setNewAccountPassword(e.target.value)}
                  placeholder="Ex : Agent123!"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateAccountModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition"
                >
                  {submitting ? 'Création...' : 'Créer le Compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: DELETE CONFIRMATION (For Admin)                     */}
      {/* ============================================================ */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-sm text-rose-700 uppercase">
                  Confirmation de Suppression
                </h3>
                <p className="text-[11px] text-slate-500">Action irréversible</p>
              </div>
            </div>

            <p className="text-xs text-slate-700">
              Êtes-vous sûr de vouloir supprimer définitivement la fiche de <strong className="text-slate-900">{deletingStaff.nom} {deletingStaff.prenoms}</strong> (Matricule : <span className="font-mono">{deletingStaff.matricule || 'N/A'}</span>) ?
            </p>

            {(deletingStaff.linked_user_id || deletingStaff.user_id) && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs space-y-2">
                <label className="flex items-center space-x-2 font-bold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteLinkedUser}
                    onChange={(e) => setDeleteLinkedUser(e.target.checked)}
                    className="rounded-sm text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <span>Supprimer également le compte utilisateur de connexion associé</span>
                </label>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleDeleteStaff}
                disabled={submitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition"
              >
                {submitting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: DETAILED STAFF CARD (All Roles)                     */}
      {/* ============================================================ */}
      {viewingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-kindia-blue text-white flex items-center justify-center font-bold shadow-md">
                  <Users className="w-5 h-5 text-kindia-gold" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-800">
                    FICHE DU PERSONNEL : {viewingStaff.nom} {viewingStaff.prenoms}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {viewingStaff.service_name || 'Université de Kindia'} • {viewingStaff.fonction}
                  </span>
                </div>
              </div>
              <button onClick={() => setViewingStaff(null)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* General Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div><span className="font-bold text-slate-500">Nom :</span> <span className="font-bold text-slate-800">{viewingStaff.nom}</span></div>
              <div><span className="font-bold text-slate-500">Prénoms :</span> <span className="font-bold text-slate-800">{viewingStaff.prenoms}</span></div>
              <div><span className="font-bold text-slate-500">Matricule :</span> <span className="font-mono font-bold text-kindia-blue">{viewingStaff.matricule || 'N/A'}</span></div>
              <div><span className="font-bold text-slate-500">Nationalité :</span> <span>{viewingStaff.nationality}</span></div>
              <div><span className="font-bold text-slate-500">Fonction :</span> <span>{viewingStaff.fonction}</span></div>
              <div><span className="font-bold text-slate-500">Structure / Service :</span> <span className="font-semibold text-slate-700">{viewingStaff.service_name || 'Non affecté'}</span></div>
              <div><span className="font-bold text-slate-500">Téléphone :</span> <span className="font-mono">{viewingStaff.telephone || 'N/A'}</span></div>
              <div><span className="font-bold text-slate-500">E-mail Professionnel :</span> <span>{viewingStaff.email || 'N/A'}</span></div>
              <div><span className="font-bold text-slate-500">Statut Administratif :</span> <span className="font-bold text-emerald-700">{viewingStaff.status}</span></div>
              <div>
                <span className="font-bold text-slate-500">Compte Système :</span>{' '}
                {viewingStaff.linked_user_id || viewingStaff.user_id ? (
                  <span className="font-bold text-emerald-700">Actif ({viewingStaff.role_name || 'Utilisateur'})</span>
                ) : (
                  <span className="text-slate-500">Aucun compte lié</span>
                )}
              </div>
            </div>

            {/* Transport Section */}
            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 text-xs space-y-2">
              <h4 className="font-bold text-amber-900 flex items-center">
                <Car className="w-4 h-4 mr-1.5 text-amber-600" />
                🚗 INFORMATIONS DE TRANSPORT & VÉHICULE
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div><span className="font-bold text-amber-800">Immatriculation :</span> <span className="font-mono font-bold">{viewingStaff.vehicle_registration || 'Aucun'}</span></div>
                <div><span className="font-bold text-amber-800">Marque / Modèle :</span> <span>{viewingStaff.vehicle_brand || ''} {viewingStaff.vehicle_model || 'N/A'}</span></div>
                <div><span className="font-bold text-amber-800">Chauffeur Autorisé :</span> <span className="font-bold">{viewingStaff.is_driver === 1 ? 'Oui (Autorisé)' : 'Non'}</span></div>
              </div>
            </div>

            {/* Mission History Section */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-800 flex items-center justify-between">
                <span className="flex items-center">
                  <FileText className="w-4 h-4 mr-1.5 text-kindia-blue" />
                  📋 HISTORIQUE DES ORDRES DE MISSION ({staffMissions.length})
                </span>
              </h4>

              {staffMissions.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-slate-400 text-center text-xs border border-slate-100">
                  Aucun ordre de mission associé à cette personne.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {staffMissions.map((m, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold font-mono text-kindia-blue">{m.reference}</span>
                        <p className="text-[11px] text-slate-600">{m.destination} — {m.object_of_mission}</p>
                        <p className="text-[10px] text-slate-400">Du {m.departure_date} au {m.return_date}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.status === 'ARCHIVÉ' || m.status === 'ARCHIVED' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setViewingStaff(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition text-xs"
              >
                Fermer la fiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Warning Dialog */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border-2 border-amber-400">
            <div className="flex items-center space-x-3 text-amber-800">
              <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />
              <h3 className="font-heading font-extrabold text-sm uppercase">
                ⚠️ PERSONNEL SIMILAIRE EXISTANT
              </h3>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs space-y-1">
              <p className="font-bold text-amber-900">{duplicateWarning.nom || `${duplicateWarning.last_name || ''} ${duplicateWarning.first_name || ''}`} {duplicateWarning.prenoms || ''}</p>
              <p className="text-amber-800 font-mono">Matricule : {duplicateWarning.matricule || 'N/A'}</p>
              <p className="text-amber-800">Fonction : {duplicateWarning.fonction || duplicateWarning.function_title || 'Personnel'}</p>
              {duplicateWarning.email && <p className="text-amber-800">Email : {duplicateWarning.email}</p>}
            </div>

            <p className="text-xs text-slate-600">
              Une personne possédant des identifiants identiques (matricule, email ou nom) est déjà enregistrée dans la base. Souhaitez-vous réutiliser cette fiche ou modifier le compte existant ?
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="px-3 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={() => {
                  setDuplicateWarning(null);
                  if (duplicateWarning.id) {
                    handleEdit(duplicateWarning);
                  }
                }}
                className="px-4 py-2 bg-kindia-blue text-white font-bold rounded-xl text-xs shadow-md hover:bg-kindia-lightBlue transition"
              >
                Consulter / Modifier la fiche existante
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

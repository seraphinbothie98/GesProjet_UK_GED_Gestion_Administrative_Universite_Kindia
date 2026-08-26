import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Plus, Edit, Power, X, Award, Check, Shield, Key, Lock, Laptop, CheckCircle2, AlertCircle, Copy, Trash2 } from 'lucide-react';

export default function UserAdmin() {
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

  // Form State for Create & Edit
  const [matricule, setMatricule] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [functionTitle, setFunctionTitle] = useState('');
  const [serviceId, setServiceId] = useState('');
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

  const openCreateModal = () => {
    resetForm();
    if (activeTab === 'CHEFS_SERVICE') {
      const chefRole = roles.find(r => r.code === 'CHEF_SERVICE');
      if (chefRole) setRoleId(String(chefRole.id));
      setIsChefService(true);
    }
    setShowCreateModal(true);
  };

  const openEditModal = (u) => {
    setError('');
    setSuccessMsg('');
    setEditingUser(u);
    setMatricule(u.matricule || '');
    setFirstName(u.first_name || '');
    setLastName(u.last_name || '');
    setEmail(u.email || '');
    setPhone(u.phone || '');
    setFunctionTitle(u.function_title || '');
    setServiceId(String(u.service_id || ''));
    setRoleId(String(u.role_id || ''));
    setStatus(u.status || 'ACTIVE');
    setIsChefService(u.role_code === 'CHEF_SERVICE');
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
    if (!window.confirm(`Confirmez-vous la réinitialisation du mot de passe de ${securityUser.first_name} ${securityUser.last_name} ? Un mot de passe temporaire sera généré et ses sessions actives seront déconnectées.`)) {
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
    if (!window.confirm(`Voulez-vous déconnecter immédiatement toutes les sessions actives de ${securityUser.first_name} ${securityUser.last_name} ?`)) {
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
    setMatricule('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setFunctionTitle('');
    setServiceId('');
    setRoleId('');
    setStatus('ACTIVE');
    setIsChefService(false);
    setPassword('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.createUser({
        matricule,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        function_title: functionTitle,
        service_id: serviceId,
        role_id: roleId,
        password
      });

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

    try {
      const res = await api.updateUser(editingUser.id, {
        matricule,
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

      setSuccessMsg(`Modifications enregistrées avec succès (${res.changesCount || 0} champs modifiés et inscrits dans l'audit).`);
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
    if (!window.confirm(`Confirmez-vous le passage du statut de ${userObj.first_name} ${userObj.last_name} à ${nextStatus} ?`)) return;

    try {
      await api.toggleUserStatus(userObj.id, nextStatus);
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

    const userName = `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || userObj.matricule || 'cet utilisateur';
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
                <th className="p-3.5">Matricule</th>
                <th className="p-3.5">Nom et Prénom</th>
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
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">Chargement des utilisateurs...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">Aucun utilisateur trouvé.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-bold text-kindia-blue">{u.matricule}</td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {u.first_name} {u.last_name}
                      {u.role_code === 'CHEF_SERVICE' && (
                        <span className="ml-2 px-2 py-0.5 rounded text-[9px] bg-kindia-gold/20 text-kindia-blue font-extrabold uppercase">Chef</span>
                      )}
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
                  <label className="block font-bold text-slate-700 mb-1">Fonction Officielle *</label>
                  <input type="text" value={functionTitle} onChange={(e) => setFunctionTitle(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Professionnel *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Affectation Service (Réaffecter) *</label>
                  <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue font-bold">
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rôle RBAC *</label>
                  <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue font-bold">
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
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
                  <label className="block font-bold text-slate-700 mb-1">Fonction *</label>
                  <input type="text" value={functionTitle} onChange={(e) => setFunctionTitle(e.target.value)} placeholder="Ex: Chef de Division / DAF" required className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+224 6..." className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service de rattachement *</label>
                  <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300">
                    <option value="">-- Sélectionner --</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rôle RBAC *</label>
                  <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-300">
                    <option value="">-- Sélectionner --</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
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
                    {securityUser.first_name} {securityUser.last_name} ({securityUser.role_name})
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
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Plus, Edit, Power, X, Award, Check, Shield } from 'lucide-react';

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
                        onClick={() => openEditModal(u)}
                        className="p-1.5 rounded-lg bg-kindia-blue/10 text-kindia-blue hover:bg-kindia-blue hover:text-white transition"
                        title="Modifier les informations du chef/utilisateur"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`p-1.5 rounded-lg transition ${u.status === 'ACTIVE' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                        title={u.status === 'ACTIVE' ? 'Désactiver le compte' : 'Activer le compte'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
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
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Car, Plus, Search, Filter, CheckCircle2, AlertTriangle, 
  History, UserCheck, Building2, Wrench, ShieldAlert, ArrowRight, X, Clock, Edit2, Trash2, Power, Ban
} from 'lucide-react';

export default function FleetManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role_code === 'ADMINISTRATEUR';
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleHistory, setVehicleHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    registration_number: '',
    brand: '',
    model: '',
    vehicle_type: 'SERVICE',
    color: '',
    status: 'DISPONIBLE',
    default_driver_id: '',
    observations: ''
  });

  const [assignData, setAssignData] = useState({
    staff_id: '',
    service_id: '',
    default_driver_id: '',
    reason: 'Affectation administrative',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;

      const [vehRes, srvRes, staffRes, drvRes] = await Promise.all([
        api.getFleetVehicles(params),
        api.getServices ? api.getServices() : Promise.resolve([]),
        api.getStaff ? api.getStaff({ status: 'ACTIF' }) : Promise.resolve([]),
        api.getDrivers({ active_only: 'true' })
      ]);

      setVehicles(Array.isArray(vehRes) ? vehRes : []);
      setServices(Array.isArray(srvRes) ? srvRes : []);
      setStaffList(Array.isArray(staffRes) ? staffRes : []);
      setDrivers(Array.isArray(drvRes) ? drvRes : []);
    } catch (err) {
      console.error('Erreur chargement données parc:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      registration_number: '',
      brand: '',
      model: '',
      vehicle_type: 'SERVICE',
      color: '',
      status: 'DISPONIBLE',
      default_driver_id: '',
      observations: ''
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (v) => {
    setSelectedVehicle(v);
    setFormData({
      registration_number: v.registration_number || '',
      brand: v.brand || '',
      model: v.model || '',
      vehicle_type: v.vehicle_type || 'SERVICE',
      color: v.color || '',
      status: v.status || 'DISPONIBLE',
      default_driver_id: v.default_driver_id || '',
      observations: v.observations || ''
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleOpenAssign = (v) => {
    setSelectedVehicle(v);
    setAssignData({
      staff_id: v.assigned_staff_id || '',
      service_id: v.assigned_service_id || '',
      default_driver_id: v.default_driver_id || '',
      reason: 'Affectation administrative',
      notes: ''
    });
    setFormError('');
    setShowAssignModal(true);
  };

  const handleOpenHistory = async (v) => {
    setSelectedVehicle(v);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const history = await api.getVehicleHistory(v.id);
      setVehicleHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      console.error('Erreur historique:', err);
      setVehicleHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.registration_number.trim()) {
      setFormError("L'immatriculation est obligatoire");
      return;
    }

    try {
      setFormLoading(true);
      await api.createFleetVehicle(formData);
      setShowAddModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.registration_number.trim()) {
      setFormError("L'immatriculation est obligatoire");
      return;
    }

    try {
      setFormLoading(true);
      await api.updateFleetVehicle(selectedVehicle.id, formData);
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveAssign = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!assignData.staff_id && !assignData.service_id) {
      setFormError('Veuillez sélectionner au moins un employé ou un service');
      return;
    }

    try {
      setFormLoading(true);
      await api.assignFleetVehicle(selectedVehicle.id, assignData);
      setShowAssignModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUnassign = async (v) => {
    if (!window.confirm(`Confirmez-vous le retrait de l'affectation du véhicule ${v.registration_number} ? Il redeviendra disponible dans le parc.`)) {
      return;
    }

    try {
      await api.unassignFleetVehicle(v.id, { reason: 'Retrait d’affectation administratif' });
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleToggleStatus = async (v) => {
    if (!isAdmin) {
      alert("Action refusée : Seul l'Administrateur Système est habilité à désactiver ou réactiver un véhicule.");
      return;
    }

    const isInactive = v.status === 'INACTIF';
    const nextStatus = isInactive ? 'DISPONIBLE' : 'INACTIF';
    const actionLabel = isInactive ? 'réactiver' : 'désactiver';

    if (!window.confirm(`Confirmez-vous vouloir ${actionLabel} le véhicule ${v.registration_number} ?`)) {
      return;
    }

    try {
      await api.toggleFleetVehicleStatus(v.id, nextStatus);
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleDeleteVehicle = async (v) => {
    if (!isAdmin) {
      alert("Action refusée : Seul l'Administrateur Système est habilité à supprimer définitivement un véhicule.");
      return;
    }

    if (!window.confirm(`⚠️ ATTENTION : Confirmez-vous la suppression définitive du véhicule ${v.registration_number} (${v.brand || ''} ${v.model || ''}) du parc automobile ?\n\nCette action supprimera également son historique d'affectation.`)) {
      return;
    }

    try {
      await api.deleteFleetVehicle(v.id);
      loadData();
    } catch (err) {
      alert('Erreur lors de la suppression : ' + err.message);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (v.registration_number || '').toLowerCase().includes(term) ||
      (v.brand || '').toLowerCase().includes(term) ||
      (v.model || '').toLowerCase().includes(term) ||
      (v.assigned_staff_full_name || '').toLowerCase().includes(term) ||
      (v.assigned_service_name || '').toLowerCase().includes(term)
    );
  });

  // Calculate metrics
  const totalCount = vehicles.length;
  const availableCount = vehicles.filter(v => v.status === 'DISPONIBLE').length;
  const assignedCount = vehicles.filter(v => v.status === 'AFFECTÉ').length;
  const maintenanceCount = vehicles.filter(v => v.status === 'EN_ENTRETIEN').length;
  const immobilizedCount = vehicles.filter(v => v.status === 'IMMOBILISÉ' || v.status === 'INACTIF').length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DISPONIBLE':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-300">🟢 Disponible</span>;
      case 'AFFECTÉ':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-full border border-blue-300">🔵 Affecté</span>;
      case 'EN_ENTRETIEN':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full border border-amber-300">🟠 En entretien</span>;
      case 'IMMOBILISÉ':
        return <span className="px-2.5 py-1 bg-red-100 text-red-800 text-[11px] font-bold rounded-full border border-red-300">🔴 Immobilisé</span>;
      case 'RÉFORMÉ':
        return <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-[11px] font-bold rounded-full border border-slate-400">⚪ Réformé</span>;
      case 'INACTIF':
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-full border border-slate-300">Inactif</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[11px] font-medium rounded-full">{status}</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-kindia-blue text-white rounded-xl flex items-center justify-center shadow-md">
              <Car className="w-6 h-6 text-kindia-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-extrabold text-slate-800">
                Parc Automobile de l’Université
              </h1>
              <p className="text-xs text-slate-500">
                Gestion des véhicules officiels, affectations durables aux services/responsables et historique du parc.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center space-x-2 border border-kindia-gold/30 shrink-0"
        >
          <Plus className="w-4 h-4 text-kindia-gold" />
          <span>Ajouter un véhicule</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Total Parc</span>
          <span className="text-2xl font-black text-slate-800 mt-1 block">{totalCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/30">
          <span className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider block">Disponibles</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">{availableCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm bg-blue-50/30">
          <span className="text-[11px] text-blue-700 font-bold uppercase tracking-wider block">Affectés</span>
          <span className="text-2xl font-black text-blue-700 mt-1 block">{assignedCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/30">
          <span className="text-[11px] text-amber-700 font-bold uppercase tracking-wider block">En entretien</span>
          <span className="text-2xl font-black text-amber-700 mt-1 block">{maintenanceCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm bg-red-50/30 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-red-700 font-bold uppercase tracking-wider block">Immobilisés / Réformés</span>
          <span className="text-2xl font-black text-red-700 mt-1 block">{immobilizedCount}</span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher immatriculation, marque, responsable..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-600">Statut:</span>
          {['', 'DISPONIBLE', 'AFFECTÉ', 'EN_ENTRETIEN', 'IMMOBILISÉ', 'INACTIF'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-kindia-blue text-white shadow'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {st === '' ? 'Tous' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-3"></div>
            <span>Chargement du parc automobile...</span>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-sm">Aucun véhicule trouvé</p>
            <p className="text-xs text-slate-400 mt-1">Modifiez vos filtres ou ajoutez un nouveau véhicule.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="p-3.5 pl-5">Immatriculation</th>
                  <th className="p-3.5">Véhicule</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5">Affectation Actuelle</th>
                  <th className="p-3.5">Chauffeur Habituel</th>
                  <th className="p-3.5 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredVehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 pl-5 font-mono font-black text-kindia-blue text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-black tracking-wide">
                          {v.registration_number}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-800 block">{v.brand || '—'} {v.model || ''}</span>
                      <span className="text-[11px] text-slate-400 block">
                        {v.vehicle_type || 'Voiture'} {v.color ? `• ${v.color}` : ''}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {getStatusBadge(v.status)}
                    </td>
                    <td className="p-3.5">
                      {v.assigned_staff_full_name ? (
                        <div>
                          <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{v.assigned_staff_full_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            {v.assigned_service_name || v.assigned_staff_fonction || 'Personnel UK'}
                          </span>
                          {v.assigned_at && (
                            <span className="text-[9px] text-slate-400 block">
                              Depuis le {new Date(v.assigned_at).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                      ) : v.assigned_service_name ? (
                        <div>
                          <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{v.assigned_service_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">Service Université</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Non affecté (Pool Central)</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {v.default_driver_full_name ? (
                        <div>
                          <span className="font-bold text-slate-800 block">{v.default_driver_full_name}</span>
                          <span className="text-[10px] text-slate-500 block">{v.default_driver_telephone || ''}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Aucun chauffeur assigné</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right pr-5">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleOpenAssign(v)}
                          disabled={v.status === 'INACTIF'}
                          className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition ${
                            v.status === 'INACTIF'
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                          }`}
                          title="Affecter ou changer d'affectation"
                        >
                          🔄 Affecter
                        </button>
                        {v.assigned_staff_id || v.assigned_service_id ? (
                          <button
                            onClick={() => handleUnassign(v)}
                            className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold rounded-lg transition"
                            title="Retirer l'affectation"
                          >
                            Libérer
                          </button>
                        ) : null}
                        {isAdmin && (
                          <button
                            onClick={() => handleToggleStatus(v)}
                            className={`p-1.5 rounded-lg transition ${
                              v.status === 'INACTIF'
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                : 'hover:bg-slate-100 text-slate-500 hover:text-amber-600'
                            }`}
                            title={v.status === 'INACTIF' ? 'Réactiver le véhicule (Admin)' : 'Désactiver le véhicule (Admin)'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenHistory(v)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                          title="Historique des affectations"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                          title="Modifier le véhicule"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteVehicle(v)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition"
                            title="Supprimer définitivement le véhicule (Admin)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Vehicle */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-kindia-blue text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Car className="w-5 h-5 text-kindia-gold" />
                <h3 className="font-heading font-extrabold text-base">Ajouter un véhicule au parc</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Immatriculation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: RC-1234-A ou GN-5555-AA"
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marque</label>
                  <input
                    type="text"
                    placeholder="Ex: Toyota, Renault..."
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Modèle</label>
                  <input
                    type="text"
                    placeholder="Ex: Hilux, Land Cruiser, Duster..."
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Type de véhicule</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  >
                    <option value="SERVICE">Véhicule de service</option>
                    <option value="UTILITAIRE">Pick-up / Utilitaire</option>
                    <option value="MINIBUS">Minibus / Bus</option>
                    <option value="BERLINE">Berline</option>
                    <option value="4X4">4x4 / SUV</option>
                    <option value="MOTO">Moto de liaison</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Couleur</label>
                  <input
                    type="text"
                    placeholder="Ex: Blanche, Grise..."
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Statut initial</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  >
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="AFFECTÉ">Affecté</option>
                    <option value="EN_ENTRETIEN">En entretien</option>
                    <option value="IMMOBILISÉ">Immobilisé</option>
                    <option value="RÉFORMÉ">Réformé</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chauffeur habituel</label>
                  <select
                    value={formData.default_driver_id}
                    onChange={(e) => setFormData({ ...formData, default_driver_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  >
                    <option value="">-- Aucun chauffeur assigné --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name} ({d.telephone})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observations</label>
                <textarea
                  rows="2"
                  placeholder="Notes techniques, état du véhicule..."
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow transition"
                >
                  {formLoading ? 'Enregistrement...' : 'Enregistrer le véhicule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Vehicle */}
      {showEditModal && selectedVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-kindia-blue text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Car className="w-5 h-5 text-kindia-gold" />
                <h3 className="font-heading font-extrabold text-base">Modifier le véhicule {selectedVehicle.registration_number}</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Immatriculation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marque</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Modèle</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Statut</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  >
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="AFFECTÉ">Affecté</option>
                    <option value="EN_ENTRETIEN">En entretien</option>
                    <option value="IMMOBILISÉ">Immobilisé</option>
                    <option value="RÉFORMÉ">Réformé</option>
                    <option value="INACTIF">Inactif / Désactivé</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chauffeur habituel</label>
                  <select
                    value={formData.default_driver_id}
                    onChange={(e) => setFormData({ ...formData, default_driver_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  >
                    <option value="">-- Aucun chauffeur assigné --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name} ({d.telephone})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observations</label>
                <textarea
                  rows="2"
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow transition"
                >
                  {formLoading ? 'Mise à jour...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Vehicle */}
      {showAssignModal && selectedVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-kindia-blue text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-kindia-gold" />
                <h3 className="font-heading font-extrabold text-base">Affecter le véhicule {selectedVehicle.registration_number}</h3>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssign} className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                <p className="font-bold">Information de propriété</p>
                <p className="mt-0.5 text-[11px] text-blue-700">
                  Ce véhicule appartient à l’<strong>Université de Kindia</strong>. L’affectation est une mise à disposition durable pour les besoins de service.
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Affecter à un employé / responsable
                </label>
                <select
                  value={assignData.staff_id}
                  onChange={(e) => setAssignData({ ...assignData, staff_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                >
                  <option value="">-- Aucun employé individuel --</option>
                  {staffList.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.prenoms} {st.nom} ({st.fonction} - {st.matricule || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Affecter à un service ou direction
                </label>
                <select
                  value={assignData.service_id}
                  onChange={(e) => setAssignData({ ...assignData, service_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                >
                  <option value="">-- Aucun service spécifique --</option>
                  {services.map(srv => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} ({srv.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chauffeur habituel pour cette affectation
                </label>
                <select
                  value={assignData.default_driver_id}
                  onChange={(e) => setAssignData({ ...assignData, default_driver_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                >
                  <option value="">-- Aucun chauffeur habituel --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name} ({d.telephone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motif de l'affectation
                </label>
                <input
                  type="text"
                  placeholder="Ex: Prise de fonction, dotation de service..."
                  value={assignData.reason}
                  onChange={(e) => setAssignData({ ...assignData, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow transition"
                >
                  {formLoading ? 'Validation...' : 'Confirmer l’affectation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assignment History */}
      {showHistoryModal && selectedVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-kindia-blue text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-kindia-gold" />
                <h3 className="font-heading font-extrabold text-base">Historique des affectations : {selectedVehicle.registration_number}</h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {historyLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="animate-spin w-6 h-6 border-2 border-kindia-blue border-t-transparent rounded-full mx-auto mb-2"></div>
                  <span>Chargement de l'historique...</span>
                </div>
              ) : vehicleHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-sm">Aucun historique d'affectation enregistré</p>
                  <p className="text-xs text-slate-400 mt-1">Les affectations futures seront tracées ici.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
                  {vehicleHistory.map((item) => (
                    <div key={item.id} className="relative">
                      <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                        item.unassigned_at ? 'bg-slate-400' : 'bg-emerald-500 ring-4 ring-emerald-100'
                      }`}></div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-800">
                            {item.staff_full_name ? `${item.staff_full_name} (${item.staff_fonction || 'Agent'})` : item.service_name || 'Affectation de service'}
                          </span>
                          {!item.unassigned_at ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">
                              EN COURS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full">
                              CLÔTURÉ
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 space-y-1">
                          <p><strong>Service :</strong> {item.service_name || 'N/A'}</p>
                          <p><strong>Période :</strong> Du {new Date(item.assigned_at).toLocaleDateString('fr-FR')} {item.unassigned_at ? `au ${new Date(item.unassigned_at).toLocaleDateString('fr-FR')}` : '(Actuellement affecté)'}</p>
                          {item.reason && <p><strong>Motif :</strong> {item.reason}</p>}
                          {item.notes && <p className="text-slate-500 italic text-[11px]">{item.notes}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
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

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Users, Plus, Search, Filter, Phone, FileText, 
  ShieldAlert, Edit2, CheckCircle2, XCircle, X, User, Trash2,
  Building, Award, Check
} from 'lucide-react';
import { formatFullName } from '../utils/userUtils';

export default function DriverManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role_code === 'ADMINISTRATEUR';
  const [drivers, setDrivers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Hierarchical Structure / Service selector state for Add & Edit Modals
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [selectedAttachmentId, setSelectedAttachmentId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    prenoms: '',
    telephone: '+224',
    license_number: '',
    service_id: '',
    status: 'ACTIF',
    notes: ''
  });

  // Base Structures (Niveau 1 : parent_id est null ou UK)
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

  const updateEffectiveServiceId = (structId, attId, unitId) => {
    if (unitId) {
      setFormData(prev => ({ ...prev, service_id: unitId }));
    } else if (attId) {
      setFormData(prev => ({ ...prev, service_id: attId }));
    } else if (structId) {
      setFormData(prev => ({ ...prev, service_id: structId }));
    } else {
      setFormData(prev => ({ ...prev, service_id: '' }));
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;

      const [drvRes, srvRes] = await Promise.all([
        api.getDrivers(params),
        api.getServices ? api.getServices() : Promise.resolve([])
      ]);

      setDrivers(Array.isArray(drvRes) ? drvRes : []);
      setServices(Array.isArray(srvRes) ? srvRes : []);
    } catch (err) {
      console.error('Erreur chargement chauffeurs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      matricule: '',
      nom: '',
      prenoms: '',
      telephone: '+224',
      license_number: '',
      service_id: '',
      status: 'ACTIF',
      notes: ''
    });
    setSelectedStructureId('');
    setSelectedAttachmentId('');
    setSelectedUnitId('');
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (d) => {
    setSelectedDriver(d);
    setFormData({
      matricule: d.matricule || '',
      nom: d.nom || '',
      prenoms: d.prenoms || '',
      telephone: d.telephone || '+224',
      license_number: d.license_number || '',
      service_id: d.service_id ? String(d.service_id) : '',
      status: d.status || 'ACTIF',
      notes: d.notes || ''
    });

    // Auto-resolve hierarchy (Structure -> Rattachement -> Unité)
    if (d.service_id) {
      const sId = Number(d.service_id);
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
        setSelectedStructureId(String(d.service_id));
        setSelectedAttachmentId('');
        setSelectedUnitId('');
      }
    } else {
      setSelectedStructureId('');
      setSelectedAttachmentId('');
      setSelectedUnitId('');
    }

    setFormError('');
    setShowEditModal(true);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.nom.trim() || !formData.prenoms.trim() || !formData.telephone.trim()) {
      setFormError('Veuillez renseigner le nom, les prénoms et le téléphone');
      return;
    }

    try {
      setFormLoading(true);
      await api.createDriver(formData);
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
    if (!formData.nom.trim() || !formData.prenoms.trim() || !formData.telephone.trim()) {
      setFormError('Veuillez renseigner le nom, les prénoms et le téléphone');
      return;
    }

    try {
      setFormLoading(true);
      await api.updateDriver(selectedDriver.id, formData);
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (d) => {
    if (!isAdmin) {
      alert("Action refusée : Seul l'Administrateur Système est habilité à désactiver ou activer un chauffeur.");
      return;
    }

    const newStatus = d.status === 'ACTIF' ? 'INACTIF' : 'ACTIF';
    const action = newStatus === 'ACTIF' ? 'activer' : 'désactiver';

    if (!window.confirm(`Confirmez-vous la volonté de ${action} le chauffeur ${d.prenoms} ${d.nom} ?`)) {
      return;
    }

    try {
      if (newStatus === 'INACTIF') {
        await api.deactivateDriver(d.id);
      } else {
        await api.updateDriver(d.id, { status: 'ACTIF' });
      }
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleDeleteDriver = async (d) => {
    if (!isAdmin) {
      alert("Action refusée : Seul l'Administrateur Système est habilité à supprimer définitivement un chauffeur.");
      return;
    }

    if (!window.confirm(`⚠️ ATTENTION : Confirmez-vous la suppression définitive du chauffeur ${d.prenoms} ${d.nom} ?\n\nCette action supprimera également ses rattachements aux véhicules.`)) {
      return;
    }

    try {
      await api.deleteDriver(d.id, true);
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const getServiceDisplayName = (srvId, srvName) => {
    if (!srvId) return null;
    const srv = services.find(s => s.id === Number(srvId));
    if (!srv) return srvName || null;
    if (srv.parent_id) {
      const parent = services.find(p => p.id === srv.parent_id);
      if (parent) {
        return `${parent.code || parent.name} ➔ ${srv.name}`;
      }
    }
    return srv.name;
  };

  const filteredDrivers = drivers.filter(d => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (d.nom || '').toLowerCase().includes(term) ||
      (d.prenoms || '').toLowerCase().includes(term) ||
      (d.telephone || '').toLowerCase().includes(term) ||
      (d.matricule || '').toLowerCase().includes(term) ||
      (d.service_name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-kindia-blue text-white rounded-xl flex items-center justify-center shadow-md">
              <Users className="w-6 h-6 text-kindia-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-extrabold text-slate-800">
                Répertoire des Chauffeurs
              </h1>
              <p className="text-xs text-slate-500">
                Gestion autonome des chauffeurs de l'Université (aucun compte utilisateur requis).
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center space-x-2 border border-kindia-gold/30 shrink-0"
        >
          <Plus className="w-4 h-4 text-kindia-gold" />
          <span>Enregistrer un chauffeur</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher nom, prénom, téléphone, matricule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-600">Statut:</span>
          {['', 'ACTIF', 'INACTIF'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-kindia-blue text-white shadow'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {st === '' ? 'Tous' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Drivers List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-3"></div>
            <span>Chargement des chauffeurs...</span>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-sm">Aucun chauffeur trouvé</p>
            <p className="text-xs text-slate-400 mt-1">Enregistrez un nouveau chauffeur avec le bouton ci-dessus.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="p-3.5 pl-5">Nom & Prénoms</th>
                  <th className="p-3.5">Téléphone</th>
                  <th className="p-3.5">Matricule</th>
                  <th className="p-3.5">Service de rattachement</th>
                  <th className="p-3.5">N° Permis</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredDrivers.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 pl-5">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                          {d.nom ? d.nom.substring(0, 1) : 'C'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 block text-sm">
                            {formatFullName(d)}
                          </span>
                          {d.notes && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-xs">{d.notes}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center space-x-1.5 font-mono font-bold text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{d.telephone}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {d.matricule || '—'}
                    </td>
                    <td className="p-3.5">
                      {d.service_id || d.service_name ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] font-semibold border border-blue-200">
                          <Building className="w-3 h-3 mr-1 text-kindia-blue shrink-0" />
                          <span>{getServiceDisplayName(d.service_id, d.service_name) || d.service_name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[11px] font-medium border border-slate-200">
                          Pool Central UK
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {d.license_number || '—'}
                    </td>
                    <td className="p-3.5">
                      {d.status === 'ACTIF' ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-300">
                          Actif
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-full border border-slate-300">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right pr-5">
                      <div className="flex items-center justify-end space-x-1.5">
                        {isAdmin && (
                          <button
                            onClick={() => handleToggleStatus(d)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                              d.status === 'ACTIF'
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                            }`}
                            title={d.status === 'ACTIF' ? 'Désactiver le chauffeur (Admin)' : 'Activer le chauffeur (Admin)'}
                          >
                            {d.status === 'ACTIF' ? 'Désactiver' : 'Activer'}
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(d)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteDriver(d)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition"
                            title="Supprimer définitivement (Admin)"
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

      {/* Modal: Add Driver */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-kindia-blue text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-kindia-gold" />
                <h3 className="font-heading font-extrabold text-base">Enregistrer un chauffeur</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                <p className="font-bold">Information importante</p>
                <p className="mt-0.5 text-[11px] text-blue-700">
                  Les chauffeurs sont enregistrés de façon indépendante des comptes d'accès UK-GED. Aucun compte utilisateur n'est créé automatiquement.
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom de famille <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: DIALLO"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Prénoms <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Mamadou"
                    value={formData.prenoms}
                    onChange={(e) => setFormData({ ...formData, prenoms: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Téléphone (Guinée +224) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+224620000000"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Matricule (optionnel)</label>
                  <input
                    type="text"
                    placeholder="Ex: MAT-0099"
                    value={formData.matricule}
                    onChange={(e) => setFormData({ ...formData, matricule: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">N° Permis de conduire</label>
                <input
                  type="text"
                  placeholder="Ex: PC-GN-2024-..."
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              {/* Affectation Organisationnelle / Service de rattachement */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-kindia-blue" />
                    <span className="font-bold text-xs text-slate-800">Affectation & Structure de rattachement</span>
                  </div>
                  {formData.service_id ? (
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                      Structure assignée
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                      Pool Central UK (Tous services)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Structure principale
                    </label>
                    <select
                      value={selectedStructureId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedStructureId(val);
                        setSelectedAttachmentId('');
                        setSelectedUnitId('');
                        updateEffectiveServiceId(val, '', '');
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue font-bold text-slate-800"
                    >
                      <option value="">-- Pool Central / Tous services --</option>
                      {baseStructures.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Structure de rattachement
                    </label>
                    <select
                      value={selectedAttachmentId}
                      disabled={!selectedStructureId || attachmentOptions.length === 0}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedAttachmentId(val);
                        setSelectedUnitId('');
                        updateEffectiveServiceId(selectedStructureId, val, '');
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">
                        {!selectedStructureId 
                          ? "Sélectionnez d'abord une structure" 
                          : attachmentOptions.length === 0 
                            ? "Aucun sous-service (affectation directe)" 
                            : "-- Choisir une structure de rattachement --"}
                      </option>
                      {attachmentOptions.map(att => (
                        <option key={att.id} value={att.id}>➜ {att.name} {att.code ? `(${att.code})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {selectedAttachmentId && unitOptions.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Unité / Service / Département spécifique
                      </label>
                      <select
                        value={selectedUnitId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedUnitId(val);
                          updateEffectiveServiceId(selectedStructureId, selectedAttachmentId, val);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue font-semibold text-slate-800"
                      >
                        <option value="">-- Affectation au niveau rattachement supérieur --</option>
                        {unitOptions.map(u => (
                          <option key={u.id} value={u.id}>⤷ {u.name} {u.code ? `(${u.code})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Informations complémentaires</label>
                <textarea
                  rows="2"
                  placeholder="Informations supplémentaires..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  {formLoading ? 'Enregistrement...' : 'Enregistrer le chauffeur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Driver */}
      {showEditModal && selectedDriver && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar border border-slate-200">
            <div className="px-6 py-4 bg-kindia-blue text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-kindia-gold" />
                <h3 className="font-heading font-extrabold text-base">Modifier le chauffeur {selectedDriver.nom} {selectedDriver.prenoms}</h3>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom de famille <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Prénoms <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.prenoms}
                    onChange={(e) => setFormData({ ...formData, prenoms: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Téléphone (Guinée +224) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Matricule</label>
                  <input
                    type="text"
                    value={formData.matricule}
                    onChange={(e) => setFormData({ ...formData, matricule: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">N° Permis de conduire</label>
                <input
                  type="text"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              {/* Affectation Organisationnelle / Service de rattachement */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-kindia-blue" />
                    <span className="font-bold text-xs text-slate-800">Affectation & Structure de rattachement</span>
                  </div>
                  {formData.service_id ? (
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                      Structure assignée
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                      Pool Central UK (Tous services)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Structure principale
                    </label>
                    <select
                      value={selectedStructureId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedStructureId(val);
                        setSelectedAttachmentId('');
                        setSelectedUnitId('');
                        updateEffectiveServiceId(val, '', '');
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue font-bold text-slate-800"
                    >
                      <option value="">-- Pool Central / Tous services --</option>
                      {baseStructures.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Structure de rattachement
                    </label>
                    <select
                      value={selectedAttachmentId}
                      disabled={!selectedStructureId || attachmentOptions.length === 0}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedAttachmentId(val);
                        setSelectedUnitId('');
                        updateEffectiveServiceId(selectedStructureId, val, '');
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">
                        {!selectedStructureId 
                          ? "Sélectionnez d'abord une structure" 
                          : attachmentOptions.length === 0 
                            ? "Aucun sous-service (affectation directe)" 
                            : "-- Choisir une structure de rattachement --"}
                      </option>
                      {attachmentOptions.map(att => (
                        <option key={att.id} value={att.id}>➜ {att.name} {att.code ? `(${att.code})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {selectedAttachmentId && unitOptions.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Unité / Service / Département spécifique
                      </label>
                      <select
                        value={selectedUnitId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedUnitId(val);
                          updateEffectiveServiceId(selectedStructureId, selectedAttachmentId, val);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue font-semibold text-slate-800"
                      >
                        <option value="">-- Affectation au niveau rattachement supérieur --</option>
                        {unitOptions.map(u => (
                          <option key={u.id} value={u.id}>⤷ {u.name} {u.code ? `(${u.code})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Statut</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kindia-blue"
                >
                  <option value="ACTIF">Actif</option>
                  <option value="INACTIF">Inactif</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Informations complémentaires</label>
                <textarea
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
    </div>
  );
}

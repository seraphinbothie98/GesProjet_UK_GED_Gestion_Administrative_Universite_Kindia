import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Plus, Search, UserCheck, UserX, Car, AlertTriangle, Eye, Edit3, CheckCircle, FileText, X } from 'lucide-react';

export default function StaffManagement() {
  const [staffList, setStaffList] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [staffMissions, setStaffMissions] = useState([]);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
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
  }, [statusFilter, searchQuery]);

  const loadData = async () => {
    try {
      const [staffData, servicesData] = await Promise.all([
        api.getStaff({ status: statusFilter, query: searchQuery }),
        api.getServices()
      ]);
      setStaffList(staffData);
      setServices(servicesData);
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

    // Duplicate Check (Rule 18)
    if (!forceCreate && !editingStaffId) {
      try {
        const dupRes = await api.checkDuplicateStaff({ matricule, nom, prenoms });
        if (dupRes.duplicate && dupRes.staff) {
          setDuplicateWarning(dupRes.staff);
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
    setNom(staff.nom);
    setPrenoms(staff.prenoms);
    setNationality(staff.nationality || 'Guinéenne');
    setFonction(staff.fonction);
    setServiceId(staff.service_id || '');
    setMatricule(staff.matricule || '');
    setTelephone(staff.telephone || '');
    setEmail(staff.email || '');
    setStatus(staff.status || 'ACTIF');
    setIsDriver(staff.is_driver === 1);
    setVehicleReg(staff.vehicle_registration || '');
    setVehicleBrand(staff.vehicle_brand || '');
    setVehicleModel(staff.vehicle_model || '');
    setShowAddModal(true);
  };

  const handleToggleStatus = async (staffId) => {
    try {
      await api.toggleStaffStatus(staffId);
      loadData();
    } catch (err) {
      alert('Erreur lors du changement de statut : ' + err.message);
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-kindia-blue text-white flex items-center justify-center font-bold shadow">
            <Users className="w-5 h-5 text-kindia-gold" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-kindia-gold uppercase tracking-wider block">RÉPERTOIRE OFFICIEL • UK</span>
            <h2 className="font-heading font-bold text-lg text-slate-800">Gestion du Personnel de l'Université</h2>
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="mt-3 sm:mt-0 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
        >
          <Plus className="w-4 h-4 text-kindia-gold" />
          <span>➕ AJOUTER UN MEMBRE DU PERSONNEL</span>
        </button>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher (Nom, Matricule, Fonction)..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-kindia-blue"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700"
          >
            <option value="">-- Tous les statuts --</option>
            <option value="ACTIF">ACTIFS UNIQUEMENT</option>
            <option value="INACTIF">INACTIFS UNIQUEMENT</option>
          </select>
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
                <th className="p-3.5">Service</th>
                <th className="p-3.5">Téléphone / Contact</th>
                <th className="p-3.5">Chauffeur ?</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Chargement du répertoire du personnel...</td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Aucun membre du personnel enregistré.</td>
                </tr>
              ) : (
                staffList.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-kindia-blue">{s.matricule || 'N/A'}</td>
                    <td className="p-3.5 font-bold text-slate-800">{s.nom} {s.prenoms}</td>
                    <td className="p-3.5 text-slate-600">{s.fonction}</td>
                    <td className="p-3.5 text-slate-600 font-semibold">{s.service_name || 'Non affecté'}</td>
                    <td className="p-3.5 text-slate-500">{s.telephone || s.email || 'N/A'}</td>
                    <td className="p-3.5">
                      {s.is_driver === 1 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Car className="w-3 h-3 mr-1" /> Chauffeur
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Non</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'ACTIF' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleViewCard(s.id)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                        title="Consulter la fiche"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleEdit(s)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                        title="Modifier"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(s.id)}
                        className={`p-1.5 rounded-lg transition ${
                          s.status === 'ACTIF' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                        title={s.status === 'ACTIF' ? 'Désactiver (Soft Delete)' : 'Réactiver'}
                      >
                        {s.status === 'ACTIF' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-kindia-blue">
                {editingStaffId ? '✏️ Modifier la Fiche du Personnel' : '➕ Enregistrer un Membre du Personnel (Rule 2)'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                ×
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
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold uppercase"
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
                    className="w-full p-2.5 rounded-xl border border-slate-300"
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
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nationalité *</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
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
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service d'Rattachement</label>
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium"
                  >
                    <option value="">-- Sélectionner un service --</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="Ex : +224 621 00 11 22"
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mail Professionnel</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex : agent@univ-kindia.edu.gn"
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* Chauffeur Toggle (Rule 4) */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2">
                <label className="flex items-center space-x-2 font-bold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDriver}
                    onChange={(e) => setIsDriver(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <span>☐ Autorisé comme chauffeur (is_driver = true)</span>
                </label>
                <p className="text-[10px] text-amber-800">
                  Si cette option est activée, cet agent pourra être sélectionné comme chauffeur lors des ordres de mission.
                </p>
              </div>

              {/* Vehicle Section (Rule 3) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs text-slate-800 flex items-center">
                  <Car className="w-4 h-4 mr-1.5 text-kindia-blue" />
                  🚗 Informations de Transport (Optionnel)
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
                  className="px-4 py-2 bg-kindia-blue text-white font-bold rounded-xl shadow hover:bg-kindia-lightBlue transition"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Warning Dialog (Rule 18) */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border-2 border-amber-400">
            <div className="flex items-center space-x-3 text-amber-800">
              <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0" />
              <h3 className="font-heading font-extrabold text-sm uppercase">
                ⚠️ PERSONNEL SIMILAIRE EXISTANT (Rule 18)
              </h3>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs space-y-1">
              <p className="font-bold text-amber-900">{duplicateWarning.nom} {duplicateWarning.prenoms}</p>
              <p className="text-amber-800 font-mono">Matricule : {duplicateWarning.matricule || 'N/A'}</p>
              <p className="text-amber-800">Fonction : {duplicateWarning.fonction}</p>
            </div>

            <p className="text-xs text-slate-600">
              Une personne possédant des identifiants identiques est déjà enregistrée dans le répertoire. Souhaitez-vous réutiliser la fiche existante ou créer un nouvel enregistrement ?
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setDuplicateWarning(null);
                  handleEdit(duplicateWarning);
                }}
                className="px-4 py-2 bg-kindia-blue text-white font-bold rounded-xl text-xs shadow hover:bg-kindia-lightBlue transition"
              >
                [UTILISER CETTE FICHE]
              </button>

              <button
                onClick={(e) => handleCreateSubmit(e, true)}
                className="px-4 py-2 bg-amber-500 text-white font-bold rounded-xl text-xs hover:bg-amber-600 transition"
              >
                [CRÉER QUAND MÊME]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Staff Card Modal (Rule 15 & 16) */}
      {viewingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-kindia-blue" />
                <h3 className="font-heading font-extrabold text-base text-slate-800">
                  👤 FICHE DU PERSONNEL : {viewingStaff.nom} {viewingStaff.prenoms}
                </h3>
              </div>
              <button onClick={() => setViewingStaff(null)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
                ×
              </button>
            </div>

            {/* General Info */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div><span className="font-bold text-slate-500">Nom :</span> <span className="font-bold text-slate-800">{viewingStaff.nom}</span></div>
              <div><span className="font-bold text-slate-500">Prénoms :</span> <span className="font-bold text-slate-800">{viewingStaff.prenoms}</span></div>
              <div><span className="font-bold text-slate-500">Matricule :</span> <span className="font-mono font-bold text-kindia-blue">{viewingStaff.matricule || 'N/A'}</span></div>
              <div><span className="font-bold text-slate-500">Nationalité :</span> <span>{viewingStaff.nationality}</span></div>
              <div><span className="font-bold text-slate-500">Fonction :</span> <span>{viewingStaff.fonction}</span></div>
              <div><span className="font-bold text-slate-500">Service :</span> <span>{viewingStaff.service_name || 'N/A'}</span></div>
              <div><span className="font-bold text-slate-500">Téléphone :</span> <span>{viewingStaff.telephone || 'N/A'}</span></div>
              <div><span className="font-bold text-slate-500">E-mail :</span> <span>{viewingStaff.email || 'N/A'}</span></div>
            </div>

            {/* Transport Section */}
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 text-xs space-y-2">
              <h4 className="font-bold text-amber-900 flex items-center">
                <Car className="w-4 h-4 mr-1.5 text-amber-600" />
                🚗 INFORMATIONS DE TRANSPORT
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-bold text-amber-800">Immatriculation :</span> <span className="font-mono font-bold">{viewingStaff.vehicle_registration || 'Aucun véhicule attribué'}</span></div>
                <div><span className="font-bold text-amber-800">Marque / Modèle :</span> <span>{viewingStaff.vehicle_brand} {viewingStaff.vehicle_model}</span></div>
                <div><span className="font-bold text-amber-800">Chauffeur Autorisé :</span> <span>{viewingStaff.is_driver === 1 ? 'Oui' : 'Non'}</span></div>
              </div>
            </div>

            {/* Mission History Section (Rule 16) */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-800 flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-kindia-blue" />
                📋 HISTORIQUE DES ORDRES DE MISSION ({staffMissions.length})
              </h4>

              {staffMissions.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-slate-400 text-center text-xs">
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
    </div>
  );
}

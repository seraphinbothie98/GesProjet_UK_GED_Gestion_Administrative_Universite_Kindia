import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plane, Plus, Search, Eye, CheckCircle, Send, FileText, 
  Calendar, Building2, User, Phone, Mail, AlertCircle, X, Download, Printer,
  Archive, Clock, Award, CheckSquare, CornerUpLeft, ShieldCheck
} from 'lucide-react';

export default function ExternalMissionaries() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals & Active Selections
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordHistory, setRecordHistory] = useState([]);
  const [previewVersion, setPreviewVersion] = useState('signed'); // signed, original, arrival, final
  const [actionLoading, setActionLoading] = useState(false);

  // Delivery Modal State
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryData, setDeliveryData] = useState({
    recipient_name: '',
    delivery_notes: '',
    delivery_date: ''
  });

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
    phone: '',
    email: '',
    observations: '',
    original_document: null
  });

  const isSGOrAdmin = user?.role_code === 'ADMINISTRATEUR' || user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user?.role_code === 'RECTEUR';
  const isSC = user?.service_code === 'SC' || user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user?.role_code === 'ADMINISTRATEUR';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [missList, servList] = await Promise.all([
        api.getExternalMissionaries({ status: selectedStatus, search: searchQuery }),
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
  }, [selectedStatus]);

  const loadRecordDetailAndHistory = async (rec) => {
    setSelectedRecord(rec);
    if (rec.signed_document_path) setPreviewVersion('signed');
    else setPreviewVersion('original');

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
      setFormData(prev => ({ ...prev, original_document: e.target.files[0] }));
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.original_document) {
      setError('Veuillez fournir le scan ou le PDF de l’ordre de mission original.');
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
      setSuccessMsg(`Ordre de mission externe enregistré avec succès (Réf UK-GED: ${res.reference}).`);
      setShowAddModal(false);
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

  // Actions Circuit
  const handleTransmitToSG = async (id) => {
    if (!window.confirm('Confirmer la transmission de cet ordre de mission au Secrétaire Général pour signature électronique ?')) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.transmitExternalMissionaryToSG(id);
      setSuccessMsg(res.message || 'Ordre de mission transmis au SG.');
      if (selectedRecord && selectedRecord.id === id) {
        const updated = await api.getExternalMissionaryById(id);
        loadRecordDetailAndHistory(updated);
      }
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la transmission au SG.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintDocument = async (id) => {
    try {
      await api.printExternalMissionary(id);
      window.open(`/api/external-missionaries/${id}/document/${previewVersion}`, '_blank');
      if (selectedRecord) {
        const updated = await api.getExternalMissionaryById(id);
        loadRecordDetailAndHistory(updated);
      }
    } catch (err) {
      console.error('Print error:', err);
    }
  };

  const handleOpenDeliveryModal = (rec) => {
    setSelectedRecord(rec);
    setDeliveryData({
      recipient_name: `${rec.first_names} ${rec.last_name}`,
      delivery_notes: '',
      delivery_date: new Date().toISOString().substring(0, 16)
    });
    setShowDeliveryModal(true);
  };

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.deliverExternalMissionary(selectedRecord.id, deliveryData);
      setSuccessMsg(res.message || 'Remise au missionnaire enregistrée.');
      setShowDeliveryModal(false);
      const updated = await api.getExternalMissionaryById(selectedRecord.id);
      loadRecordDetailAndHistory(updated);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’enregistrement de la remise.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveRecord = async (id) => {
    if (!window.confirm('Voulez-vous vraiment classer cet ordre de mission dans les Archives électroniques de l’Université ?')) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.archiveExternalMissionary(id);
      setSuccessMsg(res.message || 'Document classé aux archives avec succès.');
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ENREGISTRÉ – EN ATTENTE DE TRANSMISSION AU SG':
      case 'ENREGISTRÉ':
      case 'ORDRE DE MISSION REÇU':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>📥</span><span>Enregistré (SC)</span></span>;
      case 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1 animate-pulse"><span>⏳</span><span>Transmis au SG (À signer)</span></span>;
      case 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>✍️</span><span>Signé (Retour SC)</span></span>;
      case 'REJETÉ PAR LE SECRÉTAIRE GÉNÉRAL':
        return <span className="px-2.5 py-1 bg-red-100 text-red-900 border border-red-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>❌</span><span>Rejeté par le SG</span></span>;
      case 'REMIS AU MISSIONNAIRE':
        return <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>🤝</span><span>Remis au missionnaire</span></span>;
      case 'ARCHIVÉ':
        return <span className="px-2.5 py-1 bg-slate-200 text-slate-800 border border-slate-300 rounded-full text-xs font-extrabold inline-flex items-center space-x-1"><span>📁</span><span>Archivé</span></span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-kindia-blue to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 bg-kindia-gold/20 rounded-xl text-kindia-gold">
              <Plane className="w-6 h-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-heading font-extrabold tracking-wide">
              Ordres de Mission des Missionnaires Externes
            </h1>
          </div>
          <p className="text-xs text-slate-300">
            Circuit Obligatoire : Missionnaire Externe ➔ Secrétariat Central ➔ Secrétaire Général (Signature) ➔ Secrétariat Central ➔ Remise ➔ Archivage
          </p>
        </div>

        {isSC && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-kindia-gold text-kindia-blue hover:bg-yellow-400 font-extrabold rounded-xl shadow-lg transition flex items-center space-x-2 text-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Enregistrer un ordre de mission externe</span>
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
            className="px-4 py-2 bg-kindia-blue text-white text-xs font-bold rounded-xl hover:bg-kindia-lightBlue transition"
          >
            Rechercher
          </button>
        </form>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-kindia-blue"
          >
            <option value="">Tous les statuts</option>
            <option value="ENREGISTRÉ – EN ATTENTE DE TRANSMISSION AU SG">Enregistré (En attente transmission)</option>
            <option value="TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE">Transmis au SG (À signer)</option>
            <option value="SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL">Signé (Retour SC)</option>
            <option value="REJETÉ PAR LE SECRÉTAIRE GÉNÉRAL">Rejeté par le SG</option>
            <option value="REMIS AU MISSIONNAIRE">Remis au missionnaire</option>
            <option value="ARCHIVÉ">Archivé</option>
          </select>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-4 border-kindia-gold border-t-transparent rounded-full mx-auto mb-3"></div>
            <span className="text-xs font-bold">Chargement des ordres de mission externes...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Plane className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-600">Aucun ordre de mission externe trouvé</p>
            <p className="text-xs text-slate-400">Cliquez sur « Enregistrer un ordre de mission externe » pour ajouter une nouvelle fiche.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Réf UK-GED</th>
                  <th className="py-3.5 px-4">Missionnaire</th>
                  <th className="py-3.5 px-4">Institution & Réf OM</th>
                  <th className="py-3.5 px-4">Objet & Dates</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {records.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-kindia-blue">
                      {rec.reference}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{rec.last_name} {rec.first_names}</div>
                      <div className="text-[10px] text-slate-500">{rec.function_title}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{rec.origin_institution}</div>
                      <div className="text-[10px] font-mono text-slate-500">Réf: {rec.mission_order_ref}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-slate-800 truncate">{rec.object_of_mission}</div>
                      <div className="text-[10px] text-slate-500">
                        {rec.expected_start_date ? new Date(rec.expected_start_date).toLocaleDateString('fr-FR') : 'N/A'} - {rec.expected_end_date ? new Date(rec.expected_end_date).toLocaleDateString('fr-FR') : 'N/A'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(rec.status)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => loadRecordDetailAndHistory(rec)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1"
                        title="Consulter la fiche et l'historique chronologique"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Fiche</span>
                      </button>

                      {isSC && (rec.status === 'ENREGISTRÉ – EN ATTENTE DE TRANSMISSION AU SG' || rec.status === 'REJETÉ PAR LE SECRÉTAIRE GÉNÉRAL' || rec.status === 'ENREGISTRÉ') && (
                        <button
                          onClick={() => handleTransmitToSG(rec.id)}
                          disabled={actionLoading}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 shadow-sm"
                          title="Transmettre au Secrétaire Général pour signature"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Transmettre au SG</span>
                        </button>
                      )}

                      {isSC && rec.status === 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL' && (
                        <button
                          onClick={() => handleOpenDeliveryModal(rec)}
                          disabled={actionLoading}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 shadow-sm"
                          title="Remettre en main propre au missionnaire externe"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Remettre au missionnaire</span>
                        </button>
                      )}

                      {isSC && rec.status === 'REMIS AU MISSIONNAIRE' && (
                        <button
                          onClick={() => handleArchiveRecord(rec.id)}
                          disabled={actionLoading}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 shadow-sm"
                          title="Classer dans les archives électroniques"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archiver</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Registration (SC) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8">
            <div className="p-5 bg-kindia-blue text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plane className="w-5 h-5 text-kindia-gold" />
                <h3 className="font-heading font-extrabold text-base">Enregistrer un Ordre de Mission Externe</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nom du Missionnaire *</label>
                  <input
                    type="text"
                    name="last_name"
                    required
                    value={formData.last_name}
                    onChange={handleInputChange}
                    placeholder="Ex: DIALLO"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prénoms du Missionnaire *</label>
                  <input
                    type="text"
                    name="first_names"
                    required
                    value={formData.first_names}
                    onChange={handleInputChange}
                    placeholder="Ex: Mamadou Alpha"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Institution / Structure d’origine *</label>
                  <input
                    type="text"
                    name="origin_institution"
                    required
                    value={formData.origin_institution}
                    onChange={handleInputChange}
                    placeholder="Ex: Université Gamal Abdel Nasser de Conakry / MESRSI"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fonction *</label>
                  <input
                    type="text"
                    name="function_title"
                    required
                    value={formData.function_title}
                    onChange={handleInputChange}
                    placeholder="Ex: Expert Pédagogique / Professeur"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Réf Ordre de Mission d’origine *</label>
                  <input
                    type="text"
                    name="mission_order_ref"
                    required
                    value={formData.mission_order_ref}
                    onChange={handleInputChange}
                    placeholder="Ex: OM/2026/045/UGANC"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Autorité ayant établi l’ordre de mission</label>
                  <input
                    type="text"
                    name="issuing_authority"
                    value={formData.issuing_authority}
                    onChange={handleInputChange}
                    placeholder="Ex: Le Recteur de UGANC / Le Ministre"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Objet de la Mission *</label>
                <textarea
                  name="object_of_mission"
                  required
                  rows={2}
                  value={formData.object_of_mission}
                  onChange={handleInputChange}
                  placeholder="Ex: Animation de l’atelier de formation sur la démarche qualité..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lieu de la Mission</label>
                  <input
                    type="text"
                    name="location_of_mission"
                    value={formData.location_of_mission}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date début</label>
                    <input
                      type="date"
                      name="expected_start_date"
                      value={formData.expected_start_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date fin</label>
                    <input
                      type="date"
                      name="expected_end_date"
                      value={formData.expected_end_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone / Contact</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Ex: +224 628 00 11 22"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Ex: missionnaire@univ.gn"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observations particulières</label>
                <textarea
                  name="observations"
                  rows={2}
                  value={formData.observations}
                  onChange={handleInputChange}
                  placeholder="Notes internes, spécificités du séjour..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              {/* Upload Original Document */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <label className="block font-extrabold text-amber-900 text-xs">
                  📁 Ordre de Mission Original Scanné / PDF *
                </label>
                <p className="text-[11px] text-amber-800">
                  L'ordre de mission officiel apporté par le missionnaire est conservé comme document source principal. La signature électronique du SG sera apposée sur ce fichier.
                </p>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl transition flex items-center space-x-2 shadow-lg"
                >
                  {actionLoading ? (
                    <span>Enregistrement en cours...</span>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-kindia-gold" />
                      <span>Enregistrer la Fiche</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record View & Timeline Drawer / Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
            <div className="p-5 bg-kindia-blue text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] text-kindia-gold uppercase tracking-wider block font-bold">Fiche Ordre de Mission Externe</span>
                <h3 className="font-heading font-extrabold text-base">{selectedRecord.last_name} {selectedRecord.first_names}</h3>
                <span className="text-xs text-slate-300 font-mono">Réf UK-GED: {selectedRecord.reference} • Réf OM: {selectedRecord.mission_order_ref}</span>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-300 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {/* Status Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Statut actuel du circuit :</span>
                  <div>{getStatusBadge(selectedRecord.status)}</div>
                </div>

                {/* Circuit Control Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {isSC && (selectedRecord.status === 'ENREGISTRÉ – EN ATTENTE DE TRANSMISSION AU SG' || selectedRecord.status === 'REJETÉ PAR LE SECRÉTAIRE GÉNÉRAL' || selectedRecord.status === 'ENREGISTRÉ') && (
                    <button
                      onClick={() => handleTransmitToSG(selectedRecord.id)}
                      disabled={actionLoading}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                    >
                      <Send className="w-4 h-4" />
                      <span>Transmettre au Secrétaire Général</span>
                    </button>
                  )}

                  {isSC && selectedRecord.status === 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL' && (
                    <>
                      <button
                        onClick={() => handlePrintDocument(selectedRecord.id)}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Imprimer</span>
                      </button>
                      <button
                        onClick={() => handleOpenDeliveryModal(selectedRecord)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Remettre au missionnaire</span>
                      </button>
                    </>
                  )}

                  {isSC && selectedRecord.status === 'REMIS AU MISSIONNAIRE' && (
                    <button
                      onClick={() => handleArchiveRecord(selectedRecord.id)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                    >
                      <Archive className="w-4 h-4" />
                      <span>Classer aux Archives</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Rejection Reason Alert if rejected */}
              {selectedRecord.status === 'REJETÉ PAR LE SECRÉTAIRE GÉNÉRAL' && selectedRecord.rejection_reason && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 space-y-1">
                  <div className="font-extrabold flex items-center space-x-2">
                    <X className="w-4 h-4 text-red-600" />
                    <span>Motif du Rejet par le Secrétaire Général :</span>
                  </div>
                  <p className="text-xs text-red-700 italic pl-6">{selectedRecord.rejection_reason}</p>
                </div>
              )}

              {/* Details & Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-200">
                <div className="space-y-2">
                  <div><span className="font-bold text-slate-500">Nom & Prénoms :</span> <span className="font-bold text-slate-800">{selectedRecord.last_name} {selectedRecord.first_names}</span></div>
                  <div><span className="font-bold text-slate-500">Institution d’origine :</span> <span className="text-slate-800">{selectedRecord.origin_institution}</span></div>
                  <div><span className="font-bold text-slate-500">Fonction :</span> <span className="text-slate-800">{selectedRecord.function_title}</span></div>
                  <div><span className="font-bold text-slate-500">Autorité d’émission :</span> <span className="text-slate-800">{selectedRecord.issuing_authority || 'Non spécifiée'}</span></div>
                  <div><span className="font-bold text-slate-500">Contact / Email :</span> <span className="text-slate-800">{selectedRecord.phone || 'N/A'} {selectedRecord.email ? `(${selectedRecord.email})` : ''}</span></div>
                </div>
                <div className="space-y-2">
                  <div><span className="font-bold text-slate-500">Objet :</span> <span className="text-slate-800">{selectedRecord.object_of_mission}</span></div>
                  <div><span className="font-bold text-slate-500">Lieu de mission :</span> <span className="text-slate-800">{selectedRecord.location_of_mission}</span></div>
                  <div><span className="font-bold text-slate-500">Période prévue :</span> <span className="text-slate-800">{selectedRecord.expected_start_date ? new Date(selectedRecord.expected_start_date).toLocaleDateString('fr-FR') : 'N/A'} au {selectedRecord.expected_end_date ? new Date(selectedRecord.expected_end_date).toLocaleDateString('fr-FR') : 'N/A'}</span></div>
                  <div><span className="font-bold text-slate-500">Observations :</span> <span className="text-slate-800">{selectedRecord.observations || 'Aucune'}</span></div>
                </div>
              </div>

              {/* Chronologie Obligatoire (Timeline History) */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                  <Clock className="w-4 h-4 text-kindia-gold" />
                  <h4 className="font-heading font-extrabold text-xs text-kindia-gold uppercase tracking-wider">
                    Chronologie & Traçabilité Obligatoire du Circuit
                  </h4>
                </div>

                <div className="space-y-3 pt-1">
                  {recordHistory.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic">Aucun historique disponible.</div>
                  ) : (
                    recordHistory.map((h, idx) => (
                      <div key={h.id || idx} className="flex items-start space-x-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-kindia-gold mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white font-mono text-[11px]">
                              {new Date(h.timestamp).toLocaleDateString('fr-FR')} – {new Date(h.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">
                              {h.first_name ? `${h.first_name} ${h.last_name}` : 'Système'} ({h.service_name || 'SC'})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5">{h.details}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Document Viewer */}
              <div className="bg-slate-100 rounded-xl border border-slate-300 p-3 min-h-[450px] flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-200 rounded-lg text-slate-800 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs">Visualisation du document :</span>
                    <button
                      onClick={() => setPreviewVersion('original')}
                      className={`px-3 py-1 rounded text-[11px] font-bold transition ${previewVersion === 'original' ? 'bg-kindia-blue text-white' : 'bg-white text-slate-700'}`}
                    >
                      📄 Document Original Source
                    </button>
                    <button
                      onClick={() => setPreviewVersion('signed')}
                      disabled={!selectedRecord.signed_document_path}
                      className={`px-3 py-1 rounded text-[11px] font-bold transition ${previewVersion === 'signed' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 disabled:opacity-40'}`}
                    >
                      ✍️ Document Signé SG
                    </button>
                  </div>

                  <a
                    href={`/api/external-missionaries/${selectedRecord.id}/document/${previewVersion}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-800 rounded text-[11px] font-bold border border-slate-300 flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger PDF</span>
                  </a>
                </div>

                <iframe
                  src={`/api/external-missionaries/${selectedRecord.id}/document/${previewVersion}`}
                  className="w-full flex-1 min-h-[400px] rounded-lg border border-slate-300 bg-white"
                  title="Document Viewer"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Confirmation Modal (SC) */}
      {showDeliveryModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-200" />
                <h3 className="font-heading font-extrabold text-sm">Remise au Missionnaire Externe</h3>
              </div>
              <button onClick={() => setShowDeliveryModal(false)} className="text-emerald-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDelivery} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nom du Missionnaire / Récipient *</label>
                <input
                  type="text"
                  required
                  value={deliveryData.recipient_name}
                  onChange={(e) => setDeliveryData(prev => ({ ...prev, recipient_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Date et Heure de Remise</label>
                <input
                  type="datetime-local"
                  value={deliveryData.delivery_date}
                  onChange={(e) => setDeliveryData(prev => ({ ...prev, delivery_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observations éventuelles</label>
                <textarea
                  rows={2}
                  placeholder="Remis en main propre au Secrétariat..."
                  value={deliveryData.delivery_notes}
                  onChange={(e) => setDeliveryData(prev => ({ ...prev, delivery_notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDeliveryModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow"
                >
                  Confirmé - Valider la Remise
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

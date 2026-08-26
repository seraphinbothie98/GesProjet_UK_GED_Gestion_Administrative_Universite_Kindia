import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, Shield, Plus, Edit, Trash2, CheckCircle2, XCircle, Search, 
  Filter, AlertCircle, RefreshCw, Lock, Unlock, Eye, Settings, Building2,
  Users, Check, X, ShieldAlert, Sparkles, Scale, Info, Save
} from 'lucide-react';

export default function DocumentTypeAdmin() {
  const { user } = useAuth();
  const [types, setTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterRestriction, setFilterRestriction] = useState('ALL');

  // Permissions Matrix Modal
  const [showPermsModal, setShowPermsModal] = useState(false);
  const [selectedTypeForPerms, setSelectedTypeForPerms] = useState(null);
  const [permsMatrix, setPermsMatrix] = useState([]);
  const [savingPerms, setSavingPerms] = useState(false);

  // Type Create/Edit Modal
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formCode, setFormCode] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formCategory, setFormCategory] = useState('OFFICIAL');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('FileText');
  const [formIsRestricted, setFormIsRestricted] = useState(false);
  const [formRefPattern, setFormRefPattern] = useState('');
  const [formOrder, setFormOrder] = useState(50);
  const [savingType, setSavingType] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [typesRes, servRes, rolesRes] = await Promise.all([
        api.getDocumentTypes(),
        api.getServices().catch(() => []),
        api.getRoles().catch(() => [])
      ]);
      setTypes(typesRes || []);
      setServices(servRes || []);
      setRoles(rolesRes || []);
    } catch (err) {
      console.error('Load doc types error:', err);
      setError('Erreur lors du chargement des types de documents : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open Permissions Matrix Modal
  const handleOpenPermissions = async (type) => {
    try {
      setSelectedTypeForPerms(type);
      setShowPermsModal(true);
      const res = await api.getDocumentTypePermissions(type.code);
      setPermsMatrix(res.permissions || []);
    } catch (err) {
      console.error('Open permissions error:', err);
      setError('Impossible de charger les permissions : ' + err.message);
    }
  };

  // Toggle permission for a service
  const handleToggleServicePerm = (serviceId, permKey) => {
    setPermsMatrix(prev => {
      const existingIdx = prev.findIndex(p => p.service_id === serviceId && !p.role_id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const currentVal = updated[existingIdx][permKey] === 1;
        updated[existingIdx] = {
          ...updated[existingIdx],
          [permKey]: currentVal ? 0 : 1
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            document_type_code: selectedTypeForPerms.code,
            service_id: serviceId,
            role_id: null,
            can_create: permKey === 'can_create' ? 1 : 0,
            can_edit: permKey === 'can_edit' ? 1 : 1,
            can_view: permKey === 'can_view' ? 1 : 1,
            can_delete: 0
          }
        ];
      }
    });
  };

  // Save Permissions Matrix
  const handleSavePermissions = async () => {
    if (!selectedTypeForPerms) return;
    try {
      setSavingPerms(true);
      await api.updateDocumentTypePermissions(selectedTypeForPerms.code, permsMatrix);
      setSuccessMsg(`Permissions du type [${selectedTypeForPerms.label}] enregistrées avec succès.`);
      setShowPermsModal(false);
      loadData();
    } catch (err) {
      console.error('Save permissions error:', err);
      setError('Erreur lors de l’enregistrement des permissions : ' + err.message);
    } finally {
      setSavingPerms(false);
    }
  };

  // Open Create/Edit Type Modal
  const handleOpenTypeModal = (type = null) => {
    setEditingType(type);
    if (type) {
      setFormCode(type.code);
      setFormLabel(type.label);
      setFormCategory(type.category || 'OFFICIAL');
      setFormDescription(type.description || '');
      setFormIcon(type.icon || 'FileText');
      setFormIsRestricted(type.is_restricted === 1);
      setFormRefPattern(type.default_reference_pattern || '');
      setFormOrder(type.display_order || 50);
    } else {
      setFormCode('');
      setFormLabel('');
      setFormCategory('OFFICIAL');
      setFormDescription('');
      setFormIcon('FileText');
      setFormIsRestricted(false);
      setFormRefPattern('{CODE}/{SERVICE}/{ANNEE}/{NUMERO}');
      setFormOrder(types.length + 1);
    }
    setShowTypeModal(true);
  };

  // Save Type
  const handleSaveType = async (e) => {
    e.preventDefault();
    if (!formLabel.trim()) {
      setError('Le libellé du type de document est obligatoire.');
      return;
    }

    try {
      setSavingType(true);
      setError('');
      if (editingType) {
        await api.updateDocumentType(editingType.code, {
          label: formLabel.trim(),
          category: formCategory,
          description: formDescription.trim(),
          icon: formIcon,
          is_restricted: formIsRestricted,
          default_reference_pattern: formRefPattern.trim(),
          display_order: formOrder
        });
        setSuccessMsg(`Type de document [${formLabel}] modifié avec succès.`);
      } else {
        if (!formCode.trim()) {
          setError('Le code unique du type de document est obligatoire.');
          return;
        }
        await api.createDocumentType({
          code: formCode.trim().toUpperCase(),
          label: formLabel.trim(),
          category: formCategory,
          description: formDescription.trim(),
          icon: formIcon,
          is_restricted: formIsRestricted,
          default_reference_pattern: formRefPattern.trim() || `${formCode.trim().toUpperCase()}/{SERVICE}/{ANNEE}/{NUMERO}`,
          display_order: formOrder
        });
        setSuccessMsg(`Nouveau type de document [${formLabel}] créé avec succès.`);
      }
      setShowTypeModal(false);
      loadData();
    } catch (err) {
      console.error('Save doc type error:', err);
      setError(err.message || 'Erreur lors de l’enregistrement du type de document.');
    } finally {
      setSavingType(false);
    }
  };

  // Toggle Active Status (Logical deactivation)
  const handleToggleActive = async (type) => {
    try {
      if (type.is_active === 1) {
        if (window.confirm(`Voulez-vous désactiver le type [${type.label}] ? Les documents historiques associés resteront 100% préservés.`)) {
          await api.deleteDocumentType(type.code);
          setSuccessMsg(`Type [${type.label}] désactivé avec succès.`);
          loadData();
        }
      } else {
        await api.updateDocumentType(type.code, { is_active: 1 });
        setSuccessMsg(`Type [${type.label}] réactivé avec succès.`);
        loadData();
      }
    } catch (err) {
      console.error('Toggle active error:', err);
      setError(err.message);
    }
  };

  // Filtered types
  const filteredTypes = types.filter(t => {
    const matchesSearch = !search || t.label?.toLowerCase().includes(search.toLowerCase()) || t.code?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
    const matchesRestr = filterRestriction === 'ALL' || 
      (filterRestriction === 'RESTRICTED' && t.is_restricted === 1) ||
      (filterRestriction === 'ORDINARY' && t.is_restricted !== 1);
    return matchesSearch && matchesCategory && matchesRestr;
  });

  const countTotal = types.length;
  const countRestricted = types.filter(t => t.is_restricted === 1).length;
  const countOrdinary = types.filter(t => t.is_restricted !== 1).length;
  const countActive = types.filter(t => t.is_active === 1).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-kindia-blue via-slate-900 to-kindia-blue rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-2">
            <span className="p-2 rounded-xl bg-white/10 backdrop-blur-xs text-amber-400">
              <Scale className="w-5 h-5" />
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              Administration Sécurité & Gouvernance
            </span>
          </div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-white">
            Types de Documents & Permissions
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1">
            Gérez le catalogue des actes administratifs de l'Université de Kindia, le statut régalien/restreint et accordez des permissions spécifiques par service.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={loadData}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition backdrop-blur-xs cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => handleOpenTypeModal(null)}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs transition flex items-center space-x-2 shadow-lg shadow-emerald-900/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouveau Type de Document</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-5 py-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-900">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Types Définis</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{countTotal}</span>
            <span className="text-xs text-slate-500 font-bold">types</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Services Ordinaires</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-emerald-700">{countOrdinary}</span>
            <span className="text-xs text-emerald-600 font-bold">autorisés par défaut</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Types Restreints / Régaliens</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-amber-700">{countRestricted}</span>
            <span className="text-xs text-amber-600 font-bold">Décret, Arrêté, Loi, etc.</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-kindia-blue">Types Actifs</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-kindia-blue">{countActive}</span>
            <span className="text-xs text-slate-500 font-bold">disponibles</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par libellé ou code..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-kindia-blue"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 cursor-pointer"
          >
            <option value="ALL">Toutes les catégories</option>
            <option value="OFFICIAL">Actes Officiels</option>
            <option value="REGULATORY">Réglementaires</option>
            <option value="ACADEMIC">Académiques</option>
            <option value="INTERNAL">Internes</option>
            <option value="CORRESPONDENCE">Correspondances</option>
          </select>

          <select
            value={filterRestriction}
            onChange={(e) => setFilterRestriction(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 cursor-pointer"
          >
            <option value="ALL">Tous les niveaux d'accès</option>
            <option value="ORDINARY">🟢 Services Ordinaires (Par défaut)</option>
            <option value="RESTRICTED">🔴 Restreints (SC & Admin)</option>
          </select>
        </div>
      </div>

      {/* Document Types Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                <th className="px-6 py-4">Type de Document</th>
                <th className="px-4 py-4">Catégorie</th>
                <th className="px-4 py-4">Niveau de Droit</th>
                <th className="px-4 py-4">Structure Référence</th>
                <th className="px-4 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTypes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <span className="font-bold">Aucun type de document trouvé</span>
                  </td>
                </tr>
              ) : (
                filteredTypes.map(t => {
                  const isRestricted = t.is_restricted === 1;
                  const isActive = t.is_active === 1;

                  return (
                    <tr key={t.code} className="hover:bg-slate-50/60 transition">
                      {/* Name & Code */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black shrink-0 ${
                            isRestricted ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-kindia-blue'
                          }`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-heading font-black text-slate-900 block">
                              {t.label}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {t.code}
                            </span>
                            {t.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {t.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700">
                          {t.category || 'OFFICIAL'}
                        </span>
                      </td>

                      {/* Access Level */}
                      <td className="px-4 py-4">
                        {isRestricted ? (
                          <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                            <Lock className="w-3 h-3 text-amber-700" />
                            <span>Restreint (SC & Admin)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Tous Services</span>
                          </div>
                        )}
                      </td>

                      {/* Reference Pattern */}
                      <td className="px-4 py-4">
                        <code className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded-md text-slate-700">
                          {t.default_reference_pattern || `${t.code}/{SERVICE}/{ANNEE}/{NUMERO}`}
                        </code>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Actif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-slate-400 font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                            <span>Inactif</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Permissions Matrix Button */}
                          <button
                            onClick={() => handleOpenPermissions(t)}
                            className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-kindia-blue transition cursor-pointer"
                            title="Gérer les permissions par service"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Type */}
                          <button
                            onClick={() => handleOpenTypeModal(t)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title="Modifier les propriétés"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active */}
                          <button
                            onClick={() => handleToggleActive(t)}
                            className={`p-2 rounded-xl transition cursor-pointer ${
                              isActive
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                            }`}
                            title={isActive ? 'Désactiver ce type' : 'Activer ce type'}
                          >
                            {isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
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

      {/* ========================================================================= */}
      {/* MODAL 1 : MATRICE DE PERMISSIONS PAR SERVICE ET RÔLE                     */}
      {/* ========================================================================= */}
      {showPermsModal && selectedTypeForPerms && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
            
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-kindia-blue to-slate-900 text-white flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center">
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-white">
                    Permissions : {selectedTypeForPerms.label} ({selectedTypeForPerms.code})
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Définissez les dérogations et autorisations expresses par service pour ce type de document.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPermsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              {/* Notice */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start space-x-3 text-xs text-blue-900">
                <Info className="w-4 h-4 text-kindia-blue shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Règles institutionnelles automatiques :</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-blue-800">
                    <li>L'<strong>Administrateur</strong> et le <strong>Secrétariat Central (SC)</strong> ont toujours accès total.</li>
                    <li>{selectedTypeForPerms.is_restricted === 1 
                      ? "Ce type étant restreint, les services ordinaires sont bloqués SAUF si vous cochez 'Autoriser Création' ci-dessous."
                      : "Ce type étant ordinaire, tous les services peuvent créer par défaut SAUF si vous décochez la permission ci-dessous."}
                    </li>
                  </ul>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                      <th className="px-4 py-3">Service de l'Université</th>
                      <th className="px-4 py-3 text-center">Création</th>
                      <th className="px-4 py-3 text-center">Modification</th>
                      <th className="px-4 py-3 text-center">Consultation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {services.map(serv => {
                      const explicitPerm = permsMatrix.find(p => p.service_id === serv.id && !p.role_id);
                      
                      // Calculated effective state
                      const canCreate = explicitPerm ? explicitPerm.can_create === 1 : (selectedTypeForPerms.is_restricted !== 1);
                      const canEdit = explicitPerm ? explicitPerm.can_edit === 1 : true;
                      const canView = explicitPerm ? explicitPerm.can_view === 1 : true;

                      const isSC = serv.code === 'SC';

                      return (
                        <tr key={serv.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-800 block">{serv.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{serv.code}</span>
                          </td>

                          {/* Can Create Checkbox */}
                          <td className="px-4 py-3 text-center">
                            {isSC ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Toujours Autorisé (SC)</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleServicePerm(serv.id, 'can_create')}
                                className={`w-6 h-6 rounded-lg border flex items-center justify-center mx-auto transition cursor-pointer ${
                                  canCreate 
                                    ? 'bg-emerald-600 border-emerald-600 text-white' 
                                    : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>

                          {/* Can Edit Checkbox */}
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleServicePerm(serv.id, 'can_edit')}
                              className={`w-6 h-6 rounded-lg border flex items-center justify-center mx-auto transition cursor-pointer ${
                                canEdit 
                                  ? 'bg-blue-600 border-blue-600 text-white' 
                                  : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </td>

                          {/* Can View Checkbox */}
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleServicePerm(serv.id, 'can_view')}
                              className={`w-6 h-6 rounded-lg border flex items-center justify-center mx-auto transition cursor-pointer ${
                                canView 
                                  ? 'bg-slate-800 border-slate-800 text-white' 
                                  : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPermsModal(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={savingPerms}
                className="px-5 py-2 bg-kindia-blue hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center space-x-2 shadow-md cursor-pointer"
              >
                {savingPerms ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Enregistrer les Permissions</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2 : CRÉATION / MODIFICATION D'UN TYPE DE DOCUMENT                   */}
      {/* ========================================================================= */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-scale-up">
            
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-kindia-blue to-slate-900 text-white flex items-center justify-between shadow-md">
              <h3 className="font-heading font-extrabold text-base text-white">
                {editingType ? `Modifier : ${editingType.label}` : 'Nouveau Type de Document'}
              </h3>
              <button
                onClick={() => setShowTypeModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveType} className="p-6 space-y-4 text-xs">
              
              {/* Code */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Code Unique (Identifiant système) *
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                  disabled={!!editingType}
                  placeholder="EX: CONVOCATION, ORDRE_MISSION"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 disabled:opacity-60"
                  required
                />
              </div>

              {/* Label */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Libellé Officiel *
                </label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="EX: Convocation de Commission"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  required
                />
              </div>

              {/* Category & Display Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catégorie</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="OFFICIAL">Actes Officiels</option>
                    <option value="REGULATORY">Réglementaires</option>
                    <option value="ACADEMIC">Académiques</option>
                    <option value="INTERNAL">Internes</option>
                    <option value="CORRESPONDENCE">Correspondances</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ordre d'affichage</label>
                  <input
                    type="number"
                    value={formOrder}
                    onChange={(e) => setFormOrder(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Default Reference Pattern */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Modèle de Référence par Défaut
                </label>
                <input
                  type="text"
                  value={formRefPattern}
                  onChange={(e) => setFormRefPattern(e.target.value)}
                  placeholder="{CODE}/{SERVICE}/{ANNEE}/{NUMERO}"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-800"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Balises disponibles : {'{CODE}'}, {'{SERVICE}'}, {'{ANNEE}'}, {'{NUMERO}'}
                </span>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows="2"
                  placeholder="Usage et contexte d'utilisation du type de document..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              {/* Restrict toggle */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Type Restreint / Régalien</span>
                  <span className="text-[10px] text-slate-500">
                    Interdit par défaut aux services ordinaires (Seuls SC & Admin y ont accès sans permission explicite).
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formIsRestricted}
                  onChange={(e) => setFormIsRestricted(e.target.checked)}
                  className="w-4 h-4 rounded text-kindia-blue focus:ring-kindia-blue cursor-pointer"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingType}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black transition flex items-center space-x-2 shadow-md cursor-pointer"
                >
                  {savingType ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{editingType ? 'Enregistrer les Modifications' : 'Créer le Type'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

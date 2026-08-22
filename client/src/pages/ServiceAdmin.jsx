import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Building2, Plus, Edit, Users, FileText, X, ChevronRight, ChevronDown, 
  Shield, UserCheck, History, Award, MapPin, Mail, Phone, Upload, CheckCircle, 
  FolderTree, LayoutGrid, Search, AlertCircle, Stamp, Archive, Settings
} from 'lucide-react';
import ManageArchiveCategoriesModal from '../components/ManageArchiveCategoriesModal';
import ServiceDocumentSettings from '../components/ServiceDocumentSettings';

const STRUCTURE_TYPE_LABELS = {
  UNIVERSITE: { label: 'Université', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  FACULTE: { label: 'Faculté', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  DEPARTEMENT: { label: 'Département', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  DIRECTION: { label: 'Direction', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  SERVICE: { label: 'Service', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  SOUS_SERVICE: { label: 'Sous-service', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  AUTRE: { label: 'Unité Administrative', color: 'bg-gray-100 text-gray-800 border-gray-300' }
};

export default function ServiceAdmin() {
  const [services, setServices] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignHeadModal, setShowAssignHeadModal] = useState(false);
  const [showStampUploadModal, setShowStampUploadModal] = useState(false);
  const [manageArchiveServiceId, setManageArchiveServiceId] = useState(null);
  const [docSettingsServiceId, setDocSettingsServiceId] = useState(null);

  const [selectedServiceDetail, setSelectedServiceDetail] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [parentId, setParentId] = useState('');
  const [structureType, setStructureType] = useState('SERVICE');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [acronym, setAcronym] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [headUserId, setHeadUserId] = useState('');
  const [functionTitle, setFunctionTitle] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('ACTIVE');

  // Assign Head Form Fields
  const [assignUserId, setAssignUserId] = useState('');
  const [assignFunctionTitle, setAssignFunctionTitle] = useState('');
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignActRef, setAssignActRef] = useState('');

  // Stamp Upload Field
  const [stampFile, setStampFile] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sData, hData, uData] = await Promise.all([
        api.getServices(),
        api.getServiceHierarchy(),
        api.getUsers()
      ]);
      setServices(sData || []);
      setHierarchy(hData || []);
      setUsers(uData || []);

      // Expand root nodes by default
      const initialExpanded = {};
      (hData || []).forEach(node => {
        initialExpanded[node.id] = true;
        if (node.children) {
          node.children.forEach(child => {
            initialExpanded[child.id] = true;
          });
        }
      });
      setExpandedNodes(initialExpanded);
    } catch (err) {
      console.error('Failed to load services data:', err);
      setError('Erreur lors du chargement de la structure organisationnelle.');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleOpenAdd = (parent = null) => {
    setEditingService(null);
    setParentId(parent ? parent.id : '');
    setStructureType(parent ? (parent.structure_type === 'FACULTE' ? 'DEPARTEMENT' : 'SERVICE') : 'SERVICE');
    setCode('');
    setName('');
    setAcronym('');
    setReferenceCode('');
    setHeadUserId('');
    setFunctionTitle('');
    setHeaderText('');
    setAddress('');
    setEmail('');
    setPhone('');
    setStatus('ACTIVE');
    setError('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (s) => {
    setEditingService(s);
    setParentId(s.parent_id || '');
    setStructureType(s.structure_type || 'SERVICE');
    setCode(s.code || '');
    setName(s.name || '');
    setAcronym(s.acronym || '');
    setReferenceCode(s.reference_code || s.code || '');
    setHeadUserId(s.head_user_id || '');
    setFunctionTitle(s.function_title || '');
    setHeaderText(s.header_text || '');
    setAddress(s.address || '');
    setEmail(s.email || '');
    setPhone(s.phone || '');
    setStatus(s.status || 'ACTIVE');
    setError('');
    setShowFormModal(true);
  };

  const handleOpenDetail = async (serviceId) => {
    try {
      const details = await api.getServiceDetails(serviceId);
      setSelectedServiceDetail(details);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to load service details:', err);
    }
  };

  const handleOpenAssignHead = (service) => {
    setSelectedServiceDetail(prev => prev || { service });
    setAssignUserId('');
    setAssignFunctionTitle(service.function_title || 'Responsable de Service');
    setAssignStartDate(new Date().toISOString().split('T')[0]);
    setAssignActRef('');
    setShowAssignHeadModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        parent_id: parentId || null,
        structure_type: structureType,
        code,
        name,
        acronym: acronym || code,
        reference_code: referenceCode || code,
        head_user_id: headUserId || null,
        function_title: functionTitle,
        header_text: headerText,
        address,
        email,
        phone,
        status
      };

      if (editingService) {
        await api.updateService(editingService.id, payload);
        setSuccessMsg('Structure administrative mise à jour avec succès.');
      } else {
        await api.createService(payload);
        setSuccessMsg('Nouvelle structure créée avec succès.');
      }

      setShowFormModal(false);
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Erreur lors de l’enregistrement de la structure.');
    }
  };

  const handleAssignHeadSubmit = async (e) => {
    e.preventDefault();
    if (!assignUserId) {
      setError('Veuillez sélectionner un utilisateur.');
      return;
    }

    try {
      const sId = selectedServiceDetail.service.id;
      await api.assignServiceHead(sId, {
        user_id: assignUserId,
        function_title: assignFunctionTitle,
        start_date: assignStartDate,
        appointment_act_ref: assignActRef
      });

      setSuccessMsg('Nouveau responsable affecté avec succès et consigné dans l’historique.');
      setShowAssignHeadModal(false);
      await loadData();
      if (showDetailModal) {
        const details = await api.getServiceDetails(sId);
        setSelectedServiceDetail(details);
      }
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Erreur lors de l’affectation.');
    }
  };

  const handleStampUploadSubmit = async (e) => {
    e.preventDefault();
    if (!stampFile) return;

    try {
      const sId = selectedServiceDetail.service.id;
      const formData = new FormData();
      formData.append('stamp', stampFile);

      await api.uploadServiceStamp(sId, formData);
      setSuccessMsg('Cachet officiel enregistré avec succès.');
      setShowStampUploadModal(false);
      setStampFile(null);
      await loadData();
      if (showDetailModal) {
        const details = await api.getServiceDetails(sId);
        setSelectedServiceDetail(details);
      }
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Erreur lors du téléversement du cachet.');
    }
  };

  // Filtered Services for Table View
  const filteredServices = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.reference_code && s.reference_code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedTypeFilter === 'ALL' || s.structure_type === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  // Recursive Tree Node Renderer
  const renderTreeNode = (node, depth = 0) => {
    const isExpanded = expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const typeInfo = STRUCTURE_TYPE_LABELS[node.structure_type] || STRUCTURE_TYPE_LABELS.SERVICE;

    return (
      <div key={node.id} className="select-none">
        <div 
          className={`flex items-center justify-between p-3 my-1 rounded-xl transition border border-slate-200/80 bg-white hover:bg-slate-50 shadow-sm ${
            depth === 0 ? 'bg-amber-50/40 border-amber-200' : ''
          }`}
          style={{ marginLeft: `${depth * 24}px` }}
        >
          <div className="flex items-center space-x-3 min-w-0">
            {hasChildren ? (
              <button 
                onClick={() => toggleNode(node.id)} 
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-600 transition"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
              <span className="font-mono text-xs font-bold text-kindia-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {node.reference_code || node.code}
              </span>
            </div>

            <div className="truncate">
              <span className="font-heading font-bold text-xs text-slate-800 hover:text-kindia-blue cursor-pointer" onClick={() => handleOpenDetail(node.id)}>
                {node.name}
              </span>
              {node.acronym && node.acronym !== node.code && (
                <span className="text-[11px] text-slate-500 ml-1">({node.acronym})</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {node.head_first_name ? (
              <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium truncate max-w-[160px]">{node.head_first_name} {node.head_last_name}</span>
              </div>
            ) : (
              <span className="hidden sm:inline text-[11px] text-amber-600 italic bg-amber-50 px-2 py-0.5 rounded">
                Poste vacant
              </span>
            )}

            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleOpenDetail(node.id)}
                className="p-1.5 text-slate-600 hover:text-kindia-blue hover:bg-blue-50 rounded-lg transition"
                title="Consulter la fiche détaillée"
              >
                <FileText className="w-4 h-4" />
              </button>

              <button
                onClick={() => setDocSettingsServiceId(node.id)}
                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                title="Personnaliser l'en-tête, le pied de page et la référence"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleOpenAdd(node)}
                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                title="Ajouter une sous-structure rattachée"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleOpenEdit(node)}
                className="p-1.5 text-slate-600 hover:text-kindia-gold hover:bg-amber-50 rounded-lg transition"
                title="Modifier les informations"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-kindia-blue to-blue-700 text-white flex items-center justify-center shadow-md">
            <Building2 className="w-6 h-6 text-kindia-gold" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-xl text-slate-800">
              Organisation Administrative & Services
            </h2>
            <p className="text-xs text-slate-500">
              Structure hiérarchique officielle, gestion des responsables, signatures, en-têtes et cachets
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'tree' ? 'bg-white text-kindia-blue shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Organigramme</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'table' ? 'bg-white text-kindia-blue shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tableau</span>
            </button>
          </div>

          <button
            onClick={() => handleOpenAdd(null)}
            className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4 text-kindia-gold" />
            <span>Nouvelle Structure</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      {viewMode === 'tree' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="font-heading font-bold text-sm text-slate-800">
                Arborescence Institutionnelle (Université de Kindia)
              </span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                {services.length} Unités
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <button 
                onClick={() => {
                  const all = {};
                  services.forEach(s => all[s.id] = true);
                  setExpandedNodes(all);
                }}
                className="text-kindia-blue hover:underline font-semibold"
              >
                Tout déplier
              </button>
              <span className="text-slate-300">•</span>
              <button 
                onClick={() => setExpandedNodes({})}
                className="text-slate-500 hover:underline font-semibold"
              >
                Tout replier
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <div className="animate-spin w-8 h-8 border-4 border-kindia-gold border-t-transparent rounded-full mx-auto mb-2"></div>
              Chargement de l'organigramme...
            </div>
          ) : hierarchy.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Aucune structure enregistrée.
            </div>
          ) : (
            <div className="space-y-1 overflow-x-auto py-2">
              {hierarchy.map(node => renderTreeNode(node, 0))}
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, code ou référence (ex: FS/INFO)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue"
              />
            </div>

            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-kindia-blue"
            >
              <option value="ALL">Tous les types de structures</option>
              <option value="UNIVERSITE">Université</option>
              <option value="FACULTE">Facultés</option>
              <option value="DEPARTEMENT">Départements</option>
              <option value="DIRECTION">Directions</option>
              <option value="SERVICE">Services</option>
              <option value="SOUS_SERVICE">Sous-services</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-y border-slate-200">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Réf. Unique</th>
                  <th className="p-3">Nom Officiel</th>
                  <th className="p-3">Structure Parente</th>
                  <th className="p-3">Responsable en Fonction</th>
                  <th className="p-3 text-center">Effectif</th>
                  <th className="p-3 text-center">Actes</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">Chargement...</td></tr>
                ) : filteredServices.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">Aucun résultat trouvé.</td></tr>
                ) : (
                  filteredServices.map(s => {
                    const typeInfo = STRUCTURE_TYPE_LABELS[s.structure_type] || STRUCTURE_TYPE_LABELS.SERVICE;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md border ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-kindia-blue">
                          {s.reference_code || s.code}
                        </td>
                        <td className="p-3 font-heading font-bold text-slate-800 cursor-pointer hover:text-kindia-blue" onClick={() => handleOpenDetail(s.id)}>
                          {s.name}
                        </td>
                        <td className="p-3 text-slate-500">
                          {s.parent_name || '—'}
                        </td>
                        <td className="p-3">
                          {s.head_first_name ? (
                            <span className="text-slate-700 font-semibold flex items-center space-x-1">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{s.head_first_name} {s.head_last_name}</span>
                            </span>
                          ) : (
                            <span className="text-amber-600 italic">Non affecté</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                            {s.user_count || 0}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                            {s.document_count || 0}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleOpenDetail(s.id)}
                              className="p-1.5 text-slate-600 hover:text-kindia-blue hover:bg-blue-50 rounded-lg transition"
                              title="Fiche détaillée"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDocSettingsServiceId(s.id)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                              title="Personnaliser l'en-tête, pied & référence"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 text-slate-600 hover:text-kindia-gold hover:bg-amber-50 rounded-lg transition"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
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
      )}

      {/* ======================================================== */}
      {/* MODAL 1: FICHE COMPLÈTE DU SERVICE (RULE 2, 3, 4)        */}
      {/* ======================================================== */}
      {showDetailModal && selectedServiceDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-scale-up max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-kindia-blue to-slate-800 text-white flex justify-between items-start shrink-0">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-kindia-gold text-kindia-blue text-[10px] font-black uppercase tracking-wider">
                    {STRUCTURE_TYPE_LABELS[selectedServiceDetail.service.structure_type]?.label || 'SERVICE'}
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-200 bg-white/10 px-2 py-0.5 rounded">
                    RÉFÉRENCE : {selectedServiceDetail.service.reference_code || selectedServiceDetail.service.code}
                  </span>
                </div>
                <h3 className="font-heading font-black text-xl text-white">
                  {selectedServiceDetail.service.name}
                </h3>
                {selectedServiceDetail.service.parent_name && (
                  <p className="text-xs text-slate-300 flex items-center space-x-1">
                    <span>Rattaché à :</span>
                    <span className="font-semibold text-white">{selectedServiceDetail.service.parent_name}</span>
                  </p>
                )}
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body with Tabs / Sections */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Section 1: Current Responsible & Official Signature */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-kindia-blue" />
                    <span className="font-heading font-extrabold text-sm text-slate-800">
                      Responsable Actuel & Signature Officielle
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenAssignHead(selectedServiceDetail.service)}
                    className="px-3 py-1.5 bg-kindia-blue text-white rounded-xl font-bold hover:bg-kindia-lightBlue transition flex items-center space-x-1"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>Nommer / Remplacer</span>
                  </button>
                </div>

                {selectedServiceDetail.service.head_first_name ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <p className="text-slate-500 font-medium">Nom & Prénoms :</p>
                      <p className="font-bold text-slate-800 text-sm">
                        {selectedServiceDetail.service.head_first_name} {selectedServiceDetail.service.head_last_name}
                      </p>
                      <p className="text-slate-500 font-medium">Fonction officielle :</p>
                      <p className="font-semibold text-kindia-blue">
                        {selectedServiceDetail.service.function_title || 'Responsable de Service'}
                      </p>
                      <p className="text-slate-500 font-medium">Email / Matricule :</p>
                      <p className="text-slate-700">
                        {selectedServiceDetail.service.head_email} • {selectedServiceDetail.service.head_matricule}
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-center space-y-1 flex flex-col items-center justify-center">
                      <span className="text-[11px] font-bold text-slate-500">Signature Électronique du Responsable</span>
                      {selectedServiceDetail.service.head_signature_path ? (
                        <div className="p-2 border border-dashed border-slate-300 rounded-lg bg-slate-50">
                          <img 
                            src={`/uploads/${selectedServiceDetail.service.head_signature_path}`} 
                            alt="Signature" 
                            className="h-14 max-w-[160px] object-contain"
                          />
                          <span className="text-[10px] text-emerald-600 font-bold block mt-1">✓ Signature Enregistrée</span>
                        </div>
                      ) : (
                        <p className="text-slate-400 italic text-[11px] py-3">Aucune signature déposée pour cet utilisateur</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-center">
                    Poste de responsable non pourvu pour cette structure.
                  </div>
                )}
              </div>

              {/* Section 2: Historique des Anciens Responsables (Rule 3) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2">
                  <History className="w-4 h-4 text-kindia-blue" />
                  <span className="font-heading font-extrabold text-sm text-slate-800">
                    Historique des Responsables du Service
                  </span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Conserve la trace de toutes les personnes ayant exercé la fonction. Les anciens documents restent scellés avec le responsable en poste à leur date.
                </p>

                {selectedServiceDetail.headsHistory && selectedServiceDetail.headsHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-slate-100 rounded-xl">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="p-2.5">Responsable</th>
                          <th className="p-2.5">Fonction</th>
                          <th className="p-2.5">Période</th>
                          <th className="p-2.5">Acte de Nomination</th>
                          <th className="p-2.5 text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedServiceDetail.headsHistory.map(h => (
                          <tr key={h.id} className={h.is_current ? 'bg-emerald-50/40 font-semibold' : ''}>
                            <td className="p-2.5">{h.first_name} {h.last_name}</td>
                            <td className="p-2.5">{h.function_title}</td>
                            <td className="p-2.5 text-slate-600">
                              {h.start_date} $\rightarrow$ {h.end_date || 'En cours'}
                            </td>
                            <td className="p-2.5 font-mono text-slate-500">{h.appointment_act_ref || '—'}</td>
                            <td className="p-2.5 text-center">
                              {h.is_current ? (
                                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">Actuel</span>
                              ) : (
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">Ancien</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-[11px]">Aucun historique antérieur enregistré.</p>
                )}
              </div>

              {/* Section 3: Official Header & Cachet du service */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-heading font-extrabold text-xs text-slate-800 block">
                    En-tête Officiel du Service
                  </span>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 whitespace-pre-line leading-relaxed min-h-[90px]">
                    {selectedServiceDetail.service.header_text || "UNIVERSITÉ DE KINDIA\n" + selectedServiceDetail.service.name}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="font-heading font-extrabold text-xs text-slate-800">
                        Cachet Numérique Officiel
                      </span>
                      <button
                        onClick={() => setShowStampUploadModal(true)}
                        className="text-kindia-blue font-bold text-[11px] hover:underline flex items-center space-x-1"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Téléverser</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">Cachet officiel imprimé sur les attestations et décisions.</p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-center min-h-[90px]">
                    {selectedServiceDetail.service.stamp_path ? (
                      <img 
                        src={`/uploads/${selectedServiceDetail.service.stamp_path}`} 
                        alt="Cachet" 
                        className="h-16 max-w-[160px] object-contain"
                      />
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Aucun cachet enregistré</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 4: Coordonnées & Modèles autorisés */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-heading font-extrabold text-xs text-slate-800 block">
                  Coordonnées & Modèles de Documents Autorisés
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                  <div className="flex items-center space-x-2 text-slate-700">
                    <MapPin className="w-4 h-4 text-kindia-blue shrink-0" />
                    <span>{selectedServiceDetail.service.address || 'Quartier Foulayah, Kindia'}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-700">
                    <Mail className="w-4 h-4 text-kindia-blue shrink-0" />
                    <span>{selectedServiceDetail.service.email || 'contact@univ-kindia.edu.gn'}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-700">
                    <Phone className="w-4 h-4 text-kindia-blue shrink-0" />
                    <span>{selectedServiceDetail.service.phone || '+224 622 00 00 00'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const sId = selectedServiceDetail.service.id;
                  setShowDetailModal(false);
                  setManageArchiveServiceId(sId);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5 shadow-xs"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>📁 Gérer les catégories d'archives</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenEdit(selectedServiceDetail.service);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition"
                >
                  Modifier la fiche
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl text-xs transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CRÉATION / ÉDITION D'UNE STRUCTURE             */}
      {/* ======================================================== */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-scale-up">
            <div className="p-6 bg-gradient-to-r from-kindia-blue to-slate-800 text-white flex justify-between items-center">
              <h3 className="font-heading font-black text-lg text-white">
                {editingService ? 'Modifier la structure administrative' : 'Créer une nouvelle structure administrative'}
              </h3>
              <button 
                onClick={() => setShowFormModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Type de Structure *</label>
                  <select
                    value={structureType}
                    onChange={(e) => setStructureType(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                    required
                  >
                    <option value="UNIVERSITE">Université</option>
                    <option value="FACULTE">Faculté</option>
                    <option value="DEPARTEMENT">Département</option>
                    <option value="DIRECTION">Direction</option>
                    <option value="SERVICE">Service</option>
                    <option value="SOUS_SERVICE">Sous-service</option>
                    <option value="AUTRE">Autre Unité Administrative</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Structure Parente (Rattachement)</label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                  >
                    <option value="">— Aucune (Racine de l’Université) —</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id} disabled={editingService && s.id === editingService.id}>
                        {s.name} ({s.reference_code || s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Code Interne *</label>
                  <input
                    type="text"
                    placeholder="ex: INFO, FS, DRH"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={!!editingService}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono uppercase font-bold focus:border-kindia-blue focus:outline-none disabled:bg-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sigle / Acronyme</label>
                  <input
                    type="text"
                    placeholder="ex: INFO"
                    value={acronym}
                    onChange={(e) => setAcronym(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 uppercase font-medium focus:border-kindia-blue focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Référence Unique *</label>
                  <input
                    type="text"
                    placeholder="ex: FS/INFO, RECT"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono uppercase font-bold text-kindia-blue focus:border-kindia-blue focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Utilisée pour numéroter les actes (ex: FS/INFO/2026/0001)</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nom Officiel de la Structure *</label>
                <input
                  type="text"
                  placeholder="ex: Département d’Informatique"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Responsable Affecté (Utilisateur)</label>
                  <select
                    value={headUserId}
                    onChange={(e) => {
                      setHeadUserId(e.target.value);
                      const u = users.find(x => String(x.id) === String(e.target.value));
                      if (u && !functionTitle) setFunctionTitle(u.function_title);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                  >
                    <option value="">— Sélectionner un utilisateur du système —</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.email} - {u.function_title})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Intitulé de Fonction</label>
                  <input
                    type="text"
                    placeholder="ex: Chef du Département d’Informatique"
                    value={functionTitle}
                    onChange={(e) => setFunctionTitle(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">En-tête Textuel Spécifique</label>
                <textarea
                  rows={3}
                  placeholder="ex: RÉPUBLIQUE DE GUINÉE&#10;UNIVERSITÉ DE KINDIA&#10;FACULTÉ DES SCIENCES&#10;DÉPARTEMENT D'INFORMATIQUE"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-xs focus:border-kindia-blue focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Adresse / Localisation</label>
                  <input
                    type="text"
                    placeholder="ex: Bâtiment Sciences, Bureau 12"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-kindia-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Officiel</label>
                  <input
                    type="email"
                    placeholder="ex: informatique@univ-kindia.edu.gn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-kindia-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    placeholder="ex: +224 620 10 10 10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-kindia-blue focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow-md transition"
                >
                  Enregistrer la structure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: NOMINATION DU RESPONSABLE (RULE 3)              */}
      {/* ======================================================== */}
      {showAssignHeadModal && selectedServiceDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-scale-up">
            <div className="p-5 bg-gradient-to-r from-kindia-blue to-slate-800 text-white flex justify-between items-center">
              <div>
                <h3 className="font-heading font-black text-base text-white">
                  Nommer un Responsable de Service
                </h3>
                <p className="text-xs text-amber-200">
                  {selectedServiceDetail.service.name}
                </p>
              </div>
              <button 
                onClick={() => setShowAssignHeadModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignHeadSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Sélectionner l'Utilisateur Responsable *</label>
                <select
                  value={assignUserId}
                  onChange={(e) => {
                    setAssignUserId(e.target.value);
                    const u = users.find(x => String(x.id) === String(e.target.value));
                    if (u) setAssignFunctionTitle(u.function_title);
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                  required
                >
                  <option value="">— Choisir un compte utilisateur existant —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email} - {u.function_title})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Intitulé de Fonction *</label>
                <input
                  type="text"
                  placeholder="ex: Chef du Département d’Informatique"
                  value={assignFunctionTitle}
                  onChange={(e) => setAssignFunctionTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date de Prise de Fonction *</label>
                  <input
                    type="date"
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Réf. Acte de Nomination</label>
                  <input
                    type="text"
                    placeholder="ex: DÉC-NOMIN-UK-2026"
                    value={assignActRef}
                    onChange={(e) => setAssignActRef(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono focus:border-kindia-blue focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                ℹ️ La nomination clôture automatiquement le mandat du responsable précédent dans l'historique tout en préservant l'intégrité de ses anciens actes signés.
              </p>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAssignHeadModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow-md transition"
                >
                  Confirmer la nomination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: TÉLÉVERSEMENT DU CACHET DU SERVICE              */}
      {/* ======================================================== */}
      {showStampUploadModal && selectedServiceDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-scale-up">
            <div className="p-5 bg-gradient-to-r from-kindia-blue to-slate-800 text-white flex justify-between items-center">
              <h3 className="font-heading font-black text-base text-white">
                Téléverser le Cachet Numérique
              </h3>
              <button 
                onClick={() => setShowStampUploadModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStampUploadSubmit} className="p-6 space-y-4 text-xs">
              <div className="border-2 border-dashed border-slate-300 p-6 rounded-2xl text-center space-y-3 hover:border-kindia-blue transition bg-slate-50">
                <Stamp className="w-10 h-10 text-kindia-blue mx-auto" />
                <div>
                  <label className="cursor-pointer bg-kindia-blue text-white px-4 py-2 rounded-xl font-bold shadow-md hover:bg-kindia-lightBlue transition inline-block">
                    Sélectionner l'image du cachet
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => setStampFile(e.target.files[0])}
                      className="hidden"
                      required
                    />
                  </label>
                </div>
                {stampFile && (
                  <p className="font-bold text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200">
                    ✓ {stampFile.name} ({(stampFile.size / 1024).toFixed(1)} Ko)
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Format PNG transparent recommandé (max 5 Mo)
                </p>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowStampUploadModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!stampFile}
                  className="px-5 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  Enregistrer le cachet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Manage Archive Categories for Service */}
      {manageArchiveServiceId && (
        <ManageArchiveCategoriesModal
          isOpen={Boolean(manageArchiveServiceId)}
          onClose={() => setManageArchiveServiceId(null)}
          onCategoriesUpdated={() => loadData()}
        />
      )}

      {/* Modal Service Document Settings (Header, Footer, Reference) */}
      {docSettingsServiceId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-scale-up max-h-[92vh] flex flex-col">
            <div className="p-4 bg-kindia-blue text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <Settings className="w-5 h-5 text-kindia-gold" />
                <h3 className="font-heading font-black text-base">
                  Personnalisation des Documents Officiels (En-tête, Pied & Référence)
                </h3>
              </div>
              <button
                onClick={() => setDocSettingsServiceId(null)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              <ServiceDocumentSettings
                serviceId={docSettingsServiceId}
                onSettingsSaved={() => {
                  loadData();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

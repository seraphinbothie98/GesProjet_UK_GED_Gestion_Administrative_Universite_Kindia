import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { 
  Building2, Plus, Edit, Users, FileText, X, ChevronRight, ChevronDown, 
  Shield, UserCheck, History, Award, MapPin, Mail, Phone, Upload, CheckCircle, 
  FolderTree, LayoutGrid, Search, AlertCircle, Stamp, Archive, Settings, Trash2,
  GitFork, Network, Layers, ArrowRight, Check, Eye, ToggleLeft, ToggleRight,
  HelpCircle, RefreshCw, ChevronLeft, Building, UserPlus, Info
} from 'lucide-react';
import ManageArchiveCategoriesModal from '../components/ManageArchiveCategoriesModal';
import ServiceDocumentSettings from '../components/ServiceDocumentSettings';
import { handleGuineaPhoneChange } from '../utils/phoneUtils';

export default function ServiceAdmin() {
  const [services, setServices] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tabs: 'structures' | 'attachments' | 'config'
  const [activeTab, setActiveTab] = useState('structures');

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParentFilter, setSelectedParentFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Modals & Panels
  const [showAddStructureModal, setShowAddStructureModal] = useState(false);
  const [showAddAttachmentModal, setShowAddAttachmentModal] = useState(false);
  const [showConfigUnitModal, setShowConfigUnitModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignHeadModal, setShowAssignHeadModal] = useState(false);
  const [showStampUploadModal, setShowStampUploadModal] = useState(false);
  const [manageArchiveServiceId, setManageArchiveServiceId] = useState(null);
  const [docSettingsServiceId, setDocSettingsServiceId] = useState(null);
  const [deletingService, setDeletingService] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [statusTogglingId, setStatusTogglingId] = useState(null);

  const [selectedServiceDetail, setSelectedServiceDetail] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields - Generic Structure / Attachment Form
  const [formParentId, setFormParentId] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formAcronym, setFormAcronym] = useState('');
  const [formReferenceCode, setFormReferenceCode] = useState('');
  const [formHeadUserId, setFormHeadUserId] = useState('');
  const [formFunctionTitle, setFormFunctionTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState('ACTIVE');

  // Config Step Wizard Fields (Tab 3)
  const [configStep, setConfigStep] = useState(1);
  const [configSelectedStructureId, setConfigSelectedStructureId] = useState('');
  const [configSelectedAttachmentId, setConfigSelectedAttachmentId] = useState('');
  const [configCode, setConfigCode] = useState('');
  const [configAcronym, setConfigAcronym] = useState('');
  const [configName, setConfigName] = useState('');
  const [configDescription, setConfigDescription] = useState('');
  const [configHeadUserId, setConfigHeadUserId] = useState('');
  const [configStatus, setConfigStatus] = useState('ACTIVE');

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

      // Expand root nodes by default in tree
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

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Base Structures (Structures de niveau de base créées dans l'onglet "Structures", parent_id est null)
  const baseStructures = useMemo(() => {
    return services
      .filter(s => !s.parent_id)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
  }, [services]);

  // Tab 1: Structures de Base Filtrées
  const filteredTab1Structures = useMemo(() => {
    return services.filter(s => {
      const isBase = !s.parent_id;
      const matchesSearch = searchTerm === '' ||
        (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.acronym && s.acronym.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = selectedStatusFilter === 'ALL' || s.status === selectedStatusFilter;
      return isBase && matchesSearch && matchesStatus;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
  }, [services, searchTerm, selectedStatusFilter]);

  // Tab 2: Structures de Rattachement (Structures ayant un parent_id)
  const filteredTab2Attachments = useMemo(() => {
    return services.filter(s => {
      const isAttached = Boolean(s.parent_id);
      const matchesSearch = searchTerm === '' ||
        (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.parent_name && s.parent_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.acronym && s.acronym.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesParent = selectedParentFilter === 'ALL' || String(s.parent_id) === String(selectedParentFilter);
      const matchesStatus = selectedStatusFilter === 'ALL' || s.status === selectedStatusFilter;
      return isAttached && matchesSearch && matchesParent && matchesStatus;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
  }, [services, searchTerm, selectedParentFilter, selectedStatusFilter]);

  // Tab 3: Options de rattachement filtrées selon la structure choisie à l'étape 1
  const configStep2AttachmentOptions = useMemo(() => {
    if (!configSelectedStructureId) return [];
    const structId = Number(configSelectedStructureId);
    const directChildren = services.filter(s => s.parent_id === structId);
    return directChildren;
  }, [services, configSelectedStructureId]);

  // Statistiques pour les cartes de synthèse
  const stats = useMemo(() => {
    const total = services.length;
    const baseCount = services.filter(s => !s.parent_id).length;
    const attachedCount = services.filter(s => Boolean(s.parent_id)).length;
    const activeCount = services.filter(s => s.status === 'ACTIVE').length;
    const withHeadCount = services.filter(s => Boolean(s.head_user_id)).length;
    return { total, baseCount, attachedCount, activeCount, withHeadCount };
  }, [services]);

  // Open Form Modals
  const handleOpenAddStructure = () => {
    setEditingService(null);
    setFormParentId('');
    setFormCode('');
    setFormName('');
    setFormAcronym('');
    setFormReferenceCode('');
    setFormHeadUserId('');
    setFormFunctionTitle('');
    setFormDescription('');
    setFormAddress('');
    setFormEmail('');
    setFormPhone('');
    setFormStatus('ACTIVE');
    setError('');
    setModalError('');
    setShowAddStructureModal(true);
  };

  const handleOpenAddAttachment = (defaultParentId = '') => {
    setEditingService(null);
    setFormParentId(defaultParentId ? String(defaultParentId) : (baseStructures[0]?.id ? String(baseStructures[0].id) : ''));
    setFormCode('');
    setFormName('');
    setFormAcronym('');
    setFormReferenceCode('');
    setFormHeadUserId('');
    setFormFunctionTitle('');
    setFormDescription('');
    setFormAddress('');
    setFormEmail('');
    setFormPhone('');
    setFormStatus('ACTIVE');
    setError('');
    setModalError('');
    setShowAddAttachmentModal(true);
  };

  const handleOpenConfigUnit = (presetParentId = null) => {
    setConfigStep(1);
    setConfigSelectedStructureId(presetParentId ? String(presetParentId) : (baseStructures[0]?.id ? String(baseStructures[0].id) : ''));
    setConfigSelectedAttachmentId('');
    setConfigCode('');
    setConfigAcronym('');
    setConfigName('');
    setConfigDescription('');
    setConfigHeadUserId('');
    setConfigStatus('ACTIVE');
    setError('');
    setModalError('');
    setShowConfigUnitModal(true);
  };

  const handleOpenEdit = (s) => {
    setEditingService(s);
    setFormParentId(s.parent_id ? String(s.parent_id) : '');
    setFormCode(s.code || '');
    setFormName(s.name || '');
    setFormAcronym(s.acronym || '');
    setFormReferenceCode(s.reference_code || s.code || '');
    setFormHeadUserId(s.head_user_id ? String(s.head_user_id) : '');
    setFormFunctionTitle(s.function_title || '');
    setFormDescription(s.header_text || s.description || '');
    setFormAddress(s.address || '');
    setFormEmail(s.email || '');
    setFormPhone(s.phone || '');
    setFormStatus(s.status || 'ACTIVE');
    setError('');
    setModalError('');

    if (!s.parent_id) {
      setShowAddStructureModal(true);
    } else {
      setShowAddAttachmentModal(true);
    }
  };

  const handleOpenDetail = async (serviceId) => {
    try {
      const details = await api.getServiceDetails(serviceId);
      setSelectedServiceDetail(details);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to load service details:', err);
      setError('Erreur lors du chargement de la fiche détaillée.');
    }
  };

  const handleOpenAssignHead = (service) => {
    setSelectedServiceDetail(prev => prev || { service });
    setAssignUserId('');
    setAssignFunctionTitle(service.function_title || 'Responsable de Service');
    setAssignStartDate(new Date().toISOString().split('T')[0]);
    setAssignActRef('');
    setModalError('');
    setShowAssignHeadModal(true);
  };

  // Toggle Active / Inactive Status
  const handleToggleStatus = async (service) => {
    setStatusTogglingId(service.id);
    setError('');
    try {
      const res = await api.toggleServiceStatus(service.id);
      showNotification(res.message || `Statut de « ${service.name} » mis à jour.`);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors du basculement de statut.');
    } finally {
      setStatusTogglingId(null);
    }
  };

  // Save Structure Form (Tab 1 & Tab 2)
  const handleSaveStructureForm = async (e) => {
    e.preventDefault();
    if (!formName || !formName.trim()) {
      setModalError('L’intitulé officiel est obligatoire.');
      return;
    }
    setModalError('');
    setError('');
    setSaving(true);

    const payload = {
      parent_id: formParentId ? Number(formParentId) : null,
      structure_type: 'SERVICE',
      code: formCode,
      name: formName.trim(), // Respect strict de la casse saisie
      acronym: formAcronym ? formAcronym.trim() : null,
      reference_code: formReferenceCode ? formReferenceCode.trim() : null,
      head_user_id: formHeadUserId ? Number(formHeadUserId) : null,
      function_title: formFunctionTitle ? formFunctionTitle.trim() : null,
      header_text: formDescription ? formDescription.trim() : null,
      description: formDescription ? formDescription.trim() : null,
      address: formAddress ? formAddress.trim() : null,
      email: formEmail ? formEmail.trim() : null,
      phone: formPhone ? formPhone.trim() : null,
      status: formStatus
    };

    try {
      if (editingService) {
        await api.updateService(editingService.id, payload);
        showNotification(`Structure « ${formName} » mise à jour avec succès.`);
      } else {
        await api.createService(payload);
        showNotification(`Structure « ${formName} » créée avec succès.`);
      }

      setShowAddStructureModal(false);
      setShowAddAttachmentModal(false);
      setModalError('');
      await loadData();
    } catch (err) {
      setModalError(err.message || 'Erreur lors de l’enregistrement de la structure.');
    } finally {
      setSaving(false);
    }
  };

  // Save Config Unit Step Wizard Form (Tab 3)
  const handleSaveConfigUnitForm = async (e) => {
    e.preventDefault();
    if (!configName || !configName.trim()) {
      setModalError('L’intitulé officiel de l’unité organisationnelle est obligatoire.');
      return;
    }
    setModalError('');
    setError('');
    setSaving(true);

    const finalParentId = configSelectedAttachmentId 
      ? Number(configSelectedAttachmentId) 
      : (configSelectedStructureId ? Number(configSelectedStructureId) : null);

    const payload = {
      parent_id: finalParentId,
      structure_type: 'SERVICE',
      code: configCode,
      name: configName.trim(), // Strict case preserved
      acronym: configAcronym ? configAcronym.trim() : null,
      reference_code: configCode ? configCode.trim() : null,
      head_user_id: configHeadUserId ? Number(configHeadUserId) : null,
      header_text: configDescription ? configDescription.trim() : null,
      description: configDescription ? configDescription.trim() : null,
      status: configStatus
    };

    try {
      await api.createService(payload);
      showNotification(`Unité organisationnelle « ${configName} » configurée avec succès.`);
      setShowConfigUnitModal(false);
      setModalError('');
      await loadData();
    } catch (err) {
      setModalError(err.message || 'Erreur lors de la configuration de l’unité.');
    } finally {
      setSaving(false);
    }
  };

  // Assign Head Handler
  const handleAssignHeadSubmit = async (e) => {
    e.preventDefault();
    if (!assignUserId) {
      setModalError('Veuillez sélectionner un agent pour être responsable.');
      return;
    }
    setModalError('');
    setError('');
    setSaving(true);

    try {
      const sId = selectedServiceDetail.service.id;
      await api.assignServiceHead(sId, {
        user_id: assignUserId,
        function_title: assignFunctionTitle,
        start_date: assignStartDate,
        appointment_act_ref: assignActRef
      });

      showNotification('Responsable affecté avec succès et consigné dans l’historique officiel.');
      setShowAssignHeadModal(false);
      setModalError('');
      await loadData();
      if (showDetailModal) {
        const details = await api.getServiceDetails(sId);
        setSelectedServiceDetail(details);
      }
    } catch (err) {
      setModalError(err.message || 'Erreur lors de l’affectation du responsable.');
    } finally {
      setSaving(false);
    }
  };

  // Stamp Upload Handler
  const handleStampUploadSubmit = async (e) => {
    e.preventDefault();
    if (!stampFile) return;
    setModalError('');
    setError('');
    setSaving(true);

    try {
      const sId = selectedServiceDetail.service.id;
      const formData = new FormData();
      formData.append('stamp', stampFile);

      await api.uploadServiceStamp(sId, formData);
      showNotification('Cachet officiel de la structure enregistré avec succès.');
      setShowStampUploadModal(false);
      setStampFile(null);
      setModalError('');
      await loadData();
      if (showDetailModal) {
        const details = await api.getServiceDetails(sId);
        setSelectedServiceDetail(details);
      }
    } catch (err) {
      setModalError(err.message || 'Erreur lors du téléversement du cachet.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Handler
  const handleDeleteService = async (service) => {
    if (!service) return;
    setDeletingLoading(true);
    setError('');
    try {
      await api.deleteService(service.id);
      showNotification(`Structure « ${service.name} » (${service.code}) supprimée avec succès.`);
      setDeletingService(null);
      if (selectedServiceDetail?.service?.id === service.id) {
        setShowDetailModal(false);
        setSelectedServiceDetail(null);
      }
      await loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la suppression de la structure.');
    } finally {
      setDeletingLoading(false);
    }
  };

  // Recursive Tree Node Renderer for Tab 3 / Arborescence
  const renderTreeNode = (node, depth = 0) => {
    const isExpanded = expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const isActive = node.status === 'ACTIVE';

    return (
      <div key={node.id} className="select-none">
        <div 
          className={`flex items-center justify-between p-3.5 my-1.5 rounded-xl transition border shadow-sm ${
            depth === 0 
              ? 'bg-gradient-to-r from-amber-50/70 to-white border-amber-200/90 font-semibold' 
              : depth === 1
              ? 'bg-gradient-to-r from-blue-50/40 to-white border-blue-200/70'
              : 'bg-white hover:bg-slate-50 border-slate-200/80'
          } ${!isActive ? 'opacity-60 bg-slate-50' : ''}`}
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
              <span className="font-mono text-xs font-bold text-kindia-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {node.reference_code || node.code}
              </span>
            </div>

            <div className="truncate">
              <span 
                className="font-heading font-bold text-xs sm:text-sm text-slate-800 hover:text-kindia-blue cursor-pointer" 
                onClick={() => handleOpenDetail(node.id)}
              >
                {node.name}
              </span>
              {node.acronym && node.acronym !== node.code && (
                <span className="text-[11px] text-slate-500 ml-1.5 font-medium">({node.acronym})</span>
              )}
            </div>

            {!isActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                Inactif
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            {node.head_first_name ? (
              <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-700 bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold truncate max-w-[160px]">{node.head_first_name} {node.head_last_name}</span>
              </div>
            ) : (
              <span className="hidden sm:inline text-[11px] text-amber-600 italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Responsable non affecté
              </span>
            )}

            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleOpenDetail(node.id)}
                className="p-1.5 text-slate-600 hover:text-kindia-blue hover:bg-blue-50 rounded-lg transition"
                title="Consulter la fiche détaillée"
              >
                <Eye className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleOpenConfigUnit(node.id)}
                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                title="Rattacher une sous-unité à cette structure"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                onClick={() => setDocSettingsServiceId(node.id)}
                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                title="Personnaliser les en-têtes, pieds de page et références"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleOpenEdit(node)}
                className="p-1.5 text-slate-600 hover:text-kindia-gold hover:bg-amber-50 rounded-lg transition"
                title="Modifier les informations"
              >
                <Edit className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleStatus(node)}
                disabled={statusTogglingId === node.id}
                className={`p-1.5 rounded-lg transition ${
                  isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                }`}
                title={isActive ? 'Désactiver cette structure' : 'Activer cette structure'}
              >
                {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {[...node.children]
              .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }))
              .map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-kindia-blue to-blue-700 text-white flex items-center justify-center shadow-md shrink-0">
            <Building2 className="w-7 h-7 text-kindia-gold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-800">
                Gestion des Services & Organisation
              </h1>
              <span className="bg-kindia-blue/10 text-kindia-blue text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-kindia-blue/20">
                Dynamique & Multi-Établissement
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configuration de l'organigramme administratif, des structures hiérarchiques, des rattachements et des unités organisationnelles.
            </p>
          </div>
        </div>

        {/* Global Action Button per Active Tab */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          {activeTab === 'structures' && (
            <button
              onClick={handleOpenAddStructure}
              className="w-full md:w-auto bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center space-x-2 active:scale-95"
            >
              <Plus className="w-4 h-4 text-kindia-gold" />
              <span>Ajouter une structure</span>
            </button>
          )}

          {activeTab === 'attachments' && (
            <button
              onClick={() => handleOpenAddAttachment()}
              className="w-full md:w-auto bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center space-x-2 active:scale-95"
            >
              <Plus className="w-4 h-4 text-kindia-gold" />
              <span>Ajouter une structure de rattachement</span>
            </button>
          )}

          {activeTab === 'config' && (
            <button
              onClick={() => handleOpenConfigUnit()}
              className="w-full md:w-auto bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center space-x-2 active:scale-95"
            >
              <Layers className="w-4 h-4 text-kindia-gold" />
              <span>Configurer une unité</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-kindia-blue flex items-center justify-center shrink-0 border border-blue-100">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-heading font-black text-slate-800">{stats.baseCount}</div>
            <div className="text-[11px] text-slate-500 font-medium">Structures Principales</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-heading font-black text-slate-800">{stats.attachedCount}</div>
            <div className="text-[11px] text-slate-500 font-medium">Structures de Rattachement</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-heading font-black text-slate-800">{stats.total}</div>
            <div className="text-[11px] text-slate-500 font-medium">Total Unités Configurées</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-heading font-black text-slate-800">{stats.withHeadCount} / {stats.total}</div>
            <div className="text-[11px] text-slate-500 font-medium">Responsables Affectés</div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-center space-x-2 shadow-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs flex items-center space-x-2 shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('structures')}
          className={`flex-1 min-w-[200px] py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2.5 ${
            activeTab === 'structures'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4 text-kindia-gold" />
          <span>1. Structures</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeTab === 'structures' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {stats.baseCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('attachments')}
          className={`flex-1 min-w-[200px] py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2.5 ${
            activeTab === 'attachments'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <GitFork className="w-4 h-4 text-kindia-gold" />
          <span>2. Structures de rattachement</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeTab === 'attachments' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {stats.attachedCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 min-w-[200px] py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2.5 ${
            activeTab === 'config'
              ? 'bg-kindia-blue text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FolderTree className="w-4 h-4 text-kindia-gold" />
          <span>3. Configuration organisationnelle</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeTab === 'config' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {stats.total}
          </span>
        </button>
      </div>

      {/* Global Search and Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par intitulé officiel, code, sigle ou référence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue bg-slate-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'attachments' && (
            <select
              value={selectedParentFilter}
              onChange={(e) => setSelectedParentFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-kindia-blue bg-white font-medium"
            >
              <option value="ALL">Toutes les structures parentes</option>
              {baseStructures.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          )}

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-kindia-blue bg-white font-medium"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actif uniquement</option>
            <option value="INACTIVE">Inactif uniquement</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title="Rafraîchir les données"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1 : STRUCTURES (Niveau de base de l'organisation) */}
      {/* ========================================================= */}
      {activeTab === 'structures' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-heading font-bold text-sm text-slate-800">
                Structures de Base de l'Organisation
              </h3>
              <p className="text-[11px] text-slate-500">
                Niveau de base de l'organisation administrative.
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-500 font-medium">
                {filteredTab1Structures.length} structure(s) affichée(s)
              </span>
              <button
                onClick={handleOpenAddStructure}
                className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition flex items-center space-x-1.5 active:scale-95"
              >
                <Plus className="w-4 h-4 text-kindia-gold" />
                <span>Ajouter une structure</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="p-3">Intitulé Officiel</th>
                  <th className="p-3">Code / Sigle</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3 text-center">Structures Rattachées</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">Chargement des structures...</td></tr>
                ) : filteredTab1Structures.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      Aucune structure de base trouvée pour ces critères.
                    </td>
                  </tr>
                ) : (
                  filteredTab1Structures.map(s => {
                    const isActive = s.status === 'ACTIVE';
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center font-black text-[10px] border border-amber-200 shrink-0">
                              {s.code ? s.code.substring(0, 3) : 'STR'}
                            </div>
                            <div>
                              <span 
                                onClick={() => handleOpenDetail(s.id)}
                                className="font-heading font-bold text-slate-900 hover:text-kindia-blue cursor-pointer block text-xs sm:text-sm"
                              >
                                {s.name}
                              </span>
                              {s.acronym && s.acronym !== s.code && (
                                <span className="text-[10px] text-slate-500">Sigle : {s.acronym}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-3 font-mono font-bold text-kindia-blue">
                          <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {s.code || '—'}
                          </span>
                        </td>

                        <td className="p-3 text-slate-500 max-w-xs truncate">
                          {s.header_text || s.description || <span className="italic text-slate-400">Aucune description</span>}
                        </td>

                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isActive 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            {isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                            <GitFork className="w-3 h-3 mr-1" />
                            {s.children_count || 0}
                          </span>
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleOpenDetail(s.id)}
                              className="p-1.5 text-slate-600 hover:text-kindia-blue hover:bg-blue-50 rounded-lg transition"
                              title="Consulter la fiche détaillée"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenAddAttachment(s.id)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              title="Ajouter une structure rattachée à celle-ci"
                            >
                              <Plus className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setDocSettingsServiceId(s.id)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                              title="Personnaliser les documents officiels"
                            >
                              <Settings className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 text-slate-600 hover:text-kindia-gold hover:bg-amber-50 rounded-lg transition"
                              title="Modifier la structure"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleStatus(s)}
                              disabled={statusTogglingId === s.id}
                              className={`p-1.5 rounded-lg transition ${
                                isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                              }`}
                              title={isActive ? 'Désactiver (Recommandé)' : 'Activer'}
                            >
                              {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>

                            {s.id !== 1 && !['REC', 'SG', 'SC', 'ADMIN', 'UK'].includes(s.code?.toUpperCase()) && (
                              <button
                                onClick={() => setDeletingService(s)}
                                className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                                title="Supprimer définitivement"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
      )}

      {/* ========================================================= */}
      {/* TAB 2 : STRUCTURES DE RATTACHEMENT */}
      {/* ========================================================= */}
      {activeTab === 'attachments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-heading font-bold text-sm text-slate-800">
                Structures de Rattachement
              </h3>
              <p className="text-[11px] text-slate-500">
                Structures qui appartiennent à une structure supérieure.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-500 font-medium">
                {filteredTab2Attachments.length} structure(s) rattachée(s)
              </span>
              <button
                onClick={() => handleOpenAddAttachment()}
                className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition flex items-center space-x-1.5 active:scale-95"
              >
                <Plus className="w-4 h-4 text-kindia-gold" />
                <span>Ajouter une structure de rattachement</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="p-3">Nom Officiel</th>
                  <th className="p-3">Code / Sigle</th>
                  <th className="p-3">Structure de Rattachement</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">Chargement des structures de rattachement...</td></tr>
                ) : filteredTab2Attachments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      <GitFork className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      Aucune structure de rattachement trouvée pour ces critères.
                    </td>
                  </tr>
                ) : (
                  filteredTab2Attachments.map(s => {
                    const isActive = s.status === 'ACTIVE';
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3">
                          <span 
                            onClick={() => handleOpenDetail(s.id)}
                            className="font-heading font-bold text-slate-900 hover:text-kindia-blue cursor-pointer block text-xs sm:text-sm"
                          >
                            {s.name}
                          </span>
                          {s.acronym && s.acronym !== s.code && (
                            <span className="text-[10px] text-slate-500">Sigle : {s.acronym}</span>
                          )}
                        </td>

                        <td className="p-3 font-mono font-bold text-kindia-blue">
                          <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {s.code || '—'}
                          </span>
                        </td>

                        <td className="p-3">
                          <div className="flex items-center space-x-1.5 text-slate-700 font-semibold">
                            <Building className="w-3.5 h-3.5 text-kindia-blue shrink-0" />
                            <span>{s.parent_name || '—'}</span>
                            {s.parent_code && (
                              <span className="text-[10px] text-slate-400 font-mono">({s.parent_code})</span>
                            )}
                          </div>
                        </td>

                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isActive 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            {isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleOpenDetail(s.id)}
                              className="p-1.5 text-slate-600 hover:text-kindia-blue hover:bg-blue-50 rounded-lg transition"
                              title="Consulter la fiche détaillée"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setDocSettingsServiceId(s.id)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                              title="Personnaliser les documents officiels"
                            >
                              <Settings className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 text-slate-600 hover:text-kindia-gold hover:bg-amber-50 rounded-lg transition"
                              title="Modifier la structure"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleStatus(s)}
                              disabled={statusTogglingId === s.id}
                              className={`p-1.5 rounded-lg transition ${
                                isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                              }`}
                              title={isActive ? 'Désactiver' : 'Activer'}
                            >
                              {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>

                            {s.id !== 1 && !['REC', 'SG', 'SC', 'ADMIN', 'UK'].includes(s.code?.toUpperCase()) && (
                              <button
                                onClick={() => setDeletingService(s)}
                                className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
      )}

      {/* ========================================================= */}
      {/* TAB 3 : CONFIGURATION ORGANISATIONNELLE (Arbre & Assistant) */}
      {/* ========================================================= */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-heading font-bold text-base text-slate-800">
                  Arborescence et Organigramme Administratif
                </h3>
                <span className="text-xs font-bold text-kindia-blue bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {services.length} Unités
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Vue hiérarchique dynamique représentant les relations Structure ➜ Rattachement ➜ Unités / Services.
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <button 
                onClick={() => {
                  const all = {};
                  services.forEach(s => all[s.id] = true);
                  setExpandedNodes(all);
                }}
                className="text-kindia-blue hover:underline font-semibold flex items-center space-x-1"
              >
                <span>Tout déplier</span>
              </button>
              <span className="text-slate-300">•</span>
              <button 
                onClick={() => setExpandedNodes({})}
                className="text-slate-500 hover:underline font-semibold"
              >
                Tout replier
              </button>
              <button
                onClick={() => handleOpenConfigUnit()}
                className="bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold px-3.5 py-2 rounded-xl shadow-sm transition flex items-center space-x-1.5 ml-2 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-kindia-gold" />
                <span>Configurer une unité</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <div className="animate-spin w-8 h-8 border-4 border-kindia-gold border-t-transparent rounded-full mx-auto mb-2"></div>
              Chargement de l'organigramme hiérarchique...
            </div>
          ) : hierarchy.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <FolderTree className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              Aucune structure enregistrée dans l'organigramme.
            </div>
          ) : (
            <div className="space-y-1.5 overflow-x-auto py-2">
              {[...hierarchy]
                .sort((a, b) => {
                  if (a.code === 'UK' || a.structure_type === 'UNIVERSITE') return -1;
                  if (b.code === 'UK' || b.structure_type === 'UNIVERSITE') return 1;
                  return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
                })
                .map(node => renderTreeNode(node, 0))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1 : AJOUTER / MODIFIER UNE STRUCTURE (Onglet 1) */}
      {/* ========================================================= */}
      {showAddStructureModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-kindia-blue flex items-center justify-center font-bold">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-800">
                    {editingService ? 'Modifier la Structure' : 'Ajouter une Structure'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Niveau de base de l'organisation administrative
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddStructureModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStructureForm} className="space-y-4 text-xs">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs flex items-start space-x-2.5 shadow-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="font-semibold leading-relaxed">{modalError}</div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Intitulé officiel de la structure <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Rectorat, Faculté des Sciences..."
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (modalError) setModalError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Respect exact de la casse saisie par l'administrateur.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Code / Sigle <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : RECTORAT, FS, FSEG..."
                    value={formCode}
                    onChange={(e) => {
                      setFormCode(e.target.value.toUpperCase());
                      if (modalError) setModalError('');
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue font-mono uppercase"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Généré automatiquement si omis.</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Sigle usuel <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : UK"
                    value={formAcronym}
                    onChange={(e) => setFormAcronym(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(optionnelle)</span>
                </label>
                <textarea
                  rows="3"
                  placeholder="Ex : Université publique d’enseignement supérieur et de recherche scientifique."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Statut
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue bg-white font-semibold"
                >
                  <option value="ACTIVE">Actif</option>
                  <option value="INACTIVE">Inactif</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowAddStructureModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-kindia-blue hover:bg-kindia-lightBlue disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin text-kindia-gold" />}
                  <span>{saving ? 'Enregistrement...' : editingService ? 'Enregistrer les modifications' : 'Créer la structure'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2 : AJOUTER / MODIFIER UNE STRUCTURE DE RATTACHEMENT (Onglet 2) */}
      {/* ========================================================= */}
      {showAddAttachmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <GitFork className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-800">
                    {editingService ? 'Modifier la Structure Rattachée' : 'Ajouter une Structure de Rattachement'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Structure dépendante d'une entité administrative supérieure
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddAttachmentModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStructureForm} className="space-y-4 text-xs">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs flex items-start space-x-2.5 shadow-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="font-semibold leading-relaxed">{modalError}</div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Intitulé officiel de la structure rattachée <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Rectorat, Faculté des Sciences, Secrétariat Général..."
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (modalError) setModalError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Respect exact de la casse saisie par l'administrateur.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Structure parente <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formParentId}
                  onChange={(e) => setFormParentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue bg-white font-semibold text-slate-800"
                >
                  <option value="">Sélectionnez la structure parente...</option>
                  {baseStructures.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.code ? `(${p.code})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Alimentée par les structures créées dans l'onglet « Structures ».
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Code / Sigle <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : RECT, FS, DSEG..."
                    value={formCode}
                    onChange={(e) => {
                      setFormCode(e.target.value.toUpperCase());
                      if (modalError) setModalError('');
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Sigle usuel <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : RECT"
                    value={formAcronym}
                    onChange={(e) => setFormAcronym(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(optionnelle)</span>
                </label>
                <textarea
                  rows="2"
                  placeholder="Mission et responsabilités de cette structure rattachée..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Statut
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue bg-white font-semibold"
                >
                  <option value="ACTIVE">Actif</option>
                  <option value="INACTIVE">Inactif</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowAddAttachmentModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-kindia-blue hover:bg-kindia-lightBlue disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin text-kindia-gold" />}
                  <span>{saving ? 'Enregistrement...' : editingService ? 'Enregistrer les modifications' : 'Créer le rattachement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3 : ASSISTANT CONFIGURATION ORGANISATIONNELLE (Onglet 3) */}
      {/* ========================================================= */}
      {showConfigUnitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-800">
                    Configurer une Unité Organisationnelle
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assistant guidé en 3 étapes : Structure ➜ Rattachement ➜ Définition de l'unité
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfigUnitModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Steps Progress Indicator */}
            <div className="grid grid-cols-3 gap-2 mb-6 text-xs">
              <div 
                onClick={() => setConfigStep(1)}
                className={`p-2.5 rounded-xl border flex items-center space-x-2 cursor-pointer transition ${
                  configStep === 1 
                    ? 'bg-blue-50 border-kindia-blue text-kindia-blue font-bold shadow-sm' 
                    : configStep > 1 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold' 
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  configStep === 1 ? 'bg-kindia-blue text-white' : configStep > 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {configStep > 1 ? <Check className="w-3 h-3" /> : '1'}
                </span>
                <span className="truncate">1. Structure</span>
              </div>

              <div 
                onClick={() => configStep >= 2 && setConfigStep(2)}
                className={`p-2.5 rounded-xl border flex items-center space-x-2 cursor-pointer transition ${
                  configStep === 2 
                    ? 'bg-blue-50 border-kindia-blue text-kindia-blue font-bold shadow-sm' 
                    : configStep > 2 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold' 
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  configStep === 2 ? 'bg-kindia-blue text-white' : configStep > 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {configStep > 2 ? <Check className="w-3 h-3" /> : '2'}
                </span>
                <span className="truncate">2. Rattachement</span>
              </div>

              <div 
                onClick={() => configStep >= 3 && setConfigStep(3)}
                className={`p-2.5 rounded-xl border flex items-center space-x-2 cursor-pointer transition ${
                  configStep === 3 
                    ? 'bg-blue-50 border-kindia-blue text-kindia-blue font-bold shadow-sm' 
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  configStep === 3 ? 'bg-kindia-blue text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  3
                </span>
                <span className="truncate">3. Unité</span>
              </div>
            </div>

            <form onSubmit={handleSaveConfigUnitForm} className="space-y-4 text-xs">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs flex items-start space-x-2.5 shadow-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="font-semibold leading-relaxed">{modalError}</div>
                </div>
              )}

              {/* ÉTAPE 1 : CHOISIR LA STRUCTURE */}
              {configStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex items-start space-x-3">
                    <Info className="w-5 h-5 text-kindia-blue shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Étape 1 — Sélectionner la Structure</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Choisissez la structure de base issue de l'onglet « Structures ».
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Structure <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={configSelectedStructureId}
                      onChange={(e) => {
                        setConfigSelectedStructureId(e.target.value);
                        setConfigSelectedAttachmentId('');
                      }}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue bg-white font-bold text-slate-800 text-sm"
                    >
                      <option value="">Sélectionnez la structure...</option>
                      {baseStructures.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.code ? `(${s.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      disabled={!configSelectedStructureId}
                      onClick={() => setConfigStep(2)}
                      className="bg-kindia-blue hover:bg-kindia-lightBlue disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2"
                    >
                      <span>Passer à l'étape 2 (Rattachement)</span>
                      <ArrowRight className="w-4 h-4 text-kindia-gold" />
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2 : CHOISIR LA STRUCTURE DE RATTACHEMENT (FILTRÉE) */}
              {configStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 flex items-start space-x-3">
                    <GitFork className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Étape 2 — Choisir la Structure de Rattachement</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Cette liste est automatiquement filtrée selon la structure sélectionnée à l'étape 1.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Structure de rattachement <span className="text-slate-400 font-normal">(ou rattachement direct)</span>
                    </label>
                    <select
                      value={configSelectedAttachmentId}
                      onChange={(e) => setConfigSelectedAttachmentId(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue bg-white font-semibold text-slate-800"
                    >
                      <option value="">
                        Rattachement direct à la structure sélectionnée
                      </option>
                      {configStep2AttachmentOptions.map(att => (
                        <option key={att.id} value={att.id}>
                          ➜ {att.name} {att.code ? `(${att.code})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {configStep2AttachmentOptions.length === 0
                        ? 'Aucune sous-structure intermédiaire. L’unité sera rattachée directement.'
                        : `${configStep2AttachmentOptions.length} sous-structure(s) compatible(s) rattachée(s).`}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setConfigStep(1)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition flex items-center space-x-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Retour</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfigStep(3)}
                      className="bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2"
                    >
                      <span>Passer à l'étape 3 (Définir l'unité)</span>
                      <ArrowRight className="w-4 h-4 text-kindia-gold" />
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3 : DÉFINIR L'UNITÉ ORGANISATIONNELLE */}
              {configStep === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Étape 3 — Définition de l'Unité</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Renseignez les informations de la nouvelle unité. Le responsable est facultatif.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Intitulé officiel de l'unité <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex : Département des Sciences Économiques, Pôle Financier..."
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue font-medium"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Respect strict de la casse officielle.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Code <span className="text-slate-400 font-normal">(optionnel)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex : DSEG, PF..."
                        value={configCode}
                        onChange={(e) => setConfigCode(e.target.value.toUpperCase())}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Sigle <span className="text-slate-400 font-normal">(optionnel)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex : DSEG"
                        value={configAcronym}
                        onChange={(e) => setConfigAcronym(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Responsable / Chef <span className="text-slate-400 font-normal">(optionnel, peut être nommé ultérieurement)</span>
                    </label>
                    <select
                      value={configHeadUserId}
                      onChange={(e) => setConfigHeadUserId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue bg-white"
                    >
                      <option value="">Aucun responsable affecté pour le moment (Poste vacant)</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} ({u.matricule || u.email}) — {u.function_title || 'Agent'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Description <span className="text-slate-400 font-normal">(optionnelle)</span>
                    </label>
                    <textarea
                      rows="2"
                      placeholder="Missions et attributions de cette unité..."
                      value={configDescription}
                      onChange={(e) => setConfigDescription(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Statut
                    </label>
                    <select
                      value={configStatus}
                      onChange={(e) => setConfigStatus(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue bg-white font-semibold"
                    >
                      <option value="ACTIVE">Actif</option>
                      <option value="INACTIVE">Inactif</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setConfigStep(2)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition flex items-center space-x-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Retour</span>
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2"
                    >
                      {saving ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>{saving ? 'Création en cours...' : "Finaliser et créer l'unité"}</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4 : FICHE DÉTAILLÉE D'UNE STRUCTURE */}
      {/* ========================================================= */}
      {showDetailModal && selectedServiceDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-scale-up space-y-6">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-kindia-blue text-white flex items-center justify-center shadow-md font-bold text-lg">
                  {selectedServiceDetail.service.code ? selectedServiceDetail.service.code.substring(0, 3) : 'STR'}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-kindia-blue bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      {selectedServiceDetail.service.reference_code || selectedServiceDetail.service.code}
                    </span>
                  </div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-900 mt-1">
                    {selectedServiceDetail.service.name}
                  </h3>
                  {selectedServiceDetail.service.parent_name && (
                    <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                      <GitFork className="w-3.5 h-3.5 text-purple-600" />
                      <span>Rattaché à : <strong className="text-slate-700">{selectedServiceDetail.service.parent_name}</strong></span>
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Head Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Responsable en exercice</div>
                  {selectedServiceDetail.service.head_first_name ? (
                    <div className="font-heading font-bold text-slate-800 text-sm">
                      {selectedServiceDetail.service.head_first_name} {selectedServiceDetail.service.head_last_name}
                      <span className="text-xs text-slate-500 font-normal ml-1">
                        ({selectedServiceDetail.service.function_title || 'Chef de Service'})
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 font-semibold italic">
                      Aucun responsable actuellement affecté
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleOpenAssignHead(selectedServiceDetail.service)}
                  className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition flex items-center space-x-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5 text-kindia-gold" />
                  <span>Affecter / Nommer</span>
                </button>
                <button
                  onClick={() => setShowStampUploadModal(true)}
                  className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center space-x-1.5"
                >
                  <Stamp className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Cachet officiel</span>
                </button>
              </div>
            </div>

            {/* Sub-structures & Children */}
            <div>
              <h4 className="font-heading font-bold text-xs text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <FolderTree className="w-4 h-4 text-kindia-blue" />
                <span>Sous-structures et Unités rattachées ({selectedServiceDetail.subServices?.length || 0})</span>
              </h4>
              {selectedServiceDetail.subServices?.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  Aucune sous-structure rattachée directement.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedServiceDetail.subServices?.map(sub => (
                    <div key={sub.id} className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{sub.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-1.5">({sub.code})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nomination History */}
            <div>
              <h4 className="font-heading font-bold text-xs text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <History className="w-4 h-4 text-purple-600" />
                <span>Historique des nominations ({selectedServiceDetail.headsHistory?.length || 0})</span>
              </h4>
              {selectedServiceDetail.headsHistory?.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  Aucun historique de nomination consigné.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedServiceDetail.headsHistory?.map(h => (
                    <div key={h.id} className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{h.first_name} {h.last_name}</span>
                        <span className="text-[11px] text-slate-500 ml-1.5">({h.function_title})</span>
                        {h.appointment_act_ref && (
                          <span className="text-[10px] text-kindia-blue font-mono ml-1.5">Réf : {h.appointment_act_ref}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {h.start_date} ➜ {h.is_current ? <strong className="text-emerald-600">Présent</strong> : h.end_date}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setManageArchiveServiceId(selectedServiceDetail.service.id)}
                  className="px-3 py-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-xs transition flex items-center space-x-1.5"
                >
                  <Archive className="w-4 h-4" />
                  <span>Catégories d'archives</span>
                </button>
                <button
                  onClick={() => setDocSettingsServiceId(selectedServiceDetail.service.id)}
                  className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs transition flex items-center space-x-1.5"
                >
                  <Settings className="w-4 h-4" />
                  <span>Paramètres documents</span>
                </button>
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5 : AFFECTATION OFFICIELLE DE RESPONSABLE */}
      {/* ========================================================= */}
      {showAssignHeadModal && selectedServiceDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-800">
                    Nommer un Responsable
                  </h3>
                  <p className="text-xs text-slate-500">
                    Structure : {selectedServiceDetail.service?.name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAssignHeadModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignHeadSubmit} className="space-y-4 text-xs">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs flex items-start space-x-2.5 shadow-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="font-semibold leading-relaxed">{modalError}</div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Agent sélectionné <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={assignUserId}
                  onChange={(e) => {
                    setAssignUserId(e.target.value);
                    if (modalError) setModalError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue bg-white font-semibold text-slate-800"
                >
                  <option value="">Sélectionnez un personnel...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.matricule || u.email}) — {u.function_title || 'Agent'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Titre officiel de la fonction
                </label>
                <input
                  type="text"
                  placeholder="Ex : Chef de Département, Directeur, Doyen..."
                  value={assignFunctionTitle}
                  onChange={(e) => setAssignFunctionTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Date de prise de fonction
                  </label>
                  <input
                    type="date"
                    required
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Réf. de l'acte de nomination
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : DEC/UK/2026/042"
                    value={assignActRef}
                    onChange={(e) => setAssignActRef(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-kindia-blue font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowAssignHeadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl shadow-md transition flex items-center space-x-2"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin text-white" />}
                  <span>{saving ? 'Nomination...' : 'Confirmer la nomination'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6 : TÉLÉVERSEMENT DU CACHET OFFICIEL */}
      {/* ========================================================= */}
      {showStampUploadModal && selectedServiceDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Stamp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-800">
                    Cachet Officiel
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedServiceDetail.service?.name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowStampUploadModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStampUploadSubmit} className="space-y-4 text-xs">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs flex items-start space-x-2.5 shadow-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="font-semibold leading-relaxed">{modalError}</div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-2">
                  Image du cachet numérique (PNG transparent recommandé)
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  required
                  onChange={(e) => setStampFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowStampUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl shadow-md transition flex items-center space-x-2"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin text-white" />}
                  <span>{saving ? 'Enregistrement...' : 'Enregistrer le cachet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7 : CONFIRMATION DE SUPPRESSION SÉCURISÉE */}
      {/* ========================================================= */}
      {deletingService && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4 text-xs">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center font-bold">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-extrabold text-base text-slate-800">
                Confirmer la suppression
              </h3>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Êtes-vous certain de vouloir supprimer définitivement la structure :
              <br />
              <strong className="text-slate-900 text-sm">« {deletingService.name} » ({deletingService.code})</strong> ?
            </p>

            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-amber-800 leading-relaxed">
              <strong>Recommandation :</strong> Si cette structure a déjà été utilisée dans des courriers, archives ou ordres de mission, 
              il est préférable de la <strong>désactiver</strong> plutôt que de la supprimer pour préserver l'intégrité de l'historique administratif.
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
              <button
                type="button"
                disabled={deletingLoading}
                onClick={() => setDeletingService(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deletingLoading}
                onClick={() => handleDeleteService(deletingService)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition flex items-center space-x-1.5"
              >
                {deletingLoading ? (
                  <span>Suppression...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer définitivement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modals: ManageArchiveCategoriesModal & ServiceDocumentSettings */}
      {manageArchiveServiceId && (
        <ManageArchiveCategoriesModal
          serviceId={manageArchiveServiceId}
          onClose={() => setManageArchiveServiceId(null)}
        />
      )}

      {docSettingsServiceId && (
        <ServiceDocumentSettings
          serviceId={docSettingsServiceId}
          onClose={() => setDocSettingsServiceId(null)}
        />
      )}
    </div>
  );
}

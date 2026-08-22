import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import NewAdministrativeDocumentModal from '../components/NewAdministrativeDocumentModal';
import TrajectoryTimeline from '../components/TrajectoryTimeline';
import ArchiveExplorerView from '../components/ArchiveExplorerView';
import ArchiveDocumentDetailDrawer from '../components/ArchiveDocumentDetailDrawer';
import ClassifyDocumentModal from '../components/ClassifyDocumentModal';
import NewArchiveCategoryModal from '../components/NewArchiveCategoryModal';
import ManageArchiveCategoriesModal from '../components/ManageArchiveCategoriesModal';
import ServiceDocumentSettings from '../components/ServiceDocumentSettings';
import ServiceDigitizeAndArchiveModal from '../components/ServiceDigitizeAndArchiveModal';
import ServiceDiffuseModal from '../components/ServiceDiffuseModal';
import { 
  Plus, Search, Filter, RefreshCw, FileText, Send, Inbox, 
  Clock, CheckCircle2, RotateCcw, Archive, Award, ChevronRight,
  Eye, Edit, Paperclip, AlertCircle, Building2, UserCheck, Sparkles,
  ArrowLeft, Tag, Folder, Download, Landmark, FolderPlus, Settings,
  Camera, FileUp
} from 'lucide-react';

export default function ServiceWorkspace({ onSelectDocument }) {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('to_process');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [data, setData] = useState({ metrics: {}, categories_summary: [], documents: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Modals & Drawers
  const [drawerDocId, setDrawerDocId] = useState(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [selectedDocForCircuit, setSelectedDocForCircuit] = useState(null);
  const [classifyDoc, setClassifyDoc] = useState(null);
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [isManageCatsModalOpen, setIsManageCatsModalOpen] = useState(false);
  const [digitizeModalState, setDigitizeModalState] = useState({ isOpen: false, mode: 'scan' });
  const [diffuseDoc, setDiffuseDoc] = useState(null);

  const canManageCategories = user?.permissions?.includes('archives.manage_categories') || 
                              ['CHEF_SERVICE', 'RESPONSABLE_ADMIN', 'ADMINISTRATEUR', 'SG', 'RECTEUR'].includes(user?.role_code);

  useEffect(() => {
    loadServiceSpace();
  }, [activeTab, selectedCategory, selectedYear, searchTerm, typeFilter, priorityFilter]);

  const loadServiceSpace = async () => {
    if (activeTab === 'doc_settings') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = {
        tab: activeTab,
        search: searchTerm,
        type: typeFilter,
        priority: priorityFilter,
        year: selectedYear
      };
      if (activeTab === 'archived' && selectedCategory && selectedCategory !== 'ALL') {
        params.category = selectedCategory;
      }
      const res = await api.getServiceSpace(params);
      setData(res || { metrics: {}, categories_summary: [], documents: [] });
    } catch (err) {
      console.error('Load service space error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedCategory('ALL');
    setSearchTerm('');
  };

  const handleDownloadFile = async (docId, reference) => {
    try {
      const token = localStorage.getItem('uk_ged_token');
      const url = `http://127.0.0.1:5000/api/documents/${docId}/download`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur de téléchargement (${res.status})`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${reference || 'archive'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert('Erreur lors du téléchargement : ' + err.message);
    }
  };

  const tabs = [
    { id: 'to_process', label: 'À traiter', icon: Clock, count: data.metrics?.to_process || 0, badgeColor: 'bg-amber-500 text-white' },
    { id: 'received', label: 'Reçus', icon: Inbox, count: data.metrics?.received || 0, badgeColor: 'bg-blue-600 text-white' },
    { id: 'my_docs', label: 'Mes documents', icon: FileText, count: data.metrics?.my_docs || 0, badgeColor: 'bg-slate-700 text-white' },
    { id: 'drafts', label: 'Brouillons', icon: Edit, count: data.metrics?.drafts || 0, badgeColor: 'bg-slate-500 text-white' },
    { id: 'submitted', label: 'Soumis', icon: Send, count: data.metrics?.submitted || 0, badgeColor: 'bg-indigo-600 text-white' },
    { id: 'transmitted', label: 'Transmis', icon: Send, count: data.metrics?.transmitted || 0, badgeColor: 'bg-teal-600 text-white' },
    { id: 'returned', label: 'Retournés / À corriger', icon: RotateCcw, count: data.metrics?.returned || 0, badgeColor: 'bg-rose-500 text-white' },
    { id: 'validated', label: 'Validés', icon: CheckCircle2, count: data.metrics?.validated || 0, badgeColor: 'bg-emerald-600 text-white' },
    { id: 'signed', label: 'Signés', icon: Award, count: data.metrics?.signed || 0, badgeColor: 'bg-kindia-gold text-kindia-blue font-bold' },
    { id: 'archived', label: 'Archives', icon: Archive, count: data.metrics?.archived || 0, badgeColor: 'bg-slate-700 text-white' },
    { id: 'doc_settings', label: '⚙️ En-tête, Pied & Référence', icon: Settings, count: 0, badgeColor: 'bg-indigo-700 text-white' }
  ];

  return (
    <div className="space-y-6">
      {/* Workspace Header Banner */}
      <div className="bg-gradient-to-r from-kindia-blue via-kindia-lightBlue to-kindia-blue rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-black text-2xl text-kindia-gold border border-white/20 shadow-inner shrink-0">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-kindia-gold bg-white/10 px-2.5 py-0.5 rounded-full">
                Espace Documentaire Officiel
              </span>
              <span className="text-xs text-slate-300">
                {user?.service_code ? `Code : ${user.service_code}` : ''}
              </span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl mt-1 text-white">
              {user?.service_name || 'Espace de Travail Administratif'}
            </h2>
            <p className="text-xs text-slate-200 mt-0.5">
              Connecté en tant que : <strong className="text-white">{user?.first_name} {user?.last_name}</strong> ({user?.function_title || user?.role_name})
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setDigitizeModalState({ isOpen: true, mode: 'scan' })}
            className="px-3.5 py-2.5 rounded-2xl text-xs font-black transition flex items-center space-x-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            title="Numériser un document avec la caméra ou un scanner"
          >
            <Camera className="w-4 h-4 text-kindia-gold" />
            <span>📷 NUMÉRISER</span>
          </button>

          <button
            onClick={() => setDigitizeModalState({ isOpen: true, mode: 'import' })}
            className="px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center space-x-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 shadow-xs"
            title="Importer des fichiers existants (PDF, Word, Excel, Images)"
          >
            <FileUp className="w-4 h-4 text-emerald-300" />
            <span>📥 IMPORTER</span>
          </button>

          <button
            onClick={() => handleTabChange('doc_settings')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'doc_settings'
                ? 'bg-kindia-gold text-kindia-blue shadow-lg ring-2 ring-white font-extrabold'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/20 shadow-xs'
            }`}
            title="Personnaliser l'en-tête officiel, le pied de page et le format de référence de ce service"
          >
            <Settings className="w-4 h-4 text-kindia-gold" />
            <span>⚙️ EN-TÊTE & PIED DE PAGE</span>
          </button>

          <button
            onClick={() => handleTabChange('archived')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'archived'
                ? 'bg-kindia-gold text-kindia-blue shadow-lg ring-2 ring-white'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
          >
            <Archive className="w-4 h-4 text-kindia-gold" />
            <span>📁 Archives</span>
          </button>

          <button
            onClick={() => setIsNewDocModalOpen(true)}
            className="bg-kindia-gold hover:bg-amber-400 text-kindia-blue px-4 py-2.5 rounded-2xl text-xs font-black shadow-lg hover:shadow-xl transition flex items-center justify-center space-x-2 transform hover:-translate-y-0.5 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ RÉDIGER UN DOCUMENT</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 overflow-x-auto">
        <div className="flex items-center space-x-1.5 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isSpecial = tab.id === 'doc_settings' || tab.id === 'archived';
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  isActive
                    ? 'bg-kindia-blue text-white shadow-md'
                    : isSpecial
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-extrabold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-kindia-gold' : isSpecial ? 'text-kindia-blue' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${isActive ? 'bg-white/20 text-white' : tab.badgeColor}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SERVICE DOCUMENT SETTINGS TAB */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'doc_settings' ? (
        <ServiceDocumentSettings />
      ) : activeTab === 'archived' ? (
        <ArchiveExplorerView
          categories={data.categories_summary || []}
          documents={data.documents || []}
          selectedCategory={selectedCategory}
          onSelectCategory={(catCode) => setSelectedCategory(catCode)}
          selectedYear={selectedYear}
          onSelectYear={(year) => setSelectedYear(year)}
          searchTerm={searchTerm}
          onSearchChange={(val) => setSearchTerm(val)}
          loading={loading}
          onOpenDocument={(docId) => setDrawerDocId(docId)}
          onDownloadDocument={(docId, ref) => handleDownloadFile(docId, ref)}
          onClassifyDocument={(doc) => setClassifyDoc(doc)}
          onAddCategory={() => setIsNewCatModalOpen(true)}
          onManageCategories={() => setIsManageCatsModalOpen(true)}
          onScanDocument={() => setDigitizeModalState({ isOpen: true, mode: 'scan' })}
          onImportDocument={() => setDigitizeModalState({ isOpen: true, mode: 'import' })}
          onNewDocument={() => setIsNewDocModalOpen(true)}
          onDiffuseDocument={(doc) => setDiffuseDoc(doc)}
          canManageCategories={canManageCategories}
          isSC={user?.service_code === 'SC'}
        />
      ) : (
        <>
          {/* Active Circuit Filter & Search Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par référence, titre, auteur..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-kindia-blue focus:bg-white outline-hidden font-medium"
              />
            </div>

            <div className="flex items-center space-x-2.5 w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-hidden"
              >
                <option value="">Tous les types d'actes</option>
                <option value="SOIT_TRANSMIS">Soit-Transmis</option>
                <option value="DEMANDE">Demande administrative</option>
                <option value="LETTRE">Lettre officielle</option>
                <option value="NOTE_SERVICE">Note de service</option>
                <option value="RAPPORT">Rapport d'activité</option>
                <option value="PROCES_VERBAL">Procès-verbal</option>
                <option value="DECISION">Décision</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-hidden"
              >
                <option value="">Toutes priorités</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgente</option>
              </select>

              <button
                onClick={loadServiceSpace}
                className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition"
                title="Rafraîchir"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-kindia-blue' : ''}`} />
              </button>
            </div>
          </div>

          {/* Active Circuit Documents Grid */}
          {loading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-xs text-slate-500 font-medium">Chargement des documents du service...</p>
            </div>
          ) : data.documents.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-slate-700">Aucun document dans cet onglet</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchTerm || typeFilter 
                  ? 'Aucun document ne correspond à vos critères de recherche.' 
                  : 'Cet onglet est actuellement vide pour votre unité administrative.'}
              </p>
              <button
                onClick={() => setIsNewDocModalOpen(true)}
                className="mt-4 bg-kindia-blue text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-kindia-lightBlue transition inline-flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Créer un document</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument?.(doc.id)}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-kindia-blue/40 transition cursor-pointer flex flex-col justify-between space-y-4 group"
                >
                  <div>
                    {/* Header card */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-black text-kindia-blue tracking-tight group-hover:text-blue-700 transition">
                          {doc.reference}
                        </span>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {doc.document_type || doc.document_category}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {doc.current_version > 1 && (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-black">
                            V{doc.current_version}
                          </span>
                        )}
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-sm text-slate-900 mt-2.5 line-clamp-2 leading-snug">
                      {doc.title}
                    </h4>

                    {/* Origin / Destination Metadata */}
                    <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Émetteur :</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                          {doc.originating_service_name || doc.sender_name || 'Mon Service'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Détenteur actuel :</span>
                        <span className="font-bold text-kindia-blue truncate max-w-[200px]">
                          {doc.current_service_name || 'En cours de transmission'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between pt-3 text-xs border-t border-slate-100 gap-2">
                    <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
                      {doc.attachment_count > 0 && (
                        <span className="flex items-center space-x-1" title={`${doc.attachment_count} pièce(s) jointe(s)`}>
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{doc.attachment_count}</span>
                        </span>
                      )}
                      <span>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDocForCircuit(doc);
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center space-x-1"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Circuit</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDocument?.(doc.id);
                        }}
                        className="p-1.5 bg-kindia-blue/10 hover:bg-kindia-blue text-kindia-blue hover:text-white rounded-lg text-[11px] font-bold transition flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Consulter</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Trajectory Modal */}
      {selectedDocForCircuit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-heading font-extrabold text-base text-slate-900">
                  Circuit et Trajectoire Officielle
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Document Réf : {selectedDocForCircuit.reference}
                </p>
              </div>
              <button 
                onClick={() => setSelectedDocForCircuit(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition"
              >
                ✕
              </button>
            </div>
            <TrajectoryTimeline documentId={selectedDocForCircuit.id} />
          </div>
        </div>
      )}

      {/* Archive Detail Drawer */}
      {drawerDocId && (
        <ArchiveDocumentDetailDrawer
          documentId={drawerDocId}
          isOpen={Boolean(drawerDocId)}
          onClose={() => setDrawerDocId(null)}
          onClassify={(doc) => {
            setDrawerDocId(null);
            setClassifyDoc(doc);
          }}
          onDiffuse={(doc) => {
            setDrawerDocId(null);
            setDiffuseDoc(doc);
          }}
          isSC={user?.service_code === 'SC'}
        />
      )}

      {/* Classify Document Modal */}
      {classifyDoc && (
        <ClassifyDocumentModal
          isOpen={Boolean(classifyDoc)}
          document={classifyDoc}
          onClose={() => setClassifyDoc(null)}
          onSuccess={() => {
            loadServiceSpace();
          }}
        />
      )}

      {/* Digitize / Import & Archive Modal (Rules 1 to 4, 11, 12, 13) */}
      {digitizeModalState.isOpen && (
        <ServiceDigitizeAndArchiveModal
          isOpen={digitizeModalState.isOpen}
          initialMode={digitizeModalState.mode}
          onClose={() => setDigitizeModalState({ isOpen: false, mode: 'scan' })}
          onSuccess={() => {
            loadServiceSpace();
          }}
        />
      )}

      {/* Diffuse Document Modal (Rules 5, 6, 7) */}
      {diffuseDoc && (
        <ServiceDiffuseModal
          isOpen={Boolean(diffuseDoc)}
          document={diffuseDoc}
          onClose={() => setDiffuseDoc(null)}
          onSuccess={() => {
            loadServiceSpace();
          }}
        />
      )}

      {/* New Archive Category Modal */}
      {isNewCatModalOpen && (
        <NewArchiveCategoryModal
          isOpen={isNewCatModalOpen}
          onClose={() => setIsNewCatModalOpen(false)}
          onSuccess={() => {
            setIsNewCatModalOpen(false);
            loadServiceSpace();
          }}
        />
      )}

      {/* Manage Archive Categories Modal */}
      {isManageCatsModalOpen && (
        <ManageArchiveCategoriesModal
          isOpen={isManageCatsModalOpen}
          onClose={() => setIsManageCatsModalOpen(false)}
          onCategoriesUpdated={() => {
            loadServiceSpace();
          }}
        />
      )}

      {/* New Document Modal */}
      {isNewDocModalOpen && (
        <NewAdministrativeDocumentModal
          isOpen={isNewDocModalOpen}
          onClose={() => setIsNewDocModalOpen(false)}
          onSuccess={() => {
            setIsNewDocModalOpen(false);
            loadServiceSpace();
          }}
        />
      )}
    </div>
  );
}

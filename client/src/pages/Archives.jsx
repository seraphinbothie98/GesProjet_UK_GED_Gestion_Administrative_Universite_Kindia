import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Folder, FolderOpen, Archive, Eye, Trash2, AlertTriangle, X, CheckCircle, 
  Search, Download, ExternalLink, UserCheck, Calendar, Building2, FileText, 
  MapPin, CheckCircle2, ShieldCheck, Printer, RefreshCw, Send, Share2, Landmark, Lock,
  ArrowLeft, Tag, HelpCircle
} from 'lucide-react';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';
import TransmitToCentralArchiveModal from '../components/TransmitToCentralArchiveModal';
import ShareArchiveModal from '../components/ShareArchiveModal';
import ArchiveExplorerView from '../components/ArchiveExplorerView';
import ArchiveDocumentDetailDrawer from '../components/ArchiveDocumentDetailDrawer';
import ClassifyDocumentModal from '../components/ClassifyDocumentModal';
import NewArchiveCategoryModal from '../components/NewArchiveCategoryModal';
import ManageArchiveCategoriesModal from '../components/ManageArchiveCategoriesModal';
import ServiceDigitizeAndArchiveModal from '../components/ServiceDigitizeAndArchiveModal';
import ServiceDiffuseModal from '../components/ServiceDiffuseModal';
import NewAdministrativeDocumentModal from '../components/NewAdministrativeDocumentModal';

export default function Archives({ onSelectDocument }) {
  const { user } = useAuth();
  
  const [data, setData] = useState({ metrics: {}, categories_summary: [], documents: [] });
  const [loading, setLoading] = useState(true);
  const [selectedScope, setSelectedScope] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Modals & Drawers
  const [drawerDocId, setDrawerDocId] = useState(null);
  const [transmitModalDoc, setTransmitModalDoc] = useState(null);
  const [shareModalDoc, setShareModalDoc] = useState(null);
  const [classifyDoc, setClassifyDoc] = useState(null);
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [isManageCatsModalOpen, setIsManageCatsModalOpen] = useState(false);
  const [digitizeModalState, setDigitizeModalState] = useState({ isOpen: false, mode: 'scan' });
  const [diffuseDoc, setDiffuseDoc] = useState(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);

  const isAdmin = user?.role_code === 'ADMINISTRATEUR';
  const isSC = user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user?.service_code === 'SC';
  const isFaculty = user?.service_name?.toLowerCase().includes('faculté') || user?.function_title?.toLowerCase().includes('doyen');
  const canManageCategories = user?.permissions?.includes('archives.manage_categories') || 
                              ['CHEF_SERVICE', 'RESPONSABLE_ADMIN', 'ADMINISTRATEUR', 'SG', 'RECTEUR'].includes(user?.role_code);

  useEffect(() => {
    loadArchives();
  }, [selectedScope, selectedCategory, selectedYear, searchTerm]);

  const loadArchives = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        scope: selectedScope,
        year: selectedYear,
        search: searchTerm
      };
      if (selectedCategory && selectedCategory !== 'ALL') {
        params.category = selectedCategory;
      }
      const res = await api.getArchives(params);
      setData(res || { metrics: {}, categories_summary: [], documents: [] });
    } catch (err) {
      console.error('Error loading archives:', err);
      setError('Erreur lors du chargement des archives.');
    } finally {
      setLoading(false);
    }
  };

  const handleScopeChange = (scopeId) => {
    setSelectedScope(scopeId);
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

  const handleActCentralArchive = async (docId) => {
    if (!window.confirm('Voulez-vous acter le versement de ce document dans les archives centrales de l’Université ?')) return;
    try {
      await api.archiveInCentral(docId);
      setMessage('Document versé avec succès dans les archives centrales.');
      loadArchives();
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-kindia-blue to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-black text-2xl text-kindia-gold border border-white/20 shadow-inner shrink-0">
            <Archive className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-kindia-gold bg-white/10 px-2.5 py-0.5 rounded-full">
                {isSC ? 'Fonds Documentaire Central' : isFaculty ? 'Espace d’Archives Facultaires' : 'Espace d’Archives Privées'}
              </span>
              <span className="text-xs text-slate-300">
                Explorateur Documentaire • Deny by Default
              </span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl mt-1 text-white">
              {isSC 
                ? 'Archives Centrales — Secrétariat Central' 
                : isFaculty 
                  ? `Archives — ${user?.service_name}` 
                  : `Archives — ${user?.service_name || 'Mon Service'}`}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Consultation hiérarchique et sécurisée des actes administratifs (UK-GED)
            </p>
          </div>
        </div>

        <button
          onClick={loadArchives}
          className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition flex items-center space-x-2 text-xs font-bold shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-kindia-gold' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {message && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl flex items-center justify-between text-emerald-800 text-xs font-semibold">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl flex items-center justify-between text-rose-800 text-xs font-semibold">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-900">✕</button>
        </div>
      )}

      {/* Scope Navigation Tabs */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 overflow-x-auto">
        <div className="flex items-center space-x-1.5 min-w-max">
          <button
            onClick={() => handleScopeChange('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              selectedScope === 'ALL'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Toutes mes archives</span>
            {data.metrics?.all > 0 && (
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {data.metrics.all}
              </span>
            )}
          </button>

          {!isSC && (
            <button
              onClick={() => handleScopeChange('PRIVE_SERVICE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                selectedScope === 'PRIVE_SERVICE'
                  ? 'bg-kindia-blue text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Archives Privées de mon Service</span>
              {data.metrics?.private > 0 && (
                <span className="bg-slate-700 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {data.metrics.private}
                </span>
              )}
            </button>
          )}

          {isFaculty && (
            <button
              onClick={() => handleScopeChange('FACULTE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                selectedScope === 'FACULTE'
                  ? 'bg-kindia-blue text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Archives Facultaires & Départements</span>
              {data.metrics?.faculty > 0 && (
                <span className="bg-teal-700 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {data.metrics.faculty}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => handleScopeChange('INSTITUTIONNEL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              selectedScope === 'INSTITUTIONNEL'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Actes Institutionnels & Décisions</span>
            {data.metrics?.institutional > 0 && (
              <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {data.metrics.institutional}
              </span>
            )}
          </button>

          <button
            onClick={() => handleScopeChange('TRANSMITTED_SC')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              selectedScope === 'TRANSMITTED_SC'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>{isSC ? 'Versements reçus pour Archivage Central' : 'Transmis au Secrétariat Central'}</span>
            {data.metrics?.transmitted_sc > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {data.metrics.transmitted_sc}
              </span>
            )}
          </button>

          <button
            onClick={() => handleScopeChange('PARTAGE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              selectedScope === 'PARTAGE'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Archives Partagées</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2-PANEL EXPLORER VIEW : DIRECTORY TREE ON LEFT + TABLE ON RIGHT */}
      {/* ------------------------------------------------------------- */}
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
        onShareDocument={(doc) => setShareModalDoc(doc)}
        onTransmitSCDocument={(doc) => setTransmitModalDoc(doc)}
        onActCentralArchive={(docId) => handleActCentralArchive(docId)}
        onAddCategory={() => setIsNewCatModalOpen(true)}
        onManageCategories={() => setIsManageCatsModalOpen(true)}
        onScanDocument={() => setDigitizeModalState({ isOpen: true, mode: 'scan' })}
        onImportDocument={() => setDigitizeModalState({ isOpen: true, mode: 'import' })}
        onNewDocument={() => setIsNewDocModalOpen(true)}
        onDiffuseDocument={(doc) => setDiffuseDoc(doc)}
        canManageCategories={canManageCategories}
        isSC={isSC}
      />

      {/* Detail Drawer / Integrated Viewer */}
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
          onShare={(doc) => {
            setDrawerDocId(null);
            setShareModalDoc(doc);
          }}
          onTransmitSC={(doc) => {
            setDrawerDocId(null);
            setTransmitModalDoc(doc);
          }}
          isSC={isSC}
        />
      )}

      {/* Digitize / Import & Archive Modal (Rules 1 to 4, 11, 12, 13) */}
      {digitizeModalState.isOpen && (
        <ServiceDigitizeAndArchiveModal
          isOpen={digitizeModalState.isOpen}
          initialMode={digitizeModalState.mode}
          onClose={() => setDigitizeModalState({ isOpen: false, mode: 'scan' })}
          onSuccess={() => {
            setMessage('Document numérisé / importé et archivé avec succès.');
            loadArchives();
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
            setMessage('Document diffusé avec succès aux services destinataires.');
            loadArchives();
          }}
        />
      )}

      {/* Classify Document Modal */}
      {classifyDoc && (
        <ClassifyDocumentModal
          isOpen={Boolean(classifyDoc)}
          document={classifyDoc}
          onClose={() => setClassifyDoc(null)}
          onSuccess={() => {
            loadArchives();
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
            loadArchives();
          }}
        />
      )}

      {/* Manage Archive Categories Modal */}
      {isManageCatsModalOpen && (
        <ManageArchiveCategoriesModal
          isOpen={isManageCatsModalOpen}
          onClose={() => setIsManageCatsModalOpen(false)}
          onCategoriesUpdated={() => {
            loadArchives();
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
            loadArchives();
          }}
        />
      )}

      {/* Transmit to Central Archive Modal */}
      {transmitModalDoc && (
        <TransmitToCentralArchiveModal
          isOpen={Boolean(transmitModalDoc)}
          document={transmitModalDoc}
          onClose={() => setTransmitModalDoc(null)}
          onSuccess={() => {
            setMessage('Document transmis avec succès au Secrétariat Central pour versement aux archives centrales.');
            loadArchives();
          }}
        />
      )}

      {/* Share Archive Modal */}
      {shareModalDoc && (
        <ShareArchiveModal
          isOpen={Boolean(shareModalDoc)}
          document={shareModalDoc}
          onClose={() => setShareModalDoc(null)}
          onSuccess={() => {
            setMessage('Archive partagée avec succès.');
            loadArchives();
          }}
        />
      )}
    </div>
  );
}

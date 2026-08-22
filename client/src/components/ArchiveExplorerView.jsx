import React, { useState } from 'react';
import { 
  Folder, FolderOpen, Search, Download, Eye, Tag, Share2, Send, 
  Landmark, Calendar, Filter, Plus, Settings, RefreshCw, FileText, 
  ChevronRight, ArrowRight, Paperclip, Lock, ShieldCheck, Sparkles, Building2, User,
  Camera, FileUp, Edit
} from 'lucide-react';
import { StatusBadge } from './Badge';
import DynamicCategoryIcon from './DynamicCategoryIcon';

export default function ArchiveExplorerView({
  categories = [],
  documents = [],
  selectedCategory,
  onSelectCategory,
  selectedYear,
  onSelectYear,
  searchTerm,
  onSearchChange,
  loading = false,
  onOpenDocument,
  onDownloadDocument,
  onClassifyDocument,
  onShareDocument,
  onTransmitSCDocument,
  onActCentralArchive,
  onAddCategory,
  onManageCategories,
  onScanDocument,
  onImportDocument,
  onNewDocument,
  onDiffuseDocument,
  canManageCategories = false,
  isSC = false
}) {
  const years = ['2026', '2025', '2024', '2023'];
  const totalAllDocs = categories.reduce((sum, c) => sum + (c.count || 0), 0);

  // Strict French alphabetical sort for categories (Rules 9, 10, 11, 12)
  const sortedCategories = [...categories].sort((a, b) => 
    (a.label || a.name || '').localeCompare(b.label || b.name || '', 'fr', { sensitivity: 'base', numeric: true })
  );

  // Determine active category object
  const activeCatObj = selectedCategory && selectedCategory !== 'ALL'
    ? categories.find(c => c.code === selectedCategory) 
    : { code: 'ALL', label: `Toutes les archives ${selectedYear || '2026'}`, count: totalAllDocs };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden flex flex-col md:flex-row min-h-[680px]">
      
      {/* ------------------------------------------------------------- */}
      {/* LEFT PANEL : FOLDERS / CATEGORIES DIRECTORY TREE */}
      {/* ------------------------------------------------------------- */}
      <div className="w-full md:w-80 lg:w-88 bg-slate-50/80 border-r border-slate-200 p-5 flex flex-col justify-between shrink-0 space-y-4">
        
        <div className="space-y-4">
          {/* Year Selector & Title */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Période & Dossiers d'archives
            </span>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <select
                  value={selectedYear}
                  onChange={(e) => onSelectYear(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 shadow-xs focus:ring-2 focus:ring-kindia-blue outline-hidden cursor-pointer"
                >
                  <option value="2026">📁 Archives 2026</option>
                  <option value="2025">📁 Archives 2025</option>
                  <option value="2024">📁 Archives 2024</option>
                  <option value="">📁 Toutes les années</option>
                </select>
              </div>

              {onAddCategory && (
                <button
                  type="button"
                  onClick={onAddCategory}
                  className="p-2 bg-kindia-blue hover:bg-blue-800 text-white rounded-xl transition shadow-xs"
                  title="Ajouter une nouvelle catégorie"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}

              {canManageCategories && onManageCategories && (
                <button
                  type="button"
                  onClick={onManageCategories}
                  className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition shadow-xs"
                  title="Gérer les catégories"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Categories List (Vertical Tree) */}
          <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {/* All Archives Folder */}
            <button
              type="button"
              onClick={() => onSelectCategory('ALL')}
              className={`w-full p-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between group ${
                selectedCategory === 'ALL' || !selectedCategory
                  ? 'bg-kindia-blue text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <FolderOpen className={`w-4 h-4 shrink-0 ${
                  selectedCategory === 'ALL' || !selectedCategory ? 'text-kindia-gold' : 'text-slate-400'
                }`} />
                <span className="truncate">Toutes les archives {selectedYear || '2026'}</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                selectedCategory === 'ALL' || !selectedCategory
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {totalAllDocs}
              </span>
            </button>

            <div className="py-2">
              <div className="h-px bg-slate-200" />
            </div>

            {/* Standard & Custom Categories in strict French alphabetical order */}
            {sortedCategories.map((cat) => {
              const isSelected = selectedCategory === cat.code;
              return (
                <button
                  key={cat.code || cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.code)}
                  className={`w-full p-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between group ${
                    isSelected
                      ? 'bg-kindia-blue text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className={`inline-flex p-1 rounded-lg shrink-0 ${
                      isSelected 
                        ? 'text-kindia-gold bg-white/10' 
                        : (cat.color ? cat.color.split(' ')[0] : 'text-slate-400')
                    }`}>
                      <DynamicCategoryIcon iconName={cat.icon} className="w-4 h-4 shrink-0" />
                    </span>
                    <span className="truncate">{cat.label}</span>
                    {cat.is_custom && (
                      <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                        isSelected ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-800'
                      }`}>
                        Service
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {cat.count || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Left Footer Info */}
        <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-400 flex items-center justify-between">
          <span>{categories.length} dossiers actifs</span>
          <span className="font-semibold">{isSC ? 'Fonds Central' : 'Fonds Service'}</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RIGHT PANEL : DOCUMENTS TABLE & VIEWER */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 p-6 flex flex-col justify-between space-y-4 overflow-x-auto">
        
        <div className="space-y-4">
          {/* Header Bar & Quick Actions Toolbar (Rules 1, 2, 5, 14) */}
          <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <FolderOpen className="w-5 h-5 text-kindia-blue" />
                  <h3 className="font-heading font-extrabold text-base text-slate-900">
                    {activeCatObj ? `Documents archivés dans « ${activeCatObj.label} »` : 'Documents archivés'}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {documents.length} document(s) trouvé(s) dans cette sélection
                </p>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {onScanDocument && (
                  <button
                    type="button"
                    onClick={onScanDocument}
                    className="px-3 py-2 bg-gradient-to-r from-kindia-blue to-kindia-lightBlue hover:from-blue-800 hover:to-kindia-blue text-white rounded-xl text-xs font-black shadow-sm transition flex items-center space-x-1.5 transform hover:-translate-y-0.5"
                  >
                    <Camera className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>📷 Numériser</span>
                  </button>
                )}

                {onImportDocument && (
                  <button
                    type="button"
                    onClick={onImportDocument}
                    className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
                  >
                    <FileUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>📥 Importer</span>
                  </button>
                )}

                {onNewDocument && (
                  <button
                    type="button"
                    onClick={onNewDocument}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                  >
                    <Edit className="w-3.5 h-3.5 text-kindia-blue" />
                    <span>✍️ Rédiger</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher par référence, titre, émetteur, texte OCR..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-kindia-blue focus:bg-white outline-hidden font-medium"
              />
            </div>
          </div>

          {/* Documents Table */}
          {loading ? (
            <div className="p-16 text-center text-slate-400">
              <div className="animate-spin w-8 h-8 border-2 border-kindia-blue border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-xs font-semibold">Chargement des documents d'archives...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-16 text-center bg-slate-50/50 rounded-3xl border border-slate-200">
              <Folder className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h4 className="font-bold text-sm text-slate-700">Aucun document dans ce dossier</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Aucun document n'a été trouvé pour le filtre ou la catégorie sélectionnée.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <th className="py-3 px-3">Référence & Document</th>
                    <th className="py-3 px-3">Catégorie</th>
                    <th className="py-3 px-3">Service Propriétaire</th>
                    <th className="py-3 px-3">Date d'Archivage</th>
                    <th className="py-3 px-3">Portée</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => {
                    const isTransmittedToSC = doc.transmitted_to_sc_for_archive === 1;
                    const isCentralArchived = doc.is_central_archived === 1;

                    return (
                      <tr 
                        key={doc.id}
                        className="hover:bg-slate-50/80 transition group"
                      >
                        {/* Ref & Title */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-start space-x-2.5">
                            <div className="p-2 rounded-xl bg-blue-50 text-kindia-blue shrink-0 mt-0.5">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 max-w-xs sm:max-w-sm">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-900 font-mono text-[11px] truncate">
                                  {doc.reference || 'REF-NON-DEFINIE'}
                                </span>
                                {doc.is_confidential && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-rose-100 text-rose-800 uppercase">
                                    Confidentiel
                                  </span>
                                )}
                              </div>
                              <p className="font-semibold text-slate-700 truncate mt-0.5">
                                {doc.title}
                              </p>
                              {doc.sender_name && (
                                <p className="text-[10px] text-slate-400 truncate">
                                  Émetteur : {doc.sender_name}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                            <Tag className="w-3 h-3 text-slate-500" />
                            <span>{doc.archive_category || doc.document_type || 'Archive'}</span>
                          </span>
                        </td>

                        {/* Owner Service */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700 truncate max-w-[140px]">
                              {doc.owner_service_name || doc.originating_service_name || 'Service'}
                            </span>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-3">
                          <div className="text-slate-600 flex items-center space-x-1 font-mono text-[11px]">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>
                              {doc.archived_at ? new Date(doc.archived_at).toLocaleDateString('fr-FR') : doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Scope */}
                        <td className="py-3.5 px-3">
                          {isCentralArchived ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                              <Landmark className="w-3 h-3 text-amber-600" />
                              <span>Fonds Central</span>
                            </span>
                          ) : isTransmittedToSC ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                              <Send className="w-3 h-3 text-indigo-600" />
                              <span>Transmis SC</span>
                            </span>
                          ) : doc.archive_scope === 'FACULTE' ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800">
                              <Building2 className="w-3 h-3 text-teal-600" />
                              <span>Facultaire</span>
                            </span>
                          ) : doc.archive_scope === 'INSTITUTIONNEL' ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800">
                              <ShieldCheck className="w-3 h-3 text-purple-600" />
                              <span>Institutionnel</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">
                              <Lock className="w-3 h-3 text-slate-500" />
                              <span>Privé</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {/* View / Open Drawer */}
                            <button
                              type="button"
                              onClick={() => onOpenDocument(doc.id)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                              title="Consulter le document & métadonnées"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Download PDF */}
                            {doc.file_path && onDownloadDocument && (
                              <button
                                type="button"
                                onClick={() => onDownloadDocument(doc.id, doc.reference)}
                                className="p-1.5 hover:bg-blue-50 text-kindia-blue rounded-lg transition"
                                title="Télécharger le document"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}

                            {/* Classify / Categorize */}
                            {onClassifyDocument && (
                              <button
                                type="button"
                                onClick={() => onClassifyDocument(doc)}
                                className="p-1.5 hover:bg-teal-50 text-teal-700 rounded-lg transition"
                                title="Classer dans une catégorie"
                              >
                                <Tag className="w-4 h-4" />
                              </button>
                            )}

                            {/* Diffuse / Transmit Document (Rules 5, 6, 7) */}
                            {onDiffuseDocument && (
                              <button
                                type="button"
                                onClick={() => onDiffuseDocument(doc)}
                                className="p-1.5 hover:bg-teal-50 text-teal-700 rounded-lg transition"
                                title="Diffuser / Transmettre à un autre service"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}

                            {/* Share Archive */}
                            {onShareDocument && (
                              <button
                                type="button"
                                onClick={() => onShareDocument(doc)}
                                className="p-1.5 hover:bg-purple-50 text-purple-700 rounded-lg transition"
                                title="Partager avec un autre service"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Transmit to SC */}
                            {!isSC && !isTransmittedToSC && !isCentralArchived && onTransmitSCDocument && (
                              <button
                                type="button"
                                onClick={() => onTransmitSCDocument(doc)}
                                className="p-1.5 hover:bg-amber-50 text-amber-700 rounded-lg transition"
                                title="Transmettre au Secrétariat Central"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}

                            {/* Act Central Archive (SC Only) */}
                            {isSC && !isCentralArchived && onActCentralArchive && (
                              <button
                                type="button"
                                onClick={() => onActCentralArchive(doc.id)}
                                className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition"
                                title="Acter le versement aux archives centrales"
                              >
                                <Landmark className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Footer Bar */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>UK-GED • Système d'Archivage Électronique Sécurisé</span>
          <span>{documents.length} document(s)</span>
        </div>

      </div>

    </div>
  );
}

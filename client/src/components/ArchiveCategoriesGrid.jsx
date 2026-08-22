import React, { useState } from 'react';
import { 
  Send, FileText, Mail, AlertCircle, FileSignature, BookmarkCheck, 
  Landmark, Bell, FileBarChart, CheckSquare, Award, Folder, HelpCircle,
  FolderOpen, Search, ArrowRight, ShieldCheck, Calendar, Sparkles,
  Plus, Settings, Tag, Briefcase, Layers, GraduationCap, Coins, HardDrive, Database
} from 'lucide-react';

const ICON_MAP = {
  Send, FileText, Mail, AlertCircle, FileSignature, BookmarkCheck,
  Landmark, Bell, FileBarChart, CheckSquare, Award, Folder, HelpCircle,
  Calendar, ShieldCheck, Briefcase, Layers, GraduationCap, Coins, HardDrive, Database,
  SOIT_TRANSMIS: Send,
  DEMANDE: FileText,
  LETTRE: Mail,
  NOTE_SERVICE: AlertCircle,
  DECISION: FileSignature,
  ARRETE: BookmarkCheck,
  DECRET: Landmark,
  CIRCULAIRE: Bell,
  RAPPORT: FileBarChart,
  PROCES_VERBAL: CheckSquare,
  MISSION_ORDER: Award,
  CONVOCATION: Calendar,
  INVITATION: Award,
  ATTESTATION: ShieldCheck,
  AUTRE: Folder,
  NON_CLASSE: HelpCircle
};

const CATEGORY_COLOR_MAP = {
  SOIT_TRANSMIS: 'from-blue-600 to-indigo-700 text-blue-600 bg-blue-50 border-blue-200',
  DEMANDE: 'from-emerald-600 to-teal-700 text-emerald-600 bg-emerald-50 border-emerald-200',
  LETTRE: 'from-indigo-600 to-purple-700 text-indigo-600 bg-indigo-50 border-indigo-200',
  NOTE_SERVICE: 'from-amber-600 to-orange-700 text-amber-600 bg-amber-50 border-amber-200',
  DECISION: 'from-purple-600 to-pink-700 text-purple-600 bg-purple-50 border-purple-200',
  ARRETE: 'from-rose-600 to-red-700 text-rose-600 bg-rose-50 border-rose-200',
  DECRET: 'from-amber-700 to-yellow-800 text-amber-700 bg-amber-50 border-amber-300',
  CIRCULAIRE: 'from-cyan-600 to-blue-700 text-cyan-600 bg-cyan-50 border-cyan-200',
  RAPPORT: 'from-teal-600 to-emerald-700 text-teal-600 bg-teal-50 border-teal-200',
  PROCES_VERBAL: 'from-slate-700 to-slate-900 text-slate-700 bg-slate-100 border-slate-300',
  MISSION_ORDER: 'from-amber-500 to-amber-600 text-amber-600 bg-amber-50 border-amber-200',
  CONVOCATION: 'from-sky-600 to-blue-700 text-sky-600 bg-sky-50 border-sky-200',
  INVITATION: 'from-pink-600 to-rose-700 text-pink-600 bg-pink-50 border-pink-200',
  ATTESTATION: 'from-green-600 to-emerald-700 text-green-600 bg-green-50 border-green-200',
  AUTRE: 'from-slate-600 to-slate-800 text-slate-600 bg-slate-100 border-slate-200',
  NON_CLASSE: 'from-zinc-600 to-zinc-800 text-zinc-600 bg-zinc-100 border-zinc-300'
};

export default function ArchiveCategoriesGrid({ 
  categories = [], 
  onSelectCategory,
  onAddCategory,
  onManageCategories,
  canManage = true
}) {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredCategories = categories.filter(c => 
    c.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  const totalDocuments = categories.reduce((sum, c) => sum + (c.count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Search and Action Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-kindia-blue/10 text-kindia-blue flex items-center justify-center font-bold shrink-0">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-sm text-slate-900">
              Classement par Catégories Administratives
            </h3>
            <p className="text-xs text-slate-500">
              Total dans vos archives : <strong className="text-kindia-blue font-bold">{totalDocuments} document{totalDocuments > 1 ? 's' : ''}</strong> ({categories.length} catégories)
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrer une catégorie..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-kindia-blue focus:bg-white outline-hidden font-medium"
            />
          </div>

          {canManage && (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {onManageCategories && (
                <button
                  type="button"
                  onClick={onManageCategories}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shrink-0"
                  title="Gérer les catégories du service"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Gérer</span>
                </button>
              )}

              {onAddCategory && (
                <button
                  type="button"
                  onClick={onAddCategory}
                  className="w-full sm:w-auto px-4 py-2 bg-kindia-blue hover:bg-blue-800 text-white rounded-xl text-xs font-black transition flex items-center justify-center space-x-1.5 shadow-sm shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Ajouter une catégorie</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid of Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCategories.map((cat) => {
          const IconComponent = ICON_MAP[cat.icon] || ICON_MAP[cat.code] || Folder;
          const colorStyles = cat.color 
            ? `from-teal-600 to-emerald-700 ${cat.color}`
            : CATEGORY_COLOR_MAP[cat.code] || 'from-slate-600 to-slate-800 text-slate-600 bg-slate-100 border-slate-200';
          const hasDocs = cat.count > 0;

          return (
            <div
              key={cat.code || cat.id}
              onClick={() => onSelectCategory(cat.code, cat.label)}
              className={`group relative bg-white p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden ${
                hasDocs 
                  ? 'border-slate-200 hover:border-kindia-blue hover:shadow-lg hover:-translate-y-0.5' 
                  : 'border-slate-100 opacity-80 hover:opacity-100 hover:border-slate-300'
              }`}
            >
              {/* Top Accent Line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorStyles}`} />

              <div>
                {/* Header with Icon and Counter Badge */}
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs transition group-hover:scale-105 ${colorStyles}`}>
                    <IconComponent className="w-6 h-6" />
                  </div>

                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black tracking-tight ${
                      hasDocs 
                        ? 'bg-kindia-blue text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {cat.count} {cat.count > 1 ? 'documents' : 'document'}
                    </span>

                    {cat.is_custom && (
                      <span className="block text-[9px] font-black uppercase tracking-wider text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded-md mt-1">
                        Catégorie Service
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div className="mt-4">
                  <h4 className="font-heading font-extrabold text-sm text-slate-900 group-hover:text-kindia-blue transition">
                    {cat.label}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {cat.description || 'Dossier documentaire officiel de service'}
                  </p>
                </div>
              </div>

              {/* Card Footer Link */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 group-hover:text-kindia-blue font-bold transition">
                <span>Ouvrir la catégorie</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

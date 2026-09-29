import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge, PriorityBadge, DeadlineBadge } from '../components/Badge';
import { 
  FileText, Clock, CheckCircle2, AlertTriangle, Archive, 
  Send, Plus, FileCheck, ShieldAlert, ArrowRight, Eye, Calendar,
  Search, RefreshCw, Inbox, UserCheck, CheckSquare, Layers, 
  MapPin, Briefcase, FileClock, ChevronRight, AlertCircle, Building2, User
} from 'lucide-react';
import { formatAction, formatNextAction, formatActionDate } from '../utils/actionFormatter';
import { formatFullName } from '../utils/userUtils';

export default function Dashboard({ onSelectDocument, onNavigate }) {
  const { user, institution, getLogoUrl } = useAuth();
  const logoUrl = getLogoUrl();
  const showLogo = institution?.show_logo_dashboard !== 0 && logoUrl;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const isSC = user?.role_code === 'ADMINISTRATEUR' || 
               user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || 
               user?.role_code === 'AGENT_SC' || 
               user?.service_code === 'SC';

  const isSG = user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || 
               user?.service_code === 'SG';

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered recent activity list with live search
  const filteredActivity = useMemo(() => {
    if (!data?.recent_activity) return [];

    if (!searchQuery.trim()) return data.recent_activity;

    const query = searchQuery.toLowerCase().trim();
    return data.recent_activity.filter(item => {
      const matchRef = (item.reference || '').toLowerCase().includes(query);
      const matchTitle = (item.title || '').toLowerCase().includes(query);
      const matchSender = (item.sender_name || '').toLowerCase().includes(query);
      const matchService = (item.service_name || '').toLowerCase().includes(query);
      const matchResponsible = (item.current_responsible || '').toLowerCase().includes(query);
      const matchStatus = (item.status || '').toLowerCase().includes(query);
      const matchAction = (item.last_action_title || item.last_action || '').toLowerCase().includes(query);
      const matchNext = (item.next_action || '').toLowerCase().includes(query);
      return matchRef || matchTitle || matchSender || matchService || matchResponsible || matchStatus || matchAction || matchNext;
    });
  }, [data?.recent_activity, searchQuery]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-xs font-semibold text-slate-500">Chargement du tableau de bord et synchronisation du suivi...</p>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const scStats = data?.sc || {};

  const handleActionClick = (item) => {
    if (item.source_table === 'external_missionaries' || item.type_category === 'ORDRE_MISSION_EXTERNE') {
      onNavigate('external-missionaries');
    } else if (item.source_table === 'mission_requests' || item.source_table === 'mission_order_requests' || item.type_category === 'ORDRE_MISSION_INTERNE' && !item.source_table === 'documents') {
      onNavigate('missions');
    } else if (item.raw_id || item.id) {
      onSelectDocument(item.raw_id || item.id);
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* 1. Welcome Banner */}
      <div className="bg-gradient-to-r from-[#07172c] via-[#0b1c34] to-[#07172c] border border-blue-900/60 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between gap-6">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        {/* Top & Profile Identity Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 w-full">
          <div className="flex items-center space-x-4 md:space-x-5">
            {showLogo ? (
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl p-2 shadow-xl border border-white/20 flex items-center justify-center shrink-0">
                <img 
                  src={logoUrl} 
                  alt={institution?.name || "Logo Officiel"} 
                  className="w-full h-full object-contain" 
                />
              </div>
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-kindia-gold to-amber-500 rounded-2xl p-2 shadow-xl border border-white/20 flex items-center justify-center shrink-0 text-slate-950 font-black text-2xl">
                UK
              </div>
            )}

            <div>
              <div className="inline-flex items-center space-x-2 bg-[#12243d] border border-amber-400/50 px-3.5 py-1 rounded-full mb-1.5 shadow-inner">
                <span className="text-[10px] md:text-[11px] font-extrabold text-amber-400 tracking-wider uppercase font-sans">
                  GOUVERNANCE ADMINISTRATIVE & GED • {institution?.name || 'UNIVERSITÉ DE KINDIA'}
                </span>
              </div>
              
              <h2 className="font-heading font-black text-2xl md:text-3xl lg:text-4xl text-white tracking-tight leading-tight mt-1">
                Bonjour, {formatFullName(user)}
              </h2>

              <div className="text-xs md:text-sm text-slate-300 mt-1.5 flex flex-wrap items-center gap-2 font-medium">
                <span>Rôle : <strong className="text-white font-bold">{user?.role_name || (isSC ? 'Agent Secrétariat Central' : 'Utilisateur')}</strong></span>
                <span className="text-amber-400 font-bold">•</span>
                <span>Service : <strong className="text-white font-bold">{user?.service_name || (isSC ? 'Secrétariat Central' : 'Administration')}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar : Clean full-width grid layout without any horizontal overflow */}
        {isSC ? (
          <div className="w-full pt-4 border-t border-white/10 relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
              {/* 1. Mon Espace Service */}
              <button 
                onClick={() => onNavigate('service-workspace')}
                className="w-full bg-[#e5a93c] hover:bg-[#d99c2e] text-slate-950 font-bold px-4 py-3 rounded-full text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 border border-amber-300/60 active:scale-95"
                title="Accéder à Mon Espace Service"
              >
                <Building2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span className="truncate">Mon Espace Service</span>
              </button>

              {/* 2. Enregistrer un Courrier Entrant */}
              <button 
                onClick={() => onNavigate('incoming', { openCreateModal: true })}
                className="w-full bg-[#0b1c34] hover:bg-[#122c52] text-white font-bold border border-blue-400/40 hover:border-blue-300 px-4 py-3 rounded-full text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 active:scale-95"
                title="Ouvrir le formulaire d'enregistrement d'un nouveau courrier entrant"
              >
                <Plus className="w-4 h-4 text-amber-400 stroke-[3]" />
                <span className="truncate">Enregistrer un Courrier Entrant</span>
              </button>

              {/* 3. NOUVELLE DIFFUSION */}
              <button 
                onClick={() => onNavigate('dispatching', { openCreateModal: true })}
                className="w-full bg-[#e5a93c] hover:bg-[#d99c2e] text-slate-950 font-black px-4 py-3 rounded-full text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 border border-amber-300/60 active:scale-95 uppercase tracking-wide"
                title="Ouvrir le formulaire de nouvelle diffusion"
              >
                <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
                <span className="truncate">NOUVELLE DIFFUSION</span>
              </button>

              {/* 4. Audiences & RDV */}
              <button 
                onClick={() => onNavigate('appointments')}
                className="w-full bg-[#0b1c34] hover:bg-[#122c52] text-white font-bold border border-amber-400/50 hover:border-amber-400 px-4 py-3 rounded-full text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 active:scale-95"
                title="Consulter les audiences et rendez-vous"
              >
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="truncate">Audiences & RDV</span>
              </button>

              {/* 5. ÉTABLIR UN ORDRE DE MISSION (SC) */}
              <button 
                onClick={() => onNavigate('missions', { openCreateModal: true })}
                className="w-full bg-[#0b1c34] hover:bg-[#122c52] text-white font-extrabold border border-blue-400/40 hover:border-blue-300 px-4 py-3 rounded-full text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-1.5 active:scale-95 uppercase tracking-tight"
                title="Ouvrir le formulaire de création d'un ordre de mission officiel"
              >
                <Plus className="w-4 h-4 text-amber-400 stroke-[3]" />
                <FileText className="w-4 h-4 text-sky-400" />
                <span className="truncate">ÉTABLIR UN ORDRE DE MISSION (SC)</span>
              </button>

              {/* 6. Suivi de document */}
              <button 
                onClick={() => onNavigate('tracking')}
                className="w-full bg-[#e5a93c] hover:bg-[#d99c2e] text-slate-950 font-bold px-4 py-3 rounded-full text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 border border-amber-300/60 active:scale-95"
                title="Suivi de document par référence ou QR Code"
              >
                <Search className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span className="truncate">Suivi de document</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5 pt-4 border-t border-white/10 relative z-10">
            <button 
              onClick={() => onNavigate('service-workspace')}
              className="bg-kindia-gold text-kindia-blue hover:bg-amber-400 px-4 py-2.5 rounded-2xl text-xs font-black shadow-md transition flex items-center space-x-2"
            >
              <Building2 className="w-4 h-4 stroke-[2.5]" />
              <span>Mon Espace Service</span>
            </button>

            <button 
              onClick={() => onNavigate('appointments')}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center space-x-2"
            >
              <Calendar className="w-4 h-4 text-kindia-gold" />
              <span>Audiences & RDV</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Secrétariat Central Specialized Indicators Banner */}
      {isSC && scStats && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-kindia-blue p-6 rounded-3xl text-white shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
              <h3 className="font-heading font-extrabold text-sm md:text-base text-kindia-gold tracking-wide uppercase">
                Tableau de Bord Central — Pilotage des Dossiers Actifs
              </h3>
            </div>
            <span className="text-[11px] text-slate-300 font-mono">
              Suivi synchronisé en temps réel sans doublon
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Dossiers en attente de traitement */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col justify-between hover:bg-white/10 transition">
              <span className="text-[11px] font-semibold text-slate-300">Total en Traitement</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-400">{scStats.pending_processing || 0}</span>
                <Clock className="w-4 h-4 text-amber-400 opacity-80" />
              </div>
            </div>

            {/* Courriers en attente */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col justify-between hover:bg-white/10 transition">
              <span className="text-[11px] font-semibold text-slate-300">Courriers en Attente</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-sky-400">{scStats.pending_incoming_mail || 0}</span>
                <Inbox className="w-4 h-4 text-sky-400 opacity-80" />
              </div>
            </div>

            {/* Ordres de mission internes en attente */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col justify-between hover:bg-white/10 transition">
              <span className="text-[11px] font-semibold text-slate-300">OM Internes en Attente</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-teal-400">{scStats.pending_internal_missions || 0}</span>
                <FileCheck className="w-4 h-4 text-teal-400 opacity-80" />
              </div>
            </div>

            {/* Ordres de mission externes en attente */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col justify-between hover:bg-white/10 transition">
              <span className="text-[11px] font-semibold text-slate-300">OM Externes Actifs</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-kindia-gold">{scStats.pending_external_missions || 0}</span>
                <MapPin className="w-4 h-4 text-kindia-gold opacity-80" />
              </div>
            </div>

            {/* Demandes en attente */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col justify-between hover:bg-white/10 transition">
              <span className="text-[11px] font-semibold text-slate-300">Demandes en Attente</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-purple-400">{scStats.pending_requests || 0}</span>
                <FileText className="w-4 h-4 text-purple-400 opacity-80" />
              </div>
            </div>

            {/* Documents en attente de signature */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col justify-between hover:bg-white/10 transition">
              <span className="text-[11px] font-semibold text-slate-300">En Attente Signature</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-400">{scStats.pending_signatures || 0}</span>
                <AlertTriangle className="w-4 h-4 text-rose-400 opacity-80" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Alerts if any signatures are waiting for the current user */}
      {(data?.to_sign_count > 0 || data?.sg?.missions_to_sign > 0) && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-xs text-amber-950 uppercase tracking-wide">
                BOÎTE À SIGNER — {user?.function_title || user?.role_name || user?.service_name}
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Vous avez <strong>{data?.to_sign_count || data?.sg?.missions_to_sign}</strong> document(s) / ordre(s) de mission en attente de votre visa ou signature électronique.
              </p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('mobile-signatures')}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow transition text-center"
          >
            Accéder à la boîte à signer
          </button>
        </div>
      )}

      {/* 4. Global Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Documents Accessibles</span>
            <span className="text-2xl font-extrabold text-kindia-blue mt-1 block">{metrics?.total || 0}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-kindia-blue flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">En Attente / Traitement</span>
            <span className="text-2xl font-extrabold text-amber-600 mt-1 block">{(metrics?.pending || 0) + (metrics?.in_progress || 0)}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Signés & Scellés</span>
            <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">{metrics?.signed || 0}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Dépassements / Retards</span>
            <span className="text-2xl font-extrabold text-red-600 mt-1 block">{metrics?.overdue || 0}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 5. MAIN SECTION : « DERNIERS DOCUMENTS & ORIENTATION » */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden space-y-4">
        
        {/* Table Header & Search */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-kindia-blue"></span>
              <h3 className="font-heading font-extrabold text-base md:text-lg text-slate-900">
                Derniers Documents & Orientations
              </h3>
              <span className="bg-kindia-blue/10 text-kindia-blue text-xs font-black px-2.5 py-0.5 rounded-full">
                {filteredActivity.length} dossier(s)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Suivi centralisé et traçabilité de tous les dossiers administratifs actifs en cours de traitement
            </p>
          </div>

          {/* Instant Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher réf, objet, demandeur, service..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-kindia-blue focus:bg-white transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Central Tracking Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1260px] table-fixed">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-4 w-[11%] min-w-[120px]">Type</th>
                <th className="p-4 w-[17%] min-w-[200px]">Objet / Titre</th>
                <th className="p-4 w-[13%] min-w-[150px]">Expéditeur / Demandeur</th>
                <th className="p-4 w-[13%] min-w-[150px]">Service Responsable</th>
                <th className="p-4 w-[13%] min-w-[150px]">Responsable Actuel</th>
                <th className="p-4 w-[12%] min-w-[140px]">Statut</th>
                <th className="p-4 w-[22%] min-w-[260px]">Dernière Action & Date</th>
                <th className="p-4 w-[18%] min-w-[220px]">Prochaine Action</th>
                <th className="p-4 w-[8%] min-w-[90px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredActivity.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400 font-medium space-y-2">
                    <Inbox className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-sm font-bold text-slate-500">Aucun dossier correspondant.</p>
                    <p className="text-xs text-slate-400">Tous les dossiers actifs en cours de traitement apparaissent ici.</p>
                  </td>
                </tr>
              ) : (
                filteredActivity.map(doc => {
                  const actionInfo = formatAction(
                    doc.last_action_title || doc.last_action, 
                    doc.last_action_mention, 
                    doc.status, 
                    doc.document_type
                  );
                  const nextActionHuman = formatNextAction(
                    doc.next_action, 
                    doc.status, 
                    isSG, 
                    isSC
                  );

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/90 transition group">
                      
                      {/* Type */}
                      <td className="p-4 align-top">
                        <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-lg inline-block whitespace-normal break-words leading-tight ${
                          doc.type_category === 'COURRIER_ENTRANT' ? 'bg-sky-50 text-sky-800 border border-sky-200' :
                          doc.type_category === 'ORDRE_MISSION_EXTERNE' ? 'bg-amber-50 text-amber-900 border border-amber-300' :
                          doc.type_category === 'ORDRE_MISSION_INTERNE' ? 'bg-teal-50 text-teal-800 border border-teal-200' :
                          doc.type_category === 'DEMANDE' ? 'bg-purple-50 text-purple-800 border border-purple-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {doc.type_category === 'COURRIER_ENTRANT' ? '📥 Courrier Entrant' :
                           doc.type_category === 'ORDRE_MISSION_EXTERNE' ? '🌍 OM Externe' :
                           doc.type_category === 'ORDRE_MISSION_INTERNE' ? '✈️ OM Interne' :
                           doc.type_category === 'DEMANDE' ? '📝 Demande' :
                           doc.document_type || 'Document'}
                        </span>
                      </td>

                      {/* Objet / Titre & Référence */}
                      <td className="p-4 align-top">
                        <div className="font-bold text-slate-900 text-xs leading-snug break-words whitespace-normal line-clamp-2" title={doc.title}>
                          {doc.title}
                        </div>
                        <div className="mt-1.5">
                          <span className="text-[10px] font-mono font-extrabold text-kindia-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 inline-block">
                            {doc.reference}
                          </span>
                        </div>
                      </td>

                      {/* Expéditeur / Demandeur */}
                      <td className="p-4 align-top text-slate-700">
                        <div className="flex items-start space-x-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="font-semibold text-xs leading-snug break-words whitespace-normal" title={doc.sender_name}>
                            {doc.sender_name}
                          </span>
                        </div>
                      </td>

                      {/* Service Responsable */}
                      <td className="p-4 align-top text-slate-800">
                        <div className="flex items-start space-x-1.5">
                          <Building2 className="w-3.5 h-3.5 text-kindia-blue shrink-0 mt-0.5" />
                          <span className="font-bold text-slate-900 text-xs leading-snug break-words whitespace-normal">
                            {doc.service_name}
                          </span>
                        </div>
                      </td>

                      {/* Responsable Actuel */}
                      <td className="p-4 align-top text-slate-600">
                        <div className="flex items-start space-x-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="font-medium text-xs leading-snug break-words whitespace-normal" title={doc.current_responsible}>
                            {doc.current_responsible}
                          </span>
                        </div>
                      </td>

                      {/* Statut */}
                      <td className="p-4 align-top">
                        <div className="inline-block whitespace-normal leading-tight">
                          <StatusBadge status={doc.status} />
                        </div>
                      </td>

                      {/* Dernière Action & Date */}
                      <td className="p-4 align-top">
                        <div className="font-semibold text-slate-900 text-xs leading-relaxed break-words whitespace-normal">
                          {actionInfo.title}
                        </div>
                        {doc.last_action_date && (
                          <div className="text-[11px] text-slate-500 font-medium mt-1 whitespace-nowrap">
                            {formatActionDate(doc.last_action_date)}
                          </div>
                        )}
                        {actionInfo.mention && (
                          <div className="text-[10px] text-slate-600 font-medium italic mt-0.5 break-words whitespace-normal">
                            {actionInfo.mention}
                          </div>
                        )}
                      </td>

                      {/* Prochaine Action */}
                      <td className="p-4 align-top">
                        <div className="inline-flex items-start space-x-1.5 text-[11px] font-bold text-kindia-blue bg-blue-50/90 px-3 py-1.5 rounded-xl border border-blue-200/60 leading-normal break-words whitespace-normal max-w-full">
                          <span className="shrink-0">⚡</span>
                          <span className="break-words" title={nextActionHuman}>
                            {nextActionHuman}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 align-top text-right">
                        <button
                          onClick={() => handleActionClick(doc)}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 font-bold rounded-xl transition flex items-center space-x-1.5 ml-auto shadow-sm"
                          title="Consulter et traiter ce dossier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ouvrir</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

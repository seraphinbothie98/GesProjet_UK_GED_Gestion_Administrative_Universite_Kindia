import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge, PriorityBadge, DeadlineBadge } from '../components/Badge';
import { 
  FileText, Clock, CheckCircle2, AlertTriangle, Archive, 
  Send, Plus, FileCheck, ShieldAlert, ArrowRight, Eye, Calendar
} from 'lucide-react';

export default function Dashboard({ onSelectDocument, onNavigate }) {
  const { user, institution, getLogoUrl } = useAuth();
  const logoUrl = getLogoUrl();
  const showLogo = institution?.show_logo_dashboard !== 0 && logoUrl;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-xs text-slate-500">Chargement du tableau de bord...</p>
      </div>
    );
  }

  const metrics = data?.metrics || {};

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-kindia-blue to-kindia-lightBlue rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="flex items-center space-x-4">
          {showLogo && (
            <img 
              src={logoUrl} 
              alt={institution?.name || "Logo Officiel"} 
              className="w-14 h-14 object-contain rounded-xl bg-white p-1.5 shadow-lg border border-white/20 shrink-0" 
            />
          )}
          <div>
            <span className="text-xs font-bold text-kindia-gold uppercase tracking-wider block">
              Espace Administrateur & GED • {institution?.name || 'Université de Kindia'}
            </span>
            <h2 className="font-heading font-extrabold text-2xl mt-1">
              Bienvenue, {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-xs text-slate-200 mt-1">
              Rôle : <span className="font-bold text-white">{user?.role_name}</span> | Service : <span className="font-bold text-white">{user?.service_name}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 md:mt-0 flex flex-wrap gap-2.5">
          <button 
            onClick={() => onNavigate('service-workspace')}
            className="bg-kindia-gold text-kindia-blue hover:bg-amber-400 px-4 py-2 rounded-xl text-xs font-black shadow-md transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Espace & Documents de mon Service</span>
          </button>

          {/* Actions for Secrétariat Central and Administrator */}
          {(user?.role_code === 'ADMINISTRATEUR' || user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user?.service_code === 'SC') && (
            <>
              <button 
                onClick={() => onNavigate('incoming')}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2"
              >
                <Plus className="w-4 h-4 text-kindia-gold" />
                <span>Courrier Entrant</span>
              </button>

              <button 
                onClick={() => onNavigate('missions')}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2"
              >
                <FileCheck className="w-4 h-4 text-kindia-gold" />
                <span>Ordres de Mission</span>
              </button>
            </>
          )}

          <button 
            onClick={() => onNavigate('appointments')}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2"
          >
            <Calendar className="w-4 h-4 text-kindia-gold" />
            <span>Rendez-vous</span>
          </button>
        </div>
      </div>

      {/* Secrétariat Central Incoming Mission Requests Alert */}
      {(user?.role_code === 'ADMINISTRATEUR' || user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user?.service_code === 'SC') && data?.sc?.mission_requests_pending > 0 && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm shrink-0">
              📥
            </div>
            <div>
              <h4 className="font-bold text-xs text-emerald-950 uppercase flex items-center space-x-2">
                <span>BOÎTE DE RÉCEPTION — SECRÉTARIAT CENTRAL</span>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                  {data.sc.mission_requests_pending} nouvelle(s)
                </span>
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Demandes d'ordre de mission reçues : <strong>{data.sc.mission_requests_pending}</strong> en attente de traitement et de création d'ordre officiel.
              </p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('missions')}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow transition text-center flex items-center justify-center space-x-1.5"
          >
            <span>Traiter les demandes reçues</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Generic Responsable Signature Alert */}
      {(data?.to_sign_count > 0 || data?.sg?.missions_to_sign > 0) && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <h4 className="font-bold text-xs text-amber-900 uppercase">
                BOÎTE À SIGNER — {user?.function_title || user?.role_name || user?.service_name}
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Vous avez <strong>{data?.to_sign_count || data?.sg?.missions_to_sign}</strong> document(s) / ordre(s) de mission en attente de votre action.
              </p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('mobile-signatures')}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition text-center"
          >
            Accéder à la boîte à signer
          </button>
        </div>
      )}

      {/* Appointment Banner Widget */}
      {data?.appointments && (
        <div 
          onClick={() => onNavigate('appointments')}
          className="bg-gradient-to-r from-slate-900 to-kindia-blue text-white p-5 rounded-2xl shadow-md cursor-pointer hover:shadow-lg transition flex flex-col md:flex-row justify-between items-center gap-4"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-kindia-gold/20 text-kindia-gold border border-kindia-gold flex items-center justify-center font-bold text-2xl">
              📅
            </div>
            <div>
              <span className="text-[10px] font-bold text-kindia-gold uppercase tracking-wider block">MODULE RENDEZ-VOUS & AGENDA</span>
              <h4 className="font-heading font-extrabold text-lg text-white">Gestion des Audiences & Créneaux</h4>
              <p className="text-xs text-slate-300">
                Vous avez <strong className="text-kindia-gold">{data.appointments.pending}</strong> demande(s) en attente et <strong className="text-emerald-400">{data.appointments.today}</strong> rendez-vous prévus aujourd'hui.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-white/10 px-3 py-1.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-300 block">En attente</span>
              <span className="font-extrabold text-amber-300 text-sm">{data.appointments.pending}</span>
            </div>
            <div className="bg-white/10 px-3 py-1.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-300 block">Confirmés</span>
              <span className="font-extrabold text-teal-300 text-sm">{data.appointments.confirmed}</span>
            </div>
            <div className="bg-kindia-gold text-kindia-blue px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1 hover:bg-yellow-400">
              <span>Ouvrir l'agenda</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
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

      {/* Admin System Metrics Banner */}
      {data?.admin && (
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap justify-between items-center text-xs">
          <div className="flex items-center space-x-2 font-bold text-kindia-gold">
            <ShieldAlert className="w-4 h-4" />
            <span>STATISTIQUES D'ADMINISTRATION :</span>
          </div>
          <div>Utilisateurs actifs : <strong>{data.admin.total_users || 0}</strong></div>
          <div>Services préconfigurés : <strong>{data.admin.active_services || 0} / 30</strong></div>
          <div>Événements d’audit : <strong>{data.admin.audit_events || 0}</strong></div>
        </div>
      )}

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-heading font-bold text-sm text-slate-800">Derniers Documents & Orientations</h3>
          <button onClick={() => onNavigate('incoming')} className="text-xs text-kindia-blue font-bold flex items-center space-x-1 hover:underline">
            <span>Voir tout</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Référence</th>
                <th className="p-3.5">Titre / Objet</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Service Actuel</th>
                <th className="p-3.5">Priorité</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(!data?.recent_activity || data?.recent_activity?.length === 0) ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 font-medium">Aucun document récent dans le circuit.</td>
                </tr>
              ) : (
                data?.recent_activity?.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-bold text-kindia-blue">{doc.reference}</td>
                    <td className="p-3.5 text-slate-800 max-w-xs truncate">{doc.title}</td>
                    <td className="p-3.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 px-2 py-0.5 bg-slate-100 rounded">
                        {doc.document_type}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700">{doc.service_name}</td>
                    <td className="p-3.5"><PriorityBadge priority={doc.priority} /></td>
                    <td className="p-3.5"><StatusBadge status={doc.status} /></td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onSelectDocument(doc.id)}
                        className="p-1.5 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-600 rounded-lg transition"
                        title="Consulter le document et son circuit"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

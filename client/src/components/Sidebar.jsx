import React from 'react';
import { useAuth } from '../context/AuthContext';
import { usePwa } from '../context/PwaContext';
import { 
  LayoutDashboard, Inbox, Send, FileCheck, Archive, 
  Search, ShieldAlert, Building2, Users, Lock, Award, QrCode, Calendar, FileText, Download, CheckCircle2, LogOut
} from 'lucide-react';

export default function Sidebar({ currentPage, setCurrentPage }) {
  const { user, hasPermission, institution, getLogoUrl, logout } = useAuth();
  const { isInstalled, promptInstall } = usePwa();
  const logoUrl = getLogoUrl();
  const showLogo = institution?.show_logo_sidebar !== 0 && logoUrl;

  const isSC = user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' 
    || user?.service_code === 'SC';

  const isCentralAdminOrSC = user?.role_code === 'ADMINISTRATEUR' 
    || isSC;

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, show: true },
    { id: 'transmissions', label: '🔄 Transmissions Inter-Services', icon: Send, show: true },
    { id: 'service-workspace', label: '📂 Espace de mon Service', icon: Building2, show: true },
    { id: 'dispatching', label: '📢 Dispatching & Diffusions', icon: Send, show: true },
    { id: 'appointments', label: '📅 Rendez-vous', icon: Calendar, show: true },
    { id: 'tracking', label: '🔎 Suivre mon document', icon: QrCode, show: true },
    { id: 'incoming', label: 'Courriers entrants', icon: Inbox, show: isCentralAdminOrSC && hasPermission('incoming_mail.read') },
    { id: 'outgoing', label: 'Courriers sortants', icon: Send, show: isCentralAdminOrSC && hasPermission('outgoing_mail.read') },
    { 
      id: 'missions', 
      label: user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user?.role_code === 'RECTEUR' ? '✍️ Ordres de mission (À signer)' : '📄 Ordre de mission', 
      icon: FileCheck, 
      show: isCentralAdminOrSC || user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user?.role_code === 'RECTEUR' || hasPermission('mission.sign') || user?.personnel_category === 'ENSEIGNANT_CHERCHEUR'
    },
    { id: 'external-missionaries', label: '✈️ Missionnaires externes', icon: FileCheck, show: isCentralAdminOrSC || user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user?.role_code === 'RECTEUR' },
    { id: 'archives', label: isCentralAdminOrSC ? 'Archives Centrales' : '📁 Archives Électroniques', icon: Archive, show: true },
    { id: 'search', label: 'Recherche globale', icon: Search, show: true },
    { id: 'audit', label: 'Journal d’audit', icon: ShieldAlert, show: hasPermission('audit.read') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'services', label: 'Gestion des services', icon: Building2, show: hasPermission('services.read') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'staff', label: '👥 Personnel & Utilisateurs', icon: Users, show: hasPermission('users.read') || user?.service_code === 'SC' || hasPermission('personnel.view') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'fleet', label: '🚗 Parc Automobile', icon: Building2, show: isCentralAdminOrSC },
    { id: 'drivers', label: '🚖 Chauffeurs', icon: Users, show: isCentralAdminOrSC },
    { id: 'institution', label: '🏛️ Identité Visuelle', icon: Building2, show: hasPermission('institution.manage') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'mission-template', label: '📜 Modèle Ordre de mission', icon: FileCheck, show: user?.role_code === 'ADMINISTRATEUR' },
    { id: 'document-types', label: '⚖️ Types de documents', icon: FileText, show: hasPermission('settings.manage') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'signatures', label: '✍️ Signatures électroniques', icon: Lock, show: user?.role_code === 'ADMINISTRATEUR' },
    { id: 'maintenance', label: '🛠️ Corbeille & Maintenance', icon: ShieldAlert, show: user?.role_code === 'ADMINISTRATEUR' },
    { id: 'account-settings', label: '👤 Mon Compte & Sécurité', icon: Users, show: true }
  ];

  return (
    <aside className="hidden md:flex w-64 bg-kindia-blue text-white flex-col justify-between shadow-xl min-h-screen shrink-0">
      <div>
        {/* Institutional Header */}
        <div className="h-16 px-6 flex items-center space-x-3 border-b border-white/10 bg-kindia-lightBlue/40">
          {showLogo ? (
            <img 
              src={logoUrl} 
              alt={institution?.name || "Logo Officiel"} 
              className="w-10 h-10 object-contain rounded-lg bg-white p-0.5 shadow shrink-0" 
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-kindia-gold flex items-center justify-center font-extrabold text-kindia-blue shadow shrink-0">
              UK
            </div>
          )}
          <div className="overflow-hidden">
            <span className="font-heading font-extrabold text-base text-white tracking-wide block truncate">
              {institution?.name ? institution.name.split(' ')[0] + ' GED' : 'UK-GED'}
            </span>
            <span className="block text-[10px] text-kindia-gold font-medium uppercase tracking-wider truncate">
              {institution?.name || 'Univ. Kindia'}
            </span>
          </div>
        </div>

        {/* User Service / Academic Badge */}
        <div className="mx-4 my-4 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-3">
          <Award className="w-5 h-5 text-kindia-gold shrink-0" />
          <div className="overflow-hidden">
            <span className="block text-xs font-bold truncate text-white">
              {user?.personnel_category === 'ENSEIGNANT_CHERCHEUR' 
                ? '🎓 Enseignant-Chercheur' 
                : (user?.service_name || 'Personnel Université')}
            </span>
            <span className="block text-[10px] text-slate-300 truncate">
              {user?.academic_structure || user?.function_title || 'Université de Kindia'}
            </span>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="px-3 space-y-1">
          {navItems.filter(item => item.show).map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                  isActive 
                    ? 'bg-kindia-gold text-kindia-blue font-bold shadow-md' 
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-kindia-blue' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer & PWA Installation Action */}
      <div className="p-4 border-t border-white/10 text-center space-y-2.5">
        {!isInstalled ? (
          <button
            onClick={() => promptInstall()}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-kindia-gold/15 hover:bg-kindia-gold/25 text-kindia-gold border border-kindia-gold/30 text-xs font-bold transition shadow-xs group cursor-pointer"
            title="Installer UK-GED comme application sur cet ordinateur"
          >
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4 text-kindia-gold shrink-0 group-hover:scale-110 transition" />
              <span>Installer UK-GED</span>
            </div>
            <span className="text-[10px] bg-kindia-gold text-kindia-blue font-black px-1.5 py-0.5 rounded">PWA</span>
          </button>
        ) : (
          <div className="w-full flex items-center justify-center space-x-1.5 py-1 text-slate-300 text-[10px] font-medium opacity-80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Application installée</span>
          </div>
        )}

        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 hover:text-white text-rose-300 border border-rose-500/30 text-xs font-bold transition duration-150 shadow-xs cursor-pointer group"
          title="Se déconnecter et retourner à la page de connexion"
        >
          <LogOut className="w-4 h-4 text-rose-300 group-hover:text-white transition shrink-0" />
          <span>Se déconnecter</span>
        </button>

        <div>
          <span className="text-[10px] text-slate-400 block font-medium">République de Guinée</span>
          <span className="text-[9px] text-kindia-gold block">Système Officiel Certifié 2026</span>
        </div>
      </div>
    </aside>
  );
}


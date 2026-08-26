import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Inbox, Send, FileCheck, Archive, 
  Search, ShieldAlert, Building2, Users, Lock, Award, QrCode, Calendar, X, LogOut, ChevronRight, FileText
} from 'lucide-react';

export default function MobileDrawer({ isOpen, onClose, currentPage, setCurrentPage }) {
  const { user, hasPermission, institution, getLogoUrl, logout } = useAuth();
  const logoUrl = getLogoUrl();

  if (!isOpen) return null;

  const isSC = user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' 
    || user?.service_code === 'SC';

  const isCentralAdminOrSC = user?.role_code === 'ADMINISTRATEUR' 
    || isSC;

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, show: true },
    { id: 'mobile-signatures', label: '✍️ Boîte à Signer', icon: Award, show: true },
    { id: 'appointments', label: '📅 Rendez-vous & Agenda', icon: Calendar, show: true },
    { id: 'tracking', label: '🔎 Suivre mon document', icon: QrCode, show: true },
    { id: 'incoming', label: 'Courriers entrants', icon: Inbox, show: isCentralAdminOrSC && hasPermission('incoming_mail.read') },
    { id: 'outgoing', label: 'Courriers sortants', icon: Send, show: isCentralAdminOrSC && hasPermission('outgoing_mail.read') },
    { 
      id: 'missions', 
      label: '📄 Gestion des Ordres de mission', 
      icon: FileCheck, 
      show: isCentralAdminOrSC 
    },
    { id: 'external-missionaries', label: '✈️ Missionnaires externes', icon: FileCheck, show: isCentralAdminOrSC },
    { id: 'archives', label: 'Archives électroniques', icon: Archive, show: isCentralAdminOrSC },
    { id: 'search', label: 'Recherche globale', icon: Search, show: true },
    { id: 'audit', label: 'Journal d’audit', icon: ShieldAlert, show: hasPermission('audit.read') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'services', label: 'Gestion des services', icon: Building2, show: hasPermission('services.read') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'users', label: 'Gestion des utilisateurs', icon: Users, show: hasPermission('users.read') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'roles', label: 'Rôles & Permissions', icon: Lock, show: hasPermission('roles.create') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'staff', label: '👥 Personnel', icon: Users, show: user?.service_code === 'SC' || hasPermission('personnel.view') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'institution', label: '🏛️ Identité Visuelle', icon: Building2, show: hasPermission('institution.manage') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'templates', label: '📄 Modèles de documents', icon: FileCheck, show: hasPermission('templates.manage') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'document-types', label: '⚖️ Types de documents', icon: FileText, show: hasPermission('settings.manage') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'signatures', label: '✍️ Signatures électroniques', icon: Lock, show: hasPermission('signatures.manage') || user?.role_code === 'ADMINISTRATEUR' },
    { id: 'maintenance', label: '🛠️ Corbeille & Maintenance', icon: ShieldAlert, show: user?.role_code === 'ADMINISTRATEUR' },
    { id: 'account-settings', label: '👤 Mon Compte & Sécurité', icon: Users, show: true }
  ];

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Content */}
      <div className="relative w-4/5 max-w-xs bg-kindia-blue text-white h-full flex flex-col justify-between shadow-2xl z-10 overflow-y-auto">
        <div>
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-kindia-lightBlue/40">
            <div className="flex items-center space-x-2.5">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="w-8 h-8 object-contain rounded-lg bg-white p-0.5" 
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-kindia-gold text-kindia-blue font-extrabold flex items-center justify-center text-xs">
                  UK
                </div>
              )}
              <div>
                <span className="font-heading font-extrabold text-sm block leading-tight">
                  UK-GED Mobile
                </span>
                <span className="text-[10px] text-kindia-gold block uppercase">
                  {user?.service_code || 'Kindia'}
                </span>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="m-3 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-kindia-gold text-kindia-blue font-bold flex items-center justify-center text-sm shrink-0">
              {user?.first_name ? user.first_name[0] : 'U'}
            </div>
            <div className="overflow-hidden">
              <span className="block text-xs font-bold text-white truncate">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="block text-[10px] text-kindia-gold truncate">
                {user?.function_title || user?.role_name}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-1">
            {navItems.filter(item => item.show).map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                    isActive 
                      ? 'bg-kindia-gold text-kindia-blue font-bold shadow-md' 
                      : 'text-slate-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-kindia-blue' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-kindia-blue' : 'text-slate-500'}`} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border border-red-500/30"
          >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
          </button>

          <div className="text-center text-[10px] text-slate-400">
            Université de Kindia • GED Mobile 2026
          </div>
        </div>
      </div>
    </div>
  );
}

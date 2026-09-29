import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePwa } from '../context/PwaContext';
import { api } from '../services/api';
import { Bell, User, LogOut, RefreshCw, Shield, CheckCircle, Menu, FileText, Download } from 'lucide-react';
import { formatFullName } from '../utils/userUtils';

export default function Header({ onOpenMobileDrawer, onRequestMission, onNavigate }) {
  const { user, login, logout, institution, getLogoUrl } = useAuth();
  const { isInstalled, promptInstall } = usePwa();
  const logoUrl = getLogoUrl();
  const showLogo = institution?.show_logo_header !== 0 && logoUrl;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  const [dynamicAccounts, setDynamicAccounts] = useState(null);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
    loadQuickAccounts();
  }, [user]);

  const loadQuickAccounts = async () => {
    try {
      const data = await api.getQuickAccounts();
      if (data && data.accounts) {
        setDynamicAccounts(data.accounts);
      }
    } catch (e) {}
  };

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const markAllRead = async () => {
    await api.markNotificationRead('all');
    setUnreadCount(0);
    loadNotifications();
  };

  const handleNotificationClick = async (n) => {
    try {
      if (!n.is_read) {
        await api.markNotificationRead(n.id);
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: 1 } : item));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setShowNotifs(false);
      if (n.appointment_id) {
        sessionStorage.setItem('selected_appointment_id', String(n.appointment_id));
        onNavigate('appointments');
      } else if (n.type === 'MISSION_REQUEST') {
        onNavigate('missions');
      } else if (n.document_id) {
        onNavigate('documents');
      }
    } catch (e) {
      console.error('Error handling notification click:', e);
    }
  };

  // Demo accounts switch helper
  const demoAccounts = [
    { label: dynamicAccounts?.sc?.name ? `1. Secrétariat Central (${dynamicAccounts.sc.name})` : '1. Secrétariat Central', email: dynamicAccounts?.sc?.email || 'sc@univ-kindia.edu.gn', pass: 'Agent123!' },
    { label: dynamicAccounts?.sg?.name ? `2. Secrétaire Général (${dynamicAccounts.sg.name})` : '2. Secrétaire Général', email: dynamicAccounts?.sg?.email || 'sg@univ-kindia.edu.gn', pass: 'Sg123!' },
    { label: dynamicAccounts?.recteur?.name ? `3. Recteur (${dynamicAccounts.recteur.name})` : '3. Recteur', email: dynamicAccounts?.recteur?.email || 'recteur@univ-kindia.edu.gn', pass: 'Recteur123!' },
    { label: '4. DAF', email: 'daf@univ-kindia.edu.gn', pass: 'Daf123!' },
    { label: '5. Contrôle Financier', email: 'cf@univ-kindia.edu.gn', pass: 'Cf123!' },
    { label: dynamicAccounts?.admin?.name ? `6. Administrateur (${dynamicAccounts.admin.name})` : '6. Administrateur', email: dynamicAccounts?.admin?.email || 'admin@univ-kindia.edu.gn', pass: 'Admin123!' }
  ];

  const switchAccount = async (acc) => {
    try {
      await login(acc.email, acc.pass);
      setShowPersonaMenu(false);
      window.location.reload();
    } catch (err) {
      alert('Erreur lors du changement de compte de test : ' + err.message);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 md:px-5 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs w-full max-w-full gap-2 md:gap-4">
      {/* Left Section: Logo & University Title */}
      <div className="flex items-center space-x-2 md:space-x-3 shrink-0 min-w-0">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          onClick={onOpenMobileDrawer}
          className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl md:hidden shrink-0"
          title="Ouvrir le menu principal"
        >
          <Menu className="w-5 h-5 text-kindia-blue" />
        </button>

        {showLogo && (
          <img 
            src={logoUrl} 
            alt={institution?.name || "Logo Officiel"} 
            className="h-8 md:h-9 w-auto max-w-[80px] md:max-w-[110px] object-contain rounded p-0.5 shrink-0" 
          />
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] md:text-xs font-black text-kindia-gold tracking-wider uppercase truncate">
            {institution?.name || 'Université de Kindia'}
          </span>
          <span className="text-xs md:text-sm font-extrabold text-kindia-blue leading-tight truncate">
            UK-GED
          </span>
        </div>
      </div>

      {/* Right Section: Actions, Persona Switcher, Notifications, User Badge & Logout */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-2.5 lg:space-x-3 shrink-0">
        {/* PWA Install Button — Discreet & Hidden when already installed */}
        {!isInstalled && (
          <button
            onClick={() => promptInstall()}
            className="px-2.5 sm:px-3 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs active:scale-95 border border-kindia-gold/40 shrink-0 cursor-pointer"
            title="Installer UK-GED sur votre appareil (Application)"
          >
            <Download className="w-3.5 h-3.5 text-kindia-gold shrink-0 animate-bounce" />
            <span className="hidden xl:inline whitespace-nowrap">Installer UK-GED</span>
            <span className="hidden sm:inline xl:hidden whitespace-nowrap">Installer</span>
            <span className="sm:hidden">App</span>
          </button>
        )}

        {/* Mission Request Button - Available everywhere EXCEPT Secrétariat Central */}
        {!(user?.service_code === 'SC' || user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL') && (
          <button
            onClick={onRequestMission}
            className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs active:scale-95 border border-emerald-500/30 shrink-0"
            title="Transmettre une demande d'ordre de mission au Secrétariat Central"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
            <span className="hidden xl:inline whitespace-nowrap">Demander un ordre de mission</span>
            <span className="hidden sm:inline xl:hidden whitespace-nowrap">Demande OM</span>
            <span className="sm:hidden">OM</span>
          </button>
        )}

        {/* Quick Persona Switcher for Testing Scenario */}
        <div className="relative shrink-0">
          <button 
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="flex items-center space-x-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 sm:px-3 py-1.5 rounded-xl transition shrink-0"
            title="Changer rapidement de compte de test"
          >
            <RefreshCw className="w-3.5 h-3.5 text-kindia-blue shrink-0" />
            <span className="hidden xl:inline whitespace-nowrap">Changer de rôle test</span>
            <span className="hidden md:inline xl:hidden whitespace-nowrap">Rôle test</span>
          </button>

          {showPersonaMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Comptes de Démo (Scénario)
              </div>
              {demoAccounts.map((acc, idx) => (
                <button
                  key={idx}
                  onClick={() => switchAccount(acc)}
                  className={`w-full text-left px-3.5 py-2 text-xs hover:bg-blue-50/80 flex items-center justify-between transition ${user?.email === acc.email ? 'bg-blue-50 font-bold text-kindia-blue' : 'text-slate-700'}`}
                >
                  <span>{acc.label}</span>
                  {user?.email === acc.email && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative shrink-0">
          <button 
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition flex items-center justify-center shrink-0"
            title="Notifications"
          >
            <Bell className="w-4 h-4 md:w-5 md:h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center px-1 animate-pulse shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800">Notifications ({unreadCount} non lue{unreadCount > 1 ? 's' : ''})</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[11px] text-kindia-blue font-bold hover:underline">
                    Tout marquer comme lu
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <p className="p-6 text-xs text-slate-400 text-center font-medium">Aucune notification.</p>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3.5 text-xs cursor-pointer hover:bg-slate-50 transition ${n.is_read ? 'bg-white' : 'bg-blue-50/60 border-l-3 border-kindia-blue'}`}
                    >
                      <div className="font-bold text-slate-800 flex items-center justify-between">
                        <span className="truncate pr-2">{n.title}</span>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-kindia-blue shrink-0"></span>}
                      </div>
                      <div className="text-slate-600 mt-0.5 whitespace-pre-line text-[11px] leading-relaxed">{n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1.5 font-medium">{new Date(n.created_at).toLocaleString('fr-FR')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Badge — Priority Visual with strictly Single-Line Name on available space */}
        <div className="flex items-center space-x-1.5 md:space-x-2 pl-2 sm:pl-3 border-l border-slate-200 shrink-0">
          <button
            onClick={() => onNavigate && onNavigate('account-settings')}
            className="flex items-center space-x-2 text-left hover:bg-slate-50 p-1 md:p-1.5 rounded-xl transition group max-w-[180px] sm:max-w-[240px] md:max-w-[320px] lg:max-w-[400px]"
            title={`${formatFullName(user)} — ${user?.service_name || 'Service'} (${user?.role_name || user?.role_code})`}
          >
            <div className="relative w-8 h-8 rounded-xl overflow-hidden shadow-xs shrink-0 group-hover:ring-2 group-hover:ring-kindia-gold transition flex items-center justify-center bg-kindia-blue text-white font-black text-xs">
              {user?.photo_path ? (
                <img
                  src={user.photo_path.split('?')[0]}
                  alt={formatFullName(user)}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : null}
              {(!user?.photo_path) && (
                <span>{user?.first_name ? user.first_name[0].toUpperCase() : 'U'}</span>
              )}
            </div>
            <div className="hidden sm:flex flex-col text-left min-w-0">
              <span className="text-xs font-black text-slate-900 group-hover:text-kindia-blue transition whitespace-nowrap leading-tight truncate">
                {formatFullName(user)}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 leading-tight truncate mt-0.5">
                {user?.service_name || 'Université de Kindia'} ({user?.role_name || user?.role_code})
              </span>
            </div>
          </button>

          {/* Logout Button */}
          <button 
            onClick={logout}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200/80 rounded-xl font-bold text-xs shadow-xs transition-all duration-150 shrink-0 cursor-pointer group"
            title="Se déconnecter de l'application et retourner à la page de connexion"
          >
            <LogOut className="w-4 h-4 text-rose-600 group-hover:text-white transition shrink-0" />
            <span className="hidden sm:inline font-bold">Se déconnecter</span>
          </button>
        </div>
      </div>
    </header>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Bell, User, LogOut, RefreshCw, Shield, CheckCircle, Menu, FileText } from 'lucide-react';

export default function Header({ onOpenMobileDrawer, onRequestMission }) {
  const { user, login, logout, institution, getLogoUrl } = useAuth();
  const logoUrl = getLogoUrl();
  const showLogo = institution?.show_logo_header !== 0 && logoUrl;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

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
    { label: 'Secrétariat Central', email: 'sc@univ-kindia.edu.gn', pass: 'Agent123!' },
    { label: 'Secrétaire Général', email: 'sg@univ-kindia.edu.gn', pass: 'Sg123!' },
    { label: 'Recteur', email: 'recteur@univ-kindia.edu.gn', pass: 'Recteur123!' },
    { label: 'DAF', email: 'daf@univ-kindia.edu.gn', pass: 'Daf123!' },
    { label: 'Contrôle Financier', email: 'cf@univ-kindia.edu.gn', pass: 'Cf123!' },
    { label: 'Administrateur', email: 'admin@univ-kindia.edu.gn', pass: 'Admin123!' }
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
    <header className="h-16 bg-white border-b border-slate-200 px-3 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm w-full max-w-full">
      <div className="flex items-center space-x-2 md:space-x-3 overflow-hidden">
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
            className="h-8 md:h-10 w-auto max-w-[90px] md:max-w-[120px] object-contain rounded p-0.5 shrink-0" 
          />
        )}
        <div className="flex flex-col overflow-hidden">
          <span className="text-[10px] md:text-xs font-bold text-kindia-gold tracking-wider uppercase truncate">
            {institution?.name || 'Université de Kindia'}
          </span>
          <span className="text-xs md:text-sm font-extrabold text-kindia-blue truncate">
            UK-GED
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Mission Request Button - Available everywhere EXCEPT Secrétariat Central */}
        {!(user?.service_code === 'SC' || user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL') && (
          <button
            onClick={onRequestMission}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-sm active:scale-95 border border-emerald-500/30"
            title="Transmettre une demande d'ordre de mission au Secrétariat Central"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
            <span className="hidden sm:inline">Demander un ordre de mission</span>
            <span className="sm:hidden">Mission</span>
          </button>
        )}

        {/* Quick Persona Switcher for Testing Scenario */}
        <div className="relative">
          <button 
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="flex items-center space-x-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition"
            title="Changer rapidement de compte de test"
          >
            <RefreshCw className="w-3.5 h-3.5 text-kindia-blue" />
            <span className="hidden md:inline">Changer de rôle test</span>
          </button>

          {showPersonaMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
              <div className="px-3 py-1.5 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                Comptes de Démo (Scénario)
              </div>
              {demoAccounts.map((acc, idx) => (
                <button
                  key={idx}
                  onClick={() => switchAccount(acc)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 flex items-center justify-between transition ${user?.email === acc.email ? 'bg-indigo-50/70 font-semibold text-kindia-blue' : 'text-slate-700'}`}
                >
                  <span>{acc.label}</span>
                  {user?.email === acc.email && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600 transition"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">Notifications ({unreadCount} non lues)</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[11px] text-kindia-blue font-semibold hover:underline">
                    Tout marquer comme lu
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <p className="p-4 text-xs text-slate-400 text-center">Aucune notification.</p>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 text-xs cursor-pointer hover:bg-slate-100 transition ${n.is_read ? 'bg-white' : 'bg-blue-50/70 border-l-2 border-kindia-blue'}`}
                    >
                      <div className="font-semibold text-slate-800 flex items-center justify-between">
                        <span>{n.title}</span>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-kindia-blue"></span>}
                      </div>
                      <div className="text-slate-600 mt-0.5 whitespace-pre-line">{n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString('fr-FR')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Badge */}
        <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-kindia-blue text-white font-bold text-xs flex items-center justify-center shadow">
            {user?.first_name ? user.first_name[0] : 'U'}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800">{user?.first_name} {user?.last_name}</span>
            <span className="text-[11px] font-medium text-kindia-gold">{user?.service_name} ({user?.role_name})</span>
          </div>

          <button 
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-red-600 transition"
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

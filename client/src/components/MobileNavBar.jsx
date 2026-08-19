import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Inbox, Award, FileCheck, UserCheck, Bell } from 'lucide-react';

export default function MobileNavBar({ currentPage, setCurrentPage, toSignCount = 0 }) {
  const { user } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { id: 'incoming', label: 'Courriers', icon: Inbox },
    { id: 'mobile-signatures', label: 'À Signer', icon: Award, badge: toSignCount },
    { id: 'missions', label: 'Missions', icon: FileCheck },
    { id: 'mobile-responsable', label: 'Mon Espace', icon: UserCheck }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl flex justify-around py-2 px-1 text-[10px] font-bold text-slate-600 md:hidden">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`flex flex-col items-center justify-center space-y-0.5 py-1 px-2.5 rounded-xl transition ${
              isActive
                ? 'text-kindia-blue bg-indigo-50 font-black scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'text-kindia-blue' : 'text-slate-400'}`} />
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-600 text-white rounded-full text-[9px] font-black w-4 h-4 flex items-center justify-center animate-bounce shadow">
                  {item.badge}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

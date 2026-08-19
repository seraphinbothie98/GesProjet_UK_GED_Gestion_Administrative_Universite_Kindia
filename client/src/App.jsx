import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import IncomingMail from './pages/IncomingMail';
import OutgoingMail from './pages/OutgoingMail';
import MissionOrders from './pages/MissionOrders';
import DocumentDetail from './pages/DocumentDetail';
import Archives from './pages/Archives';
import Search from './pages/Search';
import AuditLogs from './pages/AuditLogs';
import ServiceAdmin from './pages/ServiceAdmin';
import UserAdmin from './pages/UserAdmin';
import RoleAdmin from './pages/RoleAdmin';
import Appointments from './pages/Appointments';
import InstitutionAdmin from './pages/InstitutionAdmin';
import TemplateAdmin from './pages/TemplateAdmin';
import SignatureAdmin from './pages/SignatureAdmin';
import StaffManagement from './pages/StaffManagement';
import AdminMaintenance from './pages/AdminMaintenance';
import ExternalMissionaries from './pages/ExternalMissionaries';
import MissionRequests from './pages/MissionRequests';
import PublicMissionRequestModal from './components/PublicMissionRequestModal';
import { ShieldAlert } from 'lucide-react';

import DocumentTracking from './pages/DocumentTracking';
import Dispatching from './pages/Dispatching';
import PublicVerification from './pages/PublicVerification';
import PublicAppointmentModal from './components/PublicAppointmentModal';
import MobileNavBar from './components/MobileNavBar';
import MobileDrawer from './components/MobileDrawer';
import MobileResponsableSpace from './pages/MobileResponsableSpace';
import { api } from './services/api';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [showPublicTracking, setShowPublicTracking] = useState(window.location.pathname === '/suivi-document');
  const [showPublicAppointment, setShowPublicAppointment] = useState(false);
  const [showPublicMissionModal, setShowPublicMissionModal] = useState(false);
  const [showConnectedMissionModal, setShowConnectedMissionModal] = useState(false);
  const [toSignCount, setToSignCount] = useState(0);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  React.useEffect(() => {
    if (user) {
      api.getDocumentsToSign()
        .then(list => setToSignCount(Array.isArray(list) ? list.length : 0))
        .catch(() => setToSignCount(0));
    }
  }, [user, currentPage, selectedDocumentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-kindia-gold border-t-transparent rounded-full mx-auto mb-3"></div>
          <span className="font-heading font-bold text-sm text-kindia-gold">UK-GED • Université de Kindia</span>
        </div>
      </div>
    );
  }

  if (window.location.pathname.startsWith('/verify/')) {
    return <PublicVerification onBack={user ? () => window.location.href = '/' : null} />;
  }

  if (showPublicTracking) {
    return <DocumentTracking onBackToLogin={user ? () => setShowPublicTracking(false) : null} />;
  }

  if (!user) {
    return (
      <div className="relative">
        <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50 flex flex-wrap items-center justify-end gap-2 max-w-[95vw]">
          <button
            onClick={() => setShowPublicMissionModal(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xl transition flex items-center space-x-1.5 border border-emerald-400/30 animate-pulse hover:animate-none"
            title="Déposer une demande d'ordre de mission au Secrétariat Central"
          >
            <span>📝 DEMANDER UN ORDRE DE MISSION</span>
          </button>

          <button
            onClick={() => setShowPublicAppointment(true)}
            className="px-3 py-2 bg-kindia-blue text-white text-xs font-bold rounded-xl shadow-lg hover:bg-kindia-lightBlue transition border border-kindia-gold/40 hidden sm:flex items-center space-x-1"
          >
            <span>📅 Rendez-vous</span>
          </button>

          <button
            onClick={() => setShowPublicTracking(true)}
            className="px-3 py-2 bg-kindia-gold text-kindia-blue text-xs font-bold rounded-xl shadow-lg hover:bg-yellow-400 transition flex items-center space-x-1"
          >
            <span>🔎 Suivi de document</span>
          </button>
        </div>

        <Login onOpenMissionModal={() => setShowPublicMissionModal(true)} />

        {showPublicAppointment && (
          <PublicAppointmentModal onClose={() => setShowPublicAppointment(false)} />
        )}

        {showPublicMissionModal && (
          <PublicMissionRequestModal 
            isOpen={showPublicMissionModal} 
            onClose={() => setShowPublicMissionModal(false)} 
          />
        )}
      </div>
    );
  }

  const handleSelectDocument = (docId) => {
    setSelectedDocumentId(docId);
  };

  const handleBack = () => {
    setSelectedDocumentId(null);
  };

  const isCentralAdminOrSC = user?.role_code === 'ADMINISTRATEUR' 
    || user?.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' 
    || user?.service_code === 'SC';

  const canAccessMissions = isCentralAdminOrSC 
    || user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' 
    || user?.role_code === 'RECTEUR' 
    || user?.role_code === 'CHEF_SERVICE'
    || user?.personnel_category === 'ENSEIGNANT_CHERCHEUR'
    || true; // All authenticated staff can access their mission workspace

  const canAccessExternalMissionaries = isCentralAdminOrSC 
    || user?.role_code === 'SECRÉTAIRE_GÉNÉRAL' 
    || user?.role_code === 'RECTEUR';

  const renderContent = () => {
    if (selectedDocumentId) {
      return <DocumentDetail documentId={selectedDocumentId} onBack={handleBack} />;
    }

    const strictlySCPages = ['incoming', 'outgoing', 'archives'];

    if (strictlySCPages.includes(currentPage) && !isCentralAdminOrSC) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-red-200 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-heading font-extrabold text-slate-800">Accès non autorisé</h2>
            <p className="text-xs text-slate-600">
              Vous ne disposez pas des permissions nécessaires pour accéder à ce module central. L'accès aux registres administratifs et aux archives est réservé au Secrétariat Central et à l'Administrateur Système.
            </p>
            <button
              onClick={() => setCurrentPage('dashboard')}
              className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow transition"
            >
              Retour au tableau de bord
            </button>
          </div>
        </div>
      );
    }

    if (currentPage === 'external-missionaries' && !canAccessExternalMissionaries) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-red-200 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-heading font-extrabold text-slate-800">Accès non autorisé</h2>
            <p className="text-xs text-slate-600">
              L'accès au module des missionnaires externes est réservé au Secrétariat Central et au Secrétaire Général.
            </p>
            <button
              onClick={() => setCurrentPage('dashboard')}
              className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow transition"
            >
              Retour au tableau de bord
            </button>
          </div>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onSelectDocument={handleSelectDocument} onNavigate={(p) => setCurrentPage(p)} />;
      case 'dispatching':
        return <Dispatching onSelectDocument={handleSelectDocument} />;
      case 'appointments':
        return <Appointments />;
      case 'tracking':
        return <DocumentTracking />;
      case 'incoming':
        return <IncomingMail onSelectDocument={handleSelectDocument} />;
      case 'outgoing':
        return <OutgoingMail onSelectDocument={handleSelectDocument} />;
      case 'missions':
      case 'mission-requests':
        return <MissionOrders onSelectDocument={handleSelectDocument} />;
      case 'external-missionaries':
        return <ExternalMissionaries />;
      case 'archives':
        return <Archives onSelectDocument={handleSelectDocument} />;
      case 'search':
        return <Search onSelectDocument={handleSelectDocument} />;
      case 'audit':
        return <AuditLogs />;
      case 'services':
        return <ServiceAdmin />;
      case 'users':
        return <UserAdmin />;
      case 'roles':
        return <RoleAdmin />;
      case 'institution':
        return <InstitutionAdmin />;
      case 'templates':
        return <TemplateAdmin />;
      case 'signatures':
        return <SignatureAdmin />;
      case 'staff':
        return <StaffManagement />;
      case 'maintenance':
        return <AdminMaintenance onSelectDocument={handleSelectDocument} />;
      case 'mobile-signatures':
      case 'mobile-responsable':
        return <MobileResponsableSpace onSelectDocument={handleSelectDocument} onNavigate={(p) => setCurrentPage(p)} />;
      default:
        return <Dashboard onSelectDocument={handleSelectDocument} onNavigate={(p) => setCurrentPage(p)} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 relative pb-20 md:pb-0 overflow-x-hidden w-full">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={(p) => {
          setSelectedDocumentId(null);
          setCurrentPage(p);
        }} 
      />

      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        <Header 
          onOpenMobileDrawer={() => setMobileDrawerOpen(true)} 
          onRequestMission={() => setShowConnectedMissionModal(true)}
        />
        <main className="p-3 md:p-6 flex-1 max-w-7xl w-full mx-auto overflow-x-hidden">
          {renderContent()}
        </main>
      </div>

      <PublicMissionRequestModal 
        isOpen={showConnectedMissionModal} 
        onClose={() => setShowConnectedMissionModal(false)}
        defaultUserData={user}
      />

      <MobileDrawer 
        isOpen={mobileDrawerOpen} 
        onClose={() => setMobileDrawerOpen(false)}
        currentPage={currentPage}
        setCurrentPage={(p) => {
          setSelectedDocumentId(null);
          setCurrentPage(p);
        }}
      />

      <MobileNavBar 
        currentPage={currentPage} 
        setCurrentPage={(p) => {
          setSelectedDocumentId(null);
          setCurrentPage(p);
        }} 
        toSignCount={toSignCount} 
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

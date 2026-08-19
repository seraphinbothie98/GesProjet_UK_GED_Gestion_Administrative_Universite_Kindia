import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge } from '../components/Badge';
import AppointmentFormModal from '../components/AppointmentFormModal';
import AppointmentDetailModal from '../components/AppointmentDetailModal';
import { QRCheckInModal } from '../components/AppointmentActionModals';
import { 
  Calendar as CalendarIcon, Clock, Filter, Plus, Search, 
  QrCode, UserCheck, CheckCircle, AlertCircle, RefreshCw, 
  Building, User, Settings, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';

export default function Appointments() {
  const { user, hasPermission } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState('my_requests'); // 'my_requests', 'received', 'calendar', 'reception', 'settings'

  // Data State
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);

  // Calendar View State
  const [calendarViewMode, setCalendarViewMode] = useState('MONTH'); // 'DAY', 'WEEK', 'MONTH', 'LIST'
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({ appointments: [], blocks: [] });

  // Settings state (Admin)
  const [responsiblesList, setResponsiblesList] = useState([]);

  const isResponsibleUser = user && (user.can_receive_appointments || ['RECTEUR', 'SECRÉTAIRE_GÉNÉRAL', 'CHEF_SERVICE', 'RESPONSABLE_ADMINISTRATIF'].includes(user.role_code));
  const canCheckIn = user && (hasPermission('appointments.check_in') || user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL');
  const isAdmin = user && user.role_code === 'ADMINISTRATEUR';

  useEffect(() => {
    // Set default tab based on user role
    if (isResponsibleUser && !isAdmin) {
      setActiveTab('received');
    }
  }, [user]);

  useEffect(() => {
    const storedApptId = sessionStorage.getItem('selected_appointment_id');
    if (storedApptId) {
      setSelectedAppointmentId(parseInt(storedApptId, 10));
      sessionStorage.removeItem('selected_appointment_id');
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Determine fetch mode query
      let fetchMode = 'all';
      if (activeTab === 'received') fetchMode = 'received';
      if (activeTab === 'my_requests') fetchMode = 'my_requests';

      const data = await api.getAppointments({
        mode: fetchMode,
        status: statusFilter,
        date: dateFilter
      });
      setAppointments(data);

      const statsData = await api.getAppointmentStats();
      setStats(statsData);

      if (activeTab === 'settings' && isAdmin) {
        const respData = await api.getUsers();
        setResponsiblesList(respData);
      }

      if (activeTab === 'calendar') {
        const cal = await api.getAppointmentCalendar();
        setCalendarData(cal);
      }
    } catch (err) {
      console.error('Error loading appointments:', err);
      setError(err.message || 'Erreur lors du chargement des rendez-vous.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, statusFilter, dateFilter]);

  const handleToggleReceive = async (userId, currentVal) => {
    try {
      await api.toggleUserReceiveAppointments(userId, !currentVal);
      loadData();
    } catch (err) {
      alert(err.message || 'Erreur lors de la mise à jour.');
    }
  };

  // Filtered Appointments list by search query
  const filteredAppointments = appointments.filter(a => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (a.reference && a.reference.toLowerCase().includes(query)) ||
      (a.subject && a.subject.toLowerCase().includes(query)) ||
      (a.requester_first_name && a.requester_first_name.toLowerCase().includes(query)) ||
      (a.requester_last_name && a.requester_last_name.toLowerCase().includes(query)) ||
      (a.resp_first_name && a.resp_first_name.toLowerCase().includes(query)) ||
      (a.resp_last_name && a.resp_last_name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-kindia-blue via-kindia-lightBlue to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-kindia-gold/20 border border-kindia-gold flex items-center justify-center text-kindia-gold font-bold text-xl">
              📅
            </div>
            <h1 className="font-heading font-extrabold text-2xl tracking-wide">Rendez-vous & Agenda</h1>
          </div>
          <p className="text-xs text-kindia-gold font-medium ml-13">
            Gestion institutionnelle des audiences, créneaux et accueils • Université de Kindia
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canCheckIn && (
            <button
              onClick={() => setShowQRModal(true)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-lg backdrop-blur-sm"
            >
              <QrCode className="w-4 h-4 text-kindia-gold" />
              <span>Accueil & Scan QR</span>
            </button>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-kindia-gold text-kindia-blue hover:bg-yellow-400 font-extrabold text-xs rounded-xl shadow-lg transition flex items-center space-x-2 transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>PRENDRE UN RENDEZ-VOUS</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm">
              📊
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total</span>
              <span className="text-lg font-extrabold text-slate-800">{stats.total}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm">
              ⏳
            </div>
            <div>
              <span className="text-[10px] text-amber-700 font-bold uppercase block">En attente</span>
              <span className="text-lg font-extrabold text-amber-900">{stats.pending}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm">
              ✅
            </div>
            <div>
              <span className="text-[10px] text-teal-700 font-bold uppercase block">Confirmés</span>
              <span className="text-lg font-extrabold text-teal-900">{stats.confirmed}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-700 flex items-center justify-center font-bold text-sm">
              ❌
            </div>
            <div>
              <span className="text-[10px] text-red-700 font-bold uppercase block">Refusés</span>
              <span className="text-lg font-extrabold text-red-900">{stats.refused}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
              🚫
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Annulés</span>
              <span className="text-lg font-extrabold text-slate-800">{stats.cancelled}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
              📅
            </div>
            <div>
              <span className="text-[10px] text-emerald-700 font-bold uppercase block">Aujourd'hui</span>
              <span className="text-lg font-extrabold text-emerald-900">{stats.today}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center space-x-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('my_requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'my_requests'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📅 Mes rendez-vous</span>
          </button>

          {isResponsibleUser && (
            <button
              onClick={() => setActiveTab('received')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeTab === 'received'
                  ? 'bg-kindia-blue text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📥 Demandes reçues</span>
              {stats && stats.pending > 0 && (
                <span className="w-5 h-5 rounded-full bg-kindia-gold text-kindia-blue font-bold text-[10px] flex items-center justify-center">
                  {stats.pending}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'calendar'
                ? 'bg-kindia-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📆 Agenda & Calendrier</span>
          </button>

          {canCheckIn && (
            <button
              onClick={() => setActiveTab('reception')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeTab === 'reception'
                  ? 'bg-kindia-blue text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📷 Secrétariat / Scan</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeTab === 'settings'
                  ? 'bg-kindia-blue text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>⚙️ Configuration & Habilitations</span>
            </button>
          )}
        </div>

        <button
          onClick={loadData}
          className="p-2 rounded-xl text-slate-500 hover:text-kindia-blue hover:bg-slate-100 transition"
          title="Rafraîchir"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Tab Content */}
      {(activeTab === 'my_requests' || activeTab === 'received') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par référence, nom, objet..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
              />
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue bg-white"
              >
                <option value="">Tous les statuts</option>
                <option value="EN_ATTENTE">🟠 En attente</option>
                <option value="ACCEPTE">🟢 Accepté</option>
                <option value="REFUSE">🔴 Refusé</option>
                <option value="REPROGRAMME">🔵 Reprogrammé</option>
                <option value="ANNULE">⚫ Annulé</option>
                <option value="TERMINE">🟣 Terminé</option>
                <option value="EN_COURS">👤 Demandeur Arrivé (En cours)</option>
              </select>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue bg-white"
              />

              {(statusFilter || dateFilter || searchQuery) && (
                <button
                  onClick={() => {
                    setStatusFilter('');
                    setDateFilter('');
                    setSearchQuery('');
                  }}
                  className="text-xs text-red-600 font-semibold hover:underline"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-2"></div>
              <span>Chargement des rendez-vous...</span>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3 border-2 border-dashed border-slate-100 rounded-2xl">
              <CalendarIcon className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-medium">Aucun rendez-vous trouvé.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Référence</th>
                    <th className="px-4 py-3">Demandeur</th>
                    <th className="px-4 py-3">Responsable Visé</th>
                    <th className="px-4 py-3">Date & Créneau</th>
                    <th className="px-4 py-3">Objet & Doc</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition group">
                      <td className="px-4 py-3 font-mono font-bold text-kindia-blue">
                        {a.reference}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block">{a.requester_first_name} {a.requester_last_name}</span>
                        <span className="text-[10px] text-slate-400 block">{a.requester_organization}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800 block">{a.resp_first_name} {a.resp_last_name}</span>
                        <span className="text-[10px] text-slate-500 block">{a.resp_function}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold block text-slate-800">📅 {a.requested_date}</span>
                        <span className="text-[11px] text-slate-500">🕐 {a.requested_start_time} ({a.duration}m)</span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="font-medium text-slate-800 line-clamp-1">{a.subject}</span>
                        {a.document_reference_input && (
                          <span className="inline-flex items-center text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 mt-0.5">
                            📄 {a.document_reference_input}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedAppointmentId(a.id)}
                          className="px-3 py-1.5 rounded-lg bg-kindia-blue/10 text-kindia-blue font-bold text-xs hover:bg-kindia-blue hover:text-white transition"
                        >
                          Détails / Traiter
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Calendar View Tab */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900">Agenda Visuel des Responsables</h3>
              <p className="text-xs text-slate-500">Vue globale des créneaux programmés et périodes bloquées</p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setCalendarViewMode('MONTH')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    calendarViewMode === 'MONTH' ? 'bg-white text-kindia-blue shadow' : 'text-slate-600'
                  }`}
                >
                  Mois
                </button>
                <button
                  onClick={() => setCalendarViewMode('WEEK')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    calendarViewMode === 'WEEK' ? 'bg-white text-kindia-blue shadow' : 'text-slate-600'
                  }`}
                >
                  Semaine
                </button>
                <button
                  onClick={() => setCalendarViewMode('DAY')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    calendarViewMode === 'DAY' ? 'bg-white text-kindia-blue shadow' : 'text-slate-600'
                  }`}
                >
                  Jour
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Display Grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
              <div key={day} className="text-center py-2 font-bold text-xs bg-slate-50 text-slate-600 rounded-lg">
                {day}
              </div>
            ))}

            {/* Mock Month grid representing current month days */}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
              const dateStr = `2026-08-${String(dayNum).padStart(2, '0')}`;
              const dayAppts = calendarData.appointments.filter(a => a.requested_date === dateStr);
              return (
                <div
                  key={dayNum}
                  className="min-h-[90px] p-2 bg-slate-50/50 rounded-xl border border-slate-200/60 hover:border-kindia-blue transition"
                >
                  <span className="text-xs font-bold text-slate-700 block mb-1">{dayNum}</span>
                  <div className="space-y-1">
                    {dayAppts.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAppointmentId(a.id)}
                        className="w-full text-left p-1 text-[10px] bg-kindia-blue text-white rounded font-medium truncate block hover:bg-kindia-lightBlue"
                      >
                        🕐 {a.requested_start_time} - {a.requester_last_name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reception / Scan Tab */}
      {activeTab === 'reception' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <div className="max-w-md mx-auto space-y-3">
            <QrCode className="w-16 h-16 text-kindia-gold mx-auto" />
            <h3 className="font-heading font-extrabold text-lg text-kindia-blue">Poste d'Accueil & Check-in</h3>
            <p className="text-xs text-slate-500">
              Scannez le QR Code présent sur la confirmation du demandeur ou recherchez par référence pour marquer son arrivée.
            </p>
            <button
              onClick={() => setShowQRModal(true)}
              className="px-6 py-3 bg-kindia-blue text-white font-bold text-xs rounded-xl shadow-lg hover:bg-kindia-lightBlue transition"
            >
              📷 OUVRIR LE SCANNER DE QR CODE
            </button>
          </div>
        </div>
      )}

      {/* Settings & Admin Tab */}
      {activeTab === 'settings' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-heading font-bold text-base text-slate-900">Gestion des Habilitations de Réception de Rendez-vous</h3>
            <p className="text-xs text-slate-500">L'administrateur peut autoriser ou révoquer la possibilité de recevoir des rendez-vous par utilisateur (Permission `appointments.receive` / Drapeaux de réception)</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Fonction</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3 text-center">Réception Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {responsiblesList.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-bold text-slate-900">{u.first_name} {u.last_name}</td>
                    <td className="px-4 py-3">{u.function_title}</td>
                    <td className="px-4 py-3 font-bold text-kindia-blue">{u.service_name}</td>
                    <td className="px-4 py-3">{u.role_name}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!u.can_receive_appointments}
                        onChange={() => handleToggleReceive(u.id, u.can_receive_appointments)}
                        className="w-4 h-4 text-kindia-blue rounded border-slate-300 focus:ring-kindia-blue cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <AppointmentFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        initialUser={user}
        onSuccess={loadData}
      />

      <QRCheckInModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        onSuccess={loadData}
      />

      <AppointmentDetailModal
        isOpen={!!selectedAppointmentId}
        onClose={() => setSelectedAppointmentId(null)}
        appointmentId={selectedAppointmentId}
        currentUser={user}
        onRefresh={loadData}
      />

    </div>
  );
}

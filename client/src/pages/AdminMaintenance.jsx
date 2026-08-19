import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Trash2, RefreshCw, AlertTriangle, ShieldAlert, Download, CheckCircle, 
  X, Database, FileText, Lock, ShieldCheck, CheckSquare, Square
} from 'lucide-react';

export default function AdminMaintenance({ onSelectDocument }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('TRASH'); // 'TRASH' or 'MAINTENANCE'
  
  // Trash state
  const [trashDocs, setTrashDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Permanent Delete Modal State
  const [selectedDocForPermanentDelete, setSelectedDocForPermanentDelete] = useState(null);
  const [permanentDeleteReason, setPermanentDeleteReason] = useState('');
  const [permanentDeleteConfirmInput, setPermanentDeleteConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Maintenance state
  const [statusInfo, setStatusInfo] = useState(null);
  const [cleanupSelections, setCleanupSelections] = useState({
    clean_incoming_test: false,
    clean_outgoing_test: false,
    clean_missions_test: false,
    clean_archived_test: false,
    clean_trashed_test: false,
    clean_attachments_test: false,
    clean_notifications_test: false,
    clean_history_test: false,
    clean_appointments_test: false
  });

  // Cleanup Modal state
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupReason, setCleanupReason] = useState('');
  const [cleanupConfirmInput, setCleanupConfirmInput] = useState('');
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    if (user?.role_code === 'ADMINISTRATEUR') {
      loadTrashData();
      loadMaintenanceStatus();
    }
  }, [user]);

  const loadTrashData = async () => {
    try {
      const docs = await api.getTrashDocuments();
      setTrashDocs(docs);
    } catch (err) {
      console.error('Failed to load trash documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMaintenanceStatus = async () => {
    try {
      const info = await api.getMaintenanceStatus();
      setStatusInfo(info);
    } catch (err) {
      console.error('Failed to load maintenance status:', err);
    }
  };

  const handleRestore = async (id, ref) => {
    if (!window.confirm(`Voulez-vous restaurer le document ${ref} ?`)) return;
    setError('');
    setMessage('');
    try {
      await api.restoreFromTrash(id);
      setMessage(`Document ${ref} restauré avec succès.`);
      loadTrashData();
      loadMaintenanceStatus();
    } catch (err) {
      setError(err.message || 'Erreur lors de la restauration.');
    }
  };

  const handlePermanentDeleteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDocForPermanentDelete) return;
    if (permanentDeleteConfirmInput !== 'SUPPRIMER') {
      setError('Veuillez saisir exactement "SUPPRIMER" pour confirmer.');
      return;
    }
    if (!permanentDeleteReason.trim()) {
      setError('Le motif de suppression est obligatoire.');
      return;
    }

    setDeleting(true);
    setError('');
    setMessage('');
    try {
      const res = await api.permanentDeleteDocument(
        selectedDocForPermanentDelete.id,
        permanentDeleteReason,
        permanentDeleteConfirmInput
      );
      setMessage(res.message);
      setSelectedDocForPermanentDelete(null);
      setPermanentDeleteReason('');
      setPermanentDeleteConfirmInput('');
      loadTrashData();
      loadMaintenanceStatus();
    } catch (err) {
      setError(err.message || 'Erreur lors de la suppression définitive.');
    } finally {
      setDeleting(false);
    }
  };

  const handleBackupDownload = async () => {
    try {
      await api.downloadDatabaseBackup();
      setMessage('Sauvegarde complète de la base de données téléchargée avec succès.');
    } catch (err) {
      setError(err.message || 'Erreur lors du téléchargement de la sauvegarde.');
    }
  };

  const handleCleanupSubmit = async (e) => {
    e.preventDefault();
    if (cleanupConfirmInput !== 'NETTOYER') {
      setError('Veuillez saisir exactement "NETTOYER" pour confirmer le nettoyage.');
      return;
    }
    if (!cleanupReason.trim()) {
      setError('Le motif du nettoyage est obligatoire pour le journal d’audit.');
      return;
    }

    setCleaning(true);
    setError('');
    setMessage('');
    try {
      const res = await api.cleanupTestData({
        ...cleanupSelections,
        reason: cleanupReason,
        confirmText: cleanupConfirmInput
      });
      setMessage(res.message);
      setShowCleanupModal(false);
      setCleanupReason('');
      setCleanupConfirmInput('');
      loadTrashData();
      loadMaintenanceStatus();
    } catch (err) {
      setError(err.message || 'Erreur lors du nettoyage.');
    } finally {
      setCleaning(false);
    }
  };

  if (user?.role_code !== 'ADMINISTRATEUR') {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 shadow-sm space-y-3">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
        <h3 className="font-heading font-bold text-base text-rose-800">Accès Réseau Restreint</h3>
        <p className="text-xs text-slate-600">Cette section de maintenance avancée et corbeille est réservée exclusivement à l'Administrateur Système.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow">
            <Database className="w-5 h-5 text-kindia-gold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-kindia-gold uppercase tracking-wider block">ADMINISTRATION AVANCÉE • SYSTEM</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                statusInfo?.is_production ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-900'
              }`}>
                {statusInfo?.is_production ? 'ENVIRONNEMENT PRODUCTION' : 'ENVIRONNEMENT TEST / DEV'}
              </span>
            </div>
            <h2 className="font-heading font-bold text-lg text-white">Corbeille & Maintenance de la Base de Données</h2>
          </div>
        </div>

        <button
          onClick={handleBackupDownload}
          className="mt-3 sm:mt-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
        >
          <Download className="w-4 h-4 text-white" />
          <span>💾 CRÉER UNE SAUVEGARDE DB</span>
        </button>
      </div>

      {/* Message / Error Notification */}
      {message && <div className="p-4 bg-emerald-50 text-emerald-800 text-xs rounded-xl font-bold border border-emerald-300 flex items-center space-x-2"><CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /><span>{message}</span></div>}
      {error && <div className="p-4 bg-rose-50 text-rose-800 text-xs rounded-xl font-bold border border-rose-300 flex items-center space-x-2"><AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" /><span>{error}</span></div>}

      {/* Tabs Filter Bar */}
      <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm text-xs font-bold">
        <button
          onClick={() => setActiveTab('TRASH')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center space-x-2 ${
            activeTab === 'TRASH' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Trash2 className="w-4 h-4 text-kindia-gold" />
          <span>Corbeille Administrateur ({trashDocs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MAINTENANCE')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center space-x-2 ${
            activeTab === 'MAINTENANCE' ? 'bg-kindia-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4 text-kindia-gold" />
          <span>Maintenance & Nettoyage Base</span>
        </button>
      </div>

      {/* TAB 1: CORBEILLE ADMINISTRATEUR */}
      {activeTab === 'TRASH' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="font-heading font-bold text-xs text-slate-800 uppercase">Documents en Corbeille (Suppression Logique)</h3>
              <p className="text-[11px] text-slate-500">Documents supprimés temporairement. Seul l'Administrateur peut les restaurer ou les détruire définitivement.</p>
            </div>
            <button onClick={loadTrashData} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition flex items-center space-x-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Référence</th>
                  <th className="p-3.5">Titre du Document</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Supprimé Par</th>
                  <th className="p-3.5">Date & Motif</th>
                  <th className="p-3.5 text-right">Actions Restreintes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">Chargement de la corbeille...</td></tr>
                ) : trashDocs.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">La corbeille est vide. Aucun document supprimé.</td></tr>
                ) : (
                  trashDocs.map(d => (
                    <tr key={d.id} className="hover:bg-rose-50/40 transition">
                      <td className="p-3.5 font-mono font-bold text-slate-800">{d.reference}</td>
                      <td className="p-3.5 text-slate-800 font-semibold">{d.title}</td>
                      <td className="p-3.5 text-slate-600 font-medium">{d.document_type}</td>
                      <td className="p-3.5 text-slate-700">{d.deleter_first ? `${d.deleter_first} ${d.deleter_last}` : 'Administrateur'}</td>
                      <td className="p-3.5 text-slate-600">
                        <div className="text-[10px] font-mono">{d.deleted_at}</div>
                        <div className="text-[11px] text-rose-800 italic font-medium">Motif : {d.deletion_reason || 'Aucun motif'}</div>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleRestore(d.id, d.reference)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-xs shadow-sm inline-flex items-center space-x-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>RESTAURER</span>
                        </button>
                        <button
                          onClick={() => setSelectedDocForPermanentDelete(d)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition text-xs shadow-sm inline-flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>SUPPRIMER DÉFINITIVEMENT</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MAINTENANCE & NETTOYAGE BASE */}
      {activeTab === 'MAINTENANCE' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl space-y-2">
            <div className="flex items-center space-x-2 font-bold text-sm text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Zone d'Opérations Critiques & Nettoyage de la Base de Données</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Cette zone permet d'effectuer un nettoyage ciblé des données de test ou de réinitialiser des registres en environnement de développement.
              Toutes les données fondamentales (Utilisateurs, Services, Rôles, Signatures, Logos) sont protégées par défaut et conservées.
            </p>
          </div>

          {/* Counts Dashboard Grid */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-2xl font-extrabold text-kindia-blue block">{statusInfo?.counts?.incoming || 0}</span>
              <span className="text-xs text-slate-500 font-bold uppercase">Courriers Entrants</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-2xl font-extrabold text-kindia-blue block">{statusInfo?.counts?.outgoing || 0}</span>
              <span className="text-xs text-slate-500 font-bold uppercase">Courriers Sortants</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-2xl font-extrabold text-kindia-blue block">{statusInfo?.counts?.missions || 0}</span>
              <span className="text-xs text-slate-500 font-bold uppercase">Ordres de Mission</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-2xl font-extrabold text-emerald-600 block">{statusInfo?.counts?.archived || 0}</span>
              <span className="text-xs text-slate-500 font-bold uppercase">Documents Archivés</span>
            </div>
          </div>

          {/* Protected Core Data Notice (Section 10) */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3">
            <h4 className="font-heading font-bold text-xs text-kindia-gold uppercase tracking-wider flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-kindia-gold" />
              <span>DONNÉES CORE PROTÉGÉES (NE SERONT JAMAIS SUPPRIMÉES LORS DU NETTOYAGE)</span>
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-semibold">
              <div className="bg-white/10 p-2.5 rounded-xl flex justify-between"><span>⚠️ Utilisateurs</span><span className="text-kindia-gold">{statusInfo?.protected_counts?.users || 0}</span></div>
              <div className="bg-white/10 p-2.5 rounded-xl flex justify-between"><span>⚠️ Services</span><span className="text-kindia-gold">{statusInfo?.protected_counts?.services || 0}</span></div>
              <div className="bg-white/10 p-2.5 rounded-xl flex justify-between"><span>⚠️ Rôles</span><span className="text-kindia-gold">{statusInfo?.protected_counts?.roles || 0}</span></div>
              <div className="bg-white/10 p-2.5 rounded-xl flex justify-between"><span>⚠️ Permissions</span><span className="text-kindia-gold">{statusInfo?.protected_counts?.permissions || 0}</span></div>
              <div className="bg-white/10 p-2.5 rounded-xl flex justify-between"><span>⚠️ Signatures</span><span className="text-kindia-gold">{statusInfo?.protected_counts?.signatures || 0}</span></div>
              <div className="bg-white/10 p-2.5 rounded-xl flex justify-between"><span>⚠️ Configuration</span><span className="text-kindia-gold">Actif</span></div>
              <div className="bg-white/10 p-2.5 rounded-xl flex justify-between"><span>⚠️ Modèles</span><span className="text-kindia-gold">{statusInfo?.protected_counts?.templates || 0}</span></div>
              <div className="bg-white/10 p-2.5 rounded-xl flex justify-between"><span>⚠️ Identité & Logo</span><span className="text-kindia-gold">Actif</span></div>
            </div>
          </div>

          {/* Test Data Cleanup Form (Section 10) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h4 className="font-heading font-bold text-sm text-slate-800 uppercase flex items-center space-x-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Sélection des éléments de test à nettoyer</span>
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allTrue = {};
                    Object.keys(cleanupSelections).forEach(k => { allTrue[k] = true; });
                    setCleanupSelections(allTrue);
                  }}
                  className="text-xs text-kindia-blue font-bold hover:underline"
                >
                  Tout sélectionner
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    const allFalse = {};
                    Object.keys(cleanupSelections).forEach(k => { allFalse[k] = false; });
                    setCleanupSelections(allFalse);
                  }}
                  className="text-xs text-slate-500 font-bold hover:underline"
                >
                  Tout désélectionner
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3 text-xs">
              {[
                { key: 'clean_incoming_test', label: 'Courriers entrants de test' },
                { key: 'clean_outgoing_test', label: 'Courriers sortants de test' },
                { key: 'clean_missions_test', label: 'Ordres de mission de test' },
                { key: 'clean_archived_test', label: 'Documents archivés de test' },
                { key: 'clean_trashed_test', label: 'Corbeille & Documents mis au rebut' },
                { key: 'clean_attachments_test', label: 'Pièces jointes & Fichiers de test' },
                { key: 'clean_notifications_test', label: 'Notifications de test' },
                { key: 'clean_history_test', label: 'Historique de test' },
                { key: 'clean_appointments_test', label: 'Rendez-vous de test' }
              ].map(item => (
                <label key={item.key} className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={cleanupSelections[item.key]}
                    onChange={e => setCleanupSelections({ ...cleanupSelections, [item.key]: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  const hasSelection = Object.values(cleanupSelections).some(v => v);
                  if (!hasSelection) {
                    alert('Veuillez sélectionner au moins une catégorie de données à nettoyer.');
                    return;
                  }
                  setShowCleanupModal(true);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>NETTOYER LES DONNÉES SÉLECTIONNÉES</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE DOUBLE CONFIRMATION MODAL (Section 2, 3, 4) */}
      {selectedDocForPermanentDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-rose-300">
            <div className="flex justify-between items-center border-b border-rose-100 pb-2">
              <h3 className="font-heading font-extrabold text-sm text-rose-800 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>ATTENTION ! SUPPRESSION DÉFINITIVE</span>
              </h3>
              <button onClick={() => setSelectedDocForPermanentDelete(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3.5 rounded-xl text-xs space-y-2">
              <p className="font-bold">Vous êtes sur le point de supprimer définitivement le document :</p>
              <p className="font-mono text-xs font-extrabold">{selectedDocForPermanentDelete.reference} — {selectedDocForPermanentDelete.title}</p>
              <p className="text-[11px] leading-relaxed">
                Cette opération supprimera définitivement :
                <br />• Le courrier et ses métadonnées
                <br />• Ses fichiers joints physiques sur disque
                <br />• Ses versions et son historique associé
              </p>
              <p className="font-bold text-rose-800 uppercase">cette opération est irréversible.</p>
            </div>

            <form onSubmit={handlePermanentDeleteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-800 font-bold mb-1">Motif de la suppression définitive *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ex: Document de test créé par erreur"
                  value={permanentDeleteReason}
                  onChange={e => setPermanentDeleteReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 shadow-inner"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Pour confirmer la suppression définitive, saisissez SUPPRIMER *</label>
                <input 
                  type="text"
                  required
                  placeholder="Saisissez SUPPRIMER"
                  value={permanentDeleteConfirmInput}
                  onChange={e => setPermanentDeleteConfirmInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold tracking-wider"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedDocForPermanentDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  ANNULER
                </button>
                <button
                  type="submit"
                  disabled={deleting || permanentDeleteConfirmInput !== 'SUPPRIMER' || !permanentDeleteReason.trim()}
                  className={`px-5 py-2 text-white font-bold rounded-xl shadow transition ${
                    permanentDeleteConfirmInput === 'SUPPRIMER' && permanentDeleteReason.trim()
                      ? 'bg-rose-700 hover:bg-rose-800'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {deleting ? 'Suppression...' : 'SUPPRIMER DÉFINITIVEMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEST DATA CLEANUP DOUBLE CONFIRMATION MODAL (Section 8, 9, 10, 11) */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-rose-300">
            <div className="flex justify-between items-center border-b border-rose-100 pb-2">
              <h3 className="font-heading font-extrabold text-sm text-rose-800 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>ATTENTION — OPÉRATION CRITIQUE</span>
              </h3>
              <button onClick={() => setShowCleanupModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-xl text-xs space-y-2">
              <p className="font-bold uppercase tracking-wide">ATTENTION — OPÉRATION CRITIQUE</p>
              <p className="font-medium">Cette opération supprimera les données sélectionnées.</p>
              <p className="text-[11px] leading-relaxed">
                Elle est destinée principalement au nettoyage de l'environnement de TEST.
                <br />Cette opération peut être irréversible.
              </p>
              <p className="font-bold text-rose-800">Assurez-vous d'avoir effectué une sauvegarde avant de continuer.</p>
            </div>

            <form onSubmit={handleCleanupSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-800 font-bold mb-1">Motif de l'opération de nettoyage *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ex: Reinitialisation des données de test avant démonstration"
                  value={cleanupReason}
                  onChange={e => setCleanupReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 shadow-inner"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Pour confirmer le nettoyage des données, saisissez NETTOYER *</label>
                <input 
                  type="text"
                  required
                  placeholder="Saisissez NETTOYER"
                  value={cleanupConfirmInput}
                  onChange={e => setCleanupConfirmInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold tracking-wider"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCleanupModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  ANNULER
                </button>
                <button
                  type="submit"
                  disabled={cleaning || cleanupConfirmInput !== 'NETTOYER' || !cleanupReason.trim()}
                  className={`px-5 py-2 text-white font-bold rounded-xl shadow transition ${
                    cleanupConfirmInput === 'NETTOYER' && cleanupReason.trim()
                      ? 'bg-rose-700 hover:bg-rose-800'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {cleaning ? 'Nettoyage...' : 'EXÉCUTER LE NETTOYAGE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

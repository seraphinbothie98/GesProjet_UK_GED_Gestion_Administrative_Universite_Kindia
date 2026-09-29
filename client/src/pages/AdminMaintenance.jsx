import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Trash2, RefreshCw, AlertTriangle, ShieldAlert, Download, CheckCircle, 
  X, Database, FileText, Lock, ShieldCheck, CheckSquare, Square,
  Users, UserX, AlertOctagon, Key, CheckCircle2, ArrowRight, ArrowLeft,
  RotateCcw, FileCheck, Eye, EyeOff, Sparkles, Building2, Briefcase, Award,
  Shield, Layers, ChevronRight, HelpCircle
} from 'lucide-react';

export default function AdminMaintenance({ onSelectDocument }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('TRASH'); // 'TRASH', 'MAINTENANCE', 'USERS_CLEANUP'
  
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

  // -------------------------------------------------------------
  // USER CLEANUP WIZARD STATE (Section 1 à 25)
  // -------------------------------------------------------------
  const [wizardStep, setWizardStep] = useState(0); 
  // 0: Avertissement
  // 1: Choix du type de nettoyage
  // 2: Audit automatique & Analyse
  // 3: Aperçu avant exécution (À Conserver vs À Réinitialiser)
  // 4: Confirmation textuelle
  // 5: Authentification administrateur
  // 6: Sauvegarde & Dernière vérification
  // 7: Confirmation finale & Lancement
  // 8: Exécution en direct
  // 9: Rapport final & Intégrité

  const [cleanupOption, setCleanupOption] = useState(null); // 'A', 'B', 'C', 'D'
  const [customScope, setCustomScope] = useState({
    clean_users: false,
    clean_staff: false,
    clean_assignments: false
  });

  const [auditLoading, setAuditLoading] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [acknowledgeAmbiguity, setAcknowledgeAmbiguity] = useState(false);

  const [textConfirmationInput, setTextConfirmationInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [resetExecuting, setResetExecuting] = useState(false);
  const [resetProgressSteps, setResetProgressSteps] = useState([]);
  const [resetFinalReport, setResetFinalReport] = useState(null);
  const [operationId, setOperationId] = useState('');

  const REQUIRED_CONFIRMATION_TEXT = 'RÉINITIALISER LES UTILISATEURS';

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

  // -------------------------------------------------------------
  // USER CLEANUP WIZARD HANDLERS
  // -------------------------------------------------------------
  const runUserAudit = async (opt = cleanupOption, scope = customScope) => {
    setAuditLoading(true);
    setError('');
    try {
      const res = await api.auditUserCleanup({
        cleanup_option: opt,
        custom_scope: scope
      });
      setAuditData(res);
      setWizardStep(3); // Go to Preview
    } catch (err) {
      setError(err.message || "Erreur lors de l'analyse des dépendances.");
    } finally {
      setAuditLoading(false);
    }
  };

  const startUserCleanupExecution = async () => {
    if (!adminPasswordInput || !adminPasswordInput.trim()) {
      setError("Le mot de passe administrateur est requis. Veuillez le renseigner à l'étape 5.");
      setWizardStep(5);
      return;
    }

    setResetExecuting(true);
    setError('');
    setWizardStep(8); // Execution Progress Screen
    
    // Generate operation ID
    const opId = `RESET_USER_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    setOperationId(opId);

    try {
      const res = await api.executeUserCleanup({
        cleanup_option: cleanupOption,
        custom_scope: customScope,
        confirmText: textConfirmationInput,
        password: adminPasswordInput.trim(),
        operationId: opId,
        acknowledgeAmbiguity
      });

      setResetFinalReport(res);
      setResetProgressSteps(res.progress_steps || []);
      setWizardStep(9); // Final Report
      loadMaintenanceStatus();
    } catch (err) {
      const errMsg = err.message || "Échec lors de l'exécution de la réinitialisation.";
      setError(errMsg);
      // Rediriger vers l'étape mot de passe si l'erreur concerne l'authentification
      if (errMsg.toLowerCase().includes('mot de passe') || errMsg.toLowerCase().includes('authentification') || errMsg.toLowerCase().includes('401')) {
        setWizardStep(5);
      } else {
        setWizardStep(6); // Rester sur confirmation
      }
    } finally {
      setResetExecuting(false);
    }
  };

  const resetWizardState = () => {
    setWizardStep(0);
    setCleanupOption(null);
    setCustomScope({ clean_users: false, clean_staff: false, clean_assignments: false });
    setAuditData(null);
    setTextConfirmationInput('');
    setAdminPasswordInput('');
    setShowAdminPassword(false);
    setResetFinalReport(null);
    setAcknowledgeAmbiguity(false);
    setError('');
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
          <span>Maintenance & Documents de Test</span>
        </button>

        <button
          onClick={() => setActiveTab('USERS_CLEANUP')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center space-x-2 ${
            activeTab === 'USERS_CLEANUP' ? 'bg-rose-700 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-50 border border-rose-200'
          }`}
        >
          <UserX className="w-4 h-4 text-kindia-gold" />
          <span>👥 Nettoyage Sécurisé des Utilisateurs</span>
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
              <span>Zone d'Opérations Critiques & Nettoyage des Documents de Test</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Cette zone permet d'effectuer un nettoyage ciblé des courriers et documents de test.
              Toutes les données fondamentales (Utilisateurs, Services, Rôles, Signatures, Logos) sont protégées et conservées.
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

          {/* Test Data Cleanup Form */}
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

      {/* TAB 3: NETTOYAGE SÉCURISÉ DES UTILISATEURS (SECTION 1 À 25) */}
      {activeTab === 'USERS_CLEANUP' && (
        <div className="space-y-6">
          {/* Stepper Progress Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <div className="flex items-center justify-between min-w-[700px] text-xs">
              {[
                { step: 0, label: 'Avertissement' },
                { step: 1, label: 'Périmètre' },
                { step: 3, label: 'Audit & Aperçu' },
                { step: 4, label: 'Confirmation' },
                { step: 5, label: 'Mot de passe' },
                { step: 6, label: 'Sauvegarde' },
                { step: 8, label: 'Exécution' },
                { step: 9, label: 'Rapport' }
              ].map((s, idx) => (
                <React.Fragment key={s.step}>
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      wizardStep === s.step 
                        ? 'bg-rose-600 text-white ring-4 ring-rose-100' 
                        : wizardStep > s.step 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {wizardStep > s.step ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`mt-1 font-semibold text-[11px] ${
                      wizardStep === s.step ? 'text-rose-700 font-bold' : 'text-slate-500'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < 7 && (
                    <div className={`flex-1 h-1 mx-2 rounded ${
                      wizardStep > s.step ? 'bg-emerald-500' : 'bg-slate-200'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* STEP 0: ÉCRAN D'AVERTISSEMENT (Section 4) */}
          {wizardStep === 0 && (
            <div className="bg-white rounded-2xl border border-rose-300 p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex items-start space-x-4">
                <div className="p-3.5 bg-rose-100 text-rose-700 rounded-2xl shrink-0">
                  <AlertOctagon className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-extrabold rounded-full tracking-wider uppercase">
                    OPÉRATION CRITIQUE & HAUTEMENT SENSIBLE
                  </span>
                  <h3 className="font-heading font-extrabold text-xl text-slate-900">
                    Nettoyage & Réinitialisation Sécurisée des Données Utilisateurs
                  </h3>
                  <p className="text-slate-600 text-xs leading-relaxed max-w-3xl">
                    Cette fonctionnalité permet à l'Administrateur Système de purger les comptes utilisateurs, fiches de personnel
                    et affectations de démonstration pour préparer le système à la saisie des véritables personnels de l'Université de Kindia.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center space-x-1.5 text-emerald-700">
                    <ShieldCheck className="w-4 h-4" />
                    <span>CE QUI SERA STRICTEMENT PROTÉGÉ</span>
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>Votre compte Administrateur</strong> (aucune suppression ni modification)</li>
                    <li><strong>100% des Services</strong> et structures universitaires</li>
                    <li><strong>100% des Postes & Fonctions</strong> (rendus vacants pour réaffectation)</li>
                    <li><strong>Rôles, Permissions & Workflows</strong> configurés</li>
                    <li><strong>Modèles de documents & Ordres de Mission avec QR Code</strong></li>
                  </ul>
                </div>

                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-2">
                  <h4 className="font-bold text-rose-800 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>PROCESSUS EN 10 NIVEAUX DE SÉCURITÉ</span>
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-rose-900">
                    <li>Aucune action directe en un clic</li>
                    <li>Audit complet des dépendances relationnelles</li>
                    <li>Confirmation textuelle manuelle obligatoire</li>
                    <li>Ré-authentification par mot de passe administrateur</li>
                    <li>Sauvegarde préalable automatique horodatée obligatoire</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('TRASH')}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Annuler et quitter
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-6 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-2"
                >
                  <span>Continuer vers l'assistant sécurisé</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: CHOIX DU TYPE DE NETTOYAGE (Section 5) */}
          {wizardStep === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
              <div>
                <h3 className="font-heading font-extrabold text-base text-slate-900 flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-rose-600" />
                  <span>Étape 1 — Sélection explicite du périmètre de nettoyage</span>
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Veuillez choisir avec précision ce que vous souhaitez nettoyer. Aucune option destructive n'est présélectionnée par défaut.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                {/* Option A */}
                <div
                  onClick={() => setCleanupOption('A')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition space-y-2 ${
                    cleanupOption === 'A'
                      ? 'border-rose-600 bg-rose-50/50 shadow-sm ring-2 ring-rose-200'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900 uppercase">Option A</span>
                    <input type="radio" checked={cleanupOption === 'A'} onChange={() => setCleanupOption('A')} className="w-4 h-4 text-rose-600" />
                  </div>
                  <h4 className="font-extrabold text-slate-800">Comptes Utilisateurs Démo uniquement</h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Supprime les accès et comptes utilisateurs de démonstration. Conserve les fiches de personnel dans l'annuaire et leurs affectations.
                  </p>
                </div>

                {/* Option B */}
                <div
                  onClick={() => setCleanupOption('B')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition space-y-2 ${
                    cleanupOption === 'B'
                      ? 'border-rose-600 bg-rose-50/50 shadow-sm ring-2 ring-rose-200'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900 uppercase">Option B</span>
                    <input type="radio" checked={cleanupOption === 'B'} onChange={() => setCleanupOption('B')} className="w-4 h-4 text-rose-600" />
                  </div>
                  <h4 className="font-extrabold text-slate-800">Utilisateurs + Personnels de Démo</h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Supprime les comptes utilisateurs et les fiches du répertoire personnel de démonstration.
                  </p>
                </div>

                {/* Option C (Recommandée) */}
                <div
                  onClick={() => setCleanupOption('C')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition space-y-2 ${
                    cleanupOption === 'C'
                      ? 'border-rose-600 bg-rose-50/50 shadow-sm ring-2 ring-rose-200'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 uppercase">Option C</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">Recommandée</span>
                    </div>
                    <input type="radio" checked={cleanupOption === 'C'} onChange={() => setCleanupOption('C')} className="w-4 h-4 text-rose-600" />
                  </div>
                  <h4 className="font-extrabold text-slate-800">Utilisateurs + Personnels + Affectations Démo</h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Purgera entièrement les données de démonstration. Tous les postes (Recteur, SG, Doyens, Chefs de service)
                    redeviennent <strong>VACANTS & DISPONIBLES</strong> pour la saisie des vraies personnes.
                  </p>
                </div>

                {/* Option D */}
                <div
                  onClick={() => setCleanupOption('D')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition space-y-2 ${
                    cleanupOption === 'D'
                      ? 'border-rose-600 bg-rose-50/50 shadow-sm ring-2 ring-rose-200'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900 uppercase">Option D</span>
                    <input type="radio" checked={cleanupOption === 'D'} onChange={() => setCleanupOption('D')} className="w-4 h-4 text-rose-600" />
                  </div>
                  <h4 className="font-extrabold text-slate-800">Nettoyage Personnalisé</h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Définir manuellement la sélection précise des modules utilisateurs à réinitialiser.
                  </p>

                  {cleanupOption === 'D' && (
                    <div className="pt-2 border-t border-slate-200 space-y-1.5" onClick={e => e.stopPropagation()}>
                      <label className="flex items-center space-x-2 text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={customScope.clean_users}
                          onChange={e => setCustomScope({ ...customScope, clean_users: e.target.checked })}
                          className="rounded text-rose-600"
                        />
                        <span>Nettoyer les comptes utilisateurs</span>
                      </label>
                      <label className="flex items-center space-x-2 text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={customScope.clean_staff}
                          onChange={e => setCustomScope({ ...customScope, clean_staff: e.target.checked })}
                          className="rounded text-rose-600"
                        />
                        <span>Nettoyer les fiches du répertoire personnel</span>
                      </label>
                      <label className="flex items-center space-x-2 text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={customScope.clean_assignments}
                          onChange={e => setCustomScope({ ...customScope, clean_assignments: e.target.checked })}
                          className="rounded text-rose-600"
                        />
                        <span>Nettoyer les affectations et libérer les postes</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setWizardStep(0)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition flex items-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour</span>
                </button>
                <button
                  type="button"
                  disabled={!cleanupOption || (cleanupOption === 'D' && !Object.values(customScope).some(v => v))}
                  onClick={() => runUserAudit(cleanupOption, customScope)}
                  className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-2 ${
                    cleanupOption && (cleanupOption !== 'D' || Object.values(customScope).some(v => v))
                      ? 'bg-rose-700 hover:bg-rose-800 cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span>{auditLoading ? 'Audit en cours...' : "Lancer l'audit des dépendances"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: APERÇU DÉTAILLÉ AVANT EXÉCUTION (Section 6, 7, 8, 9, 10) */}
          {wizardStep === 3 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
              <div>
                <h3 className="font-heading font-extrabold text-base text-slate-900 flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-rose-600" />
                  <span>Étape 2 & 3 — Audit Relationnel & Aperçu Exhaustif</span>
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Vérifiez précisément les structures qui seront préservées et la liste exacte des utilisateurs qui seront réinitialisés.
                </p>
              </div>

              {/* Ambiguity Alert if real data detected (Section 10) */}
              {auditData?.ambiguity_detected && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-sm text-amber-800">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span>Données avec activité documentée importante détectées</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Certains comptes ciblés possèdent des documents officiels actifs ou des signatures enregistrées.
                    Veuillez examiner attentivement la liste ci-dessous avant de poursuivre.
                  </p>
                  <label className="flex items-center space-x-2 font-bold text-xs text-amber-950 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledgeAmbiguity}
                      onChange={e => setAcknowledgeAmbiguity(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600"
                    />
                    <span>J'ai vérifié et je confirme que ces comptes font partie de la démonstration à réinitialiser.</span>
                  </label>
                </div>
              )}

              {/* TWO PANELS: À CONSERVER vs À RÉINITIALISER */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* PANEL 1: À CONSERVER */}
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <h4 className="font-bold text-xs text-emerald-900 uppercase flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>À CONSERVER (100% INTÈGRE)</span>
                    </h4>
                    <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded">Protégé</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-sm space-y-1">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">Administrateur Connecté (Maître)</span>
                      <div className="font-bold text-slate-800">{auditData?.protected_admin?.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{auditData?.protected_admin?.email} • Matr: {auditData?.protected_admin?.matricule || 'ADMIN'}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex justify-between items-center">
                        <span className="text-slate-600 font-semibold">Services</span>
                        <span className="font-bold text-emerald-700">{auditData?.preserved_structures?.services_count}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex justify-between items-center">
                        <span className="text-slate-600 font-semibold">Postes (Total)</span>
                        <span className="font-bold text-emerald-700">{auditData?.preserved_structures?.positions_count}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex justify-between items-center">
                        <span className="text-slate-600 font-semibold">Rôles</span>
                        <span className="font-bold text-emerald-700">{auditData?.preserved_structures?.roles_count}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex justify-between items-center">
                        <span className="text-slate-600 font-semibold">Permissions</span>
                        <span className="font-bold text-emerald-700">{auditData?.preserved_structures?.permissions_count}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex justify-between items-center">
                        <span className="text-slate-600 font-semibold">Circuits/Workflows</span>
                        <span className="font-bold text-emerald-700">{auditData?.preserved_structures?.workflows_count}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex justify-between items-center">
                        <span className="text-slate-600 font-semibold">Modèles / OM</span>
                        <span className="font-bold text-emerald-700">{auditData?.preserved_structures?.templates_count}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-emerald-800 italic">
                      ✓ Les postes dont l'affectation démo est supprimée deviendront immédiatement <strong>VACANTS & DISPONIBLES</strong>.
                    </p>
                  </div>
                </div>

                {/* PANEL 2: À RÉINITIALISER */}
                <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                    <h4 className="font-bold text-xs text-rose-900 uppercase flex items-center space-x-2">
                      <UserX className="w-4 h-4 text-rose-700" />
                      <span>À RÉINITIALISER / SUPPRIMER</span>
                    </h4>
                    <span className="px-2 py-0.5 bg-rose-200 text-rose-900 text-[10px] font-bold rounded">
                      {auditData?.counts?.users_to_clean || 0} utilisateurs
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border border-rose-200 flex justify-between items-center">
                        <span className="text-slate-600 font-semibold">Comptes Utilisateurs</span>
                        <span className="font-bold text-rose-700">{auditData?.counts?.users_to_clean}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-rose-200 flex justify-between items-center">
                        <span className="text-slate-600 font-semibold">Fiches Personnel</span>
                        <span className="font-bold text-rose-700">{auditData?.counts?.staff_to_clean}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-rose-200 flex justify-between items-center col-span-2">
                        <span className="text-slate-600 font-semibold">Affectations libérées (Postes rendus vacants)</span>
                        <span className="font-bold text-rose-700">{auditData?.counts?.assignments_to_clean}</span>
                      </div>
                    </div>

                    {/* Detailed List of Target Users */}
                    <div className="bg-white rounded-xl border border-rose-200 overflow-hidden">
                      <div className="p-2 bg-rose-100/60 font-bold text-[10px] text-rose-900 uppercase">
                        Liste détaillée des utilisateurs concernés :
                      </div>
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                        {auditData?.targets?.users?.length === 0 ? (
                          <div className="p-3 text-slate-400 text-center">Aucun utilisateur ciblé.</div>
                        ) : (
                          auditData?.targets?.users?.map(u => (
                            <div key={u.id} className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                              <div>
                                <div className="font-bold text-slate-800">{u.first_name} {u.last_name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{u.email} • {u.role_name || u.role_code}</div>
                              </div>
                              {u.is_ambiguous && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                                  Actif ({u.docs_authored} docs)
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition flex items-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Modifier le périmètre</span>
                </button>
                <button
                  type="button"
                  disabled={auditData?.ambiguity_detected && !acknowledgeAmbiguity}
                  onClick={() => setWizardStep(4)}
                  className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-2 ${
                    !auditData?.ambiguity_detected || acknowledgeAmbiguity
                      ? 'bg-rose-700 hover:bg-rose-800 cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span>Passer aux confirmations de sécurité</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: CONFIRMATION TEXTUELLE (Section 11) */}
          {wizardStep === 4 && (
            <div className="bg-white rounded-2xl border border-rose-300 p-6 md:p-8 shadow-sm space-y-6 max-w-2xl mx-auto">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-2xl mx-auto flex items-center justify-center font-bold">
                  <FileCheck className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-slate-900">
                  Étape 4 — Saisie Manuelle de la Confirmation Textuelle
                </h3>
                <p className="text-slate-500 text-xs">
                  Pour vous prémunir contre toute validation accidentelle, veuillez taper manuellement la phrase exacte ci-dessous :
                </p>
              </div>

              <div className="p-4 bg-slate-900 text-kindia-gold rounded-xl font-mono text-center font-extrabold tracking-widest text-sm select-all">
                {REQUIRED_CONFIRMATION_TEXT}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Saisissez la phrase exacte (respecter les majuscules et les espaces) :
                </label>
                <input
                  type="text"
                  value={textConfirmationInput}
                  onChange={e => setTextConfirmationInput(e.target.value)}
                  placeholder="RÉINITIALISER LES UTILISATEURS"
                  className="w-full p-3 rounded-xl border-2 border-slate-300 font-mono font-bold text-sm focus:border-rose-600 focus:ring-rose-500"
                />
                {textConfirmationInput && textConfirmationInput !== REQUIRED_CONFIRMATION_TEXT && (
                  <p className="text-[11px] text-rose-600 font-semibold">
                    ⚠️ La phrase saisie ne correspond pas encore exactement au texte requis.
                  </p>
                )}
                {textConfirmationInput === REQUIRED_CONFIRMATION_TEXT && (
                  <p className="text-[11px] text-emerald-600 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Phrase validée avec succès.</span>
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition flex items-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour à l'aperçu</span>
                </button>
                <button
                  type="button"
                  disabled={textConfirmationInput !== REQUIRED_CONFIRMATION_TEXT}
                  onClick={() => setWizardStep(5)}
                  className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-2 ${
                    textConfirmationInput === REQUIRED_CONFIRMATION_TEXT
                      ? 'bg-rose-700 hover:bg-rose-800 cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span>Continuer vers l'authentification</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: AUTHENTIFICATION ADMINISTRATEUR (Section 12) */}
          {wizardStep === 5 && (
            <div className="bg-white rounded-2xl border border-rose-300 p-6 md:p-8 shadow-sm space-y-6 max-w-2xl mx-auto">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl mx-auto flex items-center justify-center font-bold">
                  <Key className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-slate-900">
                  Étape 5 — Ré-Authentification Administrateur Système
                </h3>
                <p className="text-slate-500 text-xs">
                  Veuillez saisir votre mot de passe administrateur pour autoriser cette opération hautement sensible.
                </p>
              </div>

              {error && (
                <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-600">
                <p>🔒 <strong>Sécurité renforcée :</strong></p>
                <p>• Votre mot de passe est vérifié directement via hachage sécurisé bcrypt.</p>
                <p>• Il ne sera <strong>jamais enregistré</strong>, ni affiché en clair, ni transcrit dans les journaux d'audit.</p>
                <p>• Mot de passe du compte <strong>{user?.email}</strong> (ex: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">Admin123!</code>).</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Mot de passe de session Administrateur * :
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    required
                    value={adminPasswordInput}
                    onChange={e => {
                      setAdminPasswordInput(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Saisissez votre mot de passe (ex: Admin123!)"
                    className="w-full p-3 pr-12 rounded-xl border-2 border-slate-300 font-mono text-sm focus:border-rose-600 focus:ring-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition flex items-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour</span>
                </button>
                <button
                  type="button"
                  disabled={!adminPasswordInput.trim()}
                  onClick={() => setWizardStep(6)}
                  className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-2 ${
                    adminPasswordInput.trim()
                      ? 'bg-rose-700 hover:bg-rose-800 cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span>Valider et passer à la sauvegarde</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6 & 7: SAUVEGARDE OBLIGATOIRE & DERNIÈRE CONFIRMATION (Section 13 & 14) */}
          {wizardStep === 6 && (
            <div className="bg-white rounded-2xl border border-rose-400 p-6 md:p-8 shadow-lg space-y-6 max-w-2xl mx-auto">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl mx-auto flex items-center justify-center font-bold shadow">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-extrabold text-lg text-rose-900">
                  Étape 6 & 7 — Sauvegarde Automatique & Dernière Confirmation
                </h3>
                <p className="text-slate-600 text-xs">
                  Toutes les conditions préalables ont été vérifiées avec succès.
                </p>
              </div>

              {error && (
                <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!adminPasswordInput.trim() && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center justify-between">
                  <span>⚠️ Mot de passe administrateur non renseigné.</span>
                  <button
                    type="button"
                    onClick={() => setWizardStep(5)}
                    className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition text-[11px]"
                  >
                    Saisir le mot de passe
                  </button>
                </div>
              )}

              <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 p-4 rounded-xl text-xs space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Protocole de sauvegarde automatique prêt</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Avant la moindre modification en base de données, le serveur créera automatiquement un snapshot physique horodaté 
                  dans le répertoire sécurisé des sauvegardes. En cas d'échec de la sauvegarde, l'opération sera annulée instantanément.
                </p>
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-xl text-xs space-y-2">
                <div className="font-bold text-kindia-gold uppercase tracking-wider text-[11px]">
                  Bilan final du périmètre d'exécution :
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>• Administrateur connecté : <span className="text-emerald-400 font-bold">CONSERVÉ</span></div>
                  <div>• Services institutionnels : <span className="text-emerald-400 font-bold">CONSERVÉS</span></div>
                  <div>• Postes & Fonctions : <span className="text-emerald-400 font-bold">RENDUS VACANTS</span></div>
                  <div>• Ordres de Mission & QR : <span className="text-emerald-400 font-bold">INTACTS</span></div>
                  <div>• Utilisateurs à nettoyer : <span className="text-rose-400 font-bold">{auditData?.counts?.users_to_clean}</span></div>
                  <div>• Personnels à nettoyer : <span className="text-rose-400 font-bold">{auditData?.counts?.staff_to_clean}</span></div>
                </div>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-bold text-center">
                ⚠️ ÊTES-VOUS ABSOLUMENT CERTAIN DE VOULOIR EXÉCUTER CETTE RÉINITIALISATION MAINTENANT ?
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={resetWizardState}
                  disabled={resetExecuting}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition disabled:opacity-50"
                >
                  ANNULER L'OPÉRATION
                </button>
                <button
                  type="button"
                  disabled={resetExecuting || !adminPasswordInput.trim()}
                  onClick={startUserCleanupExecution}
                  className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center space-x-2 ${
                    resetExecuting || !adminPasswordInput.trim()
                      ? 'bg-rose-400 cursor-not-allowed'
                      : 'bg-rose-700 hover:bg-rose-800 cursor-pointer animate-pulse'
                  }`}
                >
                  {resetExecuting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>EXÉCUTION EN COURS...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>LANCER LA RÉINITIALISATION SÉCURISÉE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 8: PROGRESSION DE L'EXÉCUTION EN DIRECT (Section 15, 16, 18) */}
          {wizardStep === 8 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-lg space-y-6 max-w-2xl mx-auto text-center">
              <div className="w-14 h-14 bg-rose-100 text-rose-700 rounded-full mx-auto flex items-center justify-center animate-spin">
                <RefreshCw className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h3 className="font-heading font-extrabold text-lg text-slate-900">
                  Réinitialisation Sécurisée en Cours...
                </h3>
                <p className="text-slate-500 text-xs">
                  Veuillez patienter pendant l'exécution des 10 étapes transactionnelles. Ne fermez pas votre navigateur.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left space-y-2 text-xs">
                {[
                  "1. Vérification des autorisations",
                  "2. Contrôle d'intégrité relationnelle",
                  "3. Création de la sauvegarde automatique DB",
                  "4. Sanctuarisation de l'administrateur connecté",
                  "5. Libération des services & déclaration de vacance",
                  "6. Réassignation des métadonnées de templates",
                  "7. Nettoyage des affectations & libération des postes",
                  "8. Nettoyage des fiches de personnel démo",
                  "9. Nettoyage des comptes utilisateurs démo",
                  "10. Vérification finale PRAGMA foreign_key_check"
                ].map((st, i) => (
                  <div key={i} className="flex items-center space-x-2 text-slate-700 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{st}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 9: RAPPORT FINAL & CONTRÔLE POST-NETTOYAGE (Section 19, 20, 21) */}
          {wizardStep === 9 && resetFinalReport && (
            <div className="bg-white rounded-2xl border border-emerald-300 p-6 md:p-8 shadow-xl space-y-6 max-w-3xl mx-auto">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center font-bold">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full tracking-wider uppercase">
                  OPÉRATION RÉUSSIE AVEC SUCCÈS
                </span>
                <h3 className="font-heading font-extrabold text-xl text-slate-900">
                  Réinitialisation des Données Démo Terminée
                </h3>
                <p className="text-slate-600 text-xs">
                  Identifiant d'opération : <span className="font-mono font-bold text-slate-900">{resetFinalReport.operationId}</span>
                </p>
              </div>

              {/* Summary Metrics Box (Section 19) */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4">
                <div className="font-bold text-xs text-kindia-gold uppercase tracking-wider flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-kindia-gold" />
                  <span>RAPPORT DE CONFORMITÉ & BILAN DÉTAILLÉ</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center">
                    <span>Administrateur conservé :</span>
                    <span className="font-bold text-emerald-400">OUI</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center">
                    <span>Services conservés :</span>
                    <span className="font-bold text-emerald-400">OUI ({resetFinalReport.preserved_counts?.services})</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center">
                    <span>Postes conservés :</span>
                    <span className="font-bold text-emerald-400">OUI ({resetFinalReport.preserved_counts?.positions})</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center">
                    <span>Rôles & Droits conservés :</span>
                    <span className="font-bold text-emerald-400">OUI ({resetFinalReport.preserved_counts?.roles})</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center">
                    <span>Workflows conservés :</span>
                    <span className="font-bold text-emerald-400">OUI ({resetFinalReport.preserved_counts?.workflows})</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center">
                    <span>QR Code & OM intacts :</span>
                    <span className="font-bold text-emerald-400">OUI</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white/10 p-3 rounded-xl">
                    <span className="text-[10px] text-slate-300 block">Utilisateurs nettoyés</span>
                    <span className="text-xl font-bold text-rose-400">{resetFinalReport.report?.users_cleaned}</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl">
                    <span className="text-[10px] text-slate-300 block">Personnels nettoyés</span>
                    <span className="text-xl font-bold text-rose-400">{resetFinalReport.report?.staff_cleaned}</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl">
                    <span className="text-[10px] text-slate-300 block">Affectations nettoyées</span>
                    <span className="text-xl font-bold text-rose-400">{resetFinalReport.report?.assignments_cleaned}</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl">
                    <span className="text-[10px] text-slate-300 block">Postes redevenus vacants</span>
                    <span className="text-xl font-bold text-kindia-gold">{resetFinalReport.report?.positions_vacant}</span>
                  </div>
                </div>

                <div className="bg-emerald-900/40 border border-emerald-500/30 p-3 rounded-xl text-[11px] flex justify-between items-center">
                  <span>💾 Sauvegarde de sécurité créée :</span>
                  <span className="font-mono text-emerald-300 font-bold">{resetFinalReport.report?.backup_file}</span>
                </div>
              </div>

              {/* Ready for Real Users (Section 21) */}
              <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-xl text-xs space-y-2">
                <h4 className="font-bold text-blue-950 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>UK-GED est désormais prêt pour les vrais utilisateurs de l'Université de Kindia !</span>
                </h4>
                <p className="text-[11px] leading-relaxed">
                  Vous pouvez à présent recréer les identités, comptes, rôles et affectations des agents réels
                  (Secrétariat Central, Secrétaire Général, Recteur, Doyens, Chefs de service, etc.) sans aucun conflit relationnel.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={resetWizardState}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Terminer et revenir au tableau de bord</span>
                </button>
              </div>
            </div>
          )}
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

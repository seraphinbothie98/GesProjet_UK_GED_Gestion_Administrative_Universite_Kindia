import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldCheck, Plus, Upload, CheckCircle, XCircle, Trash2, User, Award, Eye, AlertCircle, Edit, RefreshCw, Layers } from 'lucide-react';

export default function SignatureAdmin() {
  const [signatures, setSignatures] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [functionTitle, setFunctionTitle] = useState('');
  const [sigFile, setSigFile] = useState(null);
  const [sigPreview, setSigPreview] = useState(null);
  const [activationDate, setActivationDate] = useState(new Date().toISOString().split('T')[0]);

  // Conflict Modal State (Rule 16 & 21)
  const [conflictModal, setConflictModal] = useState(null);

  // Protected Deletion Dialog State (Rule 19)
  const [deleteDialog, setDeleteDialog] = useState(null);

  // Detail Modal State (Rule 26)
  const [viewModal, setViewModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sigsList, usersList] = await Promise.all([
        api.getElectronicSignatures().catch(err => {
          console.error('Failed to load signatures:', err);
          return [];
        }),
        api.getUsers().catch(err => {
          console.error('Failed to load users:', err);
          return [];
        })
      ]);
      setSignatures(Array.isArray(sigsList) ? sigsList : []);
      setUsers(Array.isArray(usersList) ? usersList : []);
    } catch (err) {
      console.error('Failed to load electronic signatures data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e, forceOverride = false) => {
    if (e) e.preventDefault();
    if (!selectedUserId || (!sigFile && !forceOverride)) {
      setError('Veuillez sélectionner un responsable et une image de signature.');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('user_id', selectedUserId);
      formData.append('function_title', functionTitle);
      if (sigFile) formData.append('signature', sigFile);
      formData.append('activation_date', activationDate);
      if (forceOverride) formData.append('force', 'true');

      const res = await api.createElectronicSignature(formData);
      setMessage(res.message || 'Signature électronique enregistrée et activée avec succès.');
      setShowModal(false);
      setConflictModal(null);
      resetForm();
      loadData();
    } catch (err) {
      if (err.message && err.message.includes('Une autre signature est actuellement active')) {
        setConflictModal({
          message: err.message
        });
      } else {
        setError(err.message || 'Erreur lors de l’enregistrement de la signature.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedUserId('');
    setFunctionTitle('');
    setSigFile(null);
    setSigPreview(null);
    setActivationDate(new Date().toISOString().split('T')[0]);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSigFile(file);
      setSigPreview(URL.createObjectURL(file));
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      const res = await api.toggleElectronicSignature(id);
      setMessage(res.message);
      loadData();
    } catch (err) {
      setError('Erreur lors du changement de statut : ' + err.message);
    }
  };

  const handleDeleteClick = async (sig) => {
    setDeleteDialog(sig);
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    try {
      const res = await api.deleteElectronicSignature(deleteDialog.id);
      setMessage(res.message);
      setDeleteDialog(null);
      loadData();
    } catch (err) {
      if (err.message && err.message.includes('liée à des documents historiques')) {
        alert(err.message);
      } else {
        setError('Erreur lors de la suppression : ' + err.message);
      }
      setDeleteDialog(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500 font-bold">Chargement des signatures électroniques...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-kindia-blue text-kindia-gold flex items-center justify-center shadow">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-lg text-slate-800">✍️ Signatures Électroniques des Responsables</h2>
            <p className="text-xs text-slate-500">Gestion des empreintes manuscrites scellées et verrouillées (Recteur, SG, Chefs de Service)</p>
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="mt-3 sm:mt-0 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
        >
          <Plus className="w-4 h-4 text-kindia-gold" />
          <span>➕ ENREGISTRER UNE SIGNATURE</span>
        </button>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-800 text-xs font-bold rounded-2xl border border-red-200 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Signature Cards Grid (Rule 26) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {signatures.map(sig => {
          const isActive = sig.is_active === 1 || sig.status === 'ACTIVE';
          return (
            <div key={sig.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 relative hover:border-kindia-gold transition">
              {/* Header Badge */}
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-kindia-blue flex items-center justify-center font-bold text-xs border border-slate-200">
                    👤
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-xs text-slate-800">
                      {sig.first_name} {sig.last_name}
                    </h3>
                    <p className="text-[10px] font-bold text-kindia-gold uppercase tracking-wider">{sig.function_title || sig.role_name}</p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1 ${
                  isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  <span>{isActive ? '🟢 ACTIVE' : '⚪ INACTIVE'}</span>
                </span>
              </div>

              {/* Signature Image Display */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center min-h-[90px] relative">
                {sig.signature_image_path ? (
                  <img
                    src={sig.signature_image_path}
                    alt="Signature"
                    className="max-h-16 object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-slate-400 font-bold italic">Aucune image enregistrée</span>
                )}
                <span className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-400 font-bold">
                  v{sig.version_number || 1}
                </span>
              </div>

              {/* Details & Actions */}
              <div className="space-y-1 text-[11px] text-slate-500 pt-1">
                <p><strong>Service :</strong> {sig.service_name || 'Administration centrale'}</p>
                <p><strong>Activité :</strong> {sig.activation_date || 'Immédiate'}</p>
                <p><strong>Documents Signés :</strong> <span className="font-bold text-kindia-blue">{sig.documents_signed_count || 0}</span></p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                <button
                  onClick={() => setViewModal(sig)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center space-x-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Voir</span>
                </button>

                <button
                  onClick={() => handleToggleStatus(sig.id)}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center space-x-1 ${
                    isActive ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isActive ? 'Désactiver' : 'Activer'}</span>
                </button>

                <button
                  onClick={() => handleDeleteClick(sig)}
                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE SIGNATURE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-slate-800 flex items-center">
                <ShieldCheck className="w-4 h-4 text-kindia-gold mr-2" />
                Enregistrer la Signature d’un Responsable
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 font-bold text-lg">×</button>
            </div>

            <form onSubmit={(e) => handleCreateSubmit(e, false)} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Sélectionner le Responsable Autorisé *</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedUserId(val);
                    const match = users.find(u => String(u.id) === String(val));
                    if (match) {
                      setFunctionTitle(match.function_title || match.role_name || '');
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-kindia-blue"
                  required
                >
                  {users && users.length > 0 ? (
                    <>
                      <option value="">-- Sélectionner un utilisateur --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} — {u.function_title || u.role_name || 'Agent'} ({u.service_code || u.service_name || 'UK'})
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="" disabled>
                      Aucun responsable autorisé disponible. Veuillez d’abord créer ou activer un utilisateur disposant d’un rôle approprié.
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Titre de la Fonction Officielle</label>
                <input
                  type="text"
                  value={functionTitle}
                  onChange={(e) => setFunctionTitle(e.target.value)}
                  placeholder="Ex : Secrétaire Général"
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Image de la Signature (PNG transparent recommandé) *</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleFileChange}
                  className="block w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue"
                  required
                />
              </div>

              {sigPreview && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 font-bold block mb-1">Aperçu de l'image de la signature</span>
                  <img src={sigPreview} alt="Preview" className="max-h-16 mx-auto object-contain" />
                </div>
              )}

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl">
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-kindia-blue text-white font-bold rounded-xl shadow hover:bg-kindia-lightBlue transition">
                  {submitting ? 'Enregistrement...' : 'ACTIVER LA SIGNATURE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFLICT CONFIRMATION MODAL (Rule 16 & 21) */}
      {conflictModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-amber-300 text-xs">
            <div className="flex items-center space-x-2 text-amber-800 font-bold">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <h3 className="font-heading font-extrabold text-sm">Remplacement de Signature Active</h3>
            </div>

            <p className="text-slate-700">{conflictModal.message}</p>

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
              <button
                onClick={() => setConflictModal(null)}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl"
              >
                Annuler
              </button>

              <button
                onClick={() => handleCreateSubmit(null, true)}
                className="px-5 py-2.5 bg-amber-600 text-white font-bold rounded-xl shadow hover:bg-amber-700 transition"
              >
                REMPLACER ET ACTIVER LA NOUVELLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROTECTED DELETION DIALOG (Rule 19 & 20) */}
      {deleteDialog && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-red-200 text-xs">
            <h3 className="font-heading font-extrabold text-sm text-red-900 flex items-center">
              <Trash2 className="w-4 h-4 text-red-600 mr-2" />
              Confirmation de Suppression
            </h3>

            <p className="text-slate-700">
              Voulez-vous réellement supprimer la signature électronique de <strong>{deleteDialog.first_name} {deleteDialog.last_name}</strong> ?
            </p>

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
              <button onClick={() => setDeleteDialog(null)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl">
                Annuler
              </button>
              <button onClick={confirmDelete} className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl shadow hover:bg-red-700 transition">
                CONFIRMER LA SUPPRESSION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

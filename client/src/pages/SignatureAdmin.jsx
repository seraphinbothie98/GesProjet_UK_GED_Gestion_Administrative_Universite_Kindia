import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldCheck, Plus, Upload, CheckCircle, XCircle, Trash2, User, Award, Eye, AlertCircle, Edit, Edit3, RefreshCw, Layers, X, Check } from 'lucide-react';
import { formatFullName } from '../utils/userUtils';

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

  // Edit Modal State
  const [editModal, setEditModal] = useState(null);
  const [editFunctionTitle, setEditFunctionTitle] = useState('');
  const [editActivationDate, setEditActivationDate] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSigFile, setEditSigFile] = useState(null);
  const [editSigPreview, setEditSigPreview] = useState(null);

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

  const handleOpenEditModal = (sig) => {
    setEditModal(sig);
    setEditFunctionTitle(sig.function_title || sig.role_name || '');
    setEditActivationDate(sig.activation_date || new Date().toISOString().split('T')[0]);
    setEditIsActive(sig.is_active === 1 || sig.status === 'ACTIVE');
    setEditSigFile(null);
    setEditSigPreview(null);
    setError('');
  };

  const handleEditSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!editModal) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      let res;
      if (editSigFile) {
        const formData = new FormData();
        formData.append('function_title', editFunctionTitle);
        formData.append('activation_date', editActivationDate);
        formData.append('is_active', editIsActive ? '1' : '0');
        formData.append('signature', editSigFile);
        res = await api.updateElectronicSignature(editModal.id, formData);
      } else {
        res = await api.updateElectronicSignature(editModal.id, {
          function_title: editFunctionTitle,
          activation_date: editActivationDate,
          is_active: editIsActive ? 1 : 0
        });
      }

      setMessage(res.message || 'Signature électronique mise à jour avec succès.');
      setEditModal(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la mise à jour de la signature.');
    } finally {
      setSubmitting(false);
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
      setError('Erreur lors de la suppression : ' + err.message);
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
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-emerald-700 hover:text-emerald-950 font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-800 text-xs font-bold rounded-2xl border border-red-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-700 hover:text-red-950 font-bold">×</button>
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
                      {formatFullName(sig)}
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

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold gap-1.5 flex-wrap">
                <button
                  onClick={() => setViewModal(sig)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center space-x-1"
                  title="Voir les détails"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Voir</span>
                </button>

                <button
                  onClick={() => handleOpenEditModal(sig)}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center space-x-1"
                  title="Modifier ou remplacer l'image de la signature"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Modifier</span>
                </button>

                <button
                  onClick={() => handleToggleStatus(sig.id)}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center space-x-1 ${
                    isActive ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                  }`}
                  title={isActive ? 'Désactiver la signature' : 'Activer la signature'}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isActive ? 'Désactiver' : 'Activer'}</span>
                </button>

                <button
                  onClick={() => handleDeleteClick(sig)}
                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition"
                  title="Supprimer la signature"
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
                          {formatFullName(u)} — {u.function_title || u.role_name || 'Agent'} ({u.service_code || u.service_name || 'UK'})
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="" disabled>
                      Aucun responsable autorisé disponible.
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
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
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

      {/* EDIT / UPDATE SIGNATURE MODAL */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-slate-800 flex items-center">
                <Edit3 className="w-4 h-4 text-kindia-gold mr-2" />
                Mettre à Jour la Signature : {formatFullName(editModal)}
              </h3>
              <button onClick={() => setEditModal(null)} className="text-slate-400 font-bold text-lg">×</button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fonction Officielle</label>
                <input
                  type="text"
                  value={editFunctionTitle}
                  onChange={(e) => setEditFunctionTitle(e.target.value)}
                  placeholder="Ex : Secrétaire Général"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Date d'Activation</label>
                <input
                  type="date"
                  value={editActivationDate}
                  onChange={(e) => setEditActivationDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="editIsActiveToggle"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded-sm text-kindia-blue focus:ring-kindia-blue h-4 w-4"
                />
                <label htmlFor="editIsActiveToggle" className="font-bold text-slate-800 cursor-pointer">
                  Signature active (utilisable pour sceller les documents)
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Changer l'image de la signature (Optionnel — crée une nouvelle version v{(editModal.version_number || 1) + 1})
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      setEditSigFile(file);
                      setEditSigPreview(URL.createObjectURL(file));
                    }
                  }}
                  className="block w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-kindia-blue file:text-white hover:file:bg-kindia-lightBlue"
                />
              </div>

              {/* Preview Comparison */}
              <div className="grid grid-cols-2 gap-3 pt-1 text-center">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block mb-1">Signature Actuelle (v{editModal.version_number || 1})</span>
                  {editModal.signature_image_path ? (
                    <img src={editModal.signature_image_path} alt="Actuelle" className="max-h-12 mx-auto object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Aucune</span>
                  )}
                </div>

                <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-200">
                  <span className="text-[10px] text-kindia-blue font-bold block mb-1">Nouvelle Image</span>
                  {editSigPreview ? (
                    <img src={editSigPreview} alt="Nouvelle" className="max-h-12 mx-auto object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Non modifiée</span>
                  )}
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditModal(null)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl">
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-kindia-blue text-white font-bold rounded-xl shadow hover:bg-kindia-lightBlue transition">
                  {submitting ? 'Mise à jour...' : 'ENREGISTRER LES MODIFICATIONS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL / VIEW MODAL */}
      {viewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-slate-800 flex items-center">
                <Eye className="w-4 h-4 text-kindia-gold mr-2" />
                Fiche Signature : {formatFullName(viewModal)}
              </h3>
              <button onClick={() => setViewModal(null)} className="text-slate-400 font-bold text-lg">×</button>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                {viewModal.signature_image_path ? (
                  <img src={viewModal.signature_image_path} alt="Signature" className="max-h-24 mx-auto object-contain" />
                ) : (
                  <span className="text-slate-400 italic">Aucune image</span>
                )}
                <span className="block mt-2 text-[10px] font-mono text-slate-500 font-bold">
                  Version actuelle : v{viewModal.version_number || 1}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold block">Responsable</span>
                  <span className="font-bold text-slate-800">{formatFullName(viewModal)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold block">Matricule</span>
                  <span className="font-mono font-bold text-kindia-blue">{viewModal.matricule || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold block">Fonction Officielle</span>
                  <span className="font-bold text-slate-800">{viewModal.function_title || viewModal.role_name}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold block">Service</span>
                  <span className="font-bold text-slate-800">{viewModal.service_name || 'UK'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold block">Statut Actuel</span>
                  <span className={`font-bold ${viewModal.is_active === 1 ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {viewModal.is_active === 1 ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold block">Documents Signés</span>
                  <span className="font-bold text-kindia-blue">{viewModal.documents_signed_count || 0} document(s)</span>
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button onClick={() => setViewModal(null)} className="px-4 py-2 bg-kindia-blue text-white font-bold rounded-xl shadow hover:bg-kindia-lightBlue transition">
                Fermer
              </button>
            </div>
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
              Confirmation de Suppression de Signature
            </h3>

            <p className="text-slate-700">
              Voulez-vous réellement supprimer la signature électronique de <strong>{formatFullName(deleteDialog)}</strong> ?
            </p>

            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-[11px] leading-relaxed">
              🛡️ <strong>Intégrité garantie :</strong> Les documents administratifs et ordres de mission déjà scellés et signés avec cette signature resteront strictement intacts et valides avec leur signature apposée.
            </div>

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

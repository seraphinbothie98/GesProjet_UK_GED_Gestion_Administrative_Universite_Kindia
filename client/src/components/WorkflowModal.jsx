import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Send, CornerUpLeft, ArrowRight, X, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export default function WorkflowModal({ doc, mode, onClose, onSuccess }) {
  // mode: 'ORIENT' | 'TRANSMIT' | 'RETURN' | 'ACCEPT' | 'REJECT' | 'SIGN_AND_RETURN'
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [targetServiceId, setTargetServiceId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [motif, setMotif] = useState(mode === 'REJECT' ? '' : 'Pour examen');
  const [instruction, setInstruction] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState(doc?.priority || 'NORMAL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSelfTransmission = ['ORIENT', 'TRANSMIT'].includes(mode) && targetServiceId && user?.service_id && String(targetServiceId) === String(user.service_id);

  const motifsList = [
    'Pour examen',
    'Pour avis',
    'Pour étude',
    'Pour traitement',
    'Pour information',
    'Pour exécution',
    'Pour proposition',
    'Pour réponse',
    'Pour suivi'
  ];

  useEffect(() => {
    if (['ORIENT', 'TRANSMIT', 'RETURN'].includes(mode)) {
      loadData();
    }
  }, [mode]);

  const loadData = async () => {
    try {
      const sData = await api.getServices();
      setServices(sData.filter(s => s.status === 'ACTIVE'));
      const uData = await api.getUsers();
      setUsers(uData.filter(u => u.status === 'ACTIVE'));
    } catch (err) {
      console.error('Failed to load workflow metadata:', err);
    }
  };

  const filteredUsers = targetServiceId 
    ? users.filter(u => String(u.service_id) === String(targetServiceId))
    : users;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (['ORIENT', 'TRANSMIT'].includes(mode) && targetServiceId && user?.service_id && String(targetServiceId) === String(user.service_id)) {
      setError('TRANSMISSION IMPOSSIBLE : Vous ne pouvez pas transmettre ou orienter un document vers votre propre service. Veuillez sélectionner un autre service destinataire.');
      return;
    }

    if (['ORIENT', 'TRANSMIT'].includes(mode) && !targetServiceId) {
      setError('Veuillez sélectionner un service destinataire.');
      return;
    }

    if (mode === 'REJECT' && (!motif || !motif.trim())) {
      setError('Le motif du rejet est obligatoire.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'ORIENT') {
        await api.orientDocument({
          document_id: doc.id,
          to_service_id: targetServiceId,
          to_user_id: targetUserId || null,
          motif,
          instruction,
          deadline: deadline || null,
          priority
        });
      } else if (mode === 'TRANSMIT') {
        await api.transmitDocument({
          document_id: doc.id,
          to_service_id: targetServiceId,
          to_user_id: targetUserId || null,
          instruction
        });
      } else if (mode === 'RETURN') {
        await api.returnDocument({
          document_id: doc.id,
          to_service_id: targetServiceId || null,
          return_reason: instruction || motif || 'Retour au Secrétariat Central'
        });
      } else if (mode === 'SIGN_AND_RETURN') {
        await api.signAndReturnDocument({
          document_id: doc.id,
          remarks: instruction
        });
      } else if (mode === 'ACCEPT') {
        await api.acceptDocument({
          document_id: doc.id,
          remarks: instruction
        });
      } else if (mode === 'REJECT') {
        await api.rejectDocument({
          document_id: doc.id,
          motif
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’opération du workflow.');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (mode === 'ORIENT') return `Orienter le document — ${doc.reference}`;
    if (mode === 'TRANSMIT') return `Transmettre le document — ${doc.reference}`;
    if (mode === 'RETURN') return `Demander une correction / Retourner — ${doc.reference}`;
    if (mode === 'ACCEPT') return `Accepter le document — ${doc.reference}`;
    if (mode === 'REJECT') return `REJETER LE DOCUMENT`;
    return `Action — ${doc.reference}`;
  };

  const getHeaderBg = () => {
    if (mode === 'ACCEPT') return 'bg-emerald-700';
    if (mode === 'REJECT') return 'bg-red-700';
    if (mode === 'RETURN') return 'bg-amber-600';
    return 'bg-kindia-blue';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className={`${getHeaderBg()} px-6 py-4 text-white flex justify-between items-center`}>
          <div className="flex items-center space-x-2">
            {mode === 'ACCEPT' && <CheckCircle2 className="w-5 h-5 text-emerald-200" />}
            {mode === 'REJECT' && <XCircle className="w-5 h-5 text-red-200" />}
            {mode === 'ORIENT' && <ArrowRight className="w-5 h-5 text-kindia-gold" />}
            {mode === 'TRANSMIT' && <Send className="w-5 h-5 text-kindia-gold" />}
            {mode === 'RETURN' && <CornerUpLeft className="w-5 h-5 text-amber-200" />}
            <h3 className="font-heading font-extrabold text-sm tracking-wide">{getTitle()}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-white/80">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center space-x-2 border border-red-200 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Self Transmission Warning (Rule 8) */}
          {isSelfTransmission && (
            <div className="p-3.5 bg-red-50 text-red-800 text-xs rounded-xl border border-red-300 font-medium space-y-1">
              <div className="font-bold text-red-700 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>⚠️ TRANSMISSION IMPOSSIBLE</span>
              </div>
              <p>
                Vous ne pouvez pas transmettre ou orienter un document vers votre propre service. Veuillez sélectionner un autre service destinataire.
              </p>
            </div>
          )}

          {/* Mode SIGN_AND_RETURN Specific UI (Rules 4 & 5) */}
          {mode === 'SIGN_AND_RETURN' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-indigo-50 text-indigo-900 text-xs rounded-xl border border-indigo-200 leading-relaxed">
                ✍️ <strong>Signature / Validation et Retour au Secrétariat Central</strong> — La validation enregistrera l'identité du signataire, la date, l'heure et l'empreinte numérique. Le document sera scellé et retourné au <strong>Secrétariat Central</strong> pour la suite du workflow.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Remarques ou observations du Chef de service (Optionnel)
                </label>
                <textarea
                  rows={3}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Ex : Dossier examiné, validé et conforme. Retour au SC."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Mode REJECT Specific UI (Prompt Item 2 & 3 Exact Requirements) */}
          {mode === 'REJECT' && (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200">
                ⚠️ <strong>Rejet du document Réf: {doc.reference}</strong> — Le rejet interrompt le circuit d'orientation et nécessite obligatoirement la saisie d'un motif clair.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motif du rejet *
                </label>
                <textarea
                  rows={4}
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Ex : Pièces justificatives manquantes ou non conformes aux exigences réglementaires."
                  className="w-full text-xs p-3 rounded-xl border-2 border-red-200 focus:border-red-600 focus:ring-0 outline-none font-medium"
                  required
                />
              </div>
            </div>
          )}

          {/* Mode ACCEPT Specific UI */}
          {mode === 'ACCEPT' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200">
                ✅ <strong>Validation et Acceptation</strong> — Vous vous apprêtez à officialiser l'acceptation du document Réf: {doc.reference}.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Remarques ou instructions de validation (Optionnel)
                </label>
                <textarea
                  rows={3}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Ex : Document conforme, avis favorable accordé."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Workflow Routing Modes (ORIENT, TRANSMIT, RETURN) */}
          {['ORIENT', 'TRANSMIT', 'RETURN'].includes(mode) && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Destinataire *</label>
                <select
                  value={targetServiceId}
                  onChange={(e) => {
                    setTargetServiceId(e.target.value);
                    setTargetUserId('');
                  }}
                  className={`w-full text-xs p-2.5 rounded-xl border font-bold ${
                    isSelfTransmission ? 'border-red-500 bg-red-50 text-red-800' : 'border-slate-300 focus:ring-2 focus:ring-kindia-blue'
                  }`}
                  required
                >
                  <option value="">-- Sélectionner un service parmi les 30 services --</option>
                  {services.map(s => {
                    const isOwn = user?.service_id && String(s.id) === String(user.service_id);
                    return (
                      <option key={s.id} value={s.id} disabled={['ORIENT', 'TRANSMIT'].includes(mode) && isOwn}>
                        {s.name} ({s.code}) {isOwn && ['ORIENT', 'TRANSMIT'].includes(mode) ? '— [VOTRE SERVICE - INTERDIT]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Responsable / Agent spécifique (Optionnel)</label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
                >
                  <option value="">-- Tout le service --</option>
                  {filteredUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.function_title})
                    </option>
                  ))}
                </select>
              </div>

              {mode !== 'TRANSMIT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Motif de l’opération *</label>
                  <select
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue font-semibold"
                  >
                    {motifsList.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instruction / Remarques accompagnantes</label>
                <textarea
                  rows={3}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Ex : Prière d'examiner et de transmettre votre avis sous 48h."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
                />
              </div>

              {mode === 'ORIENT' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Date limite / Échéance</label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Priorité</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-300 font-semibold"
                    >
                      <option value="LOW">Basse</option>
                      <option value="NORMAL">Normale</option>
                      <option value="HIGH">Haute</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action Buttons Footer (ANNULER & CONFIRMER LE REJET / CONFIRMER) */}
          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              ANNULER
            </button>
            <button
              type="submit"
              disabled={loading || isSelfTransmission}
              className={`px-5 py-2.5 text-xs font-extrabold text-white rounded-xl shadow-lg transition disabled:opacity-50 ${
                mode === 'REJECT'
                  ? 'bg-red-600 hover:bg-red-700'
                  : mode === 'ACCEPT'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : mode === 'SIGN_AND_RETURN'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-kindia-blue hover:bg-kindia-lightBlue'
              }`}
            >
              {loading 
                ? 'Traitement...' 
                : mode === 'REJECT' 
                  ? 'CONFIRMER LE REJET' 
                  : mode === 'ACCEPT' 
                    ? 'CONFIRMER L’ACCEPTATION' 
                    : mode === 'SIGN_AND_RETURN'
                      ? 'SIGNER & RETOURNER AU SC'
                      : 'Valider l’opération'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

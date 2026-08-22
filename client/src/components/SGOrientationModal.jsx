import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  ShieldAlert, Send, ArrowRight, CornerUpLeft, HelpCircle, 
  Award, X, AlertCircle, CheckCircle, UserCheck 
} from 'lucide-react';

export default function SGOrientationModal({ doc, onClose, onSuccess }) {
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [actionType, setActionType] = useState('ORIENT_RECTEUR'); // 'SIGN_DIRECTLY' | 'ORIENT_RECTEUR' | 'ORIENT_SERVICE' | 'RETURN_FOR_CORRECTION' | 'REQUEST_COMPLEMENT'
  const [toServiceId, setToServiceId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [instruction, setInstruction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const data = await api.getServices();
      setServices(data || []);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (actionType === 'ORIENT_SERVICE' && !toServiceId) {
      setError('Veuillez sélectionner le service destinataire.');
      return;
    }

    if (actionType === 'RETURN_FOR_CORRECTION' && (!instruction || !instruction.trim())) {
      setError('Le motif de retour pour correction est obligatoire.');
      return;
    }

    setSubmitting(true);
    try {
      await api.sgOrientDocument({
        document_id: doc.id,
        action_type: actionType,
        to_service_id: toServiceId || null,
        to_user_id: toUserId || null,
        instruction: instruction.trim(),
        authorized_signatory_role: actionType === 'ORIENT_RECTEUR' ? 'RECTEUR' : 'CHEF_SERVICE'
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’orientation du document.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-scale-up">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-600 to-kindia-blue text-white flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="font-heading font-black text-base text-white">
                Centre de Décision du Secrétaire Général (SG)
              </h3>
              <p className="text-xs text-amber-200">
                Orientation hiérarchique de l'acte Réf : {doc.reference}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Originating context info */}
        <div className="bg-slate-50 p-4 border-b border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row justify-between gap-2">
          <div>
            <span className="text-slate-400 block text-[10px]">Structure Émettrice :</span>
            <span className="font-bold text-kindia-blue">{doc.originating_service_name || doc.sender_organization || 'Service de Kindia'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Responsable émetteur en poste :</span>
            <span className="font-semibold text-slate-800">{doc.originating_head_name || doc.sender_name || 'N/A'}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Decision Selector */}
          <div>
            <label className="block font-bold text-slate-800 mb-2">
              Décision & Orientation du Secrétaire Général *
            </label>
            <div className="grid grid-cols-1 gap-2">
              <label 
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition ${
                  actionType === 'ORIENT_RECTEUR' 
                    ? 'border-kindia-blue bg-blue-50/70 text-kindia-blue font-bold shadow-sm' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input 
                  type="radio" 
                  name="sg_action" 
                  value="ORIENT_RECTEUR" 
                  checked={actionType === 'ORIENT_RECTEUR'}
                  onChange={() => setActionType('ORIENT_RECTEUR')}
                  className="mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold">1. Transmettre au Recteur (Pour visa et signature rectorale)</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Acte relevant de la compétence exclusive du Recteur de l'Université.
                  </span>
                </div>
              </label>

              <label 
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition ${
                  actionType === 'SIGN_DIRECTLY' 
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-sm' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input 
                  type="radio" 
                  name="sg_action" 
                  value="SIGN_DIRECTLY" 
                  checked={actionType === 'SIGN_DIRECTLY'}
                  onChange={() => setActionType('SIGN_DIRECTLY')}
                  className="mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold">2. Signer et valider directement par le SG</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    L'acte relève de votre champ de compétence administrative directe (soit-transmis courant, validation interne).
                  </span>
                </div>
              </label>

              <label 
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition ${
                  actionType === 'ORIENT_SERVICE' 
                    ? 'border-purple-600 bg-purple-50 text-purple-900 font-bold shadow-sm' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input 
                  type="radio" 
                  name="sg_action" 
                  value="ORIENT_SERVICE" 
                  checked={actionType === 'ORIENT_SERVICE'}
                  onChange={() => setActionType('ORIENT_SERVICE')}
                  className="mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold">3. Orienter vers un service technique ou une faculté</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Transmettre à un Doyen, DAF, DRH, Direction pour avis ou traitement.
                  </span>
                </div>
              </label>

              <label 
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition ${
                  actionType === 'RETURN_FOR_CORRECTION' 
                    ? 'border-rose-600 bg-rose-50 text-rose-900 font-bold shadow-sm' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input 
                  type="radio" 
                  name="sg_action" 
                  value="RETURN_FOR_CORRECTION" 
                  checked={actionType === 'RETURN_FOR_CORRECTION'}
                  onChange={() => setActionType('RETURN_FOR_CORRECTION')}
                  className="mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold">4. Retourner pour correction au service émetteur</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Document incomplet ou non conforme avec motif obligatoire de renvoi.
                  </span>
                </div>
              </label>

              <label 
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition ${
                  actionType === 'REQUEST_COMPLEMENT' 
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold shadow-sm' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input 
                  type="radio" 
                  name="sg_action" 
                  value="REQUEST_COMPLEMENT" 
                  checked={actionType === 'REQUEST_COMPLEMENT'}
                  onChange={() => setActionType('REQUEST_COMPLEMENT')}
                  className="mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold">5. Demander un complément d'information</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Demande de pièces justificatives ou clarification sans renvoyer tout le dossier.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Conditional Target Service Picker */}
          {actionType === 'ORIENT_SERVICE' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Sélectionner le Service / Faculté Destinataire *
              </label>
              <select
                value={toServiceId}
                onChange={(e) => setToServiceId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
                required
              >
                <option value="">— Choisir la structure —</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.reference_code || s.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Instructions / Observations / Motif */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Instructions du Secrétaire Général / Remarques {actionType === 'RETURN_FOR_CORRECTION' ? '*' : ''}
            </label>
            <textarea
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={
                actionType === 'ORIENT_RECTEUR' ? "Ex: Pour visa et signature du Recteur..." :
                actionType === 'RETURN_FOR_CORRECTION' ? "Précisez le motif obligatoire du renvoi (ex: manque le visa du chef de département)..." :
                "Consignes particulières pour le traitement de ce document..."
              }
              className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:border-kindia-blue focus:outline-none"
              required={actionType === 'RETURN_FOR_CORRECTION'}
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              <span>{submitting ? 'Traitement...' : 'Valider la décision SG'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

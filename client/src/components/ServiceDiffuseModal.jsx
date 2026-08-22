import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Send, X, Building2, User, Clock, AlertCircle, 
  CheckCircle2, ShieldCheck, FileText, Info
} from 'lucide-react';

export default function ServiceDiffuseModal({
  isOpen,
  document: doc,
  onClose,
  onSuccess
}) {
  const { user } = useAuth();

  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [deadline, setDeadline] = useState('');
  const [dispatchType, setDispatchType] = useState('SIMPLE'); // 'SIMPLE', 'PRISE_DE_CONNAISSANCE', 'ACTION_REQUISE'
  
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadServices();
      if (doc) {
        setSubject(`Transmission : ${doc.reference || ''} - ${doc.title || ''}`);
        setMessage(`Veuillez trouver ci-joint le document transmis par le service ${user?.service_name || ''} pour traitement / prise de connaissance.`);
      }
      setSelectedServices([]);
      setError('');
    }
  }, [isOpen, doc]);

  const loadServices = async () => {
    try {
      setLoadingServices(true);
      const data = await api.getServices();
      // Filter out current service
      const others = (data || []).filter(s => s.id !== user?.service_id);
      setServices(others);
    } catch (err) {
      console.error('Error loading services for diffusion:', err);
    } finally {
      setLoadingServices(false);
    }
  };

  if (!isOpen || !doc) return null;

  const handleToggleService = (sId) => {
    setSelectedServices(prev => 
      prev.includes(sId) ? prev.filter(id => id !== sId) : [...prev, sId]
    );
  };

  const handleSelectAllServices = () => {
    if (selectedServices.length === services.length) {
      setSelectedServices([]);
    } else {
      setSelectedServices(services.map(s => s.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedServices.length === 0) {
      setError('Veuillez sélectionner au moins un service destinataire.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        target_service_ids: selectedServices,
        subject,
        message,
        priority,
        deadline: deadline || null,
        dispatch_type: dispatchType
      };

      const res = await api.diffuseDocument(doc.id, payload);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      console.error('Diffusion error:', err);
      setError(err.message || 'Erreur lors de la diffusion du document.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-auto animate-scale-up">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-kindia-blue to-teal-800 p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-teal-300 font-black border border-white/20">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase bg-white/20 text-teal-200 px-2 py-0.5 rounded">
                  Diffusion & Transmission
                </span>
                <span className="font-mono text-xs text-slate-200">{doc.reference}</span>
              </div>
              <h3 className="font-heading font-extrabold text-lg text-white">
                Diffuser / Transmettre le document
              </h3>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rule 6 Assurance Notice */}
        <div className="bg-teal-50/80 p-3.5 px-6 border-b border-teal-100 flex items-center space-x-3 text-teal-900 text-xs">
          <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0" />
          <p className="leading-snug">
            <strong>Règle de conservation :</strong> Ce document restera intégralement dans les archives de votre service. Les destinataires sélectionnés recevront une transmission officielle sécurisée et traçable.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Target Services Selection (Rule 5 & 10) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-black text-slate-800">
                Services Destinataires <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAllServices}
                className="text-kindia-blue hover:underline font-bold text-[11px]"
              >
                {selectedServices.length === services.length ? 'Tout désélectionner' : 'Sélectionner tous les services'}
              </button>
            </div>

            {loadingServices ? (
              <div className="p-4 text-center text-slate-400">Chargement des services de l'Université...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                {services.map(s => {
                  const isChecked = selectedServices.includes(s.id);
                  const isSC = s.code === 'SC';
                  return (
                    <label 
                      key={s.id} 
                      className={`flex items-center space-x-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
                        isChecked 
                          ? 'bg-teal-50 border-teal-300 text-teal-950 font-bold shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleService(s.id)}
                        className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                      />
                      <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSC ? 'text-amber-600' : 'text-slate-400'}`} />
                      <span className="truncate text-xs">
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              {selectedServices.length} service(s) sélectionné(s) pour la transmission.
            </p>
          </div>

          {/* Subject & Message */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Objet de la transmission *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-teal-600 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Message / Instructions d'accompagnement</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-teal-600 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Type de transmission</label>
              <select
                value={dispatchType}
                onChange={(e) => setDispatchType(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:ring-2 focus:ring-teal-600 outline-hidden"
              >
                <option value="SIMPLE">Information simple</option>
                <option value="PRISE_DE_CONNAISSANCE">Prise de connaissance requise</option>
                <option value="ACTION_REQUISE">Action & Traitement requis</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Niveau de Priorité</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:ring-2 focus:ring-teal-600 outline-hidden"
              >
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Délai de traitement (Optionnel)</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-teal-600 outline-hidden"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={submitting || selectedServices.length === 0}
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-black shadow-lg transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Transmission en cours...' : `📤 Diffuser à ${selectedServices.length} service(s)`}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

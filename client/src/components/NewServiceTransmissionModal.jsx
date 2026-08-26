import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  X, Send, FileText, Upload, ShieldCheck, AlertCircle, Building2, 
  HelpCircle, CheckCircle, Info
} from 'lucide-react';

export default function NewServiceTransmissionModal({ isOpen, onClose, onSuccess, user }) {
  const [services, setServices] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]);
  const [docSourceType, setDocSourceType] = useState('upload'); // 'upload' or 'existing'
  
  // Form State
  const [selectedDocId, setSelectedDocId] = useState('');
  const [toServiceId, setToServiceId] = useState('');
  const [subject, setSubject] = useState('');
  const [instruction, setInstruction] = useState('');
  const [confidentialityLevel, setConfidentialityLevel] = useState('CONFIDENTIEL_INTER_SERVICES');
  const [requiresSignature, setRequiresSignature] = useState(true);
  
  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [docNumber, setDocNumber] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      setError('');
      const [svcList, docsList] = await Promise.all([
        api.getServices(),
        api.getDocuments({ limit: 100 })
      ]);
      // Filter out user's own service from recipients
      const eligibleServices = (svcList || []).filter(s => Number(s.id) !== Number(user?.service_id));
      setServices(eligibleServices);
      setExistingDocuments(docsList?.documents || docsList || []);
    } catch (err) {
      console.error('Error loading transmission initial data:', err);
      setError('Impossible de charger les données initiales.');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!subject) {
        setSubject(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!toServiceId) {
      setError('Veuillez sélectionner un service destinataire.');
      return;
    }
    if (!subject.trim()) {
      setError('Veuillez renseigner l’objet du courrier.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let finalDocId = selectedDocId;

      // If uploading a new document
      if (docSourceType === 'upload') {
        if (!selectedFile) {
          throw new Error('Veuillez sélectionner un fichier à transmettre (PDF, DOCX).');
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', subject);
        formData.append('document_type', 'SOIT_TRANSMIS');
        formData.append('confidentiality', confidentialityLevel);
        formData.append('subject', subject);
        if (docNumber) formData.append('reference', docNumber);

        // Upload document
        const createdDoc = await api.createDocument(formData);
        finalDocId = createdDoc.id;
      }

      if (!finalDocId) {
        throw new Error('Identifiant de document manquant.');
      }

      // Create Inter-Service Transmission
      const res = await api.createTransmission({
        document_id: finalDocId,
        to_service_id: Number(toServiceId),
        subject: subject.trim(),
        instruction: instruction.trim(),
        confidentiality_level: confidentialityLevel,
        requires_signature: requiresSignature ? 1 : 0
      });

      if (onSuccess) {
        onSuccess(res);
      }
      onClose();
    } catch (err) {
      console.error('Submit transmission error:', err);
      setError(err.message || 'Erreur lors de la transmission du courrier.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-kindia-blue to-kindia-lightBlue px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Send className="w-5 h-5 text-kindia-gold" />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-lg text-white">
                Nouvelle Transmission Inter-Services
              </h2>
              <p className="text-xs text-slate-200">
                Circuit fermé & confidentiel : {user?.service_name || 'Votre Service'} ➔ Destinataire
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start space-x-3 text-amber-900 text-xs">
          <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">Confidentialité Stricte (Circuit Fermé) :</span> Seuls votre service et le service destinataire pourront consulter ce courrier, ses pièces jointes et son historique. Aucun autre service n'y aura accès.
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Destinataire */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Service Destinataire <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <select
                value={toServiceId}
                onChange={(e) => setToServiceId(e.target.value)}
                required
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-kindia-blue focus:border-transparent outline-none transition"
              >
                <option value="">Sélectionnez le service destinataire...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || s.reference_code || 'Service'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Source du Document */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Document à Transmettre <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                onClick={() => setDocSourceType('upload')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition ${
                  docSourceType === 'upload'
                    ? 'border-kindia-blue bg-kindia-blue/5 text-kindia-blue shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Téléverser un nouveau fichier</span>
              </button>
              <button
                type="button"
                onClick={() => setDocSourceType('existing')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition ${
                  docSourceType === 'existing'
                    ? 'border-kindia-blue bg-kindia-blue/5 text-kindia-blue shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Choisir un document existant</span>
              </button>
            </div>

            {docSourceType === 'upload' ? (
              <div className="border-2 border-dashed border-slate-200 hover:border-kindia-blue rounded-xl p-4 text-center bg-slate-50/50 transition">
                <input
                  type="file"
                  id="transmission-file-upload"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                />
                <label
                  htmlFor="transmission-file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <Upload className="w-8 h-8 text-slate-400 mb-1" />
                  <span className="text-xs font-bold text-slate-700">
                    {selectedFile ? selectedFile.name : 'Cliquez pour choisir un fichier'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    Formats acceptés : PDF, Word (DOCX), Images (Max 50 Mo)
                  </span>
                </label>
              </div>
            ) : (
              <select
                value={selectedDocId}
                onChange={(e) => {
                  setSelectedDocId(e.target.value);
                  const found = existingDocuments.find(d => String(d.id) === String(e.target.value));
                  if (found && !subject) setSubject(found.title || found.subject);
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-none transition"
              >
                <option value="">Sélectionnez parmi vos documents récents...</option>
                {existingDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    [{doc.document_number || doc.reference || 'DOC'}] {doc.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 3. Objet & Instructions */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Objet / Sujet du courrier <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Demande de validation du rapport de mission pédagogique"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Instructions ou Commentaires pour le Destinataire
              </label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={2}
                placeholder="Ex: Merci d'examiner et d'apposer votre signature pour validation définitive..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-none transition"
              />
            </div>
          </div>

          {/* 4. Options & Signature Obligatoire */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresSignature}
                onChange={(e) => setRequiresSignature(e.target.checked)}
                className="w-4 h-4 rounded text-kindia-blue border-slate-300 focus:ring-kindia-blue"
              />
              <span className="text-xs font-bold text-slate-800">
                Signature Électronique Requise par le Destinataire
              </span>
            </label>
            <p className="text-[11px] text-slate-500 pl-6.5">
              Après approbation et signature du destinataire, le courrier vous sera <span className="font-semibold text-kindia-blue">automatiquement retourné</span> signé et scellé.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Transmission en cours...' : 'Transmettre le Courrier'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

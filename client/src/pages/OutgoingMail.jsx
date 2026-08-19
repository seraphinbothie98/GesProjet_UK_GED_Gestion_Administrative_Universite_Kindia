import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import { Send, Plus, Eye, X, FileText } from 'lucide-react';

export default function OutgoingMail({ onSelectDocument }) {
  const { hasPermission } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSoitTransmisModal, setShowSoitTransmisModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [contentBody, setContentBody] = useState('');
  const [priority, setPriority] = useState('NORMAL');

  // Soit-Transmis States
  const [stRecipientName, setStRecipientName] = useState('');
  const [stRecipientAddress, setStRecipientAddress] = useState('');
  const [stObjectTitle, setStObjectTitle] = useState('');
  const [stContentBody, setStContentBody] = useState('');
  const [stPiecesJointes, setStPiecesJointes] = useState('');
  const [stShowPreview, setStShowPreview] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const docs = await api.getDocuments({ type: 'OUTGOING_MAIL' });
      setDocuments(docs);
    } catch (err) {
      console.error('Error loading outgoing mail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSoitTransmisSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!stRecipientName || !stObjectTitle || !stContentBody) {
      setError('Veuillez remplir les informations obligatoires du Soit-Transmis.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('recipient_name', stRecipientName);
      formData.append('recipient_address', stRecipientAddress);
      formData.append('object_title', stObjectTitle);
      formData.append('content_body', stContentBody);
      formData.append('pieces_jointes', stPiecesJointes);

      await api.createSoitTransmis(formData);
      setShowSoitTransmisModal(false);
      setStRecipientName('');
      setStRecipientAddress('');
      setStObjectTitle('');
      setStContentBody('');
      setStPiecesJointes('');
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du Soit-Transmis.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title || !recipientName) {
      setError('Veuillez renseigner le titre et le destinataire.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('recipient_name', recipientName);
      formData.append('recipient_address', recipientAddress);
      formData.append('content_body', contentBody);
      formData.append('priority', priority);

      await api.createOutgoingMail(formData);
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du courrier sortant.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setRecipientName('');
    setRecipientAddress('');
    setContentBody('');
    setPriority('NORMAL');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-800">Module Courriers Sortants</h2>
            <p className="text-xs text-slate-500">Rédaction, Validation, Expédition & Archiving</p>
          </div>
        </div>

        {hasPermission('outgoing_mail.create') && (
          <div className="flex items-center space-x-2 mt-3 sm:mt-0">
            <button
              onClick={() => setShowSoitTransmisModal(true)}
              className="bg-kindia-gold hover:bg-yellow-400 text-kindia-blue text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
            >
              <Send className="w-4 h-4 text-kindia-blue" />
              <span>➕ CRÉER UN SOIT-TRANSMIS</span>
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
            >
              <Plus className="w-4 h-4 text-kindia-gold" />
              <span>Rédiger un Courrier Sortant</span>
            </button>
          </div>
        )}
      </div>

      {/* Documents Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full">
        {/* Mobile Cards Feed (block sm:hidden) */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-6 text-center text-xs text-slate-400">Chargement...</div>
          ) : documents.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Aucun courrier sortant enregistré.</div>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="p-4 space-y-2 hover:bg-slate-50/80 transition">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-black text-kindia-blue bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {doc.reference}
                  </span>
                  <StatusBadge status={doc.status} />
                </div>

                <div>
                  <h4 className="font-heading font-extrabold text-xs text-slate-800 line-clamp-2">{doc.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    <strong>Destinataire :</strong> {doc.sender_name || 'Destinataire externe'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    <strong>Service Émetteur :</strong> {doc.current_service_name}
                  </p>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 font-bold">
                  <PriorityBadge priority={doc.priority} />
                  <span>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onSelectDocument(doc.id)}
                    className="w-full py-2 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-kindia-blue" />
                    <span>Consulter le courrier sortant</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Référence</th>
                <th className="p-3.5">Titre / Objet</th>
                <th className="p-3.5">Destinataire Externe</th>
                <th className="p-3.5">Service Émetteur</th>
                <th className="p-3.5">Priorité</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Chargement...</td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Aucun courrier sortant enregistré.</td>
                </tr>
              ) : (
                documents.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-bold text-kindia-blue">{doc.reference}</td>
                    <td className="p-3.5 text-slate-800 font-semibold max-w-xs truncate">{doc.title}</td>
                    <td className="p-3.5 text-slate-700">{doc.sender_name}</td>
                    <td className="p-3.5 text-slate-700">{doc.current_service_name}</td>
                    <td className="p-3.5"><PriorityBadge priority={doc.priority} /></td>
                    <td className="p-3.5"><StatusBadge status={doc.status} /></td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onSelectDocument(doc.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 font-bold rounded-lg transition inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Consulter</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar border border-slate-200">
            <div className="bg-kindia-blue p-4 text-white flex justify-between items-center sticky top-0 z-10">
              <h3 className="font-heading font-bold text-sm">Rédaction d'un Courrier Sortant</h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Titre / Objet du courrier sortant *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Réponse à la demande d'habilitation d'un laboratoire"
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Destinataire Externe *</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Ex: Direction Nationale de la Recherche"
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Adresse / Ville du destinataire</label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="Conakry, BP 114"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Corps du courrier / Résumé</label>
                <textarea
                  rows={4}
                  value={contentBody}
                  onChange={(e) => setContentBody(e.target.value)}
                  placeholder="Rédigez ici le contenu officiel du courrier..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow transition">
                  {submitting ? 'Création...' : 'Générer Réf CS & Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SOIT-TRANSMIS MODAL (Rules 6 to 9) */}
      {showSoitTransmisModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-kindia-gold text-kindia-blue flex items-center justify-center font-bold text-sm">
                  📨
                </div>
                <h3 className="font-heading font-extrabold text-sm text-slate-800">
                  Créer un Soit-Transmis Officiel (UK-GED)
                </h3>
              </div>
              <button onClick={() => setShowSoitTransmisModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">×</button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-800 text-xs font-bold rounded-xl border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSoitTransmisSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Destinataire Officiel *</label>
                  <input
                    type="text"
                    value={stRecipientName}
                    onChange={(e) => setStRecipientName(e.target.value)}
                    placeholder="Ex: Ministère de l'Enseignement Supérieur..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-kindia-blue"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Adresse / Service Destinataire</label>
                  <input
                    type="text"
                    value={stRecipientAddress}
                    onChange={(e) => setStRecipientAddress(e.target.value)}
                    placeholder="Ex: Conakry, Guinée"
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Objet de la Transmission *</label>
                <input
                  type="text"
                  value={stObjectTitle}
                  onChange={(e) => setStObjectTitle(e.target.value)}
                  placeholder="Ex: Transmission de dossiers administratifs et procès-verbaux"
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contenu / Description des documents *</label>
                <textarea
                  rows={3}
                  value={stContentBody}
                  onChange={(e) => setStContentBody(e.target.value)}
                  placeholder="Ex: J'ai l'honneur de vous transmettre ci-joint les procès-verbaux de la session du Conseil..."
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Liste / Nombre des pièces jointes</label>
                <input
                  type="text"
                  value={stPiecesJointes}
                  onChange={(e) => setStPiecesJointes(e.target.value)}
                  placeholder="Ex: 03 Dossiers originaux sous pli fermé"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              {/* Live Preview Toggle Button (Rule 9) */}
              <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStShowPreview(!stShowPreview)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center space-x-1.5 border border-slate-300"
                >
                  <Eye className="w-4 h-4 text-kindia-blue" />
                  <span>{stShowPreview ? 'Masquer la prévisualisation' : '👁 PRÉVISUALISER'}</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button type="button" onClick={() => setShowSoitTransmisModal(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl">
                    Annuler
                  </button>
                  <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-kindia-gold text-kindia-blue font-bold rounded-xl shadow hover:bg-yellow-400 transition">
                    {submitting ? 'Génération...' : 'VALIDER ET SOUMETTRE AU SG'}
                  </button>
                </div>
              </div>

              {/* LIVE PREVIEW BOX (Rule 9) */}
              {stShowPreview && (
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-300 space-y-4 text-xs text-slate-800 shadow-inner">
                  <div className="text-center font-bold text-kindia-blue uppercase">
                    RÉPUBLIQUE DE GUINÉE • UNIVERSITÉ DE KINDIA
                    <div className="text-[10px] text-slate-500 font-normal">SECRÉTARIAT GÉNÉRAL</div>
                  </div>
                  <div className="bg-kindia-blue text-white p-2 text-center rounded-lg font-bold">SOIT-TRANSMIS</div>
                  <div><strong>N° Réf :</strong> UK/SC/ST/2026/0000XX (Automatique)</div>
                  <div><strong>À :</strong> {stRecipientName || '[Destinataire]'}</div>
                  <div><strong>Objet :</strong> {stObjectTitle || '[Objet]'}</div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 italic text-slate-600">
                    {stContentBody || '[Contenu du Soit-Transmis]'}
                  </div>
                  <div><strong>Pièces jointes :</strong> {stPiecesJointes || 'Néant'}</div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

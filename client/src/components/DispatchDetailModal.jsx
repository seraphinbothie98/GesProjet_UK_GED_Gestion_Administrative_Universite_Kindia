import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  X, FileText, CheckCircle, Clock, AlertCircle, Bell, 
  Download, Users, ArrowRight, ShieldCheck, RefreshCw, Eye
} from 'lucide-react';
import AttachmentPreviewModal from './AttachmentPreviewModal';

export default function DispatchDetailModal({ dispatchId, onClose, onUpdated }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reminding, setReminding] = useState(false);
  const [message, setMessage] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState(null);

  useEffect(() => {
    if (dispatchId) loadDetail();
  }, [dispatchId]);

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDispatchDetail(dispatchId);
      setDetail(data);
    } catch (err) {
      console.error('Failed to load dispatch detail:', err);
      setError('Impossible de charger les informations de cette diffusion.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async () => {
    setReminding(true);
    setMessage('');
    setError('');
    try {
      const res = await api.remindDispatch(dispatchId);
      setMessage(res.message);
      loadDetail();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Erreur lors de l’envoi des rappels');
    } finally {
      setReminding(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      await api.downloadDispatchReportPdf(dispatchId);
    } catch (err) {
      alert(err.message || 'Erreur téléchargement rapport');
    }
  };

  if (!dispatchId) return null;

  const dispatch = detail?.dispatch;
  const recipients = detail?.recipients || [];
  const logs = detail?.logs || [];

  const totalCount = recipients.length;
  const ackCount = recipients.filter(r => r.status === 'PRISE_DE_CONNAISSANCE' || r.acknowledged_at).length;
  const compCount = recipients.filter(r => r.status === 'ACTION_TERMINEE' || r.action_completed_at).length;
  const viewedCount = recipients.filter(r => r.status !== 'NON_CONSULTE').length;
  const lateCount = recipients.filter(r => {
    const isLate = dispatch?.deadline && new Date() > new Date(dispatch.deadline) && r.status !== 'PRISE_DE_CONNAISSANCE' && r.status !== 'ACTION_TERMINEE';
    return Boolean(isLate);
  }).length;

  const ackPercentage = totalCount > 0 ? Math.round((ackCount / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-kindia-blue text-kindia-gold font-extrabold flex items-center justify-center text-lg border border-kindia-gold/30">
              📊
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-kindia-gold bg-kindia-gold/10 px-2 py-0.5 rounded">
                  {dispatch?.reference || 'DSP-UK...'}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {dispatch?.dispatch_type?.replace(/_/g, ' ')}
                </span>
              </div>
              <h2 className="font-heading font-extrabold text-sm text-white mt-1">
                {dispatch?.title || 'Détail de la Diffusion Administrative'}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border border-slate-700"
              title="Télécharger le rapport d'émargement officiel"
            >
              <Download className="w-3.5 h-3.5 text-kindia-gold" />
              <span>Rapport PDF</span>
            </button>

            <button
              onClick={handleSendReminder}
              disabled={reminding || loading}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
              title="Envoyer une notification de rappel aux services en attente"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{reminding ? 'Envoi...' : 'Relancer'}</span>
            </button>

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FEEDBACK MESSAGES */}
        {message && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-6 py-2 flex items-center space-x-2 flex-shrink-0">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="bg-red-600 text-white text-xs font-bold px-6 py-2 flex items-center space-x-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-kindia-blue animate-spin" />
            <p className="text-xs text-slate-500 font-bold">Chargement des données de diffusion...</p>
          </div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
            
            {/* KPI METRICS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Destinataires</span>
                <span className="text-xl font-heading font-extrabold text-slate-800">{totalCount} Services</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{viewedCount} ont ouvert le doc</span>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Émargement / Prise de Connaissance</span>
                <span className="text-xl font-heading font-extrabold text-emerald-800">{ackCount} / {totalCount}</span>
                <div className="w-full bg-emerald-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${ackPercentage}%` }} />
                </div>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Actions Traitées</span>
                <span className="text-xl font-heading font-extrabold text-blue-800">{compCount} Clôturées</span>
                <span className="text-[10px] text-blue-600 block mt-0.5">{totalCount - compCount} en attente</span>
              </div>

              <div className={`p-3.5 rounded-2xl border ${lateCount > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider block">En Retard</span>
                <span className="text-xl font-heading font-extrabold">{lateCount} Services</span>
                <span className="text-[10px] block mt-0.5">
                  {dispatch?.deadline ? `Échéance : ${new Date(dispatch.deadline).toLocaleDateString('fr-FR')}` : 'Sans date limite'}
                </span>
              </div>
            </div>

            {/* DOCUMENT & MESSAGE OVERVIEW */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-2 gap-2">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-kindia-blue flex-shrink-0" />
                  <span className="font-bold text-slate-800">
                    Document Original : [{dispatch?.document_reference}] {dispatch?.document_title}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const docData = await api.getDocumentDetail(dispatch.document_id);
                        const docObj = docData.document || docData;
                        if (docObj.attachments && docObj.attachments.length > 0) {
                          setPreviewAttachment(docObj.attachments[0]);
                        } else {
                          setPreviewAttachment({
                            name: `${docObj.reference} - ${docObj.title}`,
                            file_name: `${docObj.reference}.pdf`,
                            file_path: `/uploads/${docObj.reference}.pdf`
                          });
                        }
                      } catch (err) {
                        alert(err.message || 'Impossible d’ouvrir le document original.');
                      }
                    }}
                    className="px-2.5 py-1 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-[11px] font-bold rounded-lg transition flex items-center space-x-1 shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 text-kindia-gold" />
                    <span>Consulter le Document</span>
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Émis le {new Date(dispatch?.created_at).toLocaleString('fr-FR')} par {dispatch?.sender_service_name}
                  </span>
                </div>
              </div>

              {dispatch?.message && (
                <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-200">
                  « {dispatch.message} »
                </p>
              )}

              {dispatch?.action_description && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                  <span className="font-bold block mb-0.5">⚡ Action demandée aux services :</span>
                  <span>{dispatch.action_description}</span>
                </div>
              )}
            </div>

            {/* RECIPIENTS ATTENDANCE TABLE */}
            <div className="space-y-3">
              <h3 className="font-heading font-extrabold text-xs text-slate-800 flex items-center justify-between">
                <span className="flex items-center">
                  <Users className="w-4 h-4 text-kindia-gold mr-1.5" />
                  Tableau d'Émargement des Services Destinataires
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Mise à jour en temps réel
                </span>
              </h3>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/75 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                        <th className="py-2.5 px-4">Service</th>
                        <th className="py-2.5 px-3">Statut</th>
                        <th className="py-2.5 px-3">Agent / Signataire</th>
                        <th className="py-2.5 px-3">Consultation</th>
                        <th className="py-2.5 px-3">Prise de Connaissance / Action</th>
                        <th className="py-2.5 px-3">Rappels</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recipients.map((r) => {
                        const isLate = dispatch?.deadline && new Date() > new Date(dispatch.deadline) && r.status !== 'PRISE_DE_CONNAISSANCE' && r.status !== 'ACTION_TERMINEE';
                        return (
                          <tr key={r.id} className={`hover:bg-slate-50/80 transition ${isLate ? 'bg-red-50/30' : ''}`}>
                            <td className="py-2.5 px-4 font-bold text-slate-800">
                              <span className="text-[10px] font-mono text-slate-400 mr-1">[{r.service_code}]</span>
                              <span>{r.service_name}</span>
                            </td>

                            <td className="py-2.5 px-3">
                              {r.status === 'PRISE_DE_CONNAISSANCE' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✓ Pris connaissance
                                </span>
                              )}
                              {r.status === 'ACTION_TERMINEE' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  ✓ Action terminée
                                </span>
                              )}
                              {r.status === 'ACTION_EN_COURS' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                  ⚡ En cours
                                </span>
                              )}
                              {r.status === 'CONSULTE' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                  👁️ Consulté
                                </span>
                              )}
                              {r.status === 'NON_CONSULTE' && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isLate ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-slate-100 text-slate-600'}`}>
                                  {isLate ? '⚠️ En retard' : '⏳ Non consulté'}
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-slate-700 font-medium">
                              {r.acknowledged_by_name || r.action_completed_by_name || r.viewed_by_name || '—'}
                            </td>

                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                              {r.first_viewed_at ? new Date(r.first_viewed_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </td>

                            <td className="py-2.5 px-3 text-slate-700">
                              {r.acknowledged_at && (
                                <div className="text-[11px] font-mono text-emerald-700 font-bold">
                                  {new Date(r.acknowledged_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                              )}
                              {r.action_completed_at && (
                                <div className="text-[11px] font-mono text-blue-700 font-bold">
                                  {new Date(r.action_completed_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                              )}
                              {r.action_response_comment && (
                                <p className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-xs" title={r.action_response_comment}>
                                  « {r.action_response_comment} »
                                </p>
                              )}
                              {!r.acknowledged_at && !r.action_completed_at && <span className="text-slate-400">—</span>}
                            </td>

                            <td className="py-2.5 px-3 text-[11px] font-mono text-slate-500">
                              {r.reminders_sent > 0 ? (
                                <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                                  {r.reminders_sent} rappel(s)
                                </span>
                              ) : (
                                '0'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* AUDIT TIMELINE */}
            {logs.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-heading font-extrabold text-xs text-slate-800 flex items-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 mr-1.5" />
                  Journal de Traçabilité
                </h3>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px]">
                  {logs.map((l) => (
                    <div key={l.id} className="flex items-start space-x-2 text-slate-600">
                      <span className="text-slate-400 flex-shrink-0">
                        [{new Date(l.created_at).toLocaleString('fr-FR')}]
                      </span>
                      <span className="font-bold text-kindia-blue">{l.action} :</span>
                      <span>{l.details} ({l.user_name || 'Système'})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Attachment Preview Modal */}
        {previewAttachment && (
          <AttachmentPreviewModal
            attachment={previewAttachment}
            onClose={() => setPreviewAttachment(null)}
          />
        )}

      </div>
    </div>
  );
}

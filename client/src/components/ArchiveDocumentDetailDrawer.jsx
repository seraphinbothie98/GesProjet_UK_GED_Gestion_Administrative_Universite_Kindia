import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { StatusBadge } from './Badge';
import { 
  X, Download, Printer, Eye, Tag, Share2, Send, Landmark, 
  FileText, Calendar, Building2, UserCheck, ShieldCheck, 
  Paperclip, Clock, ArrowRight, CheckCircle2, Lock, ExternalLink
} from 'lucide-react';

export default function ArchiveDocumentDetailDrawer({ 
  documentId, 
  isOpen, 
  onClose, 
  onClassify,
  onShare,
  onDiffuse,
  onTransmitSC,
  isSC = false
}) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'ocr' | 'history' | 'attachments'

  useEffect(() => {
    if (isOpen && documentId) {
      loadDoc();
    }
  }, [isOpen, documentId]);

  const loadDoc = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getDocument(documentId);
      setDoc(data);
    } catch (err) {
      console.error('Error loading archived document detail:', err);
      setError('Erreur lors du chargement des détails du document.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!doc) return;
    const token = localStorage.getItem('uk_ged_token');
    const url = `http://127.0.0.1:5000/api/documents/${doc.id}/download`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-3xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-kindia-blue to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-kindia-gold font-black border border-white/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-black text-kindia-gold">
                  {doc?.reference || 'Document'}
                </span>
                <StatusBadge status={doc?.status || 'ARCHIVED'} />
              </div>
              <h3 className="font-heading font-extrabold text-sm text-white truncate max-w-md mt-0.5">
                {doc?.title || 'Chargement...'}
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
              title="Télécharger l'acte"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
              title="Imprimer"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-xl transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 flex space-x-4 shrink-0">
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'preview'
                ? 'border-kindia-blue text-kindia-blue'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Contenu & Métadonnées</span>
          </button>
          <button
            onClick={() => setActiveTab('attachments')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'attachments'
                ? 'border-kindia-blue text-kindia-blue'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Pièces jointes ({doc?.attachments?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'ocr'
                ? 'border-kindia-blue text-kindia-blue'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Texte & OCR</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'history'
                ? 'border-kindia-blue text-kindia-blue'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Trajectoire & Historique</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {loading ? (
            <div className="p-16 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-xs text-slate-500 font-medium">Chargement du document archivé...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl text-rose-800 text-xs font-semibold">
              {error}
            </div>
          ) : doc && (
            <>
              {activeTab === 'preview' && (
                <div className="space-y-5">
                  {/* Metadata Grid Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Type d'acte</span>
                      <span className="font-bold text-slate-800">{doc.document_type || 'Non spécifié'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Catégorie</span>
                      <span className="font-bold text-kindia-blue">{doc.archive_category || doc.document_type || 'Standard'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Portée d'archive</span>
                      <span className="font-bold text-slate-800">{doc.archive_scope || 'PRIVE_SERVICE'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Service Émetteur</span>
                      <span className="font-semibold text-slate-800">{doc.originating_service?.name || doc.sender_name || 'Université'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Auteur</span>
                      <span className="font-semibold text-slate-800">
                        {doc.creator ? `${doc.creator.first_name} ${doc.creator.last_name}` : 'Agent UK'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Date d'archivage</span>
                      <span className="font-semibold text-slate-800">
                        {new Date(doc.archived_at || doc.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>

                  {/* Document Body View */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="border-b pb-3 flex items-center justify-between">
                      <h4 className="font-heading font-extrabold text-sm text-slate-900">
                        Objet : {doc.object_title || doc.title}
                      </h4>
                    </div>

                    {doc.file_path ? (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-3">
                        <FileText className="w-8 h-8 text-kindia-blue mx-auto" />
                        <p className="text-xs text-slate-600 font-medium">Document PDF ou fichier numérisé rattaché à cet acte.</p>
                        <button
                          onClick={handleDownload}
                          className="px-4 py-2 bg-kindia-blue text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition inline-flex items-center space-x-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Ouvrir / Télécharger le fichier</span>
                        </button>
                      </div>
                    ) : doc.content_body ? (
                      <div 
                        className="prose prose-sm max-w-none text-xs text-slate-800 leading-relaxed whitespace-pre-wrap bg-slate-50/50 p-4 rounded-xl border border-slate-100 font-sans"
                        dangerouslySetInnerHTML={{ __html: doc.content_body }}
                      />
                    ) : (
                      <p className="text-xs text-slate-400 italic">Aucun texte de rédaction saisi pour cet acte.</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'attachments' && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="font-heading font-extrabold text-sm text-slate-900">
                    Pièces jointes & Documents annexes ({doc.attachments?.length || 0})
                  </h4>

                  {(!doc.attachments || doc.attachments.length === 0) ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Aucune pièce jointe supplémentaire associée à cet acte.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {doc.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            <Paperclip className="w-4 h-4 text-kindia-blue" />
                            <div>
                              <span className="font-bold text-xs text-slate-800 block truncate max-w-md">
                                {att.file_name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {att.file_size ? `${Math.round(att.file_size / 1024)} KB` : ''} • {att.mime_type || 'Fichier'}
                              </span>
                            </div>
                          </div>
                          <a
                            href={`http://127.0.0.1:5000/uploads/${encodeURIComponent(att.file_name)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>Télécharger</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h4 className="font-heading font-extrabold text-sm text-slate-900">
                    Trajectoire et Journal d'Événements
                  </h4>
                  <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {doc.history?.map((h, i) => (
                      <div key={i} className="flex items-start space-x-3 relative">
                        <div className="w-7 h-7 rounded-full bg-kindia-blue text-white flex items-center justify-center text-xs font-bold shrink-0 z-10">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{h.action}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(h.timestamp).toLocaleString('fr-FR')}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-1">{h.details}</p>
                          <span className="text-[10px] text-slate-400 font-medium block mt-1">
                            Par : {h.first_name} {h.last_name} ({h.service_name})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'ocr' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-kindia-blue" />
                        <span className="font-heading font-extrabold text-sm text-slate-800">
                          Texte Détecté & Indexation Plein Texte
                        </span>
                      </div>
                      {doc.ocr_text && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Indexé pour recherche
                        </span>
                      )}
                    </div>
                    {doc.ocr_text || doc.content_body || doc.description ? (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto select-text">
                        {doc.ocr_text || doc.content_body || doc.description}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic text-xs py-6 text-center">
                        Aucun texte OCR extrait pour ce document.
                      </p>
                    )}
                    {doc.keywords && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">Mots-clés associés :</span>
                        <div className="flex flex-wrap gap-1">
                          {doc.keywords.split(',').map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold">
                              #{kw.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            {onDiffuse && (
              <button
                type="button"
                onClick={() => onDiffuse(doc)}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>📤 Diffuser</span>
              </button>
            )}

            {onClassify && (
              <button
                type="button"
                onClick={() => onClassify(doc)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Classer / Déplacer</span>
              </button>
            )}

            {onShare && (
              <button
                type="button"
                onClick={() => onShare(doc)}
                className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Partager</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}

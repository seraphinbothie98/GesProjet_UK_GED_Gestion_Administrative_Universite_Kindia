import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { 
  X, Save, FileText, CheckCircle, AlertCircle, Copy, 
  RefreshCw, Loader2, ArrowLeft, Download, Eye, Sparkles, Plus, 
  Layers, ShieldCheck, Check, Star, Settings, FileCheck, Edit3
} from 'lucide-react';

export default function OnlyOfficeTemplateEditorModal({ 
  isOpen, 
  onClose, 
  template, 
  version = null, 
  onSaved,
  onFallbackToVisualEditor
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionConfig, setSessionConfig] = useState(null);
  const [isDegraded, setIsDegraded] = useState(false);
  const [showTagsPanel, setShowTagsPanel] = useState(true);
  const [saveAsNewVer, setSaveAsNewVer] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [copiedTag, setCopiedTag] = useState(null);

  const editorRef = useRef(null);
  const readyTimeoutRef = useRef(null);
  const templateId = template?.id;
  const versionNum = version?.version_number || version?.version || template?.version || 1;
  const versionId = version?.id || version?.version_number || 'current';
  const containerIdRef = useRef(`onlyoffice_tpl_editor_${templateId || 'tpl'}_${Date.now()}`);
  const containerId = containerIdRef.current;

  // Universal dynamic tags usable in ANY administrative document
  const universalDynamicTags = [
    { key: '{{REFERENCE}}', label: 'Numéro de référence officiel (ex: 2026/0045/UK)' },
    { key: '{{DATE}}', label: 'Date du jour au format officiel (ex: 24 août 2026)' },
    { key: '{{ANNEE}}', label: 'Année courante (ex: 2026)' },
    { key: '{{SERVICE}}', label: 'Nom complet du service émetteur' },
    { key: '{{OBJET}}', label: 'Objet officiel du document' },
    { key: '{{DESTINATAIRE}}', label: 'Destinataire officiel du document' },
    { key: '{{SIGNATAIRE}}', label: 'Nom complet de l’autorité signataire' },
    { key: '{{FONCTION_SIGNATAIRE}}', label: 'Titre / Fonction de l’autorité signataire' },
    { key: '{{SIGNATURE}}', label: 'Emplacement de la signature électronique' },
    { key: '{{QR_CODE}}', label: 'Sceau QR Code de vérification d’authenticité' },
    { key: '{{FACULTE}}', label: 'Faculté de rattachement' },
    { key: '{{DEPARTEMENT}}', label: 'Département académique' },
    { key: '{{VILLE}}', label: 'Ville institutionnelle (Kindia)' }
  ];

  useEffect(() => {
    if (isOpen && templateId) {
      loadOnlyofficeSession();
    }
    return () => {
      destroyEditor();
    };
  }, [isOpen, templateId, versionId]);

  const loadOnlyofficeSession = async () => {
    setLoading(true);
    setError('');
    setIsDegraded(false);
    setSaveSuccess('');

    try {
      const data = await api.getTemplateOnlyofficeConfig(templateId, versionId, 'edit');
      setSessionConfig(data);

      const scriptUrl = `${data.docServerUrl}/web-apps/apps/api/documents/api.js`;
      await loadScript(scriptUrl);
      initializeEditor(data.config);
    } catch (err) {
      console.error('Failed to initialize ONLYOFFICE template session:', err);
      setError(err.message || 'Impossible de joindre ONLYOFFICE Document Server.');
      setIsDegraded(true);
      setLoading(false);
    }
  };

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (window.DocsAPI && window.DocsAPI.DocEditor) {
        return resolve();
      }

      const scriptTimer = setTimeout(() => {
        reject(new Error('Délai de connexion dépassé lors du chargement de DocsAPI ONLYOFFICE.'));
      }, 7000);

      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        existingScript.onload = () => {
          clearTimeout(scriptTimer);
          resolve();
        };
        existingScript.onerror = () => {
          clearTimeout(scriptTimer);
          reject(new Error('Serveur ONLYOFFICE inaccessible (Erreur de chargement du script DocsAPI)'));
        };
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        clearTimeout(scriptTimer);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(scriptTimer);
        reject(new Error('Serveur ONLYOFFICE inaccessible (Vérifiez la connexion ou le service Docker)'));
      };
      document.body.appendChild(script);
    });
  };

  const initializeEditor = (config) => {
    try {
      destroyEditor();

      if (!window.DocsAPI || !window.DocsAPI.DocEditor) {
        throw new Error('L’API DocsAPI ONLYOFFICE n’est pas disponible.');
      }

      // 8-second watchdog timer in case iframe / websocket fails to connect
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = setTimeout(() => {
        console.warn('ONLYOFFICE onAppReady timed out after 8s');
        setLoading(false);
        setIsDegraded(true);
        setError('Impossible de connecter l’éditeur ONLYOFFICE Document Server. Vérifiez la connexion ou le conteneur Docker.');
      }, 8000);

      const editorConfig = {
        ...config,
        events: {
          onAppReady: () => {
            if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
            setLoading(false);
            setIsDegraded(false);
          },
          onDocumentStateChange: (event) => {
            // Document modified
          },
          onSave: () => {
            setSaveSuccess('Modifications enregistrées automatiquement dans UK-GED.');
            if (onSaved) onSaved();
          },
          onError: (event) => {
            console.error('ONLYOFFICE Editor error event:', event);
            if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
            setLoading(false);
            setIsDegraded(true);
            setError(event?.data?.errorDescription || 'Erreur signalée par l’éditeur ONLYOFFICE.');
          }
        }
      };

      editorRef.current = new window.DocsAPI.DocEditor(containerId, editorConfig);
    } catch (e) {
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
      console.error('Failed to instantiate DocsAPI.DocEditor for template:', e);
      setIsDegraded(true);
      setLoading(false);
      setError(e.message || 'Erreur lors de l’initialisation du composant ONLYOFFICE.');
    }
  };

  const destroyEditor = () => {
    if (readyTimeoutRef.current) {
      clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
    if (editorRef.current && typeof editorRef.current.destroyEditor === 'function') {
      try {
        editorRef.current.destroyEditor();
      } catch (e) {
        console.warn('Error destroying ONLYOFFICE editor:', e);
      }
      editorRef.current = null;
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    setSaveSuccess('');
    setError('');

    try {
      const res = await api.manualSaveTemplateOnlyoffice(templateId, {
        save_as_new_version: saveAsNewVer,
        change_description: changeDescription || `Mise à jour du modèle ${template.name}`
      });

      setSaveSuccess(res.message || 'Modèle enregistré avec succès.');
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde du modèle.');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (tag) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden border border-slate-700/40">
        
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-slate-950 via-kindia-blue to-slate-900 text-white px-6 py-3.5 flex items-center justify-between shadow-lg shrink-0">
          <div className="flex items-center space-x-3 truncate">
            <div className="w-9 h-9 rounded-xl bg-kindia-gold/20 border border-kindia-gold/40 flex items-center justify-center shrink-0 shadow">
              <FileCheck className="w-5 h-5 text-kindia-gold" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h3 className="font-heading font-extrabold text-sm text-white truncate">
                  Personnalisation Word (ONLYOFFICE) — {template?.name || 'Modèle Officiel'}
                </h3>
                <span className="bg-kindia-gold text-kindia-blue text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  v{versionNum}
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                  {template?.format || 'DOCX'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                Code : <span className="font-mono text-kindia-gold">{template?.code}</span> • Type : <span className="font-bold">{template?.document_type_code || template?.code}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowTagsPanel(!showTagsPanel)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                showTagsPanel ? 'bg-kindia-gold text-kindia-blue border-kindia-gold' : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title="Afficher/Masquer les balises dynamiques"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Balises dynamiques</span>
            </button>

            <button
              onClick={() => api.downloadTemplateDocx(template.id)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 border border-white/20"
              title="Télécharger le fichier Word (.docx)"
            >
              <Download className="w-3.5 h-3.5 text-kindia-gold" />
              <span className="hidden sm:inline">DOCX</span>
            </button>

            <button
              onClick={handleManualSave}
              disabled={saving}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? 'Sauvegarde...' : 'Enregistrer'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition ml-2"
              title="Fermer l'éditeur"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status & Alerts Bar */}
        {(error || saveSuccess) && (
          <div className={`px-6 py-2 text-xs flex items-center justify-between border-b ${
            error ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            <div className="flex items-center space-x-2">
              {error ? <AlertCircle className="w-4 h-4 text-red-600 shrink-0" /> : <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
              <span className="font-semibold">{error || saveSuccess}</span>
            </div>
            {error && onFallbackToVisualEditor && (
              <button
                onClick={onFallbackToVisualEditor}
                className="px-3 py-1 bg-kindia-blue text-white rounded-lg text-[11px] font-bold hover:bg-kindia-lightBlue transition"
              >
                Ouvrir dans l'éditeur visuel de secours
              </button>
            )}
          </div>
        )}

        {/* Main Body */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* ONLYOFFICE Document Canvas */}
          <div className="flex-1 bg-slate-100 flex flex-col relative overflow-hidden">
            {loading && (
              <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <div className="animate-spin w-12 h-12 border-4 border-kindia-blue border-t-kindia-gold rounded-full mb-3"></div>
                <h4 className="font-heading font-extrabold text-slate-800 text-sm">
                  Initialisation de la session ONLYOFFICE Document Server...
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Chargement haute fidélité du fichier Word officiel de l’Université de Kindia.
                </p>
              </div>
            )}

            {isDegraded && (
              <div className="m-6 p-8 bg-white rounded-3xl border border-amber-200 shadow-xl max-w-lg mx-auto text-center space-y-4">
                <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-heading font-extrabold text-slate-800 text-base">
                    ONLYOFFICE Document Server temporairement indisponible
                  </h4>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Le serveur de documents ONLYOFFICE ne répond pas ou est en cours de démarrage. Vous pouvez utiliser l'éditeur intégré de UK-GED pour modifier ce modèle sans interruption.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={loadOnlyofficeSession}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                    <span>Réessayer ONLYOFFICE</span>
                  </button>
                  {onFallbackToVisualEditor && (
                    <button
                      onClick={onFallbackToVisualEditor}
                      className="px-5 py-2.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow transition"
                    >
                      <Edit3 className="w-4 h-4 text-kindia-gold" />
                      <span>Éditeur visuel UK-GED</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div 
              id={containerId} 
              className="w-full h-full flex-1" 
              style={{ minHeight: '400px' }}
            />
          </div>

          {/* Right Sidebar: Dynamic Variables & Versioning Options */}
          {showTagsPanel && (
            <div className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col h-full shadow-inner shrink-0 text-xs">
              
              {/* Header */}
              <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-kindia-gold" />
                  <span className="font-heading font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                    Balises & Versioning
                  </span>
                </div>
                <button
                  onClick={() => setShowTagsPanel(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Versioning options card */}
              <div className="p-4 bg-amber-50/70 border-b border-amber-200/80 space-y-2.5">
                <span className="font-bold text-amber-950 text-[11px] uppercase tracking-wider block">
                  ⚙️ Options d'enregistrement
                </span>
                
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsNewVer}
                    onChange={(e) => setSaveAsNewVer(e.target.checked)}
                    className="w-4 h-4 rounded text-kindia-blue focus:ring-kindia-blue mt-0.5"
                  />
                  <div className="text-[11px]">
                    <span className="font-bold text-slate-800 block">Créer une nouvelle version (v{versionNum + 1})</span>
                    <span className="text-slate-500 text-[10px]">Conserve la version v{versionNum} dans l'historique officiel</span>
                  </div>
                </label>

                {saveAsNewVer && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Description des modifications :
                    </label>
                    <input
                      type="text"
                      value={changeDescription}
                      onChange={(e) => setChangeDescription(e.target.value)}
                      placeholder="Ex: Mise à jour du pavé de signature..."
                      className="w-full p-2 bg-white rounded-lg border border-amber-300 text-xs focus:ring-2 focus:ring-kindia-blue"
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Tags Directory */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                <div className="mb-2">
                  <span className="font-bold text-slate-700 text-xs block">Balises Administratives Universelles</span>
                  <span className="text-[10px] text-slate-500">
                    Cliquez sur une balise pour la copier, puis collez-la directement dans le document Word.
                  </span>
                </div>

                <div className="space-y-1.5">
                  {universalDynamicTags.map((tag) => {
                    const isCopied = copiedTag === tag.key;
                    return (
                      <div
                        key={tag.key}
                        onClick={() => copyToClipboard(tag.key)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                          isCopied ? 'bg-emerald-50 border-emerald-300' : 'bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-300'
                        }`}
                        title="Cliquez pour copier la balise"
                      >
                        <div className="truncate mr-2">
                          <span className="font-mono font-bold text-kindia-blue text-[11px] block group-hover:text-blue-700 truncate">
                            {tag.key}
                          </span>
                          <span className="text-[10px] text-slate-500 line-clamp-1">
                            {tag.label}
                          </span>
                        </div>

                        <div className="shrink-0">
                          {isCopied ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center space-x-1">
                              <Check className="w-2.5 h-2.5" />
                              <span>Copié</span>
                            </span>
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-kindia-blue" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer info */}
              <div className="p-3 bg-white border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
                <span>UK-GED • ONLYOFFICE Engine</span>
                <span className="font-bold text-kindia-gold">Université de Kindia</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

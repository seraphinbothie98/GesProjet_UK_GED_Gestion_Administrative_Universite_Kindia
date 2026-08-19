import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  Search, Camera, CheckCircle2, XCircle, Clock, AlertTriangle, 
  Building2, Calendar, FileText, ArrowRight, ShieldCheck, RefreshCw, Upload, Lock
} from 'lucide-react';

export default function DocumentTracking({ initialRef = '', onBackToLogin }) {
  const [referenceInput, setReferenceInput] = useState(initialRef);
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannerMsg, setScannerMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialRef) {
      handleSearch(initialRef);
    }
  }, [initialRef]);

  const handleSearch = async (refToSearch = referenceInput) => {
    const query = (refToSearch || '').trim();
    if (!query) {
      setError('Veuillez saisir l’identifiant unique de votre document.');
      return;
    }

    setLoading(true);
    setError('');
    setTrackingData(null);

    try {
      const data = await api.trackDocument(query);
      setTrackingData(data);
    } catch (err) {
      setError(err.message || 'Document introuvable. Veuillez vérifier l’identifiant.');
    } finally {
      setLoading(false);
    }
  };

  const handleQRScanSubmit = async (qrString) => {
    setLoading(true);
    setError('');
    setTrackingData(null);

    try {
      const data = await api.scanQRCode({ qr_data: qrString });
      setTrackingData(data);
      setReferenceInput(data.reference);
      setShowScanner(false);
    } catch (err) {
      setError(err.message || 'QR Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  // Simulates scanning QR code from webcam or image file upload fallback
  const handleFileUploadScan = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScannerMsg('Lecture du QR Code en cours...');
    // Simulated fast parsing of QR code metadata from file/image name or text
    setTimeout(() => {
      const simulatedRef = file.name.includes('OM') ? 'OM/UK/SG/2026/000001' : 'UK/SC/CE/2026/000245';
      setScannerMsg(`QR Code détecté : Référence ${simulatedRef}`);
      handleQRScanSubmit(simulatedRef);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Institutional Top Navigation Header */}
      <header className="bg-kindia-blue text-white py-4 px-6 shadow-md border-b-2 border-kindia-gold">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-kindia-gold text-kindia-blue flex items-center justify-center font-black text-lg shadow">
              UK
            </div>
            <div>
              <span className="font-heading font-extrabold text-lg text-white tracking-wide block">
                UK-GED • Université de Kindia
              </span>
              <span className="text-[10px] text-kindia-gold font-bold uppercase tracking-wider block">
                Guichet de Suivi de Document & QR Code
              </span>
            </div>
          </div>

          {onBackToLogin && (
            <button
              onClick={onBackToLogin}
              className="text-xs font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center space-x-2 border border-white/20"
            >
              <span>Espace Agent Logué</span>
              <ArrowRight className="w-4 h-4 text-kindia-gold" />
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Search Header Box */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 text-center space-y-6">
          <div className="max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-kindia-blue/10 text-kindia-blue flex items-center justify-center mx-auto mb-3">
              <Search className="w-7 h-7 text-kindia-blue" />
            </div>
            <h1 className="font-heading font-black text-xl sm:text-2xl text-kindia-blue">
              Suivi de votre document
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Saisissez l'identifiant unique présent sur votre récépissé ou scannez le QR Code pour connaître le niveau d'avancement.
            </p>
          </div>

          {/* Search Controls */}
          <div className="max-w-lg mx-auto space-y-4">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }} 
              className="flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={referenceInput}
                  onChange={(e) => setReferenceInput(e.target.value)}
                  placeholder="Ex : UK/SC/CE/2026/000245 ou OM/UK/SG/2026/000001"
                  className="w-full text-xs font-bold p-3.5 pl-4 rounded-2xl border-2 border-slate-200 focus:border-kindia-blue focus:ring-0 uppercase tracking-wider outline-none text-slate-800 placeholder:normal-case placeholder:font-normal"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 shrink-0 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-kindia-gold" />
                ) : (
                  <>
                    <Search className="w-4 h-4 text-kindia-gold" />
                    <span>SUIVRE</span>
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center space-x-4 pt-2">
              <div className="h-px bg-slate-200 flex-1"></div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">OU</span>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            {/* QR Code Scan Button */}
            <button
              onClick={() => setShowScanner(!showScanner)}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2"
            >
              <Camera className="w-4 h-4 text-kindia-gold" />
              <span>📷 SCANNER LE QR CODE</span>
            </button>
          </div>

          {/* Scanner Modal / Dropzone */}
          {showScanner && (
            <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-kindia-blue/30 max-w-lg mx-auto space-y-4 animate-in fade-in zoom-in-95">
              <div className="text-center">
                <Camera className="w-10 h-10 text-kindia-blue mx-auto mb-2 animate-bounce" />
                <h3 className="font-bold text-xs text-slate-800">Scanner de QR Code Actif</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Pointez la caméra de votre téléphone vers le QR Code ou téléchargez l'image de votre reçu.
                </p>
              </div>

              {scannerMsg && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
                  {scannerMsg}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-kindia-blue text-white text-xs font-bold rounded-xl shadow flex items-center justify-center space-x-2"
                >
                  <Upload className="w-4 h-4 text-kindia-gold" />
                  <span>Charger une photo du QR Code</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUploadScan} 
                  accept="image/*" 
                  className="hidden" 
                />

                <button
                  type="button"
                  onClick={() => handleQRScanSubmit('UK/SC/CE/2026/000245')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow"
                >
                  Détecter automatiquement
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-xs font-semibold rounded-2xl border border-red-200 max-w-lg mx-auto flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Display Tracking Details Result */}
        {trackingData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
            
            {/* Summary Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-kindia-gold uppercase tracking-widest block">
                    Référence Officielle de Suivi
                  </span>
                  <h2 className="font-heading font-black text-2xl text-kindia-blue mt-1">
                    {trackingData.reference}
                  </h2>
                </div>

                <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-slate-900 text-white font-extrabold text-xs shadow-md">
                  <span className="text-base">{trackingData.status_emoji}</span>
                  <span>{trackingData.status_label}</span>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">Type de Document</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{trackingData.document_type_label}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">Date de Dépôt</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{trackingData.deposit_date}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">Niveau Actuel</span>
                  <span className="font-extrabold text-kindia-blue block mt-0.5">{trackingData.current_level}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">Dernière Mise à Jour</span>
                  <span className="font-bold text-slate-700 block mt-0.5">{trackingData.last_update}</span>
                </div>
              </div>

              {/* Objet / Title */}
              <div className="p-4 bg-kindia-blue/5 rounded-2xl border border-kindia-blue/10">
                <span className="text-[10px] font-bold text-kindia-blue uppercase tracking-wider block">Objet du Document</span>
                <p className="text-xs font-semibold text-slate-800 mt-1 leading-relaxed">{trackingData.title}</p>
              </div>

              {/* Rejection Notice Banner */}
              {trackingData.is_rejected && (
                <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-xs space-y-1">
                  <div className="flex items-center space-x-2 text-red-700 font-bold">
                    <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <span>DOCUMENT REJETÉ — {trackingData.rejection_info?.date}</span>
                  </div>
                  <p className="text-slate-600 pl-7">{trackingData.rejection_info?.message}</p>
                </div>
              )}
            </div>

            {/* Visual Cheminement Timeline Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
              <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
                <Building2 className="w-6 h-6 text-kindia-blue" />
                <h3 className="font-heading font-extrabold text-base text-slate-800">
                  Cheminement & Progression du Traitement
                </h3>
              </div>

              <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {trackingData.progression.map((step, idx) => (
                  <div key={idx} className="relative flex items-start space-x-4">
                    {/* Circle Indicator */}
                    <div className={`absolute -left-6 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow ${
                      step.is_completed 
                        ? 'bg-emerald-500 text-white' 
                        : step.is_current 
                          ? 'bg-kindia-gold text-kindia-blue ring-4 ring-kindia-gold/20' 
                          : 'bg-slate-200 text-slate-500'
                    }`}>
                      {step.is_completed ? '✓' : idx + 1}
                    </div>

                    <div className="pl-4">
                      <span className={`text-xs font-extrabold block ${step.is_current ? 'text-kindia-blue font-heading text-sm' : step.is_completed ? 'text-slate-800' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Service responsable : <span className="font-semibold text-slate-700">{step.service}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidentiality Footer Banner */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-md flex items-center space-x-3 text-xs">
              <ShieldCheck className="w-6 h-6 text-kindia-gold shrink-0" />
              <p className="text-slate-300 text-[11px]">
                <strong className="text-white">Sécurité & Confidentialité UK-GED :</strong> Ce guichet public affiche exclusivement les informations d'avancement administratives. Les documents PDF internes, pièces jointes et commentaires nominatifs sont protégés.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

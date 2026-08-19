import React, { useState, useRef, useEffect } from 'react';
import { Camera, FileUp, X, Check, Trash2, RotateCw, Layers, Plus, FileText, Image as ImageIcon } from 'lucide-react';

/**
 * Pure JS Helper: Convert array of canvas data URLs (scanned image pages) into a standard multi-page PDF Blob.
 */
function createPDFFromImageDataURLs(imageUrls) {
  return new Promise((resolve) => {
    let pdfPages = [];
    let loaded = 0;

    imageUrls.forEach((url, idx) => {
      const img = new Image();
      img.onload = () => {
        pdfPages[idx] = img;
        loaded++;
        if (loaded === imageUrls.length) {
          const pdfBlob = buildMultiPagePdfBlob(pdfPages);
          resolve(pdfBlob);
        }
      };
      img.src = url;
    });
  });
}

function buildMultiPagePdfBlob(images) {
  let pdfParts = [];
  let xrefs = [];
  let currentOffset = 0;

  function writeString(str) {
    pdfParts.push(str);
    currentOffset += str.length;
  }

  writeString('%PDF-1.4\n');

  // Object 1: Catalog
  xrefs.push(currentOffset);
  writeString('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Page kids string
  let kidsStr = '';
  let pageObjStart = 3;
  for (let i = 0; i < images.length; i++) {
    kidsStr += `${pageObjStart + (i * 3)} 0 R `;
  }

  // Object 2: Pages
  xrefs.push(currentOffset);
  writeString(`2 0 obj\n<< /Type /Pages /Kids [ ${kidsStr}] /Count ${images.length} >>\nendobj\n`);

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const pageObjId = pageObjStart + (i * 3);
    const contentObjId = pageObjId + 1;
    const imageObjId = pageObjId + 2;

    const w = img.width || 595;
    const h = img.height || 842;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64Bytes = atob(jpegDataUrl.split(',')[1]);

    // Object Page
    xrefs.push(currentOffset);
    writeString(`${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents ${contentObjId} 0 R /Resources << /XObject << /Im${i + 1} ${imageObjId} 0 R >> >> >>\nendobj\n`);

    // Content Stream
    const streamContent = `q ${w} 0 0 ${h} 0 0 cm /Im${i + 1} Do Q`;
    xrefs.push(currentOffset);
    writeString(`${contentObjId} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`);

    // Image XObject
    xrefs.push(currentOffset);
    writeString(`${imageObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${base64Bytes.length} >>\nstream\n${base64Bytes}\nendstream\nendobj\n`);
  }

  const startXref = currentOffset;
  writeString(`xref\n0 ${xrefs.length + 1}\n0000000000 65535 f \n`);
  xrefs.forEach(off => {
    const padded = String(off).padStart(10, '0');
    writeString(`${padded} 00000 n \n`);
  });

  writeString(`trailer\n<< /Size ${xrefs.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`);

  const uint8 = new Uint8Array(pdfParts.join('').split('').map(c => c.charCodeAt(0)));
  return new Blob([uint8], { type: 'application/pdf' });
}

export default function DigitizationScannerModal({ onAddFiles, onClose, existingFiles = [] }) {
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' or 'browse'
  const [scannedPages, setScannedPages] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    let stream = null;
    if (activeTab === 'scan' && isCameraActive) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.warn('Direct camera stream unavailable:', err);
          setCameraError("Caméra directe indisponible dans ce navigateur. Utilisez le bouton 'Prendre une photo scan' ci-dessous.");
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeTab, isCameraActive]);

  const startLiveScan = () => {
    setIsCameraActive(true);
    setCameraError(null);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setScannedPages(prev => [...prev, dataUrl]);
  };

  const handleCameraPhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setScannedPages(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleBrowseFiles = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      onAddFiles(files);
    }
  };

  const deleteScannedPage = (index) => {
    setScannedPages(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleCompileAndAttachScan = async () => {
    if (scannedPages.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const pdfBlob = await createPDFFromImageDataURLs(scannedPages);
      const pdfFile = new File([pdfBlob], `Scan_UK_GED_${Date.now()}.pdf`, { type: 'application/pdf' });
      onAddFiles([pdfFile]);
      setScannedPages([]);
      setIsCameraActive(false);
      onClose();
    } catch (err) {
      console.error('Erreur génération PDF numérisé:', err);
      alert('Erreur lors de la génération du document PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-kindia-blue to-kindia-lightBlue p-5 text-white flex justify-between items-center shrink-0">
          <div>
            <span className="text-[10px] font-bold text-kindia-gold uppercase tracking-wider block">NUMÉRISATION & GESTION DES PIÈCES JOINTES</span>
            <h3 className="font-heading font-extrabold text-lg">Ajout de documents et pièces numérisées</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual Options Selector Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('scan'); setIsCameraActive(true); }}
            className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition ${
              activeTab === 'scan'
                ? 'bg-kindia-blue text-white shadow-lg ring-2 ring-kindia-blue/30'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Camera className="w-5 h-5 text-kindia-gold" />
            <span>📷 NUMÉRISER UN DOCUMENT</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('browse'); setIsCameraActive(false); fileInputRef.current?.click(); }}
            className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition ${
              activeTab === 'browse'
                ? 'bg-kindia-blue text-white shadow-lg ring-2 ring-kindia-blue/30'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            <FileUp className="w-5 h-5 text-emerald-400" />
            <span>📁 PARCOURIR / IMPORTER UN FICHIER</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* OPTION A : NUMÉRISER */}
          {activeTab === 'scan' && (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900">
                <p className="font-bold flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-kindia-blue" />
                  <span>Option A — Numérisation directe & assemblage multi-pages</span>
                </p>
                <p className="text-[11px] text-blue-700 mt-1">
                  Placez le document physique devant la caméra pour numériser chaque page. Vous pouvez capturer plusieurs pages qui seront automatiquement assemblées dans un fichier PDF unique.
                </p>
              </div>

              {/* Camera Feed or Capture Controls */}
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-slate-900 text-white flex flex-col items-center justify-center relative min-h-[260px]">
                {isCameraActive && !cameraError ? (
                  <div className="w-full flex flex-col items-center space-y-3">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="max-h-64 w-full object-contain rounded-xl bg-black border border-slate-700" 
                    />
                    <button
                      type="button"
                      onClick={captureFrame}
                      className="bg-kindia-gold hover:bg-yellow-400 text-kindia-blue font-extrabold px-6 py-2.5 rounded-full shadow-lg flex items-center space-x-2 text-xs transition"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capturer la page actuelle</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-6 space-y-4">
                    <Camera className="w-12 h-12 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-300">
                      {cameraError || "Prêt à numériser avec l'appareil photo / scanner."}
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={startLiveScan}
                        className="bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-2"
                      >
                        <RotateCw className="w-4 h-4" />
                        <span>Activer le flux caméra en direct</span>
                      </button>

                      {/* Direct mobile camera snapshot input fallback */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        ref={cameraInputRef}
                        onChange={handleCameraPhotoUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs border border-slate-600 flex items-center space-x-2"
                      >
                        <Camera className="w-4 h-4 text-kindia-gold" />
                        <span>Prendre une photo (Appareil photo)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Scanned Pages Queue & Thumbnails */}
              {scannedPages.length > 0 && (
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs text-slate-800 flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-kindia-blue" />
                      <span>Pages numérisées ({scannedPages.length})</span>
                    </h4>
                    <span className="text-[10px] text-slate-500">Un document PDF unique sera généré</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {scannedPages.map((pageUrl, idx) => (
                      <div key={idx} className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-100 p-1">
                        <img src={pageUrl} alt={`Page ${idx + 1}`} className="h-24 w-full object-cover rounded-lg" />
                        <div className="absolute top-1 left-1 bg-slate-900/80 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                          P.{idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteScannedPage(idx)}
                          className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-90 hover:opacity-100 shadow transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={isGeneratingPdf}
                    onClick={handleCompileAndAttachScan}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-2xl shadow-lg flex items-center justify-center space-x-2 text-xs transition"
                  >
                    {isGeneratingPdf ? (
                      <span>Génération du document PDF en cours...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Générer le PDF numérisé et joindre au dossier ({scannedPages.length} page(s))</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* OPTION B : PARCOURIR / IMPORTER */}
          {activeTab === 'browse' && (
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900">
                <p className="font-bold flex items-center space-x-2">
                  <FileUp className="w-4 h-4 text-emerald-600" />
                  <span>Option B — Importation de fichiers existants depuis l'appareil</span>
                </p>
                <p className="text-[11px] text-emerald-700 mt-1">
                  Sélectionnez des fichiers déjà enregistrés sur votre ordinateur, tablette ou smartphone. Formats acceptés : PDF, JPG/JPEG, PNG.
                </p>
              </div>

              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
                ref={fileInputRef}
                onChange={handleBrowseFiles}
                className="hidden"
              />

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-kindia-blue rounded-2xl p-8 text-center bg-slate-50 hover:bg-blue-50/50 transition cursor-pointer space-y-3"
              >
                <FileUp className="w-12 h-12 text-kindia-blue mx-auto" />
                <h4 className="font-bold text-xs text-slate-700">Cliquez pour parcourir et importer vos fichiers</h4>
                <p className="text-[10px] text-slate-400">PDF, JPG, PNG — Possibilité d'ajouter plusieurs pièces</p>
                <button
                  type="button"
                  className="bg-kindia-blue text-white font-bold text-xs px-5 py-2 rounded-xl shadow inline-flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Sélectionner des fichiers</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}

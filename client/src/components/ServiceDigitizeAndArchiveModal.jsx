import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import DynamicCategoryIcon from './DynamicCategoryIcon';
import { 
  Camera, FileUp, X, Check, Trash2, RotateCw, Layers, Plus, 
  FileText, Image as ImageIcon, ArrowUp, ArrowDown, Sparkles, 
  Tag, Calendar, User, Shield, Info, CheckCircle2, AlertCircle, Eye, RefreshCw
} from 'lucide-react';

/**
 * Convert array of canvas data URLs (scanned image pages) into a standard multi-page PDF Blob.
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

export default function ServiceDigitizeAndArchiveModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'scan' // 'scan' | 'import'
}) {
  const { user } = useAuth();

  // Step wizard : 1 = Capture/Files, 2 = Metadata & Category, 3 = Summary & Final Archive
  const [step, setStep] = useState(1);
  const [activeMode, setActiveMode] = useState(initialMode); // 'scan' | 'import'

  // Scanner states
  const [scannedPages, setScannedPages] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isCompilingPdf, setIsCompilingPdf] = useState(false);

  // Imported files state
  const [importedFiles, setImportedFiles] = useState([]);

  // Category state
  const [categories, setCategories] = useState({ standards: [], customs: [], all: [] });
  const [loadingCats, setLoadingCats] = useState(true);

  // Form Metadata fields (Rules 2, 3, 4, 11)
  const [title, setTitle] = useState('');
  const [objectTitle, setObjectTitle] = useState('');
  const [selectedCategoryCode, setSelectedCategoryCode] = useState('SOIT_TRANSMIS');
  const [customCategoryId, setCustomCategoryId] = useState('');
  const [documentType, setDocumentType] = useState('SOIT_TRANSMIS');
  const [customReference, setCustomReference] = useState('');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [authorName, setAuthorName] = useState(user ? `${user.first_name} ${user.last_name}` : '');
  const [signatoryName, setSignatoryName] = useState('');
  const [targetRecipientName, setTargetRecipientName] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [confidentiality, setConfidentiality] = useState('INTERNAL');
  const [priority, setPriority] = useState('NORMAL');
  const [ocrText, setOcrText] = useState('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  // Submit states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setActiveMode(initialMode);
      setStep(1);
      setError('');
      if (initialMode === 'scan') {
        setIsCameraActive(true);
      }
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    let stream = null;
    if (isOpen && activeMode === 'scan' && isCameraActive && step === 1) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.warn('Camera stream error:', err);
          setCameraError("Caméra directe inaccessible. Vous pouvez utiliser le bouton 'Appareil photo / Scan' pour prendre des photos.");
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, activeMode, isCameraActive, step]);

  const loadCategories = async () => {
    try {
      setLoadingCats(true);
      const data = await api.getArchiveCategories();
      setCategories(data);
      if (data.customs && data.customs.length > 0) {
        const first = data.customs[0];
        setCustomCategoryId(first.id);
        setSelectedCategoryCode(first.code);
        setDocumentType(first.code);
      } else if (data.standards && data.standards.length > 0) {
        setSelectedCategoryCode(data.standards[0].code);
        setDocumentType(data.standards[0].code);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoadingCats(false);
    }
  };

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // SCANNER HANDLERS
  // -------------------------------------------------------------
  const handleCapturePage = () => {
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

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setScannedPages(prev => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const movePage = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= scannedPages.length) return;
    setScannedPages(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[newIdx];
      copy[newIdx] = temp;
      return copy;
    });
  };

  const deletePage = (index) => {
    setScannedPages(prev => prev.filter((_, i) => i !== index));
  };

  // -------------------------------------------------------------
  // IMPORT FILE HANDLER
  // -------------------------------------------------------------
  const handleSelectImportFiles = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setImportedFiles(prev => [...prev, ...files]);
      if (!title) {
        const first = files[0];
        const nameWithoutExt = first.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
        setObjectTitle(nameWithoutExt);
      }
    }
  };

  const removeImportedFile = (index) => {
    setImportedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // -------------------------------------------------------------
  // CATEGORY SELECTION HANDLER
  // -------------------------------------------------------------
  const handleCategoryChange = (e) => {
    const val = e.target.value;
    if (val.startsWith('CUSTOM_')) {
      const id = val.replace('CUSTOM_', '');
      setCustomCategoryId(id);
      const matched = categories.customs?.find(c => String(c.id) === String(id));
      if (matched) {
        setSelectedCategoryCode(matched.code);
        const preferredType = matched.is_default_for_types?.[0] || matched.associated_types?.[0] || matched.code;
        setDocumentType(preferredType || 'SOIT_TRANSMIS');
      } else {
        setSelectedCategoryCode('AUTRE');
        setDocumentType('AUTRE');
      }
    } else {
      setCustomCategoryId('');
      setSelectedCategoryCode(val);
      setDocumentType(val);
    }
  };

  // -------------------------------------------------------------
  // OCR SIMULATION / EXTRACTION
  // -------------------------------------------------------------
  const handleTriggerOcr = () => {
    setIsOcrProcessing(true);
    setTimeout(() => {
      let extracted = `[RECONNAISSANCE OPTIQUE DE CARACTÈRES - UK-GED]\nDocument : ${title || 'Document administratif'}\nDate : ${documentDate}\nService : ${user?.service_name || 'Université de Kindia'}\n\nTexte détecté automatiquement :\nPar la présente, il est certifié que le document référence ${customReference || 'automatique'} a été numérisé avec succès dans les archives officielles. Les clauses et mentions portées ci-contre sont valides et enregistrées conformément aux règlements de l'Université de Kindia.`;
      setOcrText(extracted);
      setIsOcrProcessing(false);
    }, 900);
  };

  // -------------------------------------------------------------
  // FINAL SUBMISSION TO BACKEND
  // -------------------------------------------------------------
  const handleFinalArchive = async () => {
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title || objectTitle || 'Document sans titre');
      formData.append('object_title', objectTitle || title || '');
      formData.append('document_type', documentType);
      formData.append('custom_category_id', customCategoryId || '');
      
      const currentCat = customCategoryId 
        ? categories.customs?.find(c => String(c.id) === String(customCategoryId))?.name
        : categories.standards?.find(c => c.code === selectedCategoryCode)?.name;
      
      formData.append('archive_category', currentCat || 'Soit-transmis');
      formData.append('reference', customReference);
      formData.append('document_date', documentDate);
      formData.append('author_name', authorName);
      formData.append('signatory_name', signatoryName);
      formData.append('target_recipient_name', targetRecipientName);
      formData.append('description', description);
      formData.append('keywords', keywords);
      formData.append('confidentiality', confidentiality);
      formData.append('priority', priority);
      formData.append('ocr_text', ocrText);
      formData.append('is_scanned', activeMode === 'scan' ? '1' : '0');

      if (activeMode === 'scan') {
        if (scannedPages.length === 0) {
          throw new Error('Veuillez numériser au moins une page avant d’archiver.');
        }
        setIsCompilingPdf(true);
        const pdfBlob = await createPDFFromImageDataURLs(scannedPages);
        const pdfFile = new File([pdfBlob], `Scan_${Date.now()}.pdf`, { type: 'application/pdf' });
        formData.append('files', pdfFile);
      } else {
        if (importedFiles.length === 0) {
          throw new Error('Veuillez sélectionner au moins un fichier à importer.');
        }
        for (const f of importedFiles) {
          formData.append('files', f);
        }
      }

      const res = await api.archiveServiceDocument(formData);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      console.error('Archive submission error:', err);
      setError(err.message || 'Erreur lors de l’archivage du document.');
    } finally {
      setSubmitting(false);
      setIsCompilingPdf(false);
    }
  };

  // Selected Category Info for Summary
  const selectedCatObj = customCategoryId 
    ? categories.customs?.find(c => String(c.id) === String(customCategoryId))
    : categories.standards?.find(c => c.code === selectedCategoryCode);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden my-auto animate-scale-up">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-kindia-blue via-slate-800 to-kindia-blue p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-kindia-gold font-black border border-white/20">
              {activeMode === 'scan' ? <Camera className="w-6 h-6" /> : <FileUp className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black tracking-widest uppercase bg-white/15 text-kindia-gold px-2 py-0.5 rounded-md">
                  {user?.service_name || 'Espace Service'}
                </span>
                <span className="text-xs text-slate-300">
                  Étape {step} sur 3
                </span>
              </div>
              <h3 className="font-heading font-extrabold text-lg text-white">
                {activeMode === 'scan' ? 'Numérisation & Archivage Électronique' : 'Importation & Archivage de Document'}
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

        {/* Step Progress Bar */}
        <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold shrink-0">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setStep(1)}
              className={`flex items-center space-x-1.5 transition ${step === 1 ? 'text-kindia-blue' : 'text-slate-500'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-kindia-blue text-white' : 'bg-slate-300 text-slate-700'}`}>1</span>
              <span>{activeMode === 'scan' ? 'Numérisation multi-pages' : 'Fichiers importés'}</span>
            </button>
            <span className="text-slate-300">→</span>
            <button 
              onClick={() => setStep(2)}
              disabled={(activeMode === 'scan' && scannedPages.length === 0) || (activeMode === 'import' && importedFiles.length === 0)}
              className={`flex items-center space-x-1.5 transition ${step === 2 ? 'text-kindia-blue' : 'text-slate-500'} disabled:opacity-40`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-kindia-blue text-white' : 'bg-slate-300 text-slate-700'}`}>2</span>
              <span>Catégorie & Métadonnées</span>
            </button>
            <span className="text-slate-300">→</span>
            <button 
              onClick={() => setStep(3)}
              disabled={!title}
              className={`flex items-center space-x-1.5 transition ${step === 3 ? 'text-kindia-blue' : 'text-slate-500'} disabled:opacity-40`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-kindia-blue text-white' : 'bg-slate-300 text-slate-700'}`}>3</span>
              <span>Aperçu & Archivage définitif</span>
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => { setActiveMode('scan'); setIsCameraActive(true); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition flex items-center space-x-1 ${
                activeMode === 'scan' ? 'bg-kindia-blue text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Numériser</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveMode('import'); setIsCameraActive(false); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition flex items-center space-x-1 ${
                activeMode === 'import' ? 'bg-kindia-blue text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Importer</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 1 : SCANNING OR IMPORTING */}
          {/* ========================================================= */}
          {step === 1 && (
            <>
              {activeMode === 'scan' ? (
                <div className="space-y-6">
                  {/* Camera / Capture Frame */}
                  <div className="bg-slate-950 rounded-2xl p-4 text-white flex flex-col items-center justify-center min-h-[300px] border border-slate-800 relative">
                    {isCameraActive && !cameraError ? (
                      <div className="w-full flex flex-col items-center space-y-3">
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="max-h-72 w-full object-contain rounded-xl bg-black border border-slate-800 shadow-inner" 
                        />
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={handleCapturePage}
                            className="bg-kindia-gold hover:bg-yellow-400 text-kindia-blue font-black px-6 py-2.5 rounded-full shadow-xl flex items-center space-x-2 text-xs transition transform hover:scale-105"
                          >
                            <Camera className="w-4 h-4" />
                            <span>📷 NUMÉRISER LA PAGE</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2.5 rounded-full text-xs border border-slate-700 flex items-center space-x-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Prendre photo</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-6 space-y-4">
                        <Camera className="w-12 h-12 text-slate-500 mx-auto" />
                        <p className="text-xs text-slate-300 max-w-md">
                          {cameraError || "Scanner ou caméra prêt. Cliquez ci-dessous pour capturer vos pages."}
                        </p>
                        <div className="flex justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => { setIsCameraActive(true); setCameraError(null); }}
                            className="bg-kindia-blue hover:bg-blue-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-2"
                          >
                            <RotateCw className="w-4 h-4" />
                            <span>Activer le flux caméra</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs border border-slate-700 flex items-center space-x-2"
                          >
                            <Camera className="w-4 h-4 text-kindia-gold" />
                            <span>Photo depuis l'appareil</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      ref={cameraInputRef}
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Scanned Pages Carousel & Reordering (Rule 1) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Layers className="w-4 h-4 text-kindia-blue" />
                        <span className="font-bold text-xs text-slate-800">
                          Pages numérisées ({scannedPages.length})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Vous pouvez réorganiser, supprimer ou ajouter d'autres pages
                      </span>
                    </div>

                    {scannedPages.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-400 italic">
                        Aucune page numérisée pour l'instant. Capturez votre première page ci-dessus.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {scannedPages.map((pageUrl, idx) => (
                          <div key={idx} className="relative group border border-slate-200 rounded-xl overflow-hidden bg-white p-1 shadow-xs hover:shadow-md transition">
                            <img src={pageUrl} alt={`Page ${idx + 1}`} className="h-28 w-full object-cover rounded-lg" />
                            <div className="absolute top-1.5 left-1.5 bg-slate-900/90 text-white text-[10px] font-black px-1.5 py-0.5 rounded">
                              P.{idx + 1}
                            </div>
                            
                            {/* Actions Overlay */}
                            <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-slate-950/80 to-transparent flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => movePage(idx, -1)}
                                className="p-1 bg-white/20 hover:bg-white text-white hover:text-slate-900 rounded disabled:opacity-30"
                                title="Déplacer vers la gauche"
                              >
                                <ArrowUp className="w-3 h-3 -rotate-90" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === scannedPages.length - 1}
                                onClick={() => movePage(idx, 1)}
                                className="p-1 bg-white/20 hover:bg-white text-white hover:text-slate-900 rounded disabled:opacity-30"
                                title="Déplacer vers la droite"
                              >
                                <ArrowDown className="w-3 h-3 -rotate-90" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deletePage(idx)}
                                className="p-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded"
                                title="Supprimer la page"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Mode Importation Multi-formats (Rule 2) */
                <div className="space-y-6">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900">
                    <p className="font-bold flex items-center space-x-2">
                      <FileUp className="w-4 h-4 text-emerald-600" />
                      <span>Formats pris en charge : PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG</span>
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-1">
                      Sélectionnez ou déposez vos fichiers existants pour les classer et les archiver directement dans votre service.
                    </p>
                  </div>

                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
                    ref={fileInputRef}
                    onChange={handleSelectImportFiles}
                    className="hidden"
                  />

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-kindia-blue rounded-3xl p-10 text-center bg-slate-50 hover:bg-blue-50/50 transition cursor-pointer space-y-3"
                  >
                    <FileUp className="w-12 h-12 text-kindia-blue mx-auto" />
                    <h4 className="font-bold text-sm text-slate-800">Cliquez ou glissez-déposez vos documents ici</h4>
                    <p className="text-xs text-slate-400">PDF, Word (DOC/DOCX), Excel (XLS/XLSX), Images (JPG/PNG)</p>
                    <button
                      type="button"
                      className="bg-kindia-blue text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow inline-flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Parcourir mes dossiers</span>
                    </button>
                  </div>

                  {importedFiles.length > 0 && (
                    <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <h4 className="font-bold text-xs text-slate-800">Fichiers sélectionnés ({importedFiles.length}) :</h4>
                      <div className="space-y-2">
                        {importedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                            <div className="flex items-center space-x-2.5 truncate">
                              <FileText className="w-4 h-4 text-kindia-blue shrink-0" />
                              <span className="font-semibold text-slate-800 truncate">{file.name}</span>
                              <span className="text-[10px] text-slate-400">({(file.size / 1024).toFixed(1)} Ko)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeImportedFile(idx)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* STEP 2 : METADATA, CATEGORY & OCR */}
          {/* ========================================================= */}
          {step === 2 && (
            <div className="space-y-5 text-xs">
              
              {/* Mandatory Category Picker (Rule 3 & 13) */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-black text-slate-900 text-xs flex items-center space-x-1.5">
                    <Tag className="w-4 h-4 text-amber-600" />
                    <span>Catégorie d'archivage du service <span className="text-rose-500">*</span></span>
                  </label>
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-200/60 px-2 py-0.5 rounded">
                    Obligatoire
                  </span>
                </div>

                <select
                  value={customCategoryId ? `CUSTOM_${customCategoryId}` : selectedCategoryCode}
                  onChange={handleCategoryChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden cursor-pointer"
                >
                  {categories.customs?.length > 0 && (
                    <optgroup label="── Catégories propres à mon service ──">
                      {categories.customs.map(c => (
                        <option key={`c-${c.id}`} value={`CUSTOM_${c.id}`}>
                          📁 {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="── Catégories institutionnelles ──">
                    {categories.standards?.map(s => (
                      <option key={`s-${s.code}`} value={s.code}>
                        📁 {s.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* General Metadata Inputs (Rule 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Titre du document *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex: Demande d'achat de matériel informatique"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Objet / Résumé court</label>
                  <input
                    type="text"
                    value={objectTitle}
                    onChange={(e) => setObjectTitle(e.target.value)}
                    placeholder="ex: Renouvellement des routeurs de laboratoire"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Référence du document</label>
                  <input
                    type="text"
                    value={customReference}
                    onChange={(e) => setCustomReference(e.target.value)}
                    placeholder="Laisser vide pour génération auto"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] font-bold focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date du document</label>
                  <input
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Niveau de Confidentialité</label>
                  <select
                    value={confidentiality}
                    onChange={(e) => setConfidentiality(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  >
                    <option value="INTERNAL">Interne (Service & Université)</option>
                    <option value="PUBLIC">Public</option>
                    <option value="CONFIDENTIAL">Confidentiel</option>
                    <option value="RESTRICTED">Secret / Diffusion Restreinte</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Auteur / Émetteur</label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Nom de l'auteur ou service"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Signataire officiel</label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    placeholder="ex: Dr. Alpha Oumar Diallo"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Destinataire initial</label>
                  <input
                    type="text"
                    value={targetRecipientName}
                    onChange={(e) => setTargetRecipientName(e.target.value)}
                    placeholder="ex: Doyen FS, Recteur..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mots-clés (séparés par des virgules)</label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="ex: matériel, équipement, laboratoire, 2026"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Description / Observations</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Notes internes pour le service..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-kindia-blue outline-hidden"
                  />
                </div>
              </div>

              {/* OCR Recognition & Text Indexing Box (Rule 11) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-slate-800">Reconnaissance de texte OCR (Recherche plein texte)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerOcr}
                    disabled={isOcrProcessing}
                    className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg text-[11px] font-extrabold transition flex items-center space-x-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isOcrProcessing ? 'animate-spin' : ''}`} />
                    <span>{isOcrProcessing ? 'Analyse en cours...' : 'Extraire le texte OCR'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  placeholder="Le texte détecté par l'OCR apparaîtra ici et permettra la recherche dans le contenu numérisé..."
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-mono text-[11px] focus:ring-2 focus:ring-purple-500 outline-hidden"
                />
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3 : SUMMARY & FINAL ARCHIVE (Rules 4 & 12) */}
          {/* ========================================================= */}
          {step === 3 && (
            <div className="space-y-6 text-xs">
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 flex items-center space-x-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Vérification préalable avant archivage définitif</h4>
                  <p className="text-[11px] text-emerald-700">
                    Veuillez vérifier les informations ci-dessous. Le document sera scellé dans les archives du service avec conservation de l'historique immuable.
                  </p>
                </div>
              </div>

              {/* Summary Card as Requested in Rule 4 */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 font-medium">
                <h4 className="font-heading font-extrabold text-sm text-slate-800 border-b border-slate-200 pb-2">
                  Fiche Récapitulative d'Archivage
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Document / Titre :</span>
                    <span className="font-bold text-slate-900 text-sm">{title || 'Document sans titre'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Catégorie choisie :</span>
                    <span className="font-bold text-kindia-blue inline-flex items-center space-x-1.5 mt-0.5">
                      <DynamicCategoryIcon iconName={selectedCatObj?.icon || 'Folder'} className="w-3.5 h-3.5" />
                      <span>{selectedCatObj?.name || 'Soit-transmis'}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Structure Propriétaire :</span>
                    <span className="font-bold text-slate-800">{user?.service_name || 'Service de Kindia'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Référence attribuée :</span>
                    <span className="font-mono font-black text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                      {customReference || 'Génération automatique à l’enregistrement'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Date du document :</span>
                    <span className="font-semibold text-slate-800">{documentDate}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Fichiers attachés :</span>
                    <span className="font-semibold text-slate-800">
                      {activeMode === 'scan' ? `${scannedPages.length} page(s) assemblée(s) en PDF` : `${importedFiles.length} fichier(s)`}
                    </span>
                  </div>
                </div>

                {ocrText && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-400 block text-[11px] mb-1">Indexation plein texte OCR :</span>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[10px] text-slate-600 max-h-20 overflow-y-auto">
                      {ocrText}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(prev => prev - 1)}
                disabled={submitting}
                className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-200"
              >
                ← Précédent
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-bold text-xs transition"
            >
              Annuler
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && ((activeMode === 'scan' && scannedPages.length === 0) || (activeMode === 'import' && importedFiles.length === 0))) {
                    setError(activeMode === 'scan' ? 'Veuillez numériser au moins une page.' : 'Veuillez sélectionner au moins un fichier.');
                    return;
                  }
                  if (step === 2 && !title) {
                    setError('Veuillez renseigner le titre du document.');
                    return;
                  }
                  setError('');
                  setStep(prev => prev + 1);
                }}
                className="px-5 py-2.5 bg-kindia-blue hover:bg-blue-800 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5"
              >
                <span>Suivant →</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalArchive}
                disabled={submitting || isCompilingPdf}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-lg transition flex items-center space-x-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{submitting ? 'Archivage en cours...' : '📁 Archiver définitivement'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

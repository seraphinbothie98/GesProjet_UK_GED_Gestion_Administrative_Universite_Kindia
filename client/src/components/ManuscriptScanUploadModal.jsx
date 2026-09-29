import React, { useState, useRef } from 'react';
import { api } from '../services/api';
import { UploadCloud, FileText, CheckCircle, AlertCircle, X, ShieldCheck, Eye } from 'lucide-react';

export default function ManuscriptScanUploadModal({ mission, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!mission) return null;

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;

    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
    const fileName = selectedFile.name.toLowerCase();
    const isAllowed = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!isAllowed) {
      setError('Format non supporté. Veuillez sélectionner un fichier PDF ou une image scannée (JPG, PNG).');
      return;
    }

    if (selectedFile.size > 30 * 1024 * 1024) {
      setError('Fichier trop volumineux. La taille maximale autorisée est de 30 Mo.');
      return;
    }

    setError('');
    setFile(selectedFile);

    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Veuillez sélectionner le document scanné à importer.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('scanned_file', file);

      const res = await api.uploadMissionSignedScan(mission.document_id || mission.id, formData);
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      console.error('Scan upload error:', err);
      setError(err.message || 'Erreur lors de la réintégration du document scanné.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-fadeIn max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-sm text-slate-800">
                Import du Document Signé & Cacheté
              </h3>
              <p className="text-[11px] text-slate-500">
                Mode Signature Manuscrite (SG au bureau) • Secrétariat Central
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-slate-400 hover:text-slate-700 font-extrabold text-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* OM Information Summary Card to prevent mismatches */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="font-mono font-extrabold text-kindia-blue bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              Réf : {mission.reference}
            </span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Signature Manuscrite
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700">
            <div>
              <span className="text-slate-500 font-semibold block text-[10px]">MISSIONNAIRE</span>
              <strong className="text-slate-900">{mission.missionary_name}</strong>
              <p className="text-[10px] text-slate-500">{mission.function_title}</p>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block text-[10px]">DESTINATION & DATES</span>
              <strong className="text-slate-900">{mission.destination}</strong>
              <p className="text-[10px] text-slate-500">Du {mission.departure_date} au {mission.return_date}</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-xl text-[11px] text-blue-900 leading-relaxed flex items-start space-x-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>Authenticité & Traçabilité :</strong> Veuillez vous assurer que le document numérisé comporte la signature manuscrite du Secrétaire Général ainsi que le cachet physique de l’Université. Ce document scanné deviendra la version officielle scellée de l’Ordre de mission.
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-xl text-xs text-rose-800 font-bold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dropzone */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
              isDragOver 
                ? 'border-kindia-blue bg-indigo-50/50' 
                : file 
                ? 'border-emerald-400 bg-emerald-50/30' 
                : 'border-slate-300 hover:border-kindia-blue bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e.target.files[0])}
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
            />

            {file ? (
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-800 truncate max-w-sm mx-auto">{file.name}</p>
                  <p className="text-[10px] text-slate-500 font-bold">{(file.size / 1024 / 1024).toFixed(2)} Mo • Fichier prêt à être réintégré</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline"
                >
                  Changer de fichier
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">
                    Cliquez ou glissez-déposez le document scanné ici
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Formats acceptés : PDF, PNG, JPG, JPEG (Max 30 Mo)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Image Thumbnail preview if available */}
          {previewUrl && (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-48 bg-slate-900 flex items-center justify-center">
              <img src={previewUrl} alt="Aperçu scan" className="max-h-48 object-contain" />
              <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                Aperçu de l'image
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={!file || uploading}
              className={`px-5 py-2 rounded-xl font-extrabold text-xs shadow transition flex items-center space-x-1.5 ${
                !file || uploading 
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                  : 'bg-kindia-blue hover:bg-kindia-lightBlue text-white shadow-md'
              }`}
            >
              {uploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Réintégration en cours...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 text-kindia-gold" />
                  <span>📥 Réintégrer le document scanné</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

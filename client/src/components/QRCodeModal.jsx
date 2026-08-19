import React, { useState } from 'react';
import { X, QrCode, Copy, Check, ExternalLink, ShieldCheck, Smartphone } from 'lucide-react';

export default function QRCodeModal({ reference, qrCodeData, verificationUrl, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-xs text-slate-800">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-kindia-blue to-slate-900 text-white p-5 flex items-center justify-between border-b border-kindia-gold/30">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-kindia-gold text-slate-950 flex items-center justify-center font-extrabold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-sm text-white">
                QR Code Officiel de Vérification
              </h3>
              <p className="text-[10px] text-kindia-gold font-mono">
                Réf : {reference}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-4">
          
          {/* QR Code Container */}
          <div className="w-56 h-56 mx-auto bg-white p-4 rounded-3xl border-2 border-dashed border-kindia-gold shadow-lg flex items-center justify-center">
            {qrCodeData ? (
              <img src={qrCodeData} alt="QR Code" className="w-full h-full object-contain rounded-2xl" />
            ) : (
              <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full" />
            )}
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full font-bold text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>QR Code Actif & Infalsifiable</span>
            </div>
            <p className="text-slate-500 text-[11px] max-w-xs mx-auto">
              Pointez l'appareil photo de n'importe quel smartphone vers ce code pour vérifier instantanément l'authenticité et le statut en temps réel.
            </p>
          </div>

          {/* Direct Link box */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-left space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              URL Publique de Vérification :
            </span>
            <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-200">
              <span className="font-mono text-[10px] text-kindia-blue truncate select-all block">
                {verificationUrl}
              </span>
              <button
                onClick={handleCopyUrl}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition flex-shrink-0"
                title="Copier l'URL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              </button>
            </div>
          </div>

          {/* Test Link Button */}
          <div className="flex space-x-2 pt-1">
            <a
              href={verificationUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2.5 px-4 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow transition flex items-center justify-center space-x-1.5"
            >
              <ExternalLink className="w-4 h-4 text-kindia-gold" />
              <span>Tester la page publique</span>
            </a>

            <button
              onClick={onClose}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
              Fermer
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}

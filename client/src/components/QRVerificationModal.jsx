import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldCheck, ShieldAlert, X, Award, CheckCircle } from 'lucide-react';

export default function QRVerificationModal({ reference, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (reference) {
      api.verifyDocument(reference)
        .then(res => setData(res))
        .catch(err => setData({ valid: false, message: err.message }))
        .finally(() => setLoading(false));
    }
  }, [reference]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-kindia-blue p-4 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-kindia-gold" />
            <h3 className="font-heading font-bold text-sm">Vérification d’Authenticité Officielle</h3>
          </div>
          <button onClick={onClose} className="p-1 text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-kindia-blue border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-xs text-slate-500">Vérification dans le registre officiel...</p>
            </div>
          ) : data && data.valid ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
                <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-xs">DOCUMENT OFFICIEL CERTIFIÉ</h4>
                  <p className="text-[11px] text-emerald-700">Émis par l'Université de Kindia</p>
                </div>
              </div>

              <div className="space-y-2 text-xs divide-y divide-slate-100">
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500">Référence :</span>
                  <span className="font-bold text-kindia-blue">{data.reference}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500">Titre / Objet :</span>
                  <span className="font-semibold text-slate-800">{data.title}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500">Statut :</span>
                  <span className="font-bold text-emerald-600">{data.status}</span>
                </div>
                {data.signature && (
                  <>
                    <div className="pt-2 flex justify-between">
                      <span className="text-slate-500">Signataire :</span>
                      <span className="font-bold text-slate-800">{data.signature.signed_by}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-slate-500">Date de Signature :</span>
                      <span className="text-slate-700">{new Date(data.signature.signed_at).toLocaleString('fr-FR')}</span>
                    </div>
                    <div className="pt-2">
                      <span className="text-slate-500 block text-[10px]">Empreinte Numérique SHA-256 :</span>
                      <span className="font-mono text-[9px] text-slate-600 break-all bg-slate-100 p-1 rounded block mt-1">
                        {data.signature.hash}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-red-700">Document Non Certifié</h4>
              <p className="text-xs text-slate-500 mt-1">{data?.message || 'Ce document n’a pas pu être vérifié.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

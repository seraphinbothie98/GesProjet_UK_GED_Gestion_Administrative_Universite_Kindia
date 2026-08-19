import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Clock, 
  Building2, Calendar, FileText, MapPin, User, ArrowLeft, RefreshCw, Lock
} from 'lucide-react';

export default function PublicVerification({ referenceParam, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchRef, setSearchRef] = useState(referenceParam || '');

  useEffect(() => {
    // Extract reference from URL if not passed as prop
    let targetRef = referenceParam;
    if (!targetRef) {
      const path = window.location.pathname;
      if (path.startsWith('/verify/')) {
        targetRef = decodeURIComponent(path.replace('/verify/', '').trim());
      } else {
        const params = new URLSearchParams(window.location.search);
        targetRef = params.get('ref') || params.get('reference') || params.get('token');
      }
    }

    if (targetRef) {
      setSearchRef(targetRef);
      fetchVerification(targetRef);
    } else {
      setLoading(false);
    }
  }, [referenceParam]);

  const fetchVerification = async (ref) => {
    if (!ref) return;
    setLoading(true);
    setData(null);

    try {
      const res = await api.verifyDocumentPublic(ref);
      setData(res);
    } catch (err) {
      console.error('Verification error:', err);
      setData({
        valid: false,
        status: 'NOT_FOUND',
        title: 'DOCUMENT INTROUVABLE',
        message: 'Cette référence ne correspond à aucun document enregistré dans UK-GED.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchRef.trim()) {
      fetchVerification(searchRef.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans">
      
      {/* Top Institutional Header */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-kindia-gold/30 px-4 py-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-kindia-gold text-slate-950 flex items-center justify-center font-black text-sm shadow">
              UK
            </div>
            <div>
              <span className="font-heading font-extrabold text-sm text-white block">
                UNIVERSITÉ DE KINDIA
              </span>
              <span className="text-[10px] text-kindia-gold uppercase tracking-wider block font-bold">
                Système Officiel de Vérification • UK-GED
              </span>
            </div>
          </div>

          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retour</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        
        {/* Loading Spinner */}
        {loading && (
          <div className="p-16 text-center space-y-4 bg-slate-800/50 rounded-3xl border border-white/10 backdrop-blur-md">
            <RefreshCw className="w-10 h-10 text-kindia-gold animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="font-heading font-extrabold text-sm text-white">Vérification de l'authenticité en cours...</h3>
              <p className="text-xs text-slate-400">Interrogation sécurisée du registre officiel de l’Université de Kindia.</p>
            </div>
          </div>
        )}

        {/* Search Bar if not yet searched */}
        {!loading && !data && (
          <div className="bg-slate-800/60 p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="text-center space-y-1">
              <ShieldCheck className="w-12 h-12 text-kindia-gold mx-auto" />
              <h2 className="font-heading font-extrabold text-base text-white">
                Vérification d'un document officiel UK-GED
              </h2>
              <p className="text-xs text-slate-400">
                Saisissez la référence officielle ou le code de suivi pour vérifier son authenticité.
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Ex: UK-CE-2026-000125 ou OM-2026-000025"
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:ring-2 focus:ring-kindia-gold"
              />
              <button
                type="submit"
                className="w-full py-3 bg-kindia-gold hover:bg-amber-400 text-slate-950 font-extrabold rounded-2xl shadow transition text-xs"
              >
                VÉRIFIER LE DOCUMENT
              </button>
            </form>
          </div>
        )}

        {/* CASE 1: DOCUMENT AUTHENTIC */}
        {!loading && data && data.valid && data.status === 'AUTHENTIC' && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Authentic Badge Card */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 rounded-3xl shadow-2xl text-center space-y-2 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="w-14 h-14 bg-white text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg ring-4 ring-white/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <span className="bg-emerald-900/60 text-emerald-100 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                ✓ Registre Numérique Conforme
              </span>
              <h1 className="font-heading font-extrabold text-xl text-white">
                DOCUMENT AUTHENTIQUE
              </h1>
              <p className="text-emerald-100 text-xs max-w-md mx-auto">
                Ce document est officiellement enregistré et certifié dans le système UK-GED de l'Université de Kindia.
              </p>
            </div>

            {/* Document Details Card */}
            <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-white/10 p-6 shadow-xl space-y-4 text-xs">
              
              <div className="border-b border-white/10 pb-3 flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Référence Officielle Unique
                  </span>
                  <span className="font-mono font-extrabold text-base text-kindia-gold block">
                    {data.reference}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Type d'acte
                  </span>
                  <span className="bg-slate-700 text-white font-bold px-2.5 py-1 rounded-xl text-[11px] inline-block mt-0.5">
                    {data.document_type_label || data.document_type}
                  </span>
                </div>
              </div>

              {/* Status Badge Block */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500 absolute" />
                  <div className="pl-3">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      Statut en Temps Réel
                    </span>
                    <span className="font-heading font-extrabold text-sm text-emerald-400">
                      {data.current_status}
                    </span>
                  </div>
                </div>

                {data.is_signed && (
                  <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    ✓ Signé électroniquement
                  </span>
                )}
              </div>

              {/* Table of verified metadata */}
              <div className="divide-y divide-white/5 space-y-2 pt-1 text-[11px]">
                
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Date d'enregistrement :</span>
                  <span className="font-bold text-slate-200">{data.registration_date} {data.registration_time ? `à ${data.registration_time}` : ''}</span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Service émetteur / Détenteur :</span>
                  <span className="font-bold text-slate-200">{data.current_service}</span>
                </div>

                {data.object_title && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Objet de l'acte :</span>
                    <span className="font-bold text-slate-200 text-right max-w-xs truncate">{data.object_title}</span>
                  </div>
                )}

                {/* Mission Specific Info */}
                {data.mission && (
                  <>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">Missionnaire :</span>
                      <span className="font-bold text-kindia-gold">{data.mission.missionary_name}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">Destination :</span>
                      <span className="font-bold text-slate-200">{data.mission.destination}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">Période de mission :</span>
                      <span className="font-bold text-slate-200">Du {data.mission.departure_date} au {data.mission.return_date}</span>
                    </div>
                  </>
                )}

              </div>

              {/* Secure certification footer */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center space-x-1">
                  <Lock className="w-3 h-3 text-kindia-gold" />
                  <span>Document enregistré dans UK-GED</span>
                </span>
                <span>Institution : Univ. Kindia</span>
              </div>

            </div>

          </div>
        )}

        {/* CASE 2: DOCUMENT INVALID (Cancelled / Trashed) */}
        {!loading && data && data.status === 'INVALID' && (
          <div className="bg-amber-950/80 border border-amber-500/50 p-6 rounded-3xl text-center space-y-3 shadow-xl animate-in fade-in">
            <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto ring-4 ring-amber-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <span className="bg-amber-900/60 text-amber-200 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
              Avertissement Sécurité
            </span>
            <h2 className="font-heading font-extrabold text-lg text-amber-400">
              DOCUMENT NON VALIDE
            </h2>
            <p className="text-amber-200/80 text-xs max-w-md mx-auto">
              {data.message || 'Ce document a été invalidé ou retiré du circuit administratif actif.'}
            </p>
          </div>
        )}

        {/* CASE 3: DOCUMENT NOT FOUND */}
        {!loading && data && data.status === 'NOT_FOUND' && (
          <div className="bg-red-950/80 border border-red-500/50 p-6 rounded-3xl text-center space-y-3 shadow-xl animate-in fade-in">
            <div className="w-14 h-14 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto ring-4 ring-red-500/10">
              <XCircle className="w-8 h-8" />
            </div>
            <span className="bg-red-900/60 text-red-200 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
              Échec de Vérification
            </span>
            <h2 className="font-heading font-extrabold text-lg text-red-400">
              DOCUMENT INTROUVABLE
            </h2>
            <p className="text-red-200/80 text-xs max-w-md mx-auto">
              « Cette référence ne correspond à aucun document enregistré dans UK-GED. »
            </p>
            <p className="text-slate-400 text-[11px] pt-1">
              Veuillez vous assurer d'avoir scanné le QR Code officiel ou contactez le Secrétariat Central.
            </p>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[10px] text-slate-500 border-t border-white/5">
        <p>UNIVERSITÉ DE KINDIA • Système de Gestion Électronique des Documents</p>
        <p>Plateforme officielle sécurisée • Kindia, République de Guinée</p>
      </footer>

    </div>
  );
}

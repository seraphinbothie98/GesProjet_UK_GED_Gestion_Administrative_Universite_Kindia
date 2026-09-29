import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Clock, 
  Building2, Calendar, FileText, MapPin, User, ArrowLeft, RefreshCw, 
  Lock, Car, Award, Hash, Check, AlertCircle, Search, HelpCircle,
  ExternalLink, Printer, QrCode
} from 'lucide-react';

export default function PublicVerification({ referenceParam, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchRef, setSearchRef] = useState(referenceParam || '');
  const [lastScannedRef, setLastScannedRef] = useState('');

  useEffect(() => {
    // Extract token/ref from pathname or query params
    let targetRef = referenceParam;
    if (!targetRef) {
      const path = window.location.pathname;
      if (path.startsWith('/verification/ordre-mission/')) {
        targetRef = decodeURIComponent(path.replace('/verification/ordre-mission/', '').trim());
      } else if (path.startsWith('/verification/')) {
        targetRef = decodeURIComponent(path.replace('/verification/', '').trim());
      } else if (path.startsWith('/verify/mission/')) {
        targetRef = decodeURIComponent(path.replace('/verify/mission/', '').trim());
      } else if (path.startsWith('/verify/')) {
        targetRef = decodeURIComponent(path.replace('/verify/', '').trim());
      } else {
        const params = new URLSearchParams(window.location.search);
        targetRef = params.get('token') || params.get('ref') || params.get('reference') || params.get('id');
      }
    }

    if (targetRef && targetRef !== 'ordre-mission' && targetRef !== '') {
      setSearchRef(targetRef);
      setLastScannedRef(targetRef);
      fetchVerification(targetRef);
    } else {
      setLoading(false);
    }
  }, [referenceParam]);

  const fetchVerification = async (tokenOrRef) => {
    if (!tokenOrRef) return;
    setLoading(true);
    setData(null);

    try {
      const cleanToken = tokenOrRef.trim();
      setLastScannedRef(cleanToken);
      const res = await api.verifyMissionOrderPublic(cleanToken);
      setData(res);
    } catch (err) {
      console.error('Verification error:', err);
      setData({
        valid: false,
        status: 'NOT_FOUND',
        title: 'DOCUMENT NON RECONNU',
        message: "Ce document n'existe pas dans le système UK-GED."
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Institutional Top Navigation Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-amber-500/20 px-4 py-3.5 shadow-xl sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-base shadow-lg ring-2 ring-amber-400/30">
              UK
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-heading font-black text-sm text-white tracking-wide block">
                  UNIVERSITÉ DE KINDIA
                </span>
                <span className="bg-amber-400/10 text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-400/20 uppercase tracking-widest hidden sm:inline-block">
                  Officiel
                </span>
              </div>
              <span className="text-[10px] text-amber-400/90 uppercase tracking-wider block font-bold">
                Système de Vérification Publique • UK-GED
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border border-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Retour</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center space-y-4 bg-slate-900/60 rounded-3xl border border-slate-800 backdrop-blur-md shadow-2xl">
            <div className="relative w-14 h-14 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
              <ShieldCheck className="w-7 h-7 text-amber-400 absolute inset-0 m-auto" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-extrabold text-base text-white">
                Vérification de l'authenticité en cours...
              </h3>
              <p className="text-xs text-slate-400">
                Interrogation sécurisée du registre officiel de l'Université de Kindia.
              </p>
            </div>
          </div>
        )}

        {/* Manual Search Form (visible when no data or by clicking search) */}
        {!loading && !data && (
          <div className="bg-slate-900/70 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto ring-1 ring-amber-500/20">
                <QrCode className="w-8 h-8" />
              </div>
              <h2 className="font-heading font-black text-lg text-white">
                Vérifier un Ordre de Mission UK-GED
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Scannez le QR Code imprimé sur le document ou saisissez le code/référence unique pour authentifier l'acte.
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ex: OM-2026-000001 ou code de vérification"
                  value={searchRef}
                  onChange={(e) => setSearchRef(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-2xl shadow-lg transition text-xs tracking-wider uppercase flex items-center justify-center space-x-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>VÉRIFIER L'AUTHENTICITÉ</span>
              </button>
            </form>

            <div className="pt-3 border-t border-slate-800/80 text-center">
              <span className="text-[11px] text-slate-500">
                UK-GED • République de Guinée • MESRSI
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ÉTAT 1 — DOCUMENT AUTHENTIQUE                                             */}
        {/* ========================================================================= */}
        {!loading && data && data.valid && data.status === 'AUTHENTIC' && (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Top Green Banner */}
            <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-6 sm:p-7 rounded-3xl shadow-2xl text-center space-y-3 relative overflow-hidden border border-emerald-400/30">
              <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -left-8 -top-8 w-36 h-36 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

              <div className="w-16 h-16 bg-white text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-2xl ring-4 ring-white/30 animate-bounce hover:animate-none">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <span className="bg-emerald-950/70 text-emerald-200 text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider inline-block border border-emerald-400/30 shadow-inner">
                  ✓ Registre Numérique Certifié
                </span>
                <h1 className="font-heading font-black text-2xl text-white tracking-wide pt-1">
                  DOCUMENT AUTHENTIQUE
                </h1>
                <p className="text-emerald-100 text-xs font-semibold max-w-md mx-auto">
                  Ce document a été vérifié par UK-GED.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center space-x-2 text-[11px] text-emerald-100/90 font-mono bg-emerald-950/40 py-1.5 px-4 rounded-xl max-w-sm mx-auto border border-emerald-400/20">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>Réf : <strong className="text-white">{data.reference}</strong></span>
              </div>
            </div>

            {/* 4 Cards Section */}
            <div className="space-y-4">

              {/* CARD 1: IDENTITÉ */}
              <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-xs text-white uppercase tracking-wider">
                      1. Identité du Missionnaire
                    </h3>
                    <span className="text-[10px] text-slate-400">Bénéficiaire de l'Ordre de Mission</span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 border-b border-slate-800/60 gap-1">
                    <span className="text-slate-400 font-medium">Nom & Prénom(s) :</span>
                    <span className="font-bold text-amber-300 text-sm sm:text-right">
                      {data.identite?.nom_prenom || data.identite?.nom_complet || '—'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 border-b border-slate-800/60 gap-1">
                    <span className="text-slate-400 font-medium">Fonction / Titre :</span>
                    <span className="font-bold text-slate-200 sm:text-right">
                      {data.identite?.fonction || '—'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 gap-1">
                    <span className="text-slate-400 font-medium">Service / Structure de rattachement :</span>
                    <span className="font-bold text-slate-200 sm:text-right">
                      {data.identite?.service || data.identite?.structure || 'Université de Kindia'}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD 2: MISSION */}
              <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-xs text-white uppercase tracking-wider">
                      2. Détails de la Mission
                    </h3>
                    <span className="text-[10px] text-slate-400">Objet, destination et période autorisée</span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400 font-medium block mb-1">Objet de la mission :</span>
                    <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 text-slate-200 font-semibold leading-relaxed">
                      {data.mission?.objet_mission || '—'}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 border-b border-slate-800/60 gap-1">
                    <span className="text-slate-400 font-medium">Destination :</span>
                    <span className="font-extrabold text-blue-300 sm:text-right flex items-center sm:justify-end gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      {data.mission?.destination || '—'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Date de départ
                      </span>
                      <span className="font-bold text-slate-200 text-xs block">
                        {data.mission?.date_depart || '—'}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Date de retour
                      </span>
                      <span className="font-bold text-slate-200 text-xs block">
                        {data.mission?.date_retour || '—'}
                      </span>
                    </div>
                  </div>

                  {data.mission?.duree_jours && (
                    <div className="flex justify-between items-center py-1.5 text-slate-300">
                      <span className="text-slate-400 font-medium">Durée totale autorisée :</span>
                      <span className="font-extrabold text-white bg-slate-800 px-3 py-0.5 rounded-lg border border-slate-700">
                        {data.mission.duree_jours} {data.mission.duree_jours > 1 ? 'jours' : 'jour'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 3: TRANSPORT */}
              <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-xs text-white uppercase tracking-wider">
                      3. Moyen de Transport & Chauffeur
                    </h3>
                    <span className="text-[10px] text-slate-400">Logistique et mobilité</span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 border-b border-slate-800/60 gap-1">
                    <span className="text-slate-400 font-medium">Moyen de transport :</span>
                    <span className="font-bold text-slate-200 sm:text-right">
                      {data.transport?.moyen_transport || 'Véhicule service/Personnel'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 border-b border-slate-800/60 gap-1">
                    <span className="text-slate-400 font-medium">Immatriculation du Véhicule :</span>
                    <span className="font-mono font-black text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 sm:text-right self-start sm:self-auto">
                      {data.transport?.immatriculation && data.transport.immatriculation !== 'N/A' && data.transport.immatriculation !== '—' 
                        ? data.transport.immatriculation 
                        : 'Non spécifiée / N/A'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 gap-1">
                    <span className="text-slate-400 font-medium">Chauffeur assigné :</span>
                    <span className="font-bold text-slate-200 sm:text-right">
                      {data.transport?.chauffeur || 'Lui-même'}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD 4: DOCUMENT & SIGNATURE */}
              <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-xs text-white uppercase tracking-wider">
                      4. Informations du Document & Signature
                    </h3>
                    <span className="text-[10px] text-slate-400">Authentification officielle</span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 border-b border-slate-800/60 gap-1">
                    <span className="text-slate-400 font-medium">Numéro de l'Ordre de Mission :</span>
                    <span className="font-mono font-bold text-amber-300 sm:text-right">
                      {data.document?.reference || data.reference}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 border-b border-slate-800/60 gap-1">
                    <span className="text-slate-400 font-medium">Date d'émission / Signature :</span>
                    <span className="font-bold text-slate-200 sm:text-right">
                      {data.document?.date_signature || data.document?.date_emission || '—'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 border-b border-slate-800/60 gap-1">
                    <span className="text-slate-400 font-medium">Service émetteur :</span>
                    <span className="font-bold text-slate-200 sm:text-right">
                      {data.document?.service_emetteur || 'Secrétariat Général / Rectorat'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 border-b border-slate-800/60 gap-1">
                    <span className="text-slate-400 font-medium">Signataire officiel :</span>
                    <span className="font-extrabold text-emerald-300 sm:text-right">
                      {data.document?.signataire_officiel || 'Dr Mamadou Billo DOUMBOUYA, Secrétaire Général'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 gap-1">
                    <span className="text-slate-400 font-medium">Statut administratif dans UK-GED :</span>
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-2.5 py-1 rounded-full sm:text-right self-start sm:self-auto">
                      ✓ {data.document?.statut_actuel || 'SIGNÉ & CERTIFIÉ'}
                    </span>
                  </div>
                </div>

                {/* Scan Timestamp Banner */}
                {data.verification && (
                  <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Vérifié le {data.verification.verified_at_formatted}</span>
                    </div>
                    {data.verification.total_scans > 0 && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        Scan #{data.verification.total_scans}
                      </span>
                    )}
                  </div>
                )}

              </div>

            </div>

            {/* Institutional Certification Seal Footer */}
            <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-1">
              <div className="flex items-center justify-center space-x-1.5 text-amber-400 text-xs font-black">
                <ShieldCheck className="w-4 h-4" />
                <span>RÉPUBLIQUE DE GUINÉE</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Ministère de l'Enseignement Supérieur, de la Recherche Scientifique et de l'Innovation
              </p>
              <p className="text-[10px] text-slate-500">
                Université de Kindia — Système officiel de vérification des actes administratifs
              </p>
            </div>

            {/* Quick Actions (Scan another / Refresh) */}
            <div className="flex justify-center pt-2">
              <button
                onClick={() => { setData(null); setSearchRef(''); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition flex items-center space-x-1.5 border border-slate-700 shadow"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Vérifier un autre document</span>
              </button>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* ÉTAT 2 — DOCUMENT NON RECONNU                                             */}
        {/* ========================================================================= */}
        {!loading && data && data.status === 'NOT_FOUND' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-gradient-to-br from-red-950 via-rose-950 to-slate-950 border-2 border-red-500/60 p-6 sm:p-8 rounded-3xl text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-red-500/10">
                <XCircle className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <span className="bg-red-900/80 text-red-200 text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider inline-block border border-red-500/40">
                  Échec de Vérification
                </span>
                <h2 className="font-heading font-black text-2xl text-red-400 tracking-wide pt-1">
                  ✕ DOCUMENT NON RECONNU
                </h2>
                <p className="text-red-200 text-xs font-semibold max-w-md mx-auto">
                  Ce document n'existe pas dans le système UK-GED.
                </p>
              </div>

              {/* Warning box */}
              <div className="p-4 bg-red-950/80 rounded-2xl border border-red-500/30 text-left space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-red-300 font-bold">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>Avertissement de Sécurité & Contrôle</span>
                </div>
                <p className="text-red-200/80 text-[11px] leading-relaxed">
                  Attention : ce document peut être falsifié, le QR Code scanné est invalide ou la référence est incorrecte. Aucun acte officiel ne correspond à cet identifiant dans la base certifiée de l'Université de Kindia.
                </p>
                {lastScannedRef && (
                  <div className="pt-1 font-mono text-[10px] text-red-300/70">
                    Référence testée : {lastScannedRef}
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  onClick={() => { setData(null); setSearchRef(''); }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold transition border border-slate-700 flex items-center justify-center space-x-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Essayer une autre référence</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ÉTAT 3 — DOCUMENT ANNULÉ                                                  */}
        {/* ========================================================================= */}
        {!loading && data && data.status === 'CANCELLED' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-gradient-to-br from-amber-950 via-orange-950 to-slate-950 border-2 border-amber-500/60 p-6 sm:p-8 rounded-3xl text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-500/10">
                <AlertTriangle className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <span className="bg-amber-900/80 text-amber-200 text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider inline-block border border-amber-500/40">
                  Acte Administratif Invalide
                </span>
                <h2 className="font-heading font-black text-2xl text-amber-400 tracking-wide pt-1">
                  ⚠️ DOCUMENT ANNULÉ
                </h2>
                <p className="text-amber-200 text-xs font-semibold max-w-md mx-auto">
                  Cet Ordre de Mission a été officiellement annulé.
                </p>
              </div>

              <div className="p-4 bg-amber-950/80 rounded-2xl border border-amber-500/30 text-left space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-amber-300 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>Notification aux Services de Contrôle</span>
                </div>
                <p className="text-amber-200/90 text-[11px] leading-relaxed">
                  Cet Ordre de Mission n'est plus valide. Il ne confère aucune autorisation de déplacement ni prise en charge administrative au titre de l'Université de Kindia.
                </p>
                {data.reference && (
                  <div className="pt-1 font-mono text-[10px] text-amber-300">
                    Réf : {data.reference} {data.document?.statut_actuel ? `(${data.document.statut_actuel})` : ''}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => { setData(null); setSearchRef(''); }}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold transition border border-slate-700 flex items-center space-x-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Vérifier un autre document</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ÉTAT 4 — VÉRIFICATION INDISPONIBLE / ERREUR                               */}
        {/* ========================================================================= */}
        {!loading && data && (data.status === 'ERROR' || (!data.valid && data.status !== 'NOT_FOUND' && data.status !== 'CANCELLED')) && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl text-center space-y-4 shadow-2xl">
              <div className="w-14 h-14 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <span className="bg-slate-800 text-slate-300 text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider inline-block">
                  Service Indisponible
                </span>
                <h2 className="font-heading font-black text-xl text-white tracking-wide pt-1">
                  VÉRIFICATION INDISPONIBLE
                </h2>
                <p className="text-slate-400 text-xs max-w-md mx-auto">
                  {data.message || 'Le service de vérification est momentanément indisponible ou le format de la requête est incorrect.'}
                </p>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => fetchVerification(searchRef || lastScannedRef)}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl text-xs font-black transition flex items-center space-x-1.5 shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Réessayer la vérification</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Institutional Footer */}
      <footer className="py-5 px-4 text-center text-[10px] text-slate-500 border-t border-slate-900 bg-slate-950 space-y-1">
        <p className="font-semibold text-slate-400">
          UNIVERSITÉ DE KINDIA • Système de Gestion Électronique des Documents (UK-GED)
        </p>
        <p>
          Plateforme officielle sécurisée de vérification des actes administratifs • Kindia, République de Guinée
        </p>
      </footer>

    </div>
  );
}

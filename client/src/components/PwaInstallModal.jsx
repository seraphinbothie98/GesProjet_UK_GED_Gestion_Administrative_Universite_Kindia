import React from 'react';
import { usePwa } from '../context/PwaContext';
import { 
  Download, X, Smartphone, Monitor, Share, PlusSquare, 
  MoreVertical, CheckCircle2, ShieldCheck, ArrowRight, ExternalLink 
} from 'lucide-react';

export default function PwaInstallModal() {
  const { showGuideModal, closeGuideModal, platform, browserName, hasPrompt, promptInstall, isInstalled } = usePwa();

  if (!showGuideModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Kindia Colors */}
        <div className="bg-kindia-blue px-6 py-5 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-kindia-gold/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center space-x-3.5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0">
              <img 
                src="/icons/icon-192x192.png" 
                alt="Logo UK-GED" 
                className="w-full h-full object-contain"
                onError={(e) => { e.currentTarget.src = '/logo_univ_kindia_officiel.png'; }}
              />
            </div>
            <div>
              <span className="text-[10px] font-black text-kindia-gold uppercase tracking-wider block">
                Progressive Web App (PWA)
              </span>
              <h3 className="text-base font-extrabold text-white leading-tight">
                Installer UK-GED
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                Université de Kindia
              </p>
            </div>
          </div>

          <button 
            onClick={closeGuideModal}
            className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition relative z-10"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Main Status / Direct Install Button if supported */}
          {hasPrompt && (
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <Download className="w-5 h-5 text-kindia-blue shrink-0" />
                <div className="text-xs text-slate-700">
                  <span className="font-bold block text-slate-900">Installation directe disponible</span>
                  Cliquez ci-dessous pour lancer l'installation native.
                </div>
              </div>
              <button
                onClick={() => promptInstall()}
                className="w-full sm:w-auto px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 shrink-0"
              >
                <span>Installer maintenant</span>
                <ArrowRight className="w-4 h-4 text-kindia-gold" />
              </button>
            </div>
          )}

          {/* Benefits summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-800 block">Accès instantané</span>
              <span className="text-[9px] text-slate-500">Depuis le bureau ou mobile</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-800 block">Sans téléchargement</span>
              <span className="text-[9px] text-slate-500">Léger & sécurisé</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-800 block">Plein écran</span>
              <span className="text-[9px] text-slate-500">Expérience dédiée</span>
            </div>
          </div>

          {/* Contextual Step-by-Step Instructions */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              {platform === 'ios' && <Smartphone className="w-4 h-4 text-kindia-blue" />}
              {platform === 'android' && <Smartphone className="w-4 h-4 text-kindia-blue" />}
              {(platform === 'windows' || platform === 'macos' || platform === 'linux') && <Monitor className="w-4 h-4 text-kindia-blue" />}
              <span>
                {platform === 'ios' && 'Instructions pour iPhone / iPad (Safari)'}
                {platform === 'android' && 'Instructions pour Android (Chrome)'}
                {platform === 'windows' && 'Instructions pour Windows (Chrome / Edge)'}
                {platform === 'macos' && 'Instructions pour Mac (Chrome / Safari)'}
                {platform === 'linux' && 'Instructions pour Linux'}
              </span>
            </h4>

            {platform === 'ios' ? (
              <ol className="space-y-2.5 text-xs text-slate-700">
                <li className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="w-6 h-6 rounded-full bg-kindia-blue text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    Appuyez sur le bouton de <strong className="text-slate-900">Partage</strong> <Share className="w-3.5 h-3.5 inline text-blue-600 mx-1" /> situé en bas (sur iPhone) ou en haut (sur iPad) de votre navigateur Safari.
                  </div>
                </li>
                <li className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="w-6 h-6 rounded-full bg-kindia-blue text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    Faites défiler le menu vers le bas et touchez <strong className="text-slate-900">« Sur l'écran d'accueil »</strong> <PlusSquare className="w-3.5 h-3.5 inline text-slate-700 mx-1" />.
                  </div>
                </li>
                <li className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="w-6 h-6 rounded-full bg-kindia-blue text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    Touchez <strong className="text-slate-900">« Ajouter »</strong> en haut à droite. L'icône officielle UK-GED apparaîtra sur votre écran d'accueil.
                  </div>
                </li>
              </ol>
            ) : platform === 'android' ? (
              <ol className="space-y-2.5 text-xs text-slate-700">
                <li className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="w-6 h-6 rounded-full bg-kindia-blue text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    Appuyez sur les <strong className="text-slate-900">3 points verticaux</strong> <MoreVertical className="w-3.5 h-3.5 inline text-slate-700 mx-0.5" /> situés en haut à droite de votre navigateur Chrome.
                  </div>
                </li>
                <li className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="w-6 h-6 rounded-full bg-kindia-blue text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    Sélectionnez l'option <strong className="text-slate-900">« Installer l'application »</strong> ou <strong className="text-slate-900">« Ajouter à l'écran d'accueil »</strong>.
                  </div>
                </li>
                <li className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="w-6 h-6 rounded-full bg-kindia-blue text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    Confirmez en appuyant sur <strong className="text-slate-900">« Installer »</strong>. L'application UK-GED sera ajoutée à votre tiroir d'applications.
                  </div>
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-xs text-slate-700">
                <li className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="w-6 h-6 rounded-full bg-kindia-blue text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    Dans la barre d'adresse de votre navigateur (Chrome ou Edge), cliquez sur l'icône <strong className="text-slate-900">« Installer UK-GED »</strong> <Download className="w-3.5 h-3.5 inline text-kindia-blue mx-1" /> tout à droite de la barre d'URL.
                  </div>
                </li>
                <li className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="w-6 h-6 rounded-full bg-kindia-blue text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    Cliquez sur le bouton <strong className="text-slate-900">« Installer »</strong> dans la boîte de dialogue de confirmation.
                  </div>
                </li>
                <li className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="w-6 h-6 rounded-full bg-kindia-blue text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    UK-GED s'ouvrira immédiatement dans sa propre fenêtre applicative indépendante avec raccourci sur votre bureau.
                  </div>
                </li>
              </ol>
            )}
          </div>

          {/* Security note */}
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Application officielle certifiée Université de Kindia. Aucune donnée confidentielle n'est stockée hors ligne.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={closeGuideModal}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

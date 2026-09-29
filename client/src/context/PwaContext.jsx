import React, { createContext, useContext, useState, useEffect } from 'react';

const PwaContext = createContext(null);

export function PwaProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [platform, setPlatform] = useState('windows');
  const [browserName, setBrowserName] = useState('other');
  const [showGuideModal, setShowGuideModal] = useState(false);

  // 1. Détection de la plateforme et de l'environnement
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent || '';
    
    // Détection OS
    let detectedPlatform = 'windows';
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      detectedPlatform = 'ios';
    } else if (/Android/.test(ua)) {
      detectedPlatform = 'android';
    } else if (/Macintosh|MacIntel/.test(ua)) {
      detectedPlatform = 'macos';
    } else if (/Linux/.test(ua)) {
      detectedPlatform = 'linux';
    } else if (/Windows|Win32|Win64/.test(ua)) {
      detectedPlatform = 'windows';
    }
    setPlatform(detectedPlatform);

    // Détection Navigateur
    let detectedBrowser = 'chrome';
    if (/Edg\//.test(ua)) {
      detectedBrowser = 'edge';
    } else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
      detectedBrowser = 'chrome';
    } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
      detectedBrowser = 'safari';
    } else if (/Firefox\//.test(ua)) {
      detectedBrowser = 'firefox';
    } else if (/SamsungBrowser\//.test(ua)) {
      detectedBrowser = 'samsung';
    }
    setBrowserName(detectedBrowser);

    // 2. Détection si l'application est déjà en mode autonome (Standalone PWA)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      setIsInstallable(false);
    }

    // Écoute des changements de mode d'affichage
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e) => {
      if (e.matches) {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    // 3. Écoute de l'événement natif d'installation PWA
    const handleBeforeInstallPrompt = (e) => {
      // Empêcher l'affichage automatique natif de la bannière mini-infobar
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('[UK-GED PWA] Événement beforeinstallprompt capturé.');
    };

    // 4. Écoute de l'événement de réussite d'installation
    const handleAppInstalled = () => {
      console.log('[UK-GED PWA] UK-GED a été installé avec succès sur le système.');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  // 5. Déclenchement de l'installation
  const promptInstall = async () => {
    // Si l'application est déjà installée, rien à faire
    if (isInstalled) {
      return { outcome: 'already_installed' };
    }

    // Cas 1 : L'événement natif est disponible (Chrome, Edge, Android)
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          console.log('[UK-GED PWA] Installation acceptée par l\'utilisateur.');
          setIsInstalled(true);
          setIsInstallable(false);
          setDeferredPrompt(null);
          return { outcome: 'accepted' };
        } else {
          console.log('[UK-GED PWA] Installation refusée ou reportée.');
          return { outcome: 'dismissed' };
        }
      } catch (err) {
        console.warn('[UK-GED PWA] Erreur lors du prompt d\'installation :', err);
        setShowGuideModal(true);
        return { outcome: 'error', error: err };
      }
    } 
    // Cas 2 : L'installation native n'est pas directement déclenchable (iOS Safari, Firefox, etc.)
    else {
      setShowGuideModal(true);
      return { outcome: 'manual_guide' };
    }
  };

  const closeGuideModal = () => {
    setShowGuideModal(false);
  };

  return (
    <PwaContext.Provider
      value={{
        isInstalled,
        isInstallable,
        hasPrompt: Boolean(deferredPrompt),
        platform,
        browserName,
        promptInstall,
        showGuideModal,
        closeGuideModal,
        openGuideModal: () => setShowGuideModal(true)
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa doit être utilisé à l\'intérieur de PwaProvider');
  }
  return context;
}

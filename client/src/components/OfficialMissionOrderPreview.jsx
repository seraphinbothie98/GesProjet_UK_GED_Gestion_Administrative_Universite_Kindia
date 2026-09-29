import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { formatFullName, formatTransportDisplay, formatDriverDisplay } from '../utils/userUtils';

/**
 * Official University of Kindia Mission Order A4 High-Fidelity Component
 * Matches the official Republic of Guinea & Université de Kindia template standard.
 */
export default function OfficialMissionOrderPreview({ 
  mission = {}, 
  settings = {}, 
  signature = null, 
  isPrintMode = false,
  onPrint = null,
  onDownloadPdf = null
}) {
  const logoSrc = settings?.logo_path || '/uploads/logos/logo_univ_kindia_officiel.png';
  const watermarkSrc = settings?.watermark_path || '/uploads/logos/watermark_guinee_officiel.jpg';
  const watermarkOpacity = settings?.watermark_opacity !== undefined ? settings.watermark_opacity : 0.12;
  const watermarkEnabled = settings?.watermark_enabled !== 0;

  const missionaryName = formatFullName({
    nom: mission.missionary_last_name || mission.nom,
    prenoms: mission.missionary_firstnames || mission.prenoms,
    titre: mission.missionary_titre || mission.titre || mission.grade,
    full_name: mission.missionary_name
  }, mission.missionary_name || "Agent UK");

  const nationality = mission.nationality || "Guinéenne";
  const functionTitle = mission.function_title || "Agent UK";
  const destination = mission.destination || "Conakry";
  const missionObject = mission.object_of_mission || "Raisons de Service";
  
  const vehicleReg = mission.vehicle_registration || mission.vehicle_registration_snapshot || '';
  const rawTransport = mission.transport_mode || 'Véhicule service/Personnel';
  const transportMode = formatTransportDisplay(rawTransport, vehicleReg);
  const driverName = formatDriverDisplay(rawTransport, mission.driver_name || mission.driver_name_snapshot, mission.driver_option, missionaryName);

  const departureDate = mission.departure_date || "";
  const returnDate = mission.return_date || "Fin de mission";
  const reference = mission.reference || "2026/0001/MESRS/UK/RECT/SG";

  const dateStr = mission.signed_at 
    ? new Date(mission.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : (mission.created_at ? new Date(mission.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('fr-FR'));

  const signerName = signature?.signed_by_name ? formatFullName(signature.signed_by_name) : (settings?.current_sg_name ? formatFullName(settings.current_sg_name) : '');
  const signerRole = (signature?.signed_by_role || settings?.current_sg_role || "LE SECRÉTAIRE GÉNÉRAL").toUpperCase();
  const signatureImg = signature?.signature_image_path;

  const missionToken = mission.tracking_token || mission.token || mission.signature_token || mission.reference || 'UK-GED';
  const verificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/verification/ordre-mission/${encodeURIComponent(missionToken)}` : `/verification/ordre-mission/${encodeURIComponent(missionToken)}`;

  return (
    <div className="flex flex-col items-center">
      {/* Action Bar (Only in preview modal, hidden on direct paper print) */}
      {!isPrintMode && (
        <div className="w-full max-w-[210mm] mb-4 flex justify-between items-center bg-slate-800 text-white px-4 py-2.5 rounded-2xl shadow-md text-xs font-bold print:hidden">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Format Officiel A4 Portrait — Université de Kindia</span>
          </div>
          <div className="flex items-center space-x-2">
            {onPrint && (
              <button
                onClick={onPrint}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition flex items-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer</span>
              </button>
            )}
            {onDownloadPdf && (
              <button
                onClick={onDownloadPdf}
                className="px-4 py-1.5 bg-kindia-gold hover:bg-amber-400 text-slate-900 rounded-xl transition flex items-center space-x-1.5 font-extrabold shadow"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger PDF</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* A4 Document Sheet (210mm x 297mm) */}
      <div 
        id="official-mission-order-sheet"
        className="relative bg-white text-slate-900 shadow-2xl border border-slate-300 print:border-0 print:shadow-none mx-auto overflow-hidden font-serif"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '18mm 18mm 14mm 18mm',
          boxSizing: 'border-box',
          fontFamily: '"Times New Roman", Times, serif'
        }}
      >
        {/* ========================================================================= */}
        {/* 1. FILIGRANE OFFICIEL « GUINÉE » (POSITIONNÉ EN ARRIÈRE-PLAN DERRIÈRE LE TEXTE) */}
        {/* ========================================================================= */}
        {watermarkEnabled && watermarkSrc && (
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden"
            aria-hidden="true"
          >
            <img 
              src={watermarkSrc} 
              alt=""
              style={{
                opacity: watermarkOpacity,
                width: `${settings?.watermark_size || 360}px`,
                maxWidth: '80%',
                transform: `translate(${settings?.watermark_position_x || 0}px, ${settings?.watermark_position_y || 0}px) rotate(${settings?.watermark_rotation || 0}deg)`,
                filter: 'contrast(1.05)'
              }}
              className="select-none object-contain"
            />
          </div>
        )}

        {/* Content Container (z-10 over watermark) */}
        <div className="relative z-10 flex flex-col justify-between h-full min-h-[265mm]">
          
          {/* Top Section */}
          <div>
            {/* ========================================================================= */}
            {/* 2. EN-TÊTE INSTITUTIONNEL */}
            {/* ========================================================================= */}
            <div className="flex justify-between items-start gap-4">
              {/* GAUCHE : Logo officiel de l'Université de Kindia */}
              <div className="w-28 flex flex-col items-center flex-shrink-0">
                <img 
                  src={logoSrc} 
                  alt="Logo Université de Kindia" 
                  className="w-24 h-24 object-contain"
                />
              </div>

              {/* CENTRE / DROITE : Titres et coordonnées officiels */}
              <div className="flex-1 text-center pl-2">
                <div className="text-[13pt] font-bold italic tracking-wide uppercase text-slate-950 leading-tight">
                  REPUBLIQUE DE GUINEE
                </div>

                {/* Devise Nationale Tricolore */}
                <div className="text-[9.5pt] font-bold italic mt-0.5 space-x-1">
                  <span style={{ color: '#DC2626' }}>Travail</span>
                  <span className="text-slate-800"> - </span>
                  <span style={{ color: '#EAB308' }}>Justice</span>
                  <span className="text-slate-800"> - </span>
                  <span style={{ color: '#16A34A' }}>Solidarité</span>
                </div>

                <div className="text-[9pt] font-bold italic text-slate-900 mt-1 leading-snug">
                  Ministère de l'Enseignement Supérieur et de la Recherche Scientifique
                </div>

                {/* Université de Kindia (En BLEU institutionnel) */}
                <div 
                  className="text-[17pt] font-bold italic tracking-tight mt-1 leading-tight"
                  style={{ color: '#002B80' }}
                >
                  Université de Kindia
                </div>

                <div className="text-[8.5pt] italic text-slate-800 mt-0.5">
                  BP 212
                </div>

                <div className="text-[8.5pt] italic text-slate-800 flex justify-center items-center space-x-4 mt-0.5">
                  <span>Email : <strong className="text-red-700 not-italic font-sans text-[8pt]">{settings?.email || "rectorat@univ-kindia.org"}</strong></span>
                  <span>Site : <strong className="text-slate-900 not-italic font-sans text-[8pt]">{settings?.website || "www.univ-kindia.org"}</strong></span>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 3. LIGNE DE SÉPARATION HORIZONTALE NOIRE (CONFORME AU MODÈLE PERSONNALISÉ) */}
            {/* ========================================================================= */}
            <div className="w-full h-[1.5px] bg-slate-950 mt-3.5 mb-3" />

            {/* ========================================================================= */}
            {/* 4. RÉFÉRENCE & TITRE OFFICIEL */}
            {/* ========================================================================= */}
            <div className="flex justify-between items-center text-[10.5pt] font-bold text-slate-950 mt-2">
              <div>Réf: <span className="font-mono">{reference}</span></div>
            </div>

            <div className="text-center my-4">
              <h1 
                className="text-[20pt] font-bold tracking-wider uppercase inline-block pb-0.5 border-b-2 leading-none"
                style={{ color: '#002B80', borderColor: '#002B80' }}
              >
                ORDRE DE MISSION
              </h1>
            </div>

            {/* ========================================================================= */}
            {/* 5. INFORMATIONS DYNAMIQUES DU MISSIONNAIRE (Times New Roman) */}
            {/* ========================================================================= */}
            <div className="space-y-2.5 text-[11.5pt] leading-relaxed text-slate-950 mt-4">
              <div className="flex items-baseline">
                <span className="w-56 flex-shrink-0 text-slate-900 font-normal">Il est ordonné à :</span>
                <span className="font-bold uppercase tracking-wide">{missionaryName}</span>
              </div>

              <div className="flex items-baseline">
                <span className="w-56 flex-shrink-0 text-slate-900 font-normal">Nationalité :</span>
                <span className="font-bold">{nationality}</span>
              </div>

              <div className="flex items-baseline">
                <span className="w-56 flex-shrink-0 text-slate-900 font-normal">Profession ou Fonction :</span>
                <span className="font-bold">{functionTitle}</span>
              </div>

              <div className="flex items-baseline">
                <span className="w-56 flex-shrink-0 text-slate-900 font-normal">De se rendre à :</span>
                <span className="font-bold">{destination}</span>
              </div>

              <div className="flex items-baseline">
                <span className="w-56 flex-shrink-0 text-slate-900 font-normal">Objet de la Mission :</span>
                <span className="font-bold">{missionObject}</span>
              </div>

              <div className="flex items-baseline">
                <span className="w-56 flex-shrink-0 text-slate-900 font-normal">Moyen de Transport :</span>
                <span className="font-bold">{transportMode}</span>
              </div>

              <div className="flex items-baseline">
                <span className="w-56 flex-shrink-0 text-slate-900 font-normal">Date de Départ :</span>
                <span className="font-bold">{departureDate}</span>
              </div>

              <div className="flex items-baseline">
                <span className="w-56 flex-shrink-0 text-slate-900 font-normal">Date de retour :</span>
                <span className="font-bold">{returnDate}</span>
              </div>

              <div className="flex items-baseline">
                <span className="w-56 flex-shrink-0 text-slate-900 font-normal">Conduit par :</span>
                <span className="font-bold">{driverName}</span>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 6. CLAUSE ADMINISTRATIVE DE RÉQUISITION ET DE FACILITATION */}
            {/* ========================================================================= */}
            <div className="mt-5 text-[10.5pt] italic text-slate-900 leading-normal pl-1">
              <p>Les autorités civiles, militaires des localités traversées sont priées de bien</p>
              <p>faciliter l'accomplissement de la présente mission.</p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 7. SIGNATURE DU SECRÉTAIRE GÉNÉRAL ET QR CODE OFFICIEL SANS TEXTE PARASITE */}
          {/* ========================================================================= */}
          <div className="mt-8 pt-4">
            <div className="flex justify-between items-end">
              {/* GAUCHE : QR Code Sécurisé Uniquement (Aucun lien ni texte autour) */}
              <div className="flex flex-col items-start pl-1">
                <div className="p-1 bg-white border border-slate-300 rounded shadow-sm">
                  <QRCodeSVG 
                    value={verificationUrl} 
                    size={64} 
                    level="M" 
                    includeMargin={false}
                  />
                </div>
              </div>

              {/* DROITE : Bloc Signature du Secrétaire Général */}
              <div className="w-72 text-right pr-2">
                <div className="text-[11pt] font-bold text-slate-950">
                  Kindia, le {dateStr}
                </div>

                <div 
                  className="text-[11.5pt] font-bold tracking-wide mt-2 uppercase text-slate-950"
                >
                  {signerRole}
                </div>

                {/* Signature électronique image si disponible */}
                <div className="h-16 flex items-center justify-end my-1">
                  {signatureImg ? (
                    <img 
                      src={signatureImg.startsWith('http') ? signatureImg : signatureImg} 
                      alt="Signature SG" 
                      className="max-h-16 object-contain"
                    />
                  ) : (
                    <div className="text-[9pt] italic text-slate-400 border border-dashed border-slate-300 rounded px-3 py-1">
                      [Signature Électronique Certifiée]
                    </div>
                  )}
                </div>

                {/* Nom du SG souligné */}
                {signerName && (
                  <div className="text-[11pt] font-bold text-slate-950 inline-block pb-0.5 border-b border-slate-950">
                    {signerName}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

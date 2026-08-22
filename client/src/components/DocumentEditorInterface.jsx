import React, { useState } from 'react';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Table, Eye, Edit3, Sparkles, Hash, Calendar, Building, User
} from 'lucide-react';

/**
 * DocumentEditorInterface
 * Universal document drafting component with rich toolbar, placeholder insertion,
 * and live institutional preview.
 * Fully decoupled from workflow logic to allow seamless future ONLYOFFICE Docs binding.
 */
export default function DocumentEditorInterface({ 
  value, 
  onChange, 
  headerText, 
  footerText, 
  serviceName, 
  referenceCode, 
  recipientName, 
  objectTitle,
  readOnly = false 
}) {
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'preview'

  const insertPlaceholder = (tag) => {
    if (readOnly) return;
    const newText = (value || '') + ` ${tag} `;
    onChange(newText);
  };

  const applyFormatting = (prefix, suffix = '') => {
    if (readOnly) return;
    const newText = `${value || ''}\n${prefix}Texte ici${suffix}\n`;
    onChange(newText);
  };

  const insertTableTemplate = () => {
    if (readOnly) return;
    const tableText = `\n[TABLEAU]\n| N° | Désignation / Pièce | Quantité | Observation |\n|---|---|---|---|\n| 1 | Pièce principale | 1 | Conforme |\n[/TABLEAU]\n`;
    onChange((value || '') + tableText);
  };

  const placeholderTags = [
    { label: 'Réf. Acte', tag: '{{REFERENCE}}', icon: Hash },
    { label: 'Date du jour', tag: '{{DATE}}', icon: Calendar },
    { label: 'Structure Émettrice', tag: '{{SERVICE_EMETTEUR}}', icon: Building },
    { label: 'Destinataire', tag: '{{DESTINATAIRE}}', icon: User },
    { label: 'Pièces Jointes', tag: '{{PIECES_JOINTES}}', icon: List }
  ];

  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Editor / Preview Switcher */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'editor' 
                ? 'bg-kindia-blue text-white shadow-sm' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Éditeur de Rédaction</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'preview' 
                ? 'bg-kindia-gold text-kindia-blue shadow-sm' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Aperçu Officiel Format A4</span>
          </button>
        </div>

        {/* Dynamic Placeholder Chips */}
        {!readOnly && activeTab === 'editor' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center mr-1">
              <Sparkles className="w-3 h-3 text-amber-500 mr-1" /> Insérer :
            </span>
            {placeholderTags.map((p, idx) => {
              const Icon = p.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => insertPlaceholder(p.tag)}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-medium transition flex items-center space-x-1 shadow-2xs"
                  title={`Insérer la variable ${p.tag}`}
                >
                  <Icon className="w-2.5 h-2.5 text-amber-700" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Toolbar (Only for editor mode) */}
      {!readOnly && activeTab === 'editor' && (
        <div className="px-4 py-2 border-b border-slate-200 bg-white flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => applyFormatting('**', '**')}
            className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            title="Gras"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting('*', '*')}
            className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            title="Italique"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting('<u>', '</u>')}
            className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            title="Souligné"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          <button
            type="button"
            onClick={() => applyFormatting('### ')}
            className="px-2 py-1 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded transition"
            title="Titre de section"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => applyFormatting('• ')}
            className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            title="Liste à puces"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting('1. ')}
            className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            title="Liste numérotée"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={insertTableTemplate}
            className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition flex items-center space-x-1"
            title="Insérer un tableau récapitulatif"
          >
            <Table className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium">Tableau</span>
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      {activeTab === 'editor' ? (
        <div className="p-4 flex-1">
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            rows={12}
            placeholder="Rédigez ici le corps de votre document administratif (exposé des motifs, objet, références, demande ou décision)..."
            className="w-full h-full min-h-[280px] p-3 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-kindia-blue focus:border-transparent outline-hidden font-mono leading-relaxed"
          />
          <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>Rédigé dans l'espace documentaire de l'Université de Kindia (UK-GED)</span>
            <span>{(value || '').length} caractères</span>
          </p>
        </div>
      ) : (
        /* Official Page Preview Area (A4 layout simulation) */
        <div className="p-6 bg-slate-100 flex justify-center overflow-auto max-h-[600px]">
          <div className="w-full max-w-[720px] bg-white rounded-lg shadow-md p-8 border border-slate-200 text-slate-900 min-h-[650px] flex flex-col justify-between">
            {/* Document Header */}
            <div>
              <div className="text-center pb-4 border-b border-slate-200 mb-6">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">RÉPUBLIQUE DE GUINÉE</p>
                <p className="text-[10px] italic text-slate-500">Travail – Justice – Solidarité</p>
                <div className="my-2 inline-block bg-kindia-blue text-white px-3 py-1 rounded text-xs font-black tracking-wider uppercase">
                  UNIVERSITÉ DE KINDIA
                </div>
                <div className="text-xs font-bold text-slate-800 mt-1 whitespace-pre-line">
                  {headerText || serviceName || "DÉPARTEMENT D'INFORMATIQUE"}
                </div>
              </div>

              {/* References and Recipient Box */}
              <div className="flex justify-between items-start text-xs mb-6">
                <div className="space-y-1">
                  <p><strong className="text-slate-600">Réf :</strong> <span className="font-mono font-bold text-kindia-blue">{referenceCode || 'FS/INFO/2026/0001'}</span></p>
                  <p><strong className="text-slate-600">Date :</strong> {new Date().toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg max-w-[260px] text-right">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">À l'attention de :</span>
                  <span className="block font-bold text-slate-800 text-xs">{recipientName || 'Monsieur le Recteur'}</span>
                </div>
              </div>

              {/* Object Title */}
              <div className="bg-kindia-blue/5 border-l-4 border-kindia-blue p-3 rounded-r-lg mb-6">
                <span className="text-[10px] font-black uppercase text-kindia-blue tracking-wider block">Objet :</span>
                <span className="text-sm font-bold text-slate-900">{objectTitle || 'Transmission officielle de dossier administratif'}</span>
              </div>

              {/* Body Content */}
              <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line min-h-[160px]">
                {value || <span className="italic text-slate-400">(Aucun contenu rédigé pour l'instant...)</span>}
              </div>
            </div>

            {/* Document Footer */}
            <div className="pt-6 mt-8 border-t border-slate-200 text-center text-[10px] text-slate-500">
              <p className="font-medium">{footerText || "UNIVERSITÉ DE KINDIA • BP 164 Kindia, Guinée • Document certifié UK-GED"}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Scellé sous le contrôle de la gouvernance administrative et documentaire de l'Université de Kindia</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

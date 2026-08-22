import React from 'react';
import { 
  Folder, Send, FileText, Layers, Briefcase, GraduationCap, 
  Coins, Award, Shield, Bookmark, HardDrive, Database, 
  Inbox, BookOpen, FileCheck, BarChart3, CheckSquare, Scroll, 
  Building2, Tag, HelpCircle, Archive
} from 'lucide-react';

export const ICON_MAP = {
  Folder: Folder,
  Send: Send,
  FileText: FileText,
  Layers: Layers,
  Briefcase: Briefcase,
  GraduationCap: GraduationCap,
  Coins: Coins,
  Award: Award,
  Shield: Shield,
  Bookmark: Bookmark,
  HardDrive: HardDrive,
  Database: Database,
  Inbox: Inbox,
  BookOpen: BookOpen,
  FileCheck: FileCheck,
  BarChart: BarChart3,
  BarChart3: BarChart3,
  CheckSquare: CheckSquare,
  Scroll: Scroll,
  Building2: Building2,
  Tag: Tag,
  Archive: Archive,
  HelpCircle: HelpCircle
};

export const AVAILABLE_ICONS = [
  { id: 'Folder', label: 'Dossier général', icon: Folder },
  { id: 'Send', label: 'Soit-transmis / Envois', icon: Send },
  { id: 'FileText', label: 'Demandes & Actes', icon: FileText },
  { id: 'BarChart3', label: 'Rapports & Stats', icon: BarChart3 },
  { id: 'BookOpen', label: 'Recherche & Thèses', icon: BookOpen },
  { id: 'Briefcase', label: 'Projets / Affaires', icon: Briefcase },
  { id: 'GraduationCap', label: 'Académique / Étudiants', icon: GraduationCap },
  { id: 'Coins', label: 'Finances & Budget', icon: Coins },
  { id: 'Award', label: 'Décrets & Distinctions', icon: Award },
  { id: 'Shield', label: 'Juridique & Sécurité', icon: Shield },
  { id: 'Bookmark', label: 'Actes importants', icon: Bookmark },
  { id: 'Layers', label: 'Dossiers complexes', icon: Layers },
  { id: 'FileCheck', label: 'Attestations & PV', icon: FileCheck },
  { id: 'Database', label: 'Base documentaire', icon: Database }
];

export const COLOR_PALETTE = [
  { id: 'text-kindia-blue bg-blue-50 border-blue-200', label: 'Bleu Kindia', bg: 'bg-blue-600' },
  { id: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Ambre / Or', bg: 'bg-amber-500' },
  { id: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Vert Émeraude', bg: 'bg-emerald-600' },
  { id: 'text-purple-700 bg-purple-50 border-purple-200', label: 'Pourpre', bg: 'bg-purple-600' },
  { id: 'text-teal-700 bg-teal-50 border-teal-200', label: 'Sarcelle', bg: 'bg-teal-600' },
  { id: 'text-indigo-700 bg-indigo-50 border-indigo-200', label: 'Indigo', bg: 'bg-indigo-600' },
  { id: 'text-rose-700 bg-rose-50 border-rose-200', label: 'Rose Rubis', bg: 'bg-rose-600' },
  { id: 'text-slate-700 bg-slate-100 border-slate-300', label: 'Gris Ardoise', bg: 'bg-slate-600' }
];

export default function DynamicCategoryIcon({ iconName, className = 'w-4 h-4' }) {
  const IconComponent = ICON_MAP[iconName] || Folder;
  return <IconComponent className={className} />;
}

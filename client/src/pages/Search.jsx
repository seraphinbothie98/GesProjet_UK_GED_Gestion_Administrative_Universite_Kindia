import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import { Search as SearchIcon, Filter, Eye, ShieldCheck } from 'lucide-react';

export default function Search({ onSelectDocument }) {
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter(d => {
    const matchesTerm = searchTerm === '' || 
      d.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.sender_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.current_service_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === '' || d.document_type === typeFilter;
    const matchesStatus = statusFilter === '' || d.status === statusFilter;

    return matchesTerm && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <SearchIcon className="w-5 h-5 text-kindia-blue" />
          <h2 className="font-heading font-bold text-lg text-slate-800">Moteur de Recherche Globale Sécurisée</h2>
        </div>

        <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-xl flex items-center space-x-2 border border-blue-200">
          <ShieldCheck className="w-4 h-4 text-kindia-blue shrink-0" />
          <span>La recherche respecte strictement les autorisations ABAC. Seuls les documents autorisés sont affichés.</span>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Recherche par référence, objet, expéditeur, service..."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-kindia-blue"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs p-3 rounded-xl border border-slate-300"
          >
            <option value="">-- Tous les types de documents --</option>
            <option value="INCOMING_MAIL">Courriers entrants</option>
            <option value="OUTGOING_MAIL">Courriers sortants</option>
            <option value="MISSION_ORDER">Ordres de mission</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs p-3 rounded-xl border border-slate-300"
          >
            <option value="">-- Tous les statuts --</option>
            <option value="CREATED">Enregistré</option>
            <option value="PENDING">En attente</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="SIGNED">Signé & Scellé</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-700">
          Résultats ({filteredDocs.length} document(s) trouvé(s))
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Référence</th>
                <th className="p-3.5">Titre / Objet</th>
                <th className="p-3.5">Expéditeur</th>
                <th className="p-3.5">Détenteur Actuel</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Recherche en cours...</td></tr>
              ) : filteredDocs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucun document ne correspond à votre recherche.</td></tr>
              ) : (
                filteredDocs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-bold text-kindia-blue">{doc.reference}</td>
                    <td className="p-3.5 text-slate-800 font-semibold max-w-xs truncate">{doc.title}</td>
                    <td className="p-3.5 text-slate-700">{doc.sender_name || 'N/A'}</td>
                    <td className="p-3.5 text-slate-700 font-bold">{doc.current_service_name}</td>
                    <td className="p-3.5"><StatusBadge status={doc.status} /></td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onSelectDocument(doc.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-kindia-blue hover:text-white text-slate-700 font-bold rounded-lg transition inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Consulter</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

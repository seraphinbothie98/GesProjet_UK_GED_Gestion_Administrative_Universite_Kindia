import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldAlert, Terminal } from 'lucide-react';
import { formatFullName } from '../utils/userUtils';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = async () => {
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading font-bold text-lg text-slate-800">Journal d’Audit Inviolable (Audit Logs)</h2>
          <p className="text-xs text-slate-500">Traçabilité Sécurisée de Toutes les Opérations Système</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Horodatage</th>
                <th className="p-3.5">Utilisateur</th>
                <th className="p-3.5">Matricule</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Entité</th>
                <th className="p-3.5">Adresse IP</th>
                <th className="p-3.5">Détails / Métadonnées</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Chargement du journal d’audit...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Aucun événement d’audit journalisé.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString('fr-FR')}
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {log.first_name ? formatFullName(log) : 'Système / Anonyme'}
                    </td>
                    <td className="p-3.5 text-kindia-blue font-bold">{log.matricule || 'N/A'}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 font-semibold">{log.entity_type} #{log.entity_id || ''}</td>
                    <td className="p-3.5 text-slate-500 font-mono text-[10px]">{log.ip_address}</td>
                    <td className="p-3.5 font-mono text-[10px] text-slate-600 max-w-xs truncate">
                      {log.metadata}
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

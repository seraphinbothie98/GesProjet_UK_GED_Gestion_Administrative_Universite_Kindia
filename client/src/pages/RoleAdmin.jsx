import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Lock, Shield, CheckCircle, Plus, X } from 'lucide-react';

export default function RoleAdmin() {
  const [roles, setRoles] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [activeTab, setActiveTab] = useState('ROLES'); // 'ROLES' | 'DOC_TYPES'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const r = await api.getRoles();
      setRoles(r);
      const dt = await api.getDocumentTypes();
      setDocTypes(dt);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDirectArchive = async (code, currentSetting) => {
    try {
      await api.updateDocumentTypeConfig(code, !currentSetting);
      loadData();
    } catch (err) {
      alert('Erreur de mise à jour : ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-kindia-blue text-white flex items-center justify-center font-bold">
            <Lock className="w-5 h-5 text-kindia-gold" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-800">Administration & Sécurité UK-GED</h2>
            <p className="text-xs text-slate-500">Habilitations RBAC & Paramétrage des Types de Documents</p>
          </div>
        </div>

        <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('ROLES')}
            className={`px-3.5 py-1.5 rounded-lg transition ${activeTab === 'ROLES' ? 'bg-white text-kindia-blue shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Matrice des Rôles
          </button>
          <button
            onClick={() => setActiveTab('DOC_TYPES')}
            className={`px-3.5 py-1.5 rounded-lg transition ${activeTab === 'DOC_TYPES' ? 'bg-white text-kindia-blue shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            📁 Configuration Archivage Direct
          </button>
        </div>
      </div>

      {activeTab === 'ROLES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(r => (
            <div key={r.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-kindia-gold uppercase tracking-wider">{r.code}</span>
                  <h3 className="font-heading font-bold text-sm text-slate-800">{r.name}</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800">
                  {r.permissions?.length || 0} permissions
                </span>
              </div>

              <p className="text-xs text-slate-500">{r.description}</p>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                {r.permissions?.map(p => (
                  <span key={p.code} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                    <CheckCircle className="w-3 h-3 text-emerald-600 mr-1" />
                    {p.code}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'DOC_TYPES' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div>
            <h3 className="font-heading font-bold text-sm text-slate-800">Autorisations d'Archivage Direct par Type de Document (Règle 14)</h3>
            <p className="text-xs text-slate-500">L'administrateur peut autoriser ou désactiver l'archivage direct sans circuit pour chaque type de document.</p>
          </div>

          <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Intitulé du Type</th>
                <th className="p-3.5">Catégorie</th>
                <th className="p-3.5">Archivage Direct Autorisé ?</th>
                <th className="p-3.5 text-right">Action Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {docTypes.map(dt => (
                <tr key={dt.code} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5 font-bold text-kindia-blue">{dt.code}</td>
                  <td className="p-3.5 font-bold text-slate-800">{dt.label}</td>
                  <td className="p-3.5 text-slate-500">{dt.category}</td>
                  <td className="p-3.5">
                    {dt.allow_direct_archive ? (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        ✓ Autorisé (Archivage Direct)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        ✕ Requis Traitement / Circuit
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => handleToggleDirectArchive(dt.code, dt.allow_direct_archive === 1)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                        dt.allow_direct_archive
                          ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      {dt.allow_direct_archive ? 'Désactiver Direct' : 'Autoriser Direct'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

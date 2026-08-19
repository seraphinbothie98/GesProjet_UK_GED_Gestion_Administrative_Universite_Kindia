import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Building2, Plus, Edit, Power, Users, FileText, X } from 'lucide-react';

export default function ServiceAdmin() {
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [error, setError] = useState('');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [headUserId, setHeadUserId] = useState('');
  const [status, setStatus] = useState('ACTIVE');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const sData = await api.getServices();
      setServices(sData);
      const uData = await api.getUsers();
      setUsers(uData);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingService(null);
    setCode('');
    setName('');
    setHeadUserId('');
    setStatus('ACTIVE');
    setShowModal(true);
  };

  const handleOpenEdit = (s) => {
    setEditingService(s);
    setCode(s.code);
    setName(s.name);
    setHeadUserId(s.head_user_id || '');
    setStatus(s.status);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingService) {
        await api.createService({
          id: editingService.id,
          name,
          head_user_id: headUserId || null,
          status
        });
      } else {
        await api.createService({
          code,
          name,
          head_user_id: headUserId || null
        });
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde du service.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-kindia-blue text-white flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5 text-kindia-gold" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-800">Administration des Services (30 Préconfigurés)</h2>
            <p className="text-xs text-slate-500">Organigramme Institutionnel de l'Université de Kindia</p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
        >
          <Plus className="w-4 h-4 text-kindia-gold" />
          <span>Nouveau Service</span>
        </button>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Nom Officiel du Service</th>
                <th className="p-3.5">Responsable Affecté</th>
                <th className="p-3.5">Utilisateurs</th>
                <th className="p-3.5">Documents actuels</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Chargement...</td></tr>
              ) : (
                services.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-bold text-kindia-blue">{s.code}</td>
                    <td className="p-3.5 font-bold text-slate-800">{s.name}</td>
                    <td className="p-3.5 text-slate-600">
                      {s.head_first_name ? `${s.head_first_name} ${s.head_last_name}` : 'Non assigné'}
                    </td>
                    <td className="p-3.5 text-slate-700">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 font-bold">
                        <Users className="w-3 h-3 mr-1 text-slate-400" /> {s.user_count || 0}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold">
                        <FileText className="w-3 h-3 mr-1 text-blue-500" /> {s.document_count || 0}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 bg-slate-100 hover:bg-kindia-blue hover:text-white rounded-lg transition"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-kindia-blue p-4 text-white flex justify-between items-center">
              <h3 className="font-heading font-bold text-sm">
                {editingService ? `Modifier ${editingService.code}` : 'Créer un Nouveau Service'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl">{error}</div>}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Code du Service *</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={!!editingService}
                  placeholder="Ex: DAF"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nom du Service *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Division des Affaires Financières"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Responsable du Service</label>
                <select
                  value={headUserId}
                  onChange={(e) => setHeadUserId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="">-- Aucun responsable --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.function_title})</option>
                  ))}
                </select>
              </div>

              {editingService && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Statut du Service</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value="ACTIVE">Actif (Opérationnel)</option>
                    <option value="INACTIVE">Inactif (Désactivé)</option>
                  </select>
                </div>
              )}

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 font-semibold text-slate-600">Annuler</button>
                <button type="submit" className="px-5 py-2 bg-kindia-blue text-white font-bold rounded-xl shadow">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

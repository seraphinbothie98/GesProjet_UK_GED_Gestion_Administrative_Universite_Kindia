import React from 'react';
import { ArrowDown, CheckCircle2, Clock, CornerUpLeft, Send, FileText, UserCheck } from 'lucide-react';

export default function TrajectoryTimeline({ history = [], transfers = [] }) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-slate-400 p-4">Aucun historique disponible.</p>;
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'CREATE': return <FileText className="w-4 h-4 text-blue-600" />;
      case 'ORIENT': return <Send className="w-4 h-4 text-indigo-600" />;
      case 'TRANSMIT': return <Send className="w-4 h-4 text-emerald-600" />;
      case 'RETURN': return <CornerUpLeft className="w-4 h-4 text-red-600" />;
      case 'SIGN': return <UserCheck className="w-4 h-4 text-kindia-gold" />;
      case 'ARCHIVE': return <CheckCircle2 className="w-4 h-4 text-slate-600" />;
      default: return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="py-4">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center space-x-2">
        <span>Cheminement & Historique Administratif</span>
      </h4>

      <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
        {history.map((step, idx) => (
          <div key={step.id || idx} className="relative pl-6 group">
            {/* Circle Node */}
            <div className="absolute -left-[17px] top-0.5 w-8 h-8 rounded-full bg-white border-2 border-kindia-blue flex items-center justify-center shadow-sm">
              {getActionIcon(step.action)}
            </div>

            {/* Step Card */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-kindia-blue">
                  {step.service_name} ({step.first_name} {step.last_name})
                </span>
                <span className="text-[10px] font-medium text-slate-400">
                  {new Date(step.timestamp).toLocaleString('fr-FR')}
                </span>
              </div>

              <div className="text-xs text-slate-700 font-medium mt-1">
                {step.details}
              </div>

              <div className="mt-2 text-[10px] inline-block px-2 py-0.5 rounded font-bold uppercase bg-slate-100 text-slate-600">
                Action : {step.action}
              </div>
            </div>

            {idx < history.length - 1 && (
              <div className="flex justify-center my-1 text-slate-300">
                <ArrowDown className="w-4 h-4 text-slate-300" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

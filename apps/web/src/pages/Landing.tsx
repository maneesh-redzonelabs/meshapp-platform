import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/context/ToastContext';

const ROLES = [
  { key: 'Doctor', label: 'Doctor', sub: 'DPP Partner', icon: 'fa-user-doctor', color: 'bg-purple-100 text-purple-700', route: '/auth/doctor' },
  { key: 'Patient', label: 'Patient', sub: 'Care Portal', icon: 'fa-hospital-user', color: 'bg-teal-100 text-teal-700', route: '/auth/patient' },
  { key: 'MR', label: 'MR', sub: 'Med Representative', icon: 'fa-briefcase-medical', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'Paramedical', label: 'Paramedical', sub: 'Nursing & Allied', icon: 'fa-notes-medical', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'Medico Legal', label: 'Medico Legal', sub: 'Legal Experts', icon: 'fa-scale-balanced', color: 'bg-amber-100 text-amber-700' },
  { key: 'Supplier', label: 'Medico Supplier', sub: 'Medical Supplies', icon: 'fa-store', color: 'bg-rose-100 text-rose-700' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { show } = useToast();

  function selectRole(role: typeof ROLES[number]) {
    if (role.route) {
      navigate(role.route);
    } else {
      show(`${role.label} portal is coming soon.`, 'info');
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-cover bg-center"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(245,243,255,0.95), rgba(255,255,255,0.97), rgba(245,243,255,0.95)), url('https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1600&auto=format&fit=crop&q=80')",
      }}
    >
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-purple-600 mx-auto flex items-center justify-center text-white text-2xl shadow-lg shadow-purple-500/30 mb-3">
            <i className="fa-solid fa-stethoscope" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-purple-950">MeshApp AI</h1>
          <p className="text-sm font-semibold text-purple-900 mt-1">Select Your Role to Continue</p>
          <p className="text-xs text-purple-700/80 mt-1">Unified Portal for the Medical Ecosystem</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {ROLES.map((role) => (
            <button
              key={role.key}
              onClick={() => selectRole(role)}
              className="bg-white/90 hover:bg-purple-50 p-4 rounded-2xl border-2 border-purple-200 hover:border-purple-500 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group"
            >
              <div className={`w-12 h-12 rounded-xl ${role.color} flex items-center justify-center mb-2 text-lg group-hover:scale-110 transition-transform`}>
                <i className={`fa-solid ${role.icon}`} />
              </div>
              <span className="text-sm font-bold text-purple-950">{role.label}</span>
              <span className="text-[11px] text-slate-500 mt-0.5">{role.sub}</span>
            </button>
          ))}
        </div>

        <p className="text-center text-[11px] text-purple-500 mt-10">MeshApp AI Infrastructure · Multi-Role Ecosystem</p>
      </div>
    </div>
  );
}

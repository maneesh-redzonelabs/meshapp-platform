import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from './NotificationBell';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

export function DashboardLayout({ navItems, brandSubtitle }: { navItems: NavItem[]; brandSubtitle: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const primaryMobileItems = navItems.slice(0, 4);
  const overflowMobileItems = navItems.slice(4);

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-purple-50/40 flex">
      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col bg-white border-r border-purple-100 h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-purple-100 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
            <i className="fa-solid fa-stethoscope" />
          </div>
          <div>
            <p className="font-bold text-purple-950 text-sm leading-tight">MeshApp AI</p>
            <p className="text-[11px] text-slate-500">{brandSubtitle}</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? 'bg-purple-100 text-purple-800' : 'text-slate-600 hover:bg-purple-50'
                }`
              }
            >
              <i className={`fa-solid ${item.icon} w-4 text-center`} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-purple-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            <i className="fa-solid fa-right-from-bracket w-4 text-center" /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-purple-100 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center text-xs">
              <i className="fa-solid fa-stethoscope" />
            </div>
            <span className="font-bold text-purple-950 text-sm">MeshApp AI</span>
          </div>
          <div className="hidden md:block text-sm text-slate-500">Welcome back, {user?.display_name || 'there'}</div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm overflow-hidden">
              {user?.photo_url ? (
                <img src={user.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (user?.display_name || 'U').slice(0, 1).toUpperCase()
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-purple-100 flex items-stretch shadow-[0_-4px_12px_rgba(124,58,237,0.08)]">
        {primaryMobileItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive ? 'text-purple-700' : 'text-slate-500'
              }`
            }
          >
            <i className={`fa-solid ${item.icon} text-base`} />
            {item.label}
          </NavLink>
        ))}
        {overflowMobileItems.length > 0 && (
          <button
            onClick={() => setMobileMoreOpen((v) => !v)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"
          >
            <i className="fa-solid fa-ellipsis text-base" />
            More
          </button>
        )}
      </nav>

      {mobileMoreOpen && overflowMobileItems.length > 0 && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/50 flex items-end" onClick={() => setMobileMoreOpen(false)}>
          <div className="bg-white w-full rounded-t-2xl p-4 grid grid-cols-3 gap-3" onClick={(e) => e.stopPropagation()}>
            {overflowMobileItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMoreOpen(false)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-purple-50 text-purple-800 text-xs font-medium"
              >
                <i className={`fa-solid ${item.icon}`} />
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium"
            >
              <i className="fa-solid fa-right-from-bracket" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

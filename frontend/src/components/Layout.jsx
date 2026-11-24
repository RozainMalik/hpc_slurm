// src/components/Layout.jsx
import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, FolderTree, Gauge, ListChecks, LogOut, Menu, X } from 'lucide-react'
import { api, auth } from '../lib/api'

const NAV = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/accounts', label: 'Accounts', icon: FolderTree },
    { to: '/qos', label: 'QoS', icon: Gauge },
    { to: '/jobs', label: 'Jobs', icon: ListChecks },
]

export function ProtectedRoute({ children }) {
    if (!auth.isLoggedIn()) return <Navigate to="/login" replace />
    return children
}

export default function Layout() {
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)

    async function logout() {
        try {
            await api('/logout/', { method: 'POST', body: { refresh: localStorage.getItem('refresh') }, retry: false })
        } catch {
            // the token is cleared below either way
        }
        auth.clear()
        navigate('/login', { replace: true })
    }

    const nav = (
        <nav className="flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                            isActive ? 'bg-white text-[#0754b9] font-medium' : 'text-blue-100 hover:bg-white/10'
                        }`
                    }
                >
                    <Icon className="h-4 w-4" />
                    {label}
                </NavLink>
            ))}
        </nav>
    )

    return (
        <div className="min-h-screen bg-slate-50 md:flex">
            {/* Sidebar (desktop) / drawer (mobile) */}
            <aside
                className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#0754b9] px-4 py-5 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
                    open ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="mb-8 flex items-center gap-3 px-2">
                    <img src="/gaash.png" className="h-8 w-8 rounded bg-white/90 object-contain p-0.5" alt="" />
                    <div>
                        <p className="text-sm font-semibold text-white">HPC Admin</p>
                        <p className="text-xs text-blue-200">nitsri cluster</p>
                    </div>
                </div>
                {nav}
                <div className="mt-auto border-t border-white/15 pt-4">
                    <p className="px-3 pb-2 text-xs text-blue-200">Signed in as {auth.username()}</p>
                    <button
                        onClick={logout}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-blue-100 hover:bg-white/10"
                    >
                        <LogOut className="h-4 w-4" /> Log out
                    </button>
                </div>
            </aside>
            {open && <div className="fixed inset-0 z-30 bg-slate-900/30 md:hidden" onClick={() => setOpen(false)} />}

            <div className="min-w-0 flex-1">
                <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
                    <button onClick={() => setOpen(!open)} aria-label="Open menu" className="rounded p-1 text-slate-600">
                        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                    <span className="text-sm font-semibold text-slate-800">HPC Admin</span>
                    <span className="w-7" />
                </header>
                <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

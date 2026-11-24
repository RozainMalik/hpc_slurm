// src/App.jsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/ui'
import Layout, { ProtectedRoute } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import UserDetail from './pages/UserDetail'
import Accounts from './pages/Accounts'
import Qos from './pages/Qos'
import Jobs from './pages/Jobs'

export default function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                        element={
                            <ProtectedRoute>
                                <Layout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<Dashboard />} />
                        <Route path="users" element={<Users />} />
                        <Route path="users/:username" element={<UserDetail />} />
                        <Route path="accounts" element={<Accounts />} />
                        <Route path="qos" element={<Qos />} />
                        <Route path="jobs" element={<Jobs />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </ToastProvider>
        </BrowserRouter>
    )
}

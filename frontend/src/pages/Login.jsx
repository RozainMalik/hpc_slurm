import { useState } from "react";
import { ShieldCheck, Lock, User } from "lucide-react";

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    async function handleSubmit(e) {
        e.preventDefault()

        try {
            const response = await fetch("http://127.0.0.1:8000/admin/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            })

            const data = await response.json()

            if (data.success) {
                console.log("Login successful!")
                // redirect to dashboard tomorrow
            } else {
                alert(data.message)
            }

        } catch (error) {
            alert("Could not reach server. Is the backend running?")
        }
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">

            {/* Navbar */}
            <div className="flex items-center justify-between px-8 py-3 bg-slate-50 shadow-sm flex-shrink-0">
                <a href="http://gaash.nitsri.ac.in/" className="transition duration-300 hover:scale-125"><img src="/gaash.png" className="w-10 h-10 object-contain" /></a>
                <img src="/nit.png" className="w-10 h-10 object-contain" />
            </div>

            {/* Main — centers the card */}
            <div className="flex-1 flex items-center justify-center px-4 py-6">

                <div className="flex w-full max-w-6xl min-h-[580px] rounded-2xl overflow-hidden shadow-xl">

                    {/* Left — Info Panel (hidden on mobile) */}
                    <div className="hidden md:flex flex-1 bg-[#0754b9] p-20 flex-col justify-between">
                        <div>
                            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs text-blue-200 uppercase tracking-widest mb-7">
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                                HPC Administration
                            </span>

                            <h1 className="text-2xl font-serif text-white leading-snug mb-3">
                                Slurm Workload <span className="text-gray-800 italic">Manager</span>
                            </h1>

                            <p className="text-sm text-blue-200/70 leading-relaxed mb-7 font-light">
                                A unified portal for administering users, accounts, QoS
                                policies, and resource limits on your Slurm cluster,
                                without touching the CLI.
                            </p>

                            <div className="flex flex-col gap-3">
                                {[
                                    ['👥', 'User & account management'],
                                    ['⚙️', 'QoS & limit configuration'],
                                    ['📊', 'Cluster monitoring & stats'],
                                    ['🖥️', 'Node & job visibility'],
                                ].map(([icon, label]) => (
                                    <div key={label} className="flex items-center gap-3 text-blue-100 text-sm">
                                        <div className="w-7 h-7 bg-white/10 rounded-md flex items-center justify-center text-sm flex-shrink-0">
                                            {icon}
                                        </div>
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <p className="text-xs text-white/25 pt-6">
                            © 2026 GAASH Lab. All rights reserved.
                        </p>
                    </div>

                    {/* Right — Login Panel */}
                    <div className="w-full md:w-96 lg:w-[420px] bg-white flex-shrink-0 p-8 flex flex-col justify-center">

                        <div className="flex flex-col items-center mb-6">
                            <div className="bg-blue-100 p-3 rounded-2xl mb-4">
                                <ShieldCheck className="w-8 h-8 text-blue-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-800">HPC Admin Portal</h1>
                            <p className="text-slate-400 text-xs mt-1 text-center">
                                Slurm cluster management dashboard
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                    Username
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter username"
                                        className="w-full border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        className="w-full border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition duration-200 shadow-md hover:shadow-lg text-sm"
                            >
                                Login
                            </button>

                        </form>

                        <p className="mt-5 text-center text-xs text-slate-400">
                            Restricted access · Admin credentials required
                        </p>

                    </div>

                </div>
            </div>
        </div>
    );
}

export default Login;
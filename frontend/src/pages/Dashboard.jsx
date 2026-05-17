function Dashboard() {
    const role = localStorage.getItem('role')
    const username = localStorage.getItem('username')

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-slate-800">Welcome, {username}</h1>
                <p className="text-slate-400 mt-1">Role: {role}</p>
            </div>
        </div>
        
    )
}

export default Dashboard
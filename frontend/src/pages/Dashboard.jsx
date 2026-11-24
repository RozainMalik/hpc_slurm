// src/pages/Dashboard.jsx
// Live view of the cluster. Refreshes every 30 seconds.
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { Button, DataState, Empty, PageHeader, Panel } from '../components/ui'

const REFRESH_MS = 30_000

// Slurm node states → colour. States can carry suffixes like "drained*", "mixed-".
export function nodeTone(state = '') {
    const s = state.toLowerCase()
    if (s.startsWith('idle')) return { dot: 'bg-emerald-500', text: 'text-emerald-700', bar: 'bg-emerald-500' }
    if (s.startsWith('mix')) return { dot: 'bg-amber-500', text: 'text-amber-700', bar: 'bg-amber-500' }
    if (s.startsWith('alloc')) return { dot: 'bg-blue-600', text: 'text-blue-700', bar: 'bg-blue-600' }
    if (/^(drain|down|fail|maint|inval)/.test(s)) return { dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-400' }
    return { dot: 'bg-slate-400', text: 'text-slate-600', bar: 'bg-slate-400' }
}

function Stat({ label, value, detail }) {
    return (
        <div className="px-5 py-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800">{value}</p>
            {detail && <p className="mt-0.5 text-xs text-slate-400">{detail}</p>}
        </div>
    )
}

function NodeTile({ node }) {
    const tone = nodeTone(node.state)
    const cpus = node.cpus
    const pct = cpus?.total ? Math.round((cpus.allocated / cpus.total) * 100) : 0
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium text-slate-800">{node.node}</span>
                <span className={`flex items-center gap-1.5 text-xs ${tone.text}`}>
                    <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                    {node.state}
                </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{node.partition}</p>
            {cpus && (
                <>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs tabular-nums text-slate-500">
                        {cpus.allocated}/{cpus.total} CPUs in use
                    </p>
                </>
            )}
            {node.reason && node.reason !== 'none' && <p className="mt-1.5 text-xs text-red-600">{node.reason}</p>}
        </div>
    )
}

export default function Dashboard() {
    const nodes = useApi('/cluster/nodes/', { interval: REFRESH_MS })
    const jobs = useApi('/cluster/jobs/', { interval: REFRESH_MS })

    // sinfo -N lists a node once per partition; count each node once for totals
    const unique = Object.values(Object.fromEntries((nodes.data || []).map((n) => [n.node, n])))
    const cpuUsed = unique.reduce((s, n) => s + (n.cpus?.allocated || 0), 0)
    const cpuTotal = unique.reduce((s, n) => s + (n.cpus?.total || 0), 0)
    const unavailable = unique.filter((n) => /^(drain|down|fail)/i.test(n.state)).length
    const running = (jobs.data || []).filter((j) => j.state === 'RUNNING').length
    const pending = (jobs.data || []).filter((j) => j.state === 'PENDING').length

    const partitions = [...new Set((nodes.data || []).map((n) => n.partition))]

    return (
        <>
            <PageHeader
                title="Cluster overview"
                description="Live from sinfo and squeue, refreshed every 30 seconds."
                actions={
                    <Button
                        variant="secondary"
                        onClick={() => {
                            nodes.reload()
                            jobs.reload()
                        }}
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                }
            />

            <Panel className="mb-6">
                <div className="grid grid-cols-2 divide-slate-100 md:grid-cols-4 md:divide-x">
                    <Stat
                        label="CPU usage"
                        value={cpuTotal ? `${Math.round((cpuUsed / cpuTotal) * 100)}%` : '–'}
                        detail={`${cpuUsed} of ${cpuTotal} cores`}
                    />
                    <Stat label="Nodes" value={unique.length || '–'} detail={unavailable ? `${unavailable} unavailable` : 'all available'} />
                    <Stat label="Running jobs" value={jobs.data ? running : '–'} />
                    <Stat label="Pending jobs" value={jobs.data ? pending : '–'} />
                </div>
            </Panel>

            <Panel title="Nodes" className="mb-6">
                <DataState loading={nodes.loading} error={nodes.error} onRetry={nodes.reload}>
                    {partitions.length === 0 && <Empty>No nodes reported.</Empty>}
                    <div className="space-y-5 p-5">
                        {partitions.map((p) => (
                            <div key={p}>
                                <h3 className="mb-2 text-xs font-medium text-slate-500">Partition {p}</h3>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                                    {nodes.data
                                        .filter((n) => n.partition === p)
                                        .map((n) => (
                                            <NodeTile key={`${n.node}-${p}`} node={n} />
                                        ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </DataState>
            </Panel>

            <Panel
                title="Pending jobs"
                actions={
                    <Link to="/jobs" className="text-xs font-medium text-blue-600 hover:underline">
                        All jobs
                    </Link>
                }
            >
                <DataState loading={jobs.loading} error={jobs.error} onRetry={jobs.reload}>
                    {pending === 0 ? (
                        <Empty>No jobs waiting in the queue.</Empty>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {jobs.data
                                .filter((j) => j.state === 'PENDING')
                                .slice(0, 8)
                                .map((j) => (
                                    <li key={j.job_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                                        <span className="text-slate-700">
                                            <span className="font-mono text-slate-500">{j.job_id}</span> {j.name}{' '}
                                            <span className="text-slate-400">by {j.user}</span>
                                        </span>
                                        <span className="text-xs text-amber-700">waiting: {j.reason.replace(/[()]/g, '')}</span>
                                    </li>
                                ))}
                        </ul>
                    )}
                </DataState>
            </Panel>
        </>
    )
}

// src/pages/Jobs.jsx
import { useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { Badge, Button, DataState, Empty, PageHeader, Panel, Table, inputClass } from '../components/ui'

const FILTERS = ['All', 'RUNNING', 'PENDING']
const STATE_TONE = { RUNNING: 'green', PENDING: 'amber', COMPLETING: 'blue', FAILED: 'red' }

export default function Jobs() {
    const jobs = useApi('/cluster/jobs/', { interval: 30_000 })
    const [filter, setFilter] = useState('All')
    const [query, setQuery] = useState('')

    const q = query.toLowerCase()
    const rows = (jobs.data || []).filter(
        (j) => (filter === 'All' || j.state === filter) && (!q || j.user.includes(q) || j.name.toLowerCase().includes(q) || j.job_id.includes(q)),
    )

    return (
        <>
            <PageHeader
                title="Jobs"
                description="Everything in the Slurm queue right now."
                actions={<Button variant="secondary" onClick={jobs.reload}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>}
            />
            <Panel>
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
                    <div className="flex rounded-lg border border-slate-200 p-0.5">
                        {FILTERS.map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`rounded-md px-3 py-1 text-xs font-medium ${filter === f ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                {f === 'All' ? 'All' : f[0] + f.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input className={`${inputClass} pl-9`} placeholder="Search user, job name or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
                <DataState loading={jobs.loading} error={jobs.error} onRetry={jobs.reload}>
                    {rows.length === 0 ? (
                        <Empty>{jobs.data?.length ? 'No jobs match these filters.' : 'The queue is empty.'}</Empty>
                    ) : (
                        <Table
                            columns={[
                                { key: 'job_id', label: 'Job ID' },
                                { key: 'name', label: 'Name' },
                                { key: 'user', label: 'User' },
                                { key: 'account', label: 'Account' },
                                { key: 'partition', label: 'Partition' },
                                { key: 'state', label: 'State' },
                                { key: 'time', label: 'Run time', className: 'tabular-nums' },
                                { key: 'reason', label: 'Nodes / reason' },
                            ]}
                            rows={rows}
                            rowKey={(j) => j.job_id}
                            render={(j, key) => {
                                if (key === 'job_id') return <span className="font-mono text-slate-500">{j.job_id}</span>
                                if (key === 'state') return <Badge tone={STATE_TONE[j.state] || 'slate'}>{j.state.toLowerCase()}</Badge>
                                if (key === 'reason')
                                    return j.state === 'PENDING' ? (
                                        <span className="text-amber-700">{j.reason.replace(/[()]/g, '')}</span>
                                    ) : (
                                        <span className="font-mono text-xs">{j.reason}</span>
                                    )
                                return j[key]
                            }}
                        />
                    )}
                </DataState>
            </Panel>
        </>
    )
}

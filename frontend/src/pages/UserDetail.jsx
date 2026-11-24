// src/pages/UserDetail.jsx
// Everything an admin can change about one user.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, KeyRound, Plus, Star, X } from 'lucide-react'
import { api, enc } from '../lib/api'
import { useApi } from '../lib/useApi'
import {
    Badge, Button, ConfirmModal, DataState, Field, Input, Modal, PageHeader, Panel, Select, useAction, useToast,
} from '../components/ui'

function Association({ user, assoc, qosOptions, onChanged }) {
    const [run, busy] = useAction()
    const [adding, setAdding] = useState('')
    const base = `/hpc-users/${enc(user.username)}`
    const isDefault = assoc.account === user.default_account
    const available = qosOptions.filter((q) => !assoc.qos.includes(q))

    return (
        <div className="px-5 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{assoc.account}</span>
                    {isDefault && <Badge tone="blue">Default account</Badge>}
                </div>
                <div className="flex gap-2">
                    {!isDefault && (
                        <Button size="sm" variant="secondary" busy={busy}
                            onClick={() => run(() => api(`${base}/default-account/`, { method: 'POST', body: { account: assoc.account } }), { onDone: onChanged })}>
                            Make default
                        </Button>
                    )}
                    {!isDefault && user.associations.length > 1 && (
                        <Button size="sm" variant="danger-outline" busy={busy}
                            onClick={() => run(() => api(`${base}/accounts/${enc(assoc.account)}/`, { method: 'DELETE' }), { onDone: onChanged })}>
                            Remove from account
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {assoc.qos.map((q) => {
                    const def = q === assoc.default_qos
                    return (
                        <span key={q} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${def ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700'}`}>
                            <button
                                title={def ? 'Default QoS' : 'Set as default'}
                                disabled={def || busy}
                                onClick={() => run(() => api(`${base}/default-qos/`, { method: 'POST', body: { account: assoc.account, qos: q } }), { onDone: onChanged })}
                                className="disabled:cursor-default"
                            >
                                <Star className={`h-3 w-3 ${def ? 'fill-blue-600 text-blue-600' : 'text-slate-300 hover:text-blue-500'}`} />
                            </button>
                            {q}
                            {!def && (
                                <button title={`Remove ${q}`} disabled={busy}
                                    onClick={() => run(() => api(`${base}/qos/?account=${enc(assoc.account)}&qos=${enc(q)}`, { method: 'DELETE' }), { onDone: onChanged })}>
                                    <X className="h-3 w-3 text-slate-400 hover:text-red-600" />
                                </button>
                            )}
                        </span>
                    )
                })}
                {available.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        <div className="w-36">
                            <Select small value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add QoS" options={available} />
                        </div>
                        <Button size="sm" variant="secondary" disabled={!adding} busy={busy}
                            onClick={() => run(() => api(`${base}/qos/`, { method: 'POST', body: { account: assoc.account, qos: adding } }), {
                                onDone: () => { setAdding(''); onChanged() },
                            })}>
                            <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

function QuotaPanel({ user, onChanged }) {
    const [run, busy] = useAction()
    const [form, setForm] = useState({ soft_limit: '', hard_limit: '' })
    useEffect(() => {
        setForm({ soft_limit: user.quota?.soft?.toLowerCase() || '', hard_limit: user.quota?.hard?.toLowerCase() || '' })
    }, [user.quota])

    return (
        <Panel title="Home directory quota">
            <div className="space-y-4 px-5 py-4">
                {user.quota ? (
                    <p className="text-sm text-slate-600">
                        Using <span className="font-medium text-slate-800">{user.quota.used}</span> of a{' '}
                        {user.quota.soft} soft / {user.quota.hard} hard limit.
                    </p>
                ) : (
                    <p className="text-sm text-slate-400">Current usage could not be read.</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Soft limit"><Input value={form.soft_limit} onChange={(e) => setForm({ ...form, soft_limit: e.target.value })} placeholder="45g" /></Field>
                    <Field label="Hard limit"><Input value={form.hard_limit} onChange={(e) => setForm({ ...form, hard_limit: e.target.value })} placeholder="50g" /></Field>
                </div>
                <Button variant="secondary" busy={busy} disabled={!form.soft_limit || !form.hard_limit}
                    onClick={() => run(() => api(`/hpc-users/${enc(user.username)}/quota/`, { method: 'PUT', body: form }), { onDone: onChanged })}>
                    Save quota
                </Button>
            </div>
        </Panel>
    )
}

function PasswordPanel({ username }) {
    const toast = useToast()
    const [run, busy] = useAction()
    const [confirming, setConfirming] = useState(false)
    const [password, setPassword] = useState(null)

    async function reset() {
        const res = await run(() => api(`/hpc-users/${enc(username)}/reset-password/`, { method: 'POST' }))
        setConfirming(false)
        if (res) setPassword(res.data.password)
    }

    return (
        <Panel title="Password">
            <div className="space-y-3 px-5 py-4">
                <p className="text-sm text-slate-600">Sets a new random password. The user must change it at their next login.</p>
                <Button variant="secondary" onClick={() => setConfirming(true)}><KeyRound className="h-3.5 w-3.5" /> Reset password</Button>
            </div>
            <ConfirmModal open={confirming} title={`Reset password for ${username}`}
                message="Their current password stops working immediately."
                confirmLabel="Reset password" busy={busy} onConfirm={reset} onClose={() => setConfirming(false)} />
            <Modal open={Boolean(password)} title="New password" onClose={() => setPassword(null)}
                footer={<Button onClick={() => setPassword(null)}>Done</Button>}>
                <p className="text-sm text-slate-600">Give this to {username}. It is shown only once and is not saved anywhere.</p>
                <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">{password}</code>
                    <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(password); toast.success('Copied') }}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                </div>
            </Modal>
        </Panel>
    )
}

export default function UserDetail() {
    const { username } = useParams()
    const navigate = useNavigate()
    const user = useApi(`/hpc-users/${enc(username)}/`)
    const accounts = useApi('/accounts/')
    const qos = useApi('/qos/')
    const [run, busy] = useAction()
    const [newAccount, setNewAccount] = useState('')
    const [deleting, setDeleting] = useState(false)

    const u = user.data
    const qosOptions = (qos.data || []).map((q) => q.name)
    const otherAccounts = (accounts.data || []).map((a) => a.name).filter((a) => !u?.associations.some((x) => x.account === a))

    async function remove() {
        const res = await run(() => api(`/hpc-users/${enc(username)}/`, { method: 'DELETE' }))
        setDeleting(false)
        if (res) navigate('/users')
    }

    return (
        <>
            <Link to="/users" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                <ArrowLeft className="h-4 w-4" /> Users
            </Link>
            <PageHeader title={username} description={u ? `Default account ${u.default_account || 'not set'}` : undefined} />

            <DataState loading={user.loading} error={user.error} onRetry={user.reload}>
                {u && (
                    <div className="grid items-start gap-6 lg:grid-cols-3">
                        <Panel title="Accounts and QoS" className="lg:col-span-2"
                            actions={<span className="flex items-center gap-1 text-xs text-slate-400"><Star className="h-3 w-3 fill-blue-600 text-blue-600" /> default QoS for jobs in that account</span>}>
                            <div className="divide-y divide-slate-100">
                                {u.associations.map((a) => (
                                    <Association key={a.account} user={u} assoc={a} qosOptions={qosOptions} onChanged={user.reload} />
                                ))}
                            </div>
                            {otherAccounts.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4">
                                    <div className="w-56">
                                        <Select small value={newAccount} onChange={(e) => setNewAccount(e.target.value)} placeholder="Add to another account" options={otherAccounts} />
                                    </div>
                                    <Button size="sm" variant="secondary" disabled={!newAccount} busy={busy}
                                        onClick={() => run(() => api(`/hpc-users/${enc(username)}/accounts/`, { method: 'POST', body: { account: newAccount } }), {
                                            onDone: () => { setNewAccount(''); user.reload() },
                                        })}>
                                        <Plus className="h-3.5 w-3.5" /> Add to account
                                    </Button>
                                    <span className="text-xs text-slate-400">Slurm only; Linux groups are not changed.</span>
                                </div>
                            )}
                        </Panel>

                        <div className="space-y-6">
                            <QuotaPanel user={u} onChanged={user.reload} />
                            <PasswordPanel username={username} />
                            <Panel title="Delete user">
                                <div className="space-y-3 px-5 py-4">
                                    <p className="text-sm text-slate-600">Removes Slurm access, the Linux account and the home directory.</p>
                                    <Button variant="danger-outline" onClick={() => setDeleting(true)}>Delete {username}</Button>
                                </div>
                            </Panel>
                        </div>
                    </div>
                )}
            </DataState>

            <ConfirmModal open={deleting} title={`Delete ${username}`}
                message="This removes the user from Slurm, deletes their Linux account and permanently deletes their home directory. It cannot be undone."
                confirmLabel="Delete user" typeToConfirm={username} busy={busy} onConfirm={remove} onClose={() => setDeleting(false)} />
        </>
    )
}

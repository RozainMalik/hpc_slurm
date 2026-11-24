// src/pages/Accounts.jsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api, enc } from '../lib/api'
import { useApi } from '../lib/useApi'
import { Button, ConfirmModal, DataState, Empty, Field, Input, Modal, PageHeader, Panel, Table, useAction } from '../components/ui'

export default function Accounts() {
    const accounts = useApi('/accounts/')
    const [creating, setCreating] = useState(false)
    const [form, setForm] = useState({ name: '', description: '' })
    const [deleting, setDeleting] = useState(null)
    const [run, busy] = useAction()

    async function create() {
        const res = await run(() => api('/accounts/', { method: 'POST', body: form }), { onDone: accounts.reload })
        if (res) {
            setForm({ name: '', description: '' })
            setCreating(false)
        }
    }

    async function remove() {
        await run(() => api(`/accounts/${enc(deleting)}/`, { method: 'DELETE' }), { onDone: accounts.reload })
        setDeleting(null)
    }

    return (
        <>
            <PageHeader
                title="Accounts"
                description="Slurm accounts group users, usually by programme or project."
                actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create account</Button>}
            />
            <Panel>
                <DataState loading={accounts.loading} error={accounts.error} onRetry={accounts.reload}>
                    {accounts.data?.length === 0 ? (
                        <Empty>No accounts yet.</Empty>
                    ) : (
                        <Table
                            columns={[
                                { key: 'name', label: 'Account' },
                                { key: 'description', label: 'Description' },
                                { key: 'organization', label: 'Organisation' },
                                { key: 'actions', label: '', className: 'text-right' },
                            ]}
                            rows={accounts.data || []}
                            rowKey={(a) => a.name}
                            render={(a, key) =>
                                key === 'actions' ? (
                                    <Button size="sm" variant="danger-outline" onClick={() => setDeleting(a.name)}>Delete</Button>
                                ) : key === 'name' ? (
                                    <span className="font-medium text-slate-800">{a.name}</span>
                                ) : (
                                    a[key] || <span className="text-slate-300">–</span>
                                )
                            }
                        />
                    )}
                </DataState>
            </Panel>

            <Modal
                open={creating}
                title="Create account"
                onClose={() => setCreating(false)}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
                        <Button busy={busy} disabled={!form.name} onClick={create}>Create account</Button>
                    </>
                }
            >
                <Field label="Name" hint="Lowercase, e.g. btech or project_x. Users created in this account need a Linux group with the same name.">
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })} autoFocus />
                </Field>
                <Field label="Description (optional)">
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
            </Modal>

            <ConfirmModal
                open={Boolean(deleting)}
                title={`Delete account ${deleting}`}
                message="Only accounts with no users can be deleted. Move or delete its users first."
                confirmLabel="Delete account"
                busy={busy}
                onConfirm={remove}
                onClose={() => setDeleting(null)}
            />
        </>
    )
}

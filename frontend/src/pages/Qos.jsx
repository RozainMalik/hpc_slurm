// src/pages/Qos.jsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api, enc } from '../lib/api'
import { useApi } from '../lib/useApi'
import { Button, ConfirmModal, DataState, Empty, Field, Input, Modal, PageHeader, Panel, Table, useAction } from '../components/ui'

const LIMITS = [
    { key: 'priority', label: 'Priority', hint: 'Higher runs first, e.g. 10' },
    { key: 'max_wall', label: 'Max wall time', hint: 'e.g. 01:00:00 or 2-00:00:00' },
    { key: 'max_jobs_per_user', label: 'Max running jobs per user', hint: 'e.g. 4' },
]
const BLANK = { name: '', priority: '', max_wall: '', max_jobs_per_user: '' }

function QosForm({ form, setForm, editing }) {
    return (
        <>
            {!editing && (
                <Field label="Name" hint="Lowercase, e.g. shortq">
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })} autoFocus />
                </Field>
            )}
            {LIMITS.map((l) => (
                <Field key={l.key} label={l.label} hint={editing ? `${l.hint}. Leave empty for no limit.` : `${l.hint}. Optional.`}>
                    <Input value={form[l.key]} onChange={(e) => setForm({ ...form, [l.key]: e.target.value })} />
                </Field>
            ))}
        </>
    )
}

export default function Qos() {
    const qos = useApi('/qos/')
    const [mode, setMode] = useState(null) // null | 'create' | {editing: original row}
    const [form, setForm] = useState(BLANK)
    const [deleting, setDeleting] = useState(null)
    const [run, busy] = useAction()

    const editing = mode && mode !== 'create' ? mode.editing : null

    function openEdit(row) {
        setForm({ ...row })
        setMode({ editing: row })
    }

    async function save() {
        let res
        if (editing) {
            // Send only changed fields; a field cleared by the admin becomes -1 (remove limit)
            const body = {}
            for (const { key } of LIMITS) {
                if (form[key] !== editing[key]) body[key] = form[key] === '' ? '-1' : form[key]
            }
            if (Object.keys(body).length === 0) return setMode(null)
            res = await run(() => api(`/qos/${enc(editing.name)}/`, { method: 'PATCH', body }), { onDone: qos.reload })
        } else {
            res = await run(() => api('/qos/', { method: 'POST', body: form }), { onDone: qos.reload })
        }
        if (res) setMode(null)
    }

    async function remove() {
        await run(() => api(`/qos/${enc(deleting)}/`, { method: 'DELETE' }), { onDone: qos.reload })
        setDeleting(null)
    }

    return (
        <>
            <PageHeader
                title="QoS"
                description="Quality of service levels set job priority and limits."
                actions={
                    <Button onClick={() => { setForm(BLANK); setMode('create') }}>
                        <Plus className="h-4 w-4" /> Create QoS
                    </Button>
                }
            />
            <Panel>
                <DataState loading={qos.loading} error={qos.error} onRetry={qos.reload}>
                    {qos.data?.length === 0 ? (
                        <Empty>No QoS defined.</Empty>
                    ) : (
                        <Table
                            columns={[
                                { key: 'name', label: 'Name' },
                                { key: 'priority', label: 'Priority' },
                                { key: 'max_wall', label: 'Max wall time' },
                                { key: 'max_jobs_per_user', label: 'Max jobs per user' },
                                { key: 'actions', label: '', className: 'text-right' },
                            ]}
                            rows={qos.data || []}
                            rowKey={(q) => q.name}
                            render={(q, key) => {
                                if (key === 'name') return <span className="font-medium text-slate-800">{q.name}</span>
                                if (key === 'actions')
                                    return (
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => openEdit(q)}>Edit</Button>
                                            {q.name !== 'normal' && (
                                                <Button size="sm" variant="danger-outline" onClick={() => setDeleting(q.name)}>Delete</Button>
                                            )}
                                        </div>
                                    )
                                return q[key] ? <span className="tabular-nums">{q[key]}</span> : <span className="text-slate-300">no limit</span>
                            }}
                        />
                    )}
                </DataState>
            </Panel>

            <Modal
                open={Boolean(mode)}
                title={editing ? `Edit ${editing.name}` : 'Create QoS'}
                onClose={() => setMode(null)}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
                        <Button busy={busy} disabled={!editing && !form.name} onClick={save}>
                            {editing ? 'Save changes' : 'Create QoS'}
                        </Button>
                    </>
                }
            >
                <QosForm form={form} setForm={setForm} editing={Boolean(editing)} />
            </Modal>

            <ConfirmModal
                open={Boolean(deleting)}
                title={`Delete QoS ${deleting}`}
                message="Only a QoS that no user has can be deleted."
                confirmLabel="Delete QoS"
                busy={busy}
                onConfirm={remove}
                onClose={() => setDeleting(null)}
            />
        </>
    )
}

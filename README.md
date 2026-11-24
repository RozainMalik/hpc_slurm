# HPC Slurm Admin Portal

A web portal for administering the NIT Srinagar HPC cluster's Slurm setup without the terminal: users, Slurm accounts, QoS limits, disk quotas, password resets, and live node and job status.

The cluster's existing admin scripts can't be modified, so the backend runs them and standard Slurm commands over SSH. It validates every input first, verifies results afterwards, and returns clean JSON. A mock mode replaces the cluster with realistic fake data for development and demos.

## Stack

- **Backend:** Django 6, Django REST Framework, simplejwt (JWT auth), paramiko (SSH)
- **Frontend:** React 19, Vite, Tailwind CSS, react-router

## How it works

```
React (Vite) ──JWT──▶ Django REST API ──▶ commands.py ──▶ ssh.py ──SSH──▶ Slurm cluster
                       views/ (thin)      validate,        one place     sacctmgr, sinfo,
                       _utils.py          build arg lists,  that talks    squeue, xfs_quota,
                       auth.py            verify results    to cluster    existing scripts
                                                              │
                                                              └─ MOCK_MODE=True ──▶ mock.py
```

- Every endpoint is admin-only by default (`IsAdminUser`). Only login and token refresh are public.
- Commands are argument lists joined with `shlex.join`, and every value is checked against a strict pattern, so input is never interpreted by the shell or read as a flag.
- Passwords are sent over stdin, never on the command line.
- Destructive actions are guarded: no deleting users with running jobs, accounts with members, or QoS still in use.

## Run it locally (mock mode, no cluster needed)

Backend:

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # MOCK_MODE=True by default; set DJANGO_SECRET_KEY
python manage.py migrate
python manage.py createsuperuser  # this is the portal login
python manage.py runserver
```

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and log in with the superuser.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/login/`, `/api/logout/`, `/api/token/refresh/` | JWT auth |
| GET, POST | `/api/hpc-users/` | List or create users |
| GET, DELETE | `/api/hpc-users/<user>/` | User detail or delete |
| POST, DELETE | `/api/hpc-users/<user>/qos/` | Add or remove a QoS |
| POST | `/api/hpc-users/<user>/default-qos/`, `/default-account/` | Set defaults |
| POST, DELETE | `/api/hpc-users/<user>/accounts/…` | Add or remove an account |
| PUT | `/api/hpc-users/<user>/quota/` | Set disk quota |
| POST | `/api/hpc-users/<user>/reset-password/` | Reset password |
| GET, POST / PATCH, DELETE | `/api/qos/`, `/api/qos/<name>/` | Manage QoS |
| GET, POST / DELETE | `/api/accounts/`, `/api/accounts/<name>/` | Manage accounts |
| GET | `/api/cluster/nodes/`, `/api/cluster/jobs/` | Node and job status |
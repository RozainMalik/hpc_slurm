# api/slurm/commands.py
"""
Every Slurm / Linux operation the portal can perform.

Rules followed by every function here:
  1. Validate all input first (raise ValidationError -> HTTP 400).
  2. Build commands as argument lists (ssh.py quotes them safely).
  3. Return a dict: {'success': True, 'data'/'message': ...}
                 or {'success': False, 'error': ..., 'status': <http code>}
"""
import re
import secrets
import string

from .ssh import HPCSession, run_remote_command, MOCK_MODE

CLUSTER = 'nitsri'
CREATE_SCRIPT = '/apps/scripts/slurm-user-create-portal.sh'
QUOTA_FS = '/home'
PROTECTED_USERS = {'root'}

# ---------- validation ----------
NAME_RE = re.compile(r'[a-z_][a-z0-9_-]{1,31}')        # users, accounts, QoS names
LIMIT_RE = re.compile(r'0|\d+[kmgtKMGT]')               # xfs_quota limits: 50g, 512m, 0 = no limit
WALL_RE = re.compile(r'-1|[0-9:-]{1,16}')               # Slurm time: 60, 2:00:00, 1-12:00:00, -1 = clear
INT_RE = re.compile(r'-1|\d{1,9}')                      # -1 = clear the limit
DESC_RE = re.compile(r'[\w .,()-]{0,100}')


class ValidationError(ValueError):
    """Bad input from the client. Views turn this into HTTP 400."""


def _check(value, pattern, field):
    if not isinstance(value, str) or not pattern.fullmatch(value):
        raise ValidationError(f'Invalid {field}: {value!r}')
    return value


def _optional(value, pattern, field):
    return _check(value, pattern, field) if value else ''


def _user(username):
    _check(username, NAME_RE, 'username')
    if username in PROTECTED_USERS:
        raise ValidationError(f'{username} is a protected account')
    return username


def _bytes(limit):
    if limit == '0':
        return 0
    units = {'k': 1, 'm': 2, 'g': 3, 't': 4}
    return int(limit[:-1]) * 1024 ** units[limit[-1].lower()]


def _check_limits(soft, hard):
    _check(soft, LIMIT_RE, 'soft limit')
    _check(hard, LIMIT_RE, 'hard limit')
    if _bytes(hard) and _bytes(soft) > _bytes(hard):
        raise ValidationError('Soft limit cannot be larger than hard limit')


# ---------- results ----------
def _fail(error, status=502, **extra):
    """status: 400 bad request, 404 not found, 409 conflict, 502 cluster/SSH failure."""
    return {'success': False, 'error': error, 'status': status, **extra}


def _err(result):
    return result['error'] or result['output'] or 'unknown error'


def _ssh_error(e):
    return _fail(f'Could not reach the cluster: {e}')


def parse_table(result, fields):
    """
    Turn 'A|B\\n1|2' into [{'field_a': '1', 'field_b': '2'}].
    Line 0 is Slurm's header and is skipped. Columns are mapped by
    POSITION to `fields`, so keep them in the same order as format=.
    """
    if not result['success']:
        return result
    lines = [l for l in result['output'].splitlines() if l.strip()]
    rows = [dict(zip(fields, l.split('|'))) for l in lines[1:]]
    return {**result, 'data': rows}


def _exists(hpc, args):
    """True if a `sacctmgr -n -P show ...` query returned anything."""
    r = hpc.run(args)
    return r['success'] and bool(r['output'].strip())


def _account_exists(hpc, name):
    return _exists(hpc, ['sacctmgr', '-n', '-P', 'show', 'account',
                         'where', f'name={name}', 'format=Account'])


def _qos_exists(hpc, name):
    return _exists(hpc, ['sacctmgr', '-n', '-P', 'show', 'qos',
                         'where', f'name={name}', 'format=Name'])


def _user_assocs(hpc, username):
    """[{'account', 'qos': [...], 'default_qos'}] for one user."""
    r = parse_table(
        hpc.run(['sacctmgr', 'show', 'assoc', 'where', f'user={username}',
                 'format=User,Account,QOS,DefaultQOS', '--parsable2']),
        ['username', 'account', 'qos', 'default_qos'],
    )
    if not r['success']:
        return None
    return [
        {'account': a['account'], 'qos': [q for q in a.get('qos', '').split(',') if q],
         'default_qos': a.get('default_qos', '')}
        for a in r['data'] if a.get('username') == username
    ]


# =====================================================================
# HPC USERS
# =====================================================================
def list_hpc_users():
    """One entry per user, with all their account associations grouped."""
    try:
        with HPCSession() as hpc:
            assoc = parse_table(
                hpc.run(['sacctmgr', 'show', 'assoc',
                         'format=User,Account,QOS,DefaultQOS', '--parsable2']),
                ['username', 'account', 'qos', 'default_qos'],
            )
            if not assoc['success']:
                return _fail(_err(assoc))
            defaults = parse_table(
                hpc.run(['sacctmgr', 'show', 'user', 'format=User,DefaultAccount', '--parsable2']),
                ['username', 'default_account'],
            )
    except Exception as e:
        return _ssh_error(e)

    default_map = {r['username']: r.get('default_account', '') for r in defaults.get('data', [])}
    users = {}
    for r in assoc['data']:
        name = r.get('username')
        if not name or name in PROTECTED_USERS:   # blank user = account-level row
            continue
        user = users.setdefault(name, {
            'username': name,
            'default_account': default_map.get(name, ''),
            'associations': [],
        })
        user['associations'].append({
            'account': r.get('account', ''),
            'qos': [q for q in r.get('qos', '').split(',') if q],
            'default_qos': r.get('default_qos', ''),
        })
    return {'success': True, 'data': sorted(users.values(), key=lambda u: u['username'])}


def get_hpc_user(username):
    """Associations, default account and disk quota for one user."""
    _user(username)
    try:
        with HPCSession() as hpc:
            assocs = _user_assocs(hpc, username)
            if assocs is None:
                return _fail('Could not read Slurm associations')
            if not assocs:
                return _fail(f'User {username} not found in Slurm', status=404)

            d = hpc.run(['sacctmgr', '-n', '-P', 'show', 'user',
                         'where', f'name={username}', 'format=DefaultAccount'])
            default_account = d['output'].strip() if d['success'] else ''

            q = hpc.run(['xfs_quota', '-x', '-c', f'quota -u -b -h -N {username}', QUOTA_FS])
    except Exception as e:
        return _ssh_error(e)

    quota = None
    parts = q['output'].split() if q['success'] else []
    if len(parts) >= 4:   # Filesystem Used Soft Hard ...
        quota = {'used': parts[1], 'soft': parts[2], 'hard': parts[3]}

    return {'success': True, 'data': {
        'username': username,
        'default_account': default_account,
        'associations': assocs,
        'quota': quota,
    }}


def create_hpc_user(username, group, qos, soft_limit, hard_limit):
    """
    Uses the EXISTING server script (args: username group bsoft bhard).
    That script always exits 0 and checks nothing, so we check before
    running it and verify the result afterwards.
    """
    _user(username)
    _check(group, NAME_RE, 'group')
    _check(qos, NAME_RE, 'qos')
    _check_limits(soft_limit, hard_limit)

    if MOCK_MODE:
        return {'success': True,
                'message': f'MOCK: user {username} created (mock data does not change)'}

    try:
        with HPCSession() as hpc:
            # ---- pre-flight: nothing is changed yet ----
            # (also stops the script resetting an existing user's password)
            if hpc.run(['getent', 'passwd', username])['success']:
                return _fail(f'User {username} already exists', status=409)
            if not hpc.run(['getent', 'group', group])['success']:
                return _fail(f'Linux group {group} does not exist', status=400)
            if not _account_exists(hpc, group):
                return _fail(f'Slurm account {group} does not exist', status=400)
            if not _qos_exists(hpc, qos):
                return _fail(f'QoS {qos} does not exist', status=400)

            # ---- existing script ----
            script = hpc.run([CREATE_SCRIPT, username, group, soft_limit, hard_limit])

            # ---- verify, since the script's exit code means nothing ----
            if not hpc.run(['getent', 'passwd', username])['success']:
                return _fail(f'Linux user was not created. Script output: {_err(script)}')
            if not _user_assocs(hpc, username):
                return _fail(f'Linux user created but Slurm association missing. '
                             f'Script output: {_err(script)}', completed_steps=['Linux user'])

            # ---- QoS + force password change (script sets a shared default) ----
            completed = ['Linux user', 'Slurm association']
            where = ['where', f'name={username}', f'account={group}', f'cluster={CLUSTER}']
            steps = [
                ('QoS assignment', ['sacctmgr', '-i', 'modify', 'user', *where, 'set', f'qos+={qos}']),
                ('Default QoS', ['sacctmgr', '-i', 'modify', 'user', *where, 'set', f'defaultqos={qos}']),
                ('Force password change', ['chage', '-d', '0', username]),
            ]
            for label, args in steps:
                r = hpc.run(args)
                if not r['success']:
                    return _fail(f'{label} failed: {_err(r)}', completed_steps=completed)
                completed.append(label)
    except Exception as e:
        return _ssh_error(e)

    return {'success': True,
            'message': f'User {username} created. The default password must be changed at first login.'}


def delete_hpc_user(username):
    """
    The server's delete script is interactive (read -p), so it can't be
    called over SSH. These steps do the same job, with safety checks.
    """
    _user(username)
    try:
        with HPCSession() as hpc:
            # ---- safety checks ----
            r = hpc.run(['id', '-u', username])
            if not r['success']:
                return _fail(f'User {username} does not exist', status=404)
            if not r['output'].strip().isdigit() or int(r['output']) < 1000:
                return _fail(f'Refusing to delete system account {username}', status=400)
            jobs = hpc.run(['squeue', '-h', '-u', username, '-o', '%i'])
            if not jobs['success']:
                return _fail(f'Could not check jobs: {_err(jobs)}')
            njobs = len(jobs['output'].split())
            if njobs:
                return _fail(f'{username} has {njobs} running or pending job(s). Cancel them first.',
                             status=409)

            completed = []
            # ---- Slurm: all associations ----
            if _exists(hpc, ['sacctmgr', '-n', '-P', 'show', 'user',
                             'where', f'name={username}', 'format=User']):
                r = hpc.run(['sacctmgr', '-i', 'delete', 'user', 'where', f'name={username}'])
                if not r['success']:
                    return _fail(f'Slurm removal failed: {_err(r)}')
                completed.append('Slurm associations')

            # ---- quota (best effort), Linux user + home, NIS ----
            hpc.run(['xfs_quota', '-x', '-c', f'limit bsoft=0 bhard=0 {username}', QUOTA_FS])
            r = hpc.run(['userdel', '-r', username])
            if not r['success']:
                return _fail(f'userdel failed: {_err(r)}', completed_steps=completed)
            completed.append('Linux user and home directory')
            r = hpc.run(['make', '-s', '-C', '/var/yp'])
            if not r['success']:
                return _fail(f'NIS map rebuild failed: {_err(r)}', completed_steps=completed)
    except Exception as e:
        return _ssh_error(e)

    return {'success': True, 'message': f'User {username} deleted'}


# ---------- user QoS ----------
def _modify_assoc(username, account, setting):
    _user(username)
    _check(account, NAME_RE, 'account')
    r = run_remote_command(['sacctmgr', '-i', 'modify', 'user', 'where', f'name={username}',
                            f'account={account}', f'cluster={CLUSTER}', 'set', setting])
    if not r['success']:
        return _fail(_err(r))
    return None


def add_user_qos(username, account, qos):
    _check(qos, NAME_RE, 'qos')
    err = _modify_assoc(username, account, f'qos+={qos}')
    return err or {'success': True, 'message': f'Added QoS {qos} to {username} ({account})'}


def remove_user_qos(username, account, qos):
    _check(qos, NAME_RE, 'qos')
    err = _modify_assoc(username, account, f'qos-={qos}')
    return err or {'success': True, 'message': f'Removed QoS {qos} from {username} ({account})'}


def set_user_default_qos(username, account, qos):
    _check(qos, NAME_RE, 'qos')
    err = _modify_assoc(username, account, f'defaultqos={qos}')
    return err or {'success': True, 'message': f'Default QoS for {username} ({account}) is now {qos}'}


# ---------- user accounts (Slurm associations only; Linux groups unchanged) ----------
def add_user_account(username, account):
    _user(username)
    _check(account, NAME_RE, 'account')
    try:
        with HPCSession() as hpc:
            if not _account_exists(hpc, account):
                return _fail(f'Slurm account {account} does not exist', status=400)
            r = hpc.run(['sacctmgr', '-i', 'add', 'user', username, f'account={account}'])
    except Exception as e:
        return _ssh_error(e)
    if not r['success']:
        return _fail(_err(r))
    return {'success': True, 'message': f'{username} added to account {account}'}


def remove_user_account(username, account):
    _user(username)
    _check(account, NAME_RE, 'account')
    try:
        with HPCSession() as hpc:
            assocs = _user_assocs(hpc, username)
            if assocs is None:
                return _fail('Could not read Slurm associations')
            if account not in [a['account'] for a in assocs]:
                return _fail(f'{username} is not in account {account}', status=404)
            if len(assocs) == 1:
                return _fail('This is the user\'s only account. Delete the user instead.', status=409)
            d = hpc.run(['sacctmgr', '-n', '-P', 'show', 'user',
                         'where', f'name={username}', 'format=DefaultAccount'])
            if d['output'].strip() == account:
                return _fail(f'{account} is the default account. Set another default first.',
                             status=409)
            r = hpc.run(['sacctmgr', '-i', 'delete', 'user', 'where',
                         f'name={username}', f'account={account}'])
    except Exception as e:
        return _ssh_error(e)
    if not r['success']:
        return _fail(_err(r))
    return {'success': True, 'message': f'{username} removed from account {account}'}


def set_user_default_account(username, account):
    _user(username)
    _check(account, NAME_RE, 'account')
    r = run_remote_command(['sacctmgr', '-i', 'modify', 'user', 'where', f'name={username}',
                            'set', f'defaultaccount={account}'])
    if not r['success']:
        return _fail(_err(r))
    return {'success': True, 'message': f'Default account for {username} is now {account}'}


# ---------- quota and password ----------
def set_user_quota(username, soft_limit, hard_limit):
    _user(username)
    _check_limits(soft_limit, hard_limit)
    r = run_remote_command(['xfs_quota', '-x', '-c',
                            f'limit bsoft={soft_limit} bhard={hard_limit} {username}', QUOTA_FS])
    if not r['success']:
        return _fail(_err(r))
    return {'success': True, 'message': f'Quota for {username} set to {soft_limit} / {hard_limit}'}


def _generate_password(length=12):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def reset_user_password(username):
    """
    Sets a random password, forces a change at next login, updates NIS.
    The password goes over stdin (never in the command line) and is
    returned ONCE. It is never logged or stored.
    """
    _user(username)
    password = _generate_password()
    try:
        with HPCSession() as hpc:
            r = hpc.run(['id', '-u', username])
            if not r['success']:
                return _fail(f'User {username} does not exist', status=404)
            if not r['output'].strip().isdigit() or int(r['output']) < 1000:
                return _fail(f'Refusing to change system account {username}', status=400)
            for label, args, stdin in [
                ('Set password', ['chpasswd'], f'{username}:{password}\n'),
                ('Force password change', ['chage', '-d', '0', username], None),
                ('NIS map rebuild', ['make', '-s', '-C', '/var/yp'], None),
            ]:
                r = hpc.run(args, input_data=stdin)
                if not r['success']:
                    return _fail(f'{label} failed: {_err(r)}')
    except Exception as e:
        return _ssh_error(e)
    return {'success': True, 'message': f'Password reset for {username}',
            'data': {'password': password}}


# =====================================================================
# QoS
# =====================================================================
def list_qos():
    r = parse_table(
        run_remote_command(['sacctmgr', 'show', 'qos',
                            'format=Name,Priority,MaxWall,MaxJobsPU', '--parsable2']),
        ['name', 'priority', 'max_wall', 'max_jobs_per_user'],
    )
    return r if r['success'] else _fail(_err(r))


def _qos_settings(max_wall, max_jobs_per_user, priority):
    settings = []
    if _optional(max_wall, WALL_RE, 'max wall time'):
        settings.append(f'maxwall={max_wall}')
    if _optional(max_jobs_per_user, INT_RE, 'max jobs per user'):
        settings.append(f'maxjobsperuser={max_jobs_per_user}')   # verify with `man sacctmgr`
    if _optional(priority, INT_RE, 'priority'):
        settings.append(f'priority={priority}')
    return settings


def create_qos(name, max_wall='', max_jobs_per_user='', priority=''):
    _check(name, NAME_RE, 'QoS name')
    settings = _qos_settings(max_wall, max_jobs_per_user, priority)
    try:
        with HPCSession() as hpc:
            if _qos_exists(hpc, name):
                return _fail(f'QoS {name} already exists', status=409)
            r = hpc.run(['sacctmgr', '-i', 'add', 'qos', name, *settings])
    except Exception as e:
        return _ssh_error(e)
    if not r['success']:
        return _fail(_err(r))
    return {'success': True, 'message': f'QoS {name} created'}


def update_qos(name, max_wall='', max_jobs_per_user='', priority=''):
    """Empty = leave unchanged, -1 = remove the limit."""
    _check(name, NAME_RE, 'QoS name')
    settings = _qos_settings(max_wall, max_jobs_per_user, priority)
    if not settings:
        raise ValidationError('Nothing to change')
    r = run_remote_command(['sacctmgr', '-i', 'modify', 'qos', 'where', f'name={name}',
                            'set', *settings])
    if not r['success']:
        return _fail(_err(r))
    return {'success': True, 'message': f'QoS {name} updated'}


def delete_qos(name):
    _check(name, NAME_RE, 'QoS name')
    if name == 'normal':
        raise ValidationError('The normal QoS is the cluster default and cannot be deleted')
    try:
        with HPCSession() as hpc:
            usage = parse_table(
                hpc.run(['sacctmgr', 'show', 'assoc', 'format=User,QOS', '--parsable2']),
                ['username', 'qos'],
            )
            if not usage['success']:
                return _fail(_err(usage))
            users = sorted({r['username'] for r in usage['data']
                            if r.get('username') and name in r.get('qos', '').split(',')})
            if users:
                shown = ', '.join(users[:5]) + (' and others' if len(users) > 5 else '')
                return _fail(f'QoS {name} is still assigned to {len(users)} user(s): {shown}',
                             status=409)
            r = hpc.run(['sacctmgr', '-i', 'delete', 'qos', name])
    except Exception as e:
        return _ssh_error(e)
    if not r['success']:
        return _fail(_err(r))
    return {'success': True, 'message': f'QoS {name} deleted'}


# =====================================================================
# ACCOUNTS
# =====================================================================
def list_accounts():
    r = parse_table(
        run_remote_command(['sacctmgr', 'show', 'accounts',
                            'format=Account,Descr,Org', '--parsable2']),
        ['name', 'description', 'organization'],
    )
    if not r['success']:
        return _fail(_err(r))
    r['data'] = [a for a in r['data'] if a.get('name') != 'root']
    return r


def create_account(name, description=''):
    _check(name, NAME_RE, 'account name')
    args = ['sacctmgr', '-i', 'add', 'account', name]
    if _optional(description, DESC_RE, 'description'):
        args.append(f'description={description}')
    try:
        with HPCSession() as hpc:
            if _account_exists(hpc, name):
                return _fail(f'Account {name} already exists', status=409)
            r = hpc.run(args)
    except Exception as e:
        return _ssh_error(e)
    if not r['success']:
        return _fail(_err(r))
    return {'success': True, 'message': f'Account {name} created'}


def delete_account(name):
    _check(name, NAME_RE, 'account name')
    if name == 'root':
        raise ValidationError('The root account cannot be deleted')
    try:
        with HPCSession() as hpc:
            members = parse_table(
                hpc.run(['sacctmgr', 'show', 'assoc', 'where', f'account={name}',
                         'format=User', '--parsable2']),
                ['username'],
            )
            if not members['success']:
                return _fail(_err(members))
            users = sorted({r['username'] for r in members['data'] if r.get('username')})
            if users:
                return _fail(f'Account {name} still has {len(users)} user(s). '
                             f'Move or delete them first.', status=409)
            r = hpc.run(['sacctmgr', '-i', 'delete', 'account', name])
    except Exception as e:
        return _ssh_error(e)
    if not r['success']:
        return _fail(_err(r))
    return {'success': True, 'message': f'Account {name} deleted'}


# =====================================================================
# CLUSTER (squeue / sinfo have no --parsable2, so -o with | instead)
# =====================================================================
def get_node_status():
    r = parse_table(
        run_remote_command(['sinfo', '-N', '-o', '%N|%P|%T|%C|%m|%E']),
        ['node', 'partition', 'state', 'cpus', 'memory_mb', 'reason'],
    )
    if not r['success']:
        return _fail(_err(r))
    for n in r['data']:
        n['default_partition'] = n.get('partition', '').endswith('*')
        n['partition'] = n.get('partition', '').rstrip('*')
        parts = n.pop('cpus', '').split('/')   # allocated/idle/other/total
        n['cpus'] = (dict(zip(['allocated', 'idle', 'other', 'total'], map(int, parts)))
                     if len(parts) == 4 and all(p.isdigit() for p in parts) else None)
    return r


def get_running_jobs():
    r = parse_table(
        run_remote_command(['squeue', '-o', '%i|%u|%a|%P|%j|%T|%M|%D|%R']),
        ['job_id', 'user', 'account', 'partition', 'name', 'state', 'time', 'nodes', 'reason'],
    )
    return r if r['success'] else _fail(_err(r))

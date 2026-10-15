# api/slurm/mock.py
"""
Fake cluster for MOCK_MODE=True, so the whole UI can be built and tested
without SSH. Read commands return realistic sample data; write commands
just succeed (changes are NOT remembered between requests).
"""

ASSOCS = [  # User, Account, QOS (comma list), DefaultQOS
    {'User': 'aamir',  'Account': 'btech',    'QOS': 'normal,shortq', 'DefaultQOS': 'shortq'},
    {'User': 'aamir',  'Account': 'research', 'QOS': 'normal',        'DefaultQOS': 'normal'},
    {'User': 'bisma',  'Account': 'mtech',    'QOS': 'normal,longq',  'DefaultQOS': 'longq'},
    {'User': 'faizan', 'Account': 'phd',      'QOS': 'normal,gpuq',   'DefaultQOS': 'gpuq'},
    {'User': 'iqra',   'Account': 'btech',    'QOS': 'normal',        'DefaultQOS': 'normal'},
    {'User': 'sameer', 'Account': 'phd',      'QOS': 'normal,longq,gpuq', 'DefaultQOS': 'longq'},
]
DEFAULT_ACCOUNT = {'aamir': 'btech', 'bisma': 'mtech', 'faizan': 'phd', 'iqra': 'btech', 'sameer': 'phd'}
UIDS = {'aamir': 1001, 'bisma': 1002, 'faizan': 1003, 'iqra': 1004, 'sameer': 1005, 'root': 0}
GROUPS = {'btech', 'mtech', 'phd', 'research'}

QOS = [
    {'Name': 'normal', 'Priority': '0',  'MaxWall': '',           'MaxJobsPU': ''},
    {'Name': 'shortq', 'Priority': '10', 'MaxWall': '01:00:00',   'MaxJobsPU': '10'},
    {'Name': 'longq',  'Priority': '5',  'MaxWall': '7-00:00:00', 'MaxJobsPU': '4'},
    {'Name': 'gpuq',   'Priority': '20', 'MaxWall': '2-00:00:00', 'MaxJobsPU': '2'},
]
ACCOUNTS = [
    {'Account': 'btech',    'Descr': 'BTech students',     'Org': 'nitsri'},
    {'Account': 'mtech',    'Descr': 'MTech students',     'Org': 'nitsri'},
    {'Account': 'phd',      'Descr': 'PhD scholars',       'Org': 'nitsri'},
    {'Account': 'research', 'Descr': 'Funded projects',    'Org': 'nitsri'},
]

SINFO = """NODELIST|PARTITION|STATE|CPUS(A/I/O/T)|MEMORY|REASON
cn01|compute*|mixed|24/16/0/40|192000|none
cn02|compute*|allocated|40/0/0/40|192000|none
cn03|compute*|idle|0/40/0/40|192000|none
cn04|compute*|idle|0/40/0/40|192000|none
cn05|compute*|drained|0/0/40/40|192000|disk failure
gpu01|sm3090|mixed|16/16/0/32|384000|none
gpu02|sm3090|allocated|32/0/0/32|384000|none"""

JOBS = [  # id|user|account|partition|name|state|time|nodes|reason
    '48211|faizan|phd|sm3090|train_resnet|RUNNING|5:42:10|1|gpu01',
    '48215|sameer|phd|sm3090|llm_finetune|RUNNING|1-02:11:45|1|gpu02',
    '48230|bisma|mtech|compute|cfd_mesh|RUNNING|12:03|2|cn[01-02]',
    '48231|aamir|btech|compute|matmul_mpi|PENDING|0:00|1|(Resources)',
    '48232|faizan|phd|sm3090|eval_run|PENDING|0:00|1|(QOSMaxJobsPerUserLimit)',
]
JOBS_HEADER = 'JOBID|USER|ACCOUNT|PARTITION|NAME|STATE|TIME|NODES|NODELIST(REASON)'


def _ok(output=''):
    return {'success': True, 'output': output, 'error': ''}


def _fail(error):
    return {'success': False, 'output': '', 'error': error}


def _where(args):
    """Collect key=value filters after 'where' (e.g. name=x user=y)."""
    filters = {}
    if 'where' in args:
        for a in args[args.index('where') + 1:]:
            if a in ('set',) or a.startswith('format='):
                break
            if '=' in a:
                k, v = a.split('=', 1)
                filters[k.lower()] = v
    return filters


def _table(rows, args, key_map, default_fields):
    fields = default_fields
    for a in args:
        if a.startswith('format='):
            fields = a.split('=', 1)[1].split(',')
    lines = [] if '-n' in args else ['|'.join(fields)]
    lines += ['|'.join(r.get(f, '') for f in fields) for r in rows]
    return _ok('\n'.join(lines))


def mock_run(args):
    cmd = args[0]

    if cmd == 'sacctmgr' and 'show' in args:
        what = args[args.index('show') + 1]
        f = _where(args)
        if what == 'assoc':
            rows = [r for r in ASSOCS
                    if r['User'] == f.get('user', r['User'])
                    and r['Account'] == f.get('account', r['Account'])]
            return _table(rows, args, None, ['User', 'Account', 'QOS', 'DefaultQOS'])
        if what == 'user':
            rows = [{'User': u, 'DefaultAccount': a} for u, a in DEFAULT_ACCOUNT.items()
                    if u == f.get('name', u)]
            return _table(rows, args, None, ['User', 'DefaultAccount'])
        if what == 'qos':
            rows = [r for r in QOS if r['Name'] == f.get('name', r['Name'])]
            return _table(rows, args, None, ['Name', 'Priority', 'MaxWall', 'MaxJobsPU'])
        if what in ('account', 'accounts'):
            rows = [r for r in ACCOUNTS if r['Account'] == f.get('name', r['Account'])]
            return _table(rows, args, None, ['Account', 'Descr', 'Org'])

    if cmd == 'sinfo':
        return _ok(SINFO)

    if cmd == 'squeue':
        if '-u' in args:   # used by delete safety check: job ids of one user
            user = args[args.index('-u') + 1]
            return _ok('\n'.join(j.split('|')[0] for j in JOBS if j.split('|')[1] == user))
        return _ok('\n'.join([JOBS_HEADER, *JOBS]))

    if cmd == 'getent':
        kind, name = args[1], args[2]
        known = UIDS if kind == 'passwd' else GROUPS
        return _ok(name) if name in known else _fail('')

    if cmd == 'id':
        name = args[-1]
        return _ok(str(UIDS[name])) if name in UIDS else _fail(f"id: '{name}': no such user")

    if cmd == 'xfs_quota' and 'quota' in ' '.join(args):
        return _ok('/dev/sdb1 12.4G 45G 50G 00 [--------] /home')

    # every write (sacctmgr add/modify/delete, chage, chpasswd, userdel, make, scripts)
    return _ok('MOCK: ' + ' '.join(args))

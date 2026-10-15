# api/views/hpc_users.py
# No @permission_classes: the IsAdminUser default from settings applies.
from rest_framework.decorators import api_view
from api.slurm import commands as c
from ._utils import slurm_view, get_str, require, respond


@api_view(['GET', 'POST'])
@slurm_view
def users_collection(request):
    """GET: list users. POST: create a user."""
    if request.method == 'GET':
        return respond(c.list_hpc_users())

    fields = ('username', 'group', 'qos', 'soft_limit', 'hard_limit')
    values = {f: get_str(request.data, f) for f in fields}
    if (err := require(values)):
        return err
    return respond(c.create_hpc_user(**values), status=201)


@api_view(['GET', 'DELETE'])
@slurm_view
def user_detail(request, username):
    """GET: one user's accounts, QoS and quota. DELETE: remove the user entirely."""
    if request.method == 'GET':
        return respond(c.get_hpc_user(username))
    return respond(c.delete_hpc_user(username))


@api_view(['POST', 'DELETE'])
@slurm_view
def user_qos(request, username):
    """POST {account, qos}: add a QoS. DELETE ?account=&qos=: remove it."""
    source = request.data if request.method == 'POST' else request.query_params
    values = {'account': get_str(source, 'account'), 'qos': get_str(source, 'qos')}
    if (err := require(values)):
        return err
    if request.method == 'POST':
        return respond(c.add_user_qos(username, **values))
    return respond(c.remove_user_qos(username, **values))


@api_view(['POST'])
@slurm_view
def user_default_qos(request, username):
    values = {'account': get_str(request.data, 'account'), 'qos': get_str(request.data, 'qos')}
    if (err := require(values)):
        return err
    return respond(c.set_user_default_qos(username, **values))


@api_view(['POST'])
@slurm_view
def user_accounts(request, username):
    """POST {account}: add the user to another Slurm account."""
    account = get_str(request.data, 'account')
    if (err := require({'account': account})):
        return err
    return respond(c.add_user_account(username, account), status=201)


@api_view(['DELETE'])
@slurm_view
def user_account_detail(request, username, account):
    return respond(c.remove_user_account(username, account))


@api_view(['POST'])
@slurm_view
def user_default_account(request, username):
    account = get_str(request.data, 'account')
    if (err := require({'account': account})):
        return err
    return respond(c.set_user_default_account(username, account))


@api_view(['PUT'])
@slurm_view
def user_quota(request, username):
    values = {'soft_limit': get_str(request.data, 'soft_limit'),
              'hard_limit': get_str(request.data, 'hard_limit')}
    if (err := require(values)):
        return err
    return respond(c.set_user_quota(username, **values))


@api_view(['POST'])
@slurm_view
def user_reset_password(request, username):
    # The response contains the new password. Show it once; never log it.
    return respond(c.reset_user_password(username))

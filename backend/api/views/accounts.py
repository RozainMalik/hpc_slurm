# api/views/accounts.py
from rest_framework.decorators import api_view
from api.slurm import commands as c
from ._utils import slurm_view, get_str, require, respond


@api_view(['GET', 'POST'])
@slurm_view
def accounts_collection(request):
    if request.method == 'GET':
        return respond(c.list_accounts())
    name = get_str(request.data, 'name')
    if (err := require({'name': name})):
        return err
    return respond(c.create_account(name, get_str(request.data, 'description')), status=201)


@api_view(['DELETE'])
@slurm_view
def account_detail(request, name):
    return respond(c.delete_account(name))

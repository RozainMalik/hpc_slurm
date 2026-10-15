# api/views/qos.py
from rest_framework.decorators import api_view
from api.slurm import commands as c
from ._utils import slurm_view, get_str, require, respond

LIMIT_FIELDS = ('max_wall', 'max_jobs_per_user', 'priority')


@api_view(['GET', 'POST'])
@slurm_view
def qos_collection(request):
    if request.method == 'GET':
        return respond(c.list_qos())
    name = get_str(request.data, 'name')
    if (err := require({'name': name})):
        return err
    limits = {f: get_str(request.data, f) for f in LIMIT_FIELDS}
    return respond(c.create_qos(name, **limits), status=201)


@api_view(['PATCH', 'DELETE'])
@slurm_view
def qos_detail(request, name):
    """PATCH: change limits (empty = unchanged, -1 = remove limit). DELETE: remove QoS."""
    if request.method == 'PATCH':
        limits = {f: get_str(request.data, f) for f in LIMIT_FIELDS}
        return respond(c.update_qos(name, **limits))
    return respond(c.delete_qos(name))

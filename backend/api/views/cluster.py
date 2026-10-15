# api/views/cluster.py
from rest_framework.decorators import api_view
from api.slurm import commands as c
from ._utils import respond


@api_view(['GET'])
def node_status(request):
    # each node: node, partition, default_partition, state,
    #            cpus {allocated, idle, other, total}, memory_mb, reason
    return respond(c.get_node_status())


@api_view(['GET'])
def running_jobs(request):
    # each job: job_id, user, account, partition, name, state, time, nodes, reason
    return respond(c.get_running_jobs())

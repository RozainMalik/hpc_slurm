# api/views/_utils.py
"""Shared helpers so every view responds in the same shape:
   success: {'success': True, 'data'?: ..., 'message'?: ...}
   failure: {'success': False, 'error': ..., 'completed_steps'?: [...]}
"""
from functools import wraps
from rest_framework.response import Response
from api.slurm.commands import ValidationError


def slurm_view(func):
    """Turn input-validation errors into a clean 400 instead of a 500."""
    @wraps(func)
    def wrapper(request, *args, **kwargs):
        try:
            return func(request, *args, **kwargs)
        except ValidationError as e:
            return Response({'success': False, 'error': str(e)}, status=400)
    return wrapper


def get_str(data, key):
    """Request values can be None, ints, etc. Normalise to a stripped string."""
    value = data.get(key)
    return '' if value is None else str(value).strip()


def require(values: dict):
    """Return a 400 Response if any value is empty, else None."""
    missing = [k for k, v in values.items() if not v]
    if missing:
        return Response({'success': False, 'error': f'Missing required fields: {", ".join(missing)}'},
                        status=400)
    return None


def respond(result, status=200):
    """Turn a commands.py result into a Response."""
    if not result['success']:
        body = {'success': False, 'error': result.get('error') or 'Command failed'}
        if result.get('completed_steps'):
            body['completed_steps'] = result['completed_steps']
        return Response(body, status=result.get('status', 502))
    body = {'success': True}
    for key in ('data', 'message'):
        if key in result:
            body[key] = result[key]
    return Response(body, status=status)

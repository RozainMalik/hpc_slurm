# api/views/auth.py
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError


class LoginThrottle(AnonRateThrottle):
    scope = 'login'   # rate set in settings: DEFAULT_THROTTLE_RATES['login']


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'success': False, 'error': 'Enter your username and password'}, status=400)

    user = authenticate(username=username, password=password)
    # Only staff accounts may use the portal. Same message either way,
    # so the response doesn't reveal which usernames exist.
    if user is None or not user.is_staff:
        return Response({'success': False, 'error': 'Incorrect username or password'}, status=401)

    refresh = RefreshToken.for_user(user)
    return Response({
        'success': True,
        'username': user.username,
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })


@api_view(['POST'])   # IsAdminUser default applies
def logout_view(request):
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response({'success': False, 'error': 'Refresh token required'}, status=400)
    try:
        RefreshToken(refresh_token).blacklist()
    except TokenError:
        pass   # already invalid: the user is logged out either way
    return Response({'success': True, 'message': 'Logged out'})


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_view(request):
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response({'success': False, 'error': 'Refresh token required'}, status=400)
    try:
        token = RefreshToken(refresh_token)   # also rejects blacklisted tokens
        return Response({'success': True, 'access': str(token.access_token)})
    except TokenError:
        return Response({'success': False, 'error': 'Session expired, please log in again'},
                        status=401)

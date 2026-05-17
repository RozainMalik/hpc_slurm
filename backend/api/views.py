from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

# Create your views here.

@api_view(['POST'])
@permission_classes([AllowAny])

def login_view(request):

    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({
            'success' : False,
            'message' : 'Username and password required'
        })
    
    user = authenticate(username=username, password=password)

    if user is None:
        return Response({
            'success' : False,
            'message' : 'Invalid Credentials'
        })
    
    refresh = RefreshToken.for_user(user)

    return Response({
        'success' : True,
        'username' : user.username,
        'access' : str(refresh.access_token),
        'refresh' : str(refresh),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])

def logout_view(request):

    refresh_token = request.data.get('refresh')

    if not refresh_token:
        return Response({
            'success' : False,
            'message' : 'Refresh token required',
        })
    
    try:
        token = RefreshToken(refresh_token)

        token.blacklist()
        
        return Response({
            'success' : True,
            'message' : 'Logged out successfully'
        })
    
    except TokenError:
        return Response({
            'success' : False,
            'message' : 'Token is invalid or already expired'
        })
    

@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_view(request):
    refresh_token = request.data.get('refresh')

    if not refresh_token :
        return Response({
            'success' : False,
            'message' : 'Refresh token required'
        })
    
    try:
        token =RefreshToken(refresh_token)

        new_access = str(token.access_token)

        return Response({
            'success' : True,
            'access' : new_access
        })
    except TokenError:
        return Response({
            'success' : False,
            'message' : 'Session expired, please login again'
        }, status=401)
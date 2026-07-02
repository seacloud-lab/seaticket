import jwt
import logging

from seahub.settings import JWT_PRIVATE_KEY

logger = logging.getLogger(__name__)


def verify_seaqa_inner_token(request):
    """
    Verify JWT token for internal service-to-service calls.
    
    Expected header format:
        Authorization: Token <jwt>
    
    Returns True if token is valid, False otherwise.
    """
    auth = request.headers.get('Authorization', '').split()
    if not auth or len(auth) != 2 or auth[0].lower() != 'token':
        logger.warning('Invalid Authorization header format')
        return False
    
    token = auth[1]
    if not token:
        logger.warning('Empty token in Authorization header')
        return False
    
    if not JWT_PRIVATE_KEY:
        logger.error('JWT_PRIVATE_KEY not configured')
        return False
    
    try:
        jwt.decode(token, JWT_PRIVATE_KEY, algorithms=['HS256'])
        return True
    except jwt.ExpiredSignatureError:
        logger.warning('JWT token expired')
        return False
    except jwt.InvalidSignatureError:
        logger.warning('JWT signature verification failed')
        return False
    except Exception as e:
        logger.warning('JWT verification failed: %s', e)
        return False

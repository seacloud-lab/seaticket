import os
import seahub.settings as settings
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

GITHUB_CLIENT_ID = getattr(settings, 'GITHUB_CLIENT_ID', '')
GITHUB_CLIENT_SECRET = getattr(settings, 'GITHUB_CLIENT_SECRET', '')
GITHUB_REDIRECT_URI = getattr(settings, 'GITHUB_REDIRECT_URI', '')
GITHUB_APP_ID = getattr(settings, 'GITHUB_APP_ID', '')
GITHUB_APP_PRIVATE_KEY_PATH = os.path.join(BASE_DIR, "github_app", "github-app-private-key.pem")
SERVICE_URL = getattr(settings, 'SERVICE_URL', '')

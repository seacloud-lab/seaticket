import time
import jwt
import requests
import logging


from django.shortcuts import redirect
from seahub.github_app import settings

logger = logging.getLogger(__name__)

def available_installations_by_token(token):
    if not token:
        return redirect("/github/login/")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }

    user_resp = requests.get("https://api.github.com/user", headers=headers)
    if user_resp.status_code != 200:
        result = []
        logger.error("Failed to fetch user info")
        return result
    user_data = user_resp.json()

    orgs_resp = requests.get("https://api.github.com/user/orgs", headers=headers)
    user_orgs = orgs_resp.json() if orgs_resp.status_code == 200 else []

    org_dict = {org["login"]: org for org in user_orgs}
    org_dict[user_data["login"]] = {
        "login": user_data["login"],
        "avatar_url": user_data["avatar_url"],
        "type": "User",
    }

    jwt_token = generate_app_jwt()
    installs_resp = requests.get(
        "https://api.github.com/app/installations",
        headers={"Authorization": f"Bearer {jwt_token}", "Accept": "application/vnd.github+json"},
    )
    app_installations = installs_resp.json()

    result = []
    for login, org in org_dict.items():
        install = next(
            (i for i in app_installations if i["account"]["login"] == login),
            None,
        )

        if not install:
            continue

        org_info = {
            "organization": login,
            "avatar": org.get("avatar_url"),
            "installation_id": install["id"] if install else None,
        }
        result.append(org_info)

    return result


def generate_app_jwt():
    private_key = open(settings.GITHUB_APP_PRIVATE_KEY_PATH, "r").read()
    payload = {
        "iat": int(time.time()),
        "exp": int(time.time()) + 9 * 60,
        "iss": settings.GITHUB_APP_ID,
    }
    return jwt.encode(payload, private_key, algorithm="RS256")

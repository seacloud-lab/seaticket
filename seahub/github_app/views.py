import json
import requests, secrets


from django.shortcuts import redirect
from django.http import JsonResponse
from seahub.github_app.github_app_utils import available_installations_by_token
from seahub.github_app import settings
from seahub.organizations.views import is_org_staff
from seahub.project.models import Workspaces, Projects
from seahub.project.utils import check_project_admin_permission
from seahub.auth.decorators import login_required
from django.shortcuts import render


def github_login(request):
    username = request.user.username
    if not username:
        return JsonResponse({"error": "invalid user"}, status=403)
    state = secrets.token_hex(16)
    project_uuid = request.GET.get('project_uuid')
    if not project_uuid:
        return JsonResponse({"error": "Missing project_uuid"}, status=400)
    request.session["oauth_state"] = state
    request.session["username"] = username
    request.session["project_uuid"] = project_uuid

    authorize_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={settings.GITHUB_CLIENT_ID}"
        f"&redirect_uri={settings.GITHUB_REDIRECT_URI}"
        f"&scope=read:org,repo"
        f"&state={state}"
    )
    return redirect(authorize_url)


def github_callback(request):
    username = request.session.get("username")
    if not username:
        return JsonResponse({"error": "invalid user"}, status=403)
    code = request.GET.get("code")
    state = request.GET.get("state")
    if state != request.session.get("oauth_state"):
        return JsonResponse({"error": "Invalid state"}, status=400)

    token_resp = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": settings.GITHUB_CLIENT_ID,
            "client_secret": settings.GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.GITHUB_REDIRECT_URI,
        },
    )
    data = token_resp.json()
    token = data.get("access_token")

    user_resp = requests.get(
        "https://api.github.com/user",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json"
        }
    )
    user_info = user_resp.json()
    if not token:
        return JsonResponse({"error": "Failed to get token", "details": data}, status=400)


    # save user info
    project_uuid = request.session.get("project_uuid")
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        error_msg = f'Project {project_uuid} not found.'
        return JsonResponse({"error": error_msg}, status=404)
    project_name = project.name

    workspace_id = project.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        error_msg = f'Workspace {workspace_id} not found.'
        return JsonResponse({"error": error_msg}, status=404)

    if not check_project_admin_permission(username, workspace.owner):
        error_msg = 'Permission denied.'
        return JsonResponse({"error": error_msg}, status=403)

    try:
        github_oauth = {"username": user_info.get('login'), "avatar_url": user_info.get('avatar_url'),
                             "access_token": token}
        project.github_oauth = json.dumps(github_oauth)
        project.modifier = username
        project.save()
        github_oauth.pop('access_token')
    except Exception as e:
        error_msg = 'Internal Server Error'
        return JsonResponse({"error": error_msg}, status=403)
    back_url = f"{settings.SERVICE_URL}/workspace/{workspace_id}/project/{project_name}/github-integration/"
    return redirect(back_url)


def available_installations(request):
    username = request.session.get("username")
    if not username:
        return JsonResponse({"error": "invalid user"}, status=403)
    token = request.session.get("access_token")
    if not token:
        return redirect("/github/login/")
    result = available_installations_by_token(token)

    return JsonResponse(result, safe=False)


@login_required
def github_oauth_auth(request, **kwargs):
    username = request.user.username
    if not username:
        return JsonResponse({"error": "invalid user"}, status=403)
    project_uuid = request.GET.get('project_uuid')
    if not project_uuid:
        error_msg = f'Missing project_uuid.'
        return JsonResponse({"error": error_msg}, status=404)
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        error_msg = f'Project {project_uuid} not found.'
        return JsonResponse({"error": error_msg}, status=404)

    workspace_id = project.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    org_id = workspace.org_id
    is_staff = is_org_staff(org_id, username)
    if not is_staff:
        return JsonResponse({"error": "invalid user"}, status=403)
    project_name = project.name

    return render(request, "github/oauth_auth.html", {
        'project_uuid':project_uuid,
        'project_name': project_name,
        'workspace_id' : workspace_id,
    })

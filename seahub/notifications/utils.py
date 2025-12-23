import json

from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname
from .models import UserNotification


def add_user_to_group_notice(to_user, group_id, group_name, group_staff_email):
    if not to_user or not group_staff_email or to_user == group_staff_email:
        return
    detail = {
        'group_staff_email': group_staff_email,
        'group_staff_name': email2nickname(group_staff_email),
        'group_id': group_id,
        'group_name': group_name,
    }
    UserNotification.objects.create(
        to_user=to_user,
        msg_type='add_user_to_group',
        detail=json.dumps(detail),
    )

def get_user_notifications(username, page, per_page):
    start = (page - 1) * per_page
    end = page * per_page

    notice_list = UserNotification.objects.get_user_notifications(username)[start:end]
    notification_list = []
    for i in notice_list:
        if i.detail is not None:
            notification_list.append(i.to_dict())

    total_count = UserNotification.objects.get_user_notifications(username).count()
    unseen_count = UserNotification.objects.get_user_notifications(username, seen=False).count()

    return {
        'notification_list': notification_list,
        'count': total_count,
        'unseen_count': unseen_count,
    }


def ticket_assignee_added_msg_to_json(ticket_id, ticket_title, from_user_id, workspace_id=None, project_name=None):
    return json.dumps({
        'ticket_id': ticket_id,
        'ticket_title': ticket_title,
        'from_user_name': email2nickname(from_user_id),
        'from_user_id': from_user_id,
        'from_user_avatar': api_avatar_url(from_user_id)[0],
        'workspace_id': workspace_id,
        'project_name': project_name,
    })

def ticket_comment_msg_to_json(ticket_id, ticket_title, from_user_id, comment_id=None, comment_content=None, workspace_id=None, project_name=None):
    return json.dumps({
        'ticket_id': ticket_id,
        'ticket_title': ticket_title,
        'from_user_name': email2nickname(from_user_id),
        'from_user_id': from_user_id,
        'from_user_avatar': api_avatar_url(from_user_id)[0],
        'comment_id': comment_id,
        'comment_content': comment_content,
        'workspace_id': workspace_id,
        'project_name': project_name,
    })

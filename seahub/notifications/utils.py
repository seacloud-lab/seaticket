import json

from seahub.base.templatetags.seahub_tags import email2nickname


def get_user_notifications(username, page, per_page):
    start = (page - 1) * per_page
    end = page * per_page

    from .models import UserNotification
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
        'workspace_id': workspace_id,
        'project_name': project_name,
    })

def agent_notify_assignee_msg_to_json(
    ticket_id, ticket_title, from_user_id, message=None, workspace_id=None, project_name=None
):
    return json.dumps({
        'ticket_id': ticket_id,
        'ticket_title': ticket_title,
        'from_user_name': email2nickname(from_user_id),
        'from_user_id': from_user_id,
        'message': message or '',
        'workspace_id': workspace_id,
        'project_name': project_name,
    })

def ticket_comment_msg_to_json(ticket_id, ticket_title, from_user_id, comment_id=None, comment_content=None, workspace_id=None, project_name=None):
    return json.dumps({
        'ticket_id': ticket_id,
        'ticket_title': ticket_title,
        'from_user_name': email2nickname(from_user_id),
        'from_user_id': from_user_id,
        'comment_id': comment_id,
        'comment_content': comment_content,
        'workspace_id': workspace_id,
        'project_name': project_name,
    })

from django.db import connection

from seahub.ccnet_db.ccnet import db_name


def get_users_role(usernames):
    """
    usernames: username list

    return: {'username1': role1, 'username2': role2}
    """
    if not usernames:
        return {}

    role_dict = {username: '' for username in usernames}
    sql = """
        SELECT email, role FROM %s.UserRole
        WHERE email in %%s
    """ % (db_name,)
    with connection.cursor() as cursor:
        cursor.execute(sql, (usernames,))
        for email, role in cursor.fetchall():
            role_dict[email] = role

    return role_dict


def remove_user_password(username):
    if not username:
        raise Exception('username can not be empty')

    sql = """
        UPDATE %s.EmailUser SET passwd='!' WHERE email=%%s
    """ % (db_name,)
    with connection.cursor() as cursor:
        cursor.execute(sql, (username,))


def filter_profile_users(profile_user_list, org_id):
    if not profile_user_list:
        return []

    sql = """
        SELECT eu.email
        FROM %(db_name)s.EmailUser eu 
        LEFT JOIN %(db_name)s.OrgUser ou 
        ON eu.email=ou.email 
        WHERE eu.is_active=1 AND eu.email IN %%s
    """ % ({'db_name': db_name, })

    if org_id == -1:
        sql += ' AND ou.org_id IS NULL'
    else:
        sql += ' AND ou.org_id=%s' % org_id

    with connection.cursor() as cursor:
        cursor.execute(sql, (profile_user_list,))
        users = cursor.fetchall()
        user_list = [user[0] for user in users]
    return user_list

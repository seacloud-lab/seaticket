from django.db import connection

from seahub.seafile_db.seafile import db_name

def get_repos_size(repo_ids):
    """get size of repos
    
    Keyword arguments:
    repo_ids: a list of repo_id
    Return: a dict of {repo_id: size}
    """
    sql = '''
        SELECT repo_id, size FROM %(db_name)s.RepoSize
        WHERE repo_id IN %%s
    ''' % {
        'db_name': db_name
    }
    with connection.cursor() as cursor:
        cursor.execute(sql, (repo_ids,))
        rows = cursor.fetchall()
        return {row[0]: row[1] for row in rows}


def get_users_storage(user_list):
    """get users storage
    
    Keyword arguments:
    user_list -- a list of username
    Return: {username1: storage_in_bytes}
    """
    if not user_list:
        return {}
    sql = '''
        SELECT w.owner, IFNULL(rs.size, 0) FROM workspaces w
        JOIN %(db_name)s.RepoSize rs ON w.repo_id=rs.repo_id
        WHERE w.owner IN %%s
    ''' % {
        'db_name': db_name
    }
    with connection.cursor() as cursor:
        cursor.execute(sql, (user_list,))
        rows = cursor.fetchall()
        return {row[0]: row[1] for row in rows}

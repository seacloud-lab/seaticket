from django.db import connection

from seahub.ccnet_db.ccnet import db_name


class OrgUser(object):

    is_anonymous = False

    def __init__(self, **kwargs):
        self.org_id = kwargs.pop('org_id')
        self.is_staff = kwargs.pop('is_staff')
        self.email = kwargs.pop('email')
        self.ctime =kwargs.pop('ctime')
        self.id = kwargs.pop('id')
        self.is_active = kwargs.pop('is_active')
        self.username = kwargs.pop('username')


def get_org_staff_count(org_id):
    """
    return number of org staff
    """
    cnt = 0
    with connection.cursor() as cursor:
        sql = "SELECT COUNT(1) AS count FROM %s.OrgUser WHERE org_id=%%s AND is_staff=1"
        sql = sql % (db_name,)
        cursor.execute(sql, (org_id,))
        cnt = cursor.fetchone()[0]

    return cnt


def get_orgs_base_info(org_ids):
    """
    return base info dict of org_ids
    base info {'org_1': {'org_id':, 'org_name':}}
    """
    if not org_ids:
        return {}
    results = {}
    with connection.cursor() as cursor:
        sql = "SELECT org_id, org_name, url_prefix, creator, ctime FROM %s.Organization WHERE org_id in %%s"
        sql = sql % (db_name,)
        cursor.execute(sql, (org_ids,))
        infos = cursor.fetchall()
        results = {i[0]: {
            'org_id': i[0],
            'org_name': i[1],
            'url_prefix': i[2],
            'creator': i[3],
            'ctime': i[4]
        } for i in infos}
    return results


def get_users_org_ids(user_list):
    """get org_ids of users
    Argument user_list: a list of username
    return: {username: org_id}
    """
    if not user_list:
        return {}
    sql = '''
        SELECT org_id, email FROM %(db_name)s.OrgUser
        WHERE email IN %%s
    ''' % {
        'db_name': db_name
    }
    with connection.cursor() as cursor:
        cursor.execute(sql, (user_list,))
        rows = cursor.fetchall()
        return {row[1]: row[0] for row in rows}


def get_org_staffs(org_id):
    staffs = []
    with connection.cursor() as cursor:
        sql = "SELECT email FROM %s.OrgUser WHERE org_id=%%s AND is_staff=1"
        sql = sql % (db_name,)
        cursor.execute(sql, (org_id,))
        staffs = cursor.fetchall()
    return [s[0] for s in staffs]


def get_org_email_users(org_id, page, per_page):
    start = (page-1) * per_page
    limit = per_page
    org_users = []
    with connection.cursor() as cursor:
        sql = '''
            SELECT
              ou.org_id,
              ou.is_staff,
              ou.email,
              eu.ctime,
              eu.id,
              eu.is_active 
            FROM
                %(db_name)s.OrgUser ou
                JOIN %(db_name)s.EmailUser eu ON ou.email = eu.email 
            WHERE
                ou.org_id = %(org_id)s
            ORDER BY
                eu.ctime DESC
            LIMIT 
                %(start)s, %(limit)s
        '''

        sql = sql % ({
            'db_name': db_name,
            'org_id': org_id,
            'start': start,
            'limit': limit
        })
        cursor.execute(sql)
        users = cursor.fetchall()
        for user in users:
            org_id = user[0]
            is_staff = user[1]
            email = user[2]
            ctime = user[3]
            id = user[4]
            is_active = user[5]

            org_users.append(OrgUser(
                org_id=org_id,
                is_staff=is_staff,
                email=email,
                ctime=ctime,
                id=id,
                is_active=is_active,
                username = email,
            )
            )
    return org_users

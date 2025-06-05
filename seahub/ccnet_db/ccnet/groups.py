from django.db import connection

from seahub.ccnet_db.ccnet import db_name


class FakeGroup:  # fake Group class for ccnet

    def __init__(self, group_info):
        self.id = group_info.get('group_id')
        self.group_name = group_info.get('group_name')
        self.creator_name = group_info.get('group_owner')
        self.timestamp = group_info.get('timestamp')
        self.source = group_info.get('source') or 'DB'
        self.parent_group_id = group_info.get('parent_group_id')


def get_groups_members(group_ids, only_staffs=False):
    """
    not encouraged to retrieve multi groups
    return {'group_1': [{'username': 'xxx', 'is_staff': 0/1}...],}
    """
    if not group_ids:
        return {}
    group_members_dict = {gid: [] for gid in group_ids}
    with connection.cursor() as cursor:
        sql = "SELECT group_id, user_name, is_staff FROM %s.GroupUser WHERE group_id IN %%s %s"
        args = [db_name]
        if only_staffs:
            args.append(' AND is_staff=1 ')
        else:
            args.append('')
        sql = sql % tuple(args)
        cursor.execute(sql, (group_ids,))
        for group_id, username, is_staff in cursor.fetchall():
            group_members_dict[group_id].append({'username': username, 'is_staff': is_staff})
    return group_members_dict


def get_groups_members_count(group_ids):
    """
    return {'group_1': 2,}
    """
    if not group_ids:
        return {}
    count_dict = {gid: 0 for gid in group_ids}
    with connection.cursor() as cursor:
        sql = "SELECT group_id, COUNT(1) FROM %s.GroupUser WHERE group_id IN %%s GROUP BY group_id" % (db_name,)
        cursor.execute(sql, (group_ids,))
        for group_id, count in cursor.fetchall():
            count_dict[group_id] = count
    return count_dict


def get_groups_info(group_ids, username=None):
    """
    get groups info including id name and owner

    :params group_ids: list of group ids
    :params username: if not None, add `is_admin` to group info

    return {'group_1': {'group_name': '', ...other infos}}
    """
    if not group_ids:
        return {}
    info_dict = {gid: {} for gid in group_ids}
    with connection.cursor() as cursor:
        # if you want to add more info please add those columns you need
        sql = "SELECT group_id, creator_name, group_name, parent_group_id, timestamp FROM %s.Group WHERE group_id IN %%s" % (db_name,)
        cursor.execute(sql, (group_ids,))
        for group_info in cursor.fetchall():
            group_id = group_info[0]
            info_dict[group_id] = {
                'group_name': group_info[2],
                'group_id': group_id,
                'group_owner': group_info[1],
                'parent_group_id': group_info[3],
                'timestamp': group_info[4],
                'org_id': -1
            }
        sql = "SELECT org_id, group_id FROM %s.OrgGroup WHERE group_id in %%s" % (db_name,)
        cursor.execute(sql, (group_ids,))
        for group_info in cursor.fetchall():
            org_id, group_id = group_info[0], group_info[1]
            info_dict[group_id]['org_id'] = org_id
    if username:
        admin_group_ids = set(get_user_admin_group_ids(username))
        for group_id, group_info in info_dict.items():
            group_info['is_admin'] = group_id in admin_group_ids
    return info_dict


def get_sub_groups_info(group_id):
    """
    get groups info including id name and owner
    return {'sub_group_1': {'group_name': '', ...other infos}}
    """
    sql = "SELECT group_id, creator_name, group_name, parent_group_id FROM %s.Group WHERE parent_group_id=%%s" % (db_name,)
    info_dict = {}
    with connection.cursor() as cursor:
        cursor.execute(sql, (group_id,))
        for group_info in cursor.fetchall():
            group_id, creator_name, group_info = group_info[0], group_info[1], group_info[2:]
            info_dict[group_id] = {
                'group_name': group_info[0],
                'group_id': group_id,
                'group_owner': creator_name,
                'parent_group_id': group_info[1]
            }
    return info_dict


def update_group_info(group_id, group_info):
    """update group info
    
    group_info: dict of {creator_name, parent_group_id, group_name...}
    """
    updates, params = [], []

    if group_info.get('creator_name') is not None:
        updates.append('`creator_name`=%s')
        params.append(group_info['creator_name'])

    if group_info.get('parent_group_id') is not None:
        updates.append('`parent_group_id`=%s')
        params.append(group_info['parent_group_id'])

    if group_info.get('group_name') is not None:
        updates.append('`group_name`=%s')
        params.append(group_info['group_name'])

    if not updates:
        return
    updates_str = ', '.join(updates)
    sql = "UPDATE `%s`.`Group` SET %s WHERE `group_id`=%%s" % (db_name, updates_str)
    with connection.cursor() as cursor:
        params.append(group_id)
        cursor.execute(sql, params)


def delete_GroupStructure(group_id):
    sql = "DELETE FROM `%s`.`GroupStructure` WHERE `group_id`=%%s" % db_name
    with connection.cursor() as cursor:
        cursor.execute(sql, [group_id])


def delete_GroupUser(group_id):
    sql = "DELETE FROM `%s`.`GroupUser` WHERE `group_id`=%%s" % db_name
    with connection.cursor() as cursor:
        cursor.execute(sql, [group_id])


def get_user_admin_group_ids(username):
    """
    return [group_id1, group_id2...]
    """
    group_ids = []
    if not username:
        return group_ids
    sql = "SELECT group_id FROM %s.GroupUser WHERE user_name=%%s AND is_staff=1" % (db_name,)
    with connection.cursor() as cursor:
        cursor.execute(sql, (username,))
        for row in cursor.fetchall():
            group_ids.append(row[0])
    return group_ids


def get_non_org_all_dep_ids():
    """
    return all deps of sys(!cloud)
    return [group_id]
    """
    sql = """
        SELECT
            g.group_id
        FROM
            %(ccnet_db)s.Group g
        LEFT JOIN %(ccnet_db)s.OrgGroup og ON g.group_id = og.group_id
        WHERE
            og.org_id IS NULL AND g.parent_group_id <> 0;
    """ % {'ccnet_db': db_name}
    with connection.cursor() as cursor:
        cursor.execute(sql)
        return [group[0] for group in cursor.fetchall()]


def get_non_org_top_dep_ids():
    """
    return top deps of sys(!cloud)
    return [group_id]
    """
    sql = """
        SELECT
            g.group_id
        FROM
            %(ccnet_db)s.Group g
        LEFT JOIN %(ccnet_db)s.OrgGroup og ON g.group_id = og.group_id
        WHERE
            og.org_id IS NULL AND g.parent_group_id = -1;
    """ % {'ccnet_db': db_name}
    with connection.cursor() as cursor:
        cursor.execute(sql)
        return [group[0] for group in cursor.fetchall()]


def get_org_all_dep_ids(org_id):
    """
    return all deps of an org
    """
    sql = """
        SELECT
            g.group_id
        FROM
            %(ccnet_db)s.Group g
        LEFT JOIN %(ccnet_db)s.OrgGroup og ON g.group_id = og.group_id
        WHERE
            og.org_id=%%s AND g.parent_group_id <> 0;
    """ % {'ccnet_db': db_name}
    with connection.cursor() as cursor:
        cursor.execute(sql, (org_id,))
        return [group[0] for group in cursor.fetchall()]


def get_org_top_dep_ids(org_id):
    """
    return top deps of an org
    """
    sql = """
        SELECT
            g.group_id
        FROM
            %(ccnet_db)s.Group g
        LEFT JOIN %(ccnet_db)s.OrgGroup og ON g.group_id = og.group_id
        WHERE
            og.org_id=%%s AND g.parent_group_id = -1;
    """ % {'ccnet_db': db_name}
    with connection.cursor() as cursor:
        cursor.execute(sql, (org_id,))
        return [group[0] for group in cursor.fetchall()]


def get_user_group_ids(username):
    """return a list of groups user in
    """
    sql = "SELECT group_id FROM %s.GroupUser WHERE user_name=%%s" % db_name
    group_ids = []
    with connection.cursor() as cursor:
        cursor.execute(sql, (username,))
        for item in cursor.fetchall():
            group_ids.append(item[0])
    return group_ids

def search_org_group(org_id, query, start=0, end=25):
    """
        return a list of the groups info the query results
    """
    sql = """
        SELECT
            `g`.`group_id`,
            `g`.`group_name`,
            `g`.`creator_name`,
            `g`.`timestamp` 
        FROM
            `%(ccnet_db)s`.`Group` `g`
            LEFT JOIN `%(ccnet_db)s`.`OrgGroup` `og` ON `g`.`group_id` = `og`.`group_id` 
        WHERE
            `og`.`org_id` = %%s 
            AND `g`.`group_name` LIKE %%s
        LIMIT %%s, %%s;
    """ % {'ccnet_db': db_name}
    group_infos = []
    with connection.cursor() as cursor:
        cursor.execute(sql, (org_id, f'%{query}%', start, end))
        for item in cursor.fetchall():
            group_infos.append({
                'group_id': item[0],
                'group_name': item[1],
                'creator_name': item[2],
                'timestamp': item[3]
            })
    return group_infos

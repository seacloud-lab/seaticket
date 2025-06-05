# -*- coding: utf-8 -*-
import logging

from django.utils.translation import gettext as _
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seaserv import ccnet_api
import seaserv

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion, IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, get_user_common_info, send_signal_to_dtable_server
from seahub.group.utils import group_id_to_name, is_group_member
from seahub.dtable.models import DTables, DTableShare, DTableGroupShare, DTableSharePermission, FolderItems
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_PREFIX
from seahub.dtable.constants import FOLDER_ITEM_DTABLE_GROUP_SHARE
from seahub.utils import is_valid_username
from seahub.dtable.utils import get_share_permission, clean_related_users_cache
from seahub.dtable.settings import DTABLE_SHARE_QUOTA

logger = logging.getLogger(__name__)
permission_tuple = (PERMISSION_READ, PERMISSION_READ_WRITE)
GROUP_DOMAIN = '@seafile_group'

class OrgAdminDTableSharePermissions(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, org_id, dtable_uuid):
        try:
            org_id = int(org_id)
        except:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = _('Base not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        # permission check
        if dtable.workspace.org_id != org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        try:
            permission_qs = DTableSharePermission.objects.list_by_dtable(
                dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        permission_list = [item.to_dict() for item in permission_qs]
        return Response({'permission_list': permission_list})

class OrgAdminDTableShares(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, org_id, dtable_uuid):
        """
        list shares info of a base including user and group
        """
        # resource check
        try:
            org_id = int(org_id)
        except:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = _('Base not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if dtable.workspace.org_id != org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        dtable_user_shares, dtable_group_shares = [], []
        try:
            user_share_queryset = DTableShare.objects.list_by_dtable(dtable)
            for item in user_share_queryset:
                user_info = get_user_common_info(item.to_user)
                user_info['permission'] = item.permission
                user_info['share_id'] = item.id
                dtable_user_shares.append(user_info)
            group_share_queryset = DTableGroupShare.objects.filter(dtable=dtable)
            for item in group_share_queryset:
                group_id = item.group_id
                dtable_group_shares.append({
                    'group_id': group_id,
                    'group_name': group_id_to_name(group_id),
                    'permission': item.permission,
                    'share_id': item.id
                })
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


        return Response({
            "user_shares": dtable_user_shares,
            "group_shares": dtable_group_shares
        })

class OrgAdminDTableShareUsers(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, org_id, dtable_uuid):
        #args check
        try:
            org_id = int(org_id)
        except:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        to_user = request.data.get('email')
        if not to_user or not is_valid_username(to_user):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        # resource check
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = _('Base not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        if ccnet_api.org_user_exists(org_id, to_user) == 0:
            error_msg = 'User %s not found.' % to_user
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        # arg - share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
        # permission check
        if dtable.workspace.org_id != org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        #owner && target check
        workspace = dtable.workspace
        if GROUP_DOMAIN in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            if org_id != seaserv.get_org_id_by_group(int(group_id)):
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            group = seaserv.get_group(group_id)
            if not group:
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            if is_group_member(group_id, to_user):
                error_msg = _('This base cannot be shared to its group member.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            from_user = group_id + GROUP_DOMAIN
        else:
            if workspace.owner == to_user:
                error_msg = 'Cannot share to the owner of the base'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            from_user = workspace.owner

        # main
        try:
            obj = DTableShare.objects.get_by_dtable_and_to_user(dtable, to_user)
            if obj:
                error_msg = _('Base already shared to %s.') % (to_user)
                return api_error(status.HTTP_409_CONFLICT, error_msg)

            share_count = DTableShare.objects.get_count_by_dtable(dtable)
            if share_count >= DTABLE_SHARE_QUOTA:
                error_msg = _('Base cannot be shared to more than %s users.') % (DTABLE_SHARE_QUOTA)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            DTableShare.objects.add(dtable, from_user, to_user, permission)
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True}, status=status.HTTP_201_CREATED)

class OrgAdminDTableShareUser(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, org_id, dtable_uuid, email):
        #args check
        try:
            org_id = int(org_id)
        except:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if not email or not is_valid_username(email):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        # resource check
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = _('Base not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        # arg - share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
        # permission check
        if dtable.workspace.org_id != org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        # main
        try:
            obj = DTableShare.objects.get_by_dtable_and_to_user(dtable, email)
            #share status check
            if not obj:
                error_msg = 'base not shared to %s.' % (email)
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            if permission == obj.permission:
                error_msg = 'base already has %s share permission.' % (permission)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            obj.permission = permission
            obj.save(update_fields=['permission'])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True})
    
    def delete(self, request, org_id, dtable_uuid, email):
        #args check
        try:
            org_id = int(org_id)
        except:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if not email or not is_valid_username(email):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        # resource check
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = _('Base not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        # permission check
        if dtable.workspace.org_id != org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        # main
        try:
            obj = DTableShare.objects.get_by_dtable_and_to_user(dtable, email)
            if not obj:
                error_msg = 'table not shared to %s.' % (email)
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
            obj.delete()
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True})
    
class OrgAdminDTableShareGroups(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, org_id, dtable_uuid):
        #args check
        try:
            org_id = int(org_id)
        except:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        group_id = request.data.get('group_id')
        try:
            group_id = int(group_id)
        except:
            error_msg = 'group_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if group_id == 0:
            error_msg = 'group_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        # resources check
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        if ccnet_api.get_org_id_by_group(group_id) != org_id:
            error_msg = f'Group {group_id} is not one of the organization {org_id}\'s group.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        if GROUP_DOMAIN in dtable.workspace.owner and str(group_id) + GROUP_DOMAIN == dtable.workspace.owner:
            error_msg = 'Cannot share table to the group which table belongs to.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        # permission check
        if dtable.workspace.org_id != org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        # arg - share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        try:
            if DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).exists():
                error_msg = _('Base %s already shared to the group.') % dtable.name
                return api_error(status.HTTP_409_CONFLICT, error_msg)
            record = DTableGroupShare.objects.create(dtable=dtable, group_id=group_id, permission=permission, created_by=dtable.workspace.owner)
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        dtable_group_share = {
            'group_id': group_id,
            'group_name': group_id_to_name(group_id),
            'permission': record.permission,
            'dtable_share_id': record.id
        }

        return Response({'dtable_group_share': dtable_group_share})

class OrgAdminDTableShareGroup(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, org_id, dtable_uuid, group_id):
        # argument check
        try:
            org_id = int(org_id)
        except:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        try:
            group_id = int(group_id)
        except:
            error_msg = 'group_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if group_id == 0:
            error_msg = 'group_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        #resources check
        group = seaserv.get_group(group_id)
        if not group:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        if ccnet_api.get_org_id_by_group(group_id) != org_id:
            error_msg = f'Group {group_id} is not one of the organization {org_id}\'s group.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'base %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        if not DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).exists():
            error_msg = 'The base has not been shared to group %s' % (group_id,)
            return None, None, api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        # permission check
        if dtable.workspace.org_id != org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        # arg - share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            updates = {'permission': permission}
            DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).update(**updates)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    def delete(self, request, org_id, dtable_uuid, group_id):
        #resources check
        try:
            org_id = int(org_id)
        except:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        try:
            group_id = int(group_id)
        except:
            error_msg = 'group_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if group_id == 0:
            error_msg = 'group_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        group = seaserv.get_group(group_id)
        if not group:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        if ccnet_api.get_org_id_by_group(group_id) != org_id:
            error_msg = f'Group {group_id} is not one of the organization {org_id}\'s group.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'base %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        if not DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).exists():
            error_msg = 'The base has not been shared to group %s' % (group_id,)
            return None, None, api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        # permission check
        if dtable.workspace.org_id != org_id:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        try:
            record = DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).first()
            FolderItems.objects.filter(item_type=FOLDER_ITEM_DTABLE_GROUP_SHARE, item_id=record.id).delete()
            record.delete()
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

from seahub.test_utils import BaseTestCase

from seahub.role_permissions.settings import merge_roles

K1 = 'k1'
K2 = 'k2'


class SettingsTest(BaseTestCase):
    def test_merge_roles1(self, ):
        default = {
            'default': {
                K1: True,
                K2: True,
            },
        }

        custom = {
            'default': {
                K1: False,
                K2: False,
            },
            'custom': {
                K1: True,
            }
        }

        merged = merge_roles(default, custom, fallback_role='default')
        assert merged['default'][K1] is False
        assert merged['default'][K2] is False
        assert merged['custom'][K1] is True
        assert merged['custom'][K2] is True

    def test_merge_roles2(self):
        default = {
            'default': {
                'can_add_dtable': True,
                'can_add_group': True,
                'can_use_global_address_book': True,
                'can_invite_guest': False,
                'role_quota': '',
                'role_asset_quota': '',
                'row_limit': -1,
                'can_create_common_dataset': True,
                'can_generate_external_link': True,
                'can_run_python_script': True,
                'can_use_advanced_permissions': False,
                'snapshot_days': 180,
                'share_limit': 100,
            },
            'guest': {
                'can_add_dtable': False,
            },
            'org_default': {
                'share_limit': 10,
            }
        }

        custom = {
            'guest': {
                'can_use_advanced_permissions': True,
            },
            'org_pro': {
                'share_limit': 1000,
            }
        }

        merged = merge_roles(default, custom, fallback_role='default')
        assert merged['default']['can_add_dtable'] is True
        assert merged['guest']['can_add_dtable'] is False
        assert merged['org_default']['can_add_dtable'] is True
        assert merged['org_pro']['can_add_dtable'] is True

        assert merged['default']['share_limit'] == 100
        assert merged['guest']['share_limit'] == 100
        assert merged['org_default']['share_limit'] == 10
        assert merged['org_pro']['share_limit'] == 1000

        assert merged['default']['can_run_python_script'] is True
        assert merged['guest']['can_run_python_script'] is True
        assert merged['org_default']['can_run_python_script'] is True
        assert merged['org_pro']['can_run_python_script'] is True

        assert merged['default']['can_use_advanced_permissions'] is False
        assert merged['guest']['can_use_advanced_permissions'] is True
        assert merged['org_default']['can_use_advanced_permissions'] is False
        assert merged['org_pro']['can_use_advanced_permissions'] is False

    def test_merge_roles3(self):
        default = {
            'dummy_admin': {
                'can_view_system_info': False,
                'can_view_statistic': False,
                'can_config_system': False,
                'can_manage_library': False,
                'can_manage_user': False,
                'can_update_user': False,
                'can_manage_group': False,
                'can_manage_external_link': False,
                'can_view_user_log': False,
                'can_view_admin_log': False,
            },
            'default_admin': {
                'can_view_system_info': True,
                'can_view_statistic': True,
                'can_config_system': True,
                'can_manage_library': True,
                'can_manage_user': True,
                'can_update_user': True,
                'can_manage_group': True,
                'can_manage_external_link': True,
                'can_view_user_log': True,
                'can_view_admin_log': True,
            },
            # SYSTEM_ADMIN can ONLY view system-info(without upload licence), settings pages.
            'system_admin': {
                'can_view_system_info': True,
                'can_config_system': True,
            },
            # DAILY_ADMIN can ONLY view system-info(without upload licence), statistic,
            # libraries, users(except 'Admins'), groups, user-logs pages.
            'daily_admin': {
                'can_view_system_info': True,
                'can_view_statistic': True,
                'can_manage_library': True,
                'can_manage_user': True,
                'can_update_user': True,
                'can_manage_group': True,
                'can_view_user_log': True,
            },
            # AUDIT_ADMIN can ONLY view system-info(without upload licence), admin-logs pages.
            'audit_admin': {
                'can_view_system_info': True,
                'can_view_admin_log': True,
            }
        }

        custom = {
            'subscription_admin': {
                'can_update_user': True,
            }
        }

        merged = merge_roles(default, custom, fallback_role='dummy_admin')
        assert merged['dummy_admin']['can_view_system_info'] is False
        assert merged['dummy_admin']['can_view_statistic'] is False
        assert merged['dummy_admin']['can_config_system'] is False
        assert merged['dummy_admin']['can_manage_library'] is False
        assert merged['dummy_admin']['can_manage_user'] is False
        assert merged['dummy_admin']['can_update_user'] is False
        assert merged['dummy_admin']['can_manage_group'] is False
        assert merged['dummy_admin']['can_manage_external_link'] is False
        assert merged['dummy_admin']['can_view_user_log'] is False
        assert merged['dummy_admin']['can_view_admin_log'] is False

        assert merged['default_admin']['can_view_system_info'] is True
        assert merged['default_admin']['can_view_statistic'] is True
        assert merged['default_admin']['can_config_system'] is True
        assert merged['default_admin']['can_manage_library'] is True
        assert merged['default_admin']['can_manage_user'] is True
        assert merged['default_admin']['can_update_user'] is True
        assert merged['default_admin']['can_manage_group'] is True
        assert merged['default_admin']['can_manage_external_link'] is True
        assert merged['default_admin']['can_view_user_log'] is True
        assert merged['default_admin']['can_view_admin_log'] is True

        assert merged['audit_admin']['can_view_system_info'] is True
        assert merged['audit_admin']['can_view_statistic'] is False
        assert merged['audit_admin']['can_config_system'] is False
        assert merged['audit_admin']['can_manage_library'] is False
        assert merged['audit_admin']['can_manage_user'] is False
        assert merged['audit_admin']['can_update_user'] is False
        assert merged['audit_admin']['can_manage_group'] is False
        assert merged['audit_admin']['can_manage_external_link'] is False
        assert merged['audit_admin']['can_view_user_log'] is False
        assert merged['audit_admin']['can_view_admin_log'] is True

        assert merged['subscription_admin']['can_view_system_info'] is False
        assert merged['subscription_admin']['can_view_statistic'] is False
        assert merged['subscription_admin']['can_config_system'] is False
        assert merged['subscription_admin']['can_manage_library'] is False
        assert merged['subscription_admin']['can_manage_user'] is False
        assert merged['subscription_admin']['can_update_user'] is True
        assert merged['subscription_admin']['can_manage_group'] is False
        assert merged['subscription_admin']['can_manage_external_link'] is False
        assert merged['subscription_admin']['can_view_user_log'] is False
        assert merged['subscription_admin']['can_view_admin_log'] is False

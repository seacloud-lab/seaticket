CREATE TABLE IF NOT EXISTS `org_big_data_storage_stats` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` int(11) NOT NULL,
  `total_rows` bigint(20) NOT NULL,
  `total_storage` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_big_data_storage_stats_org_id` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_app_roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_id` int(11) NOT NULL,
  `role_name` varchar(255) NOT NULL,
  `role_permission` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `role_permission_detail` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_app_roles_app_id_role_name_key_234` (`app_id`,`role_name`),
  KEY `dtable_app_roles_app_id_key_8hhoeuh` (`app_id`),
  CONSTRAINT `dtable_app_roles_external_app` FOREIGN KEY (`app_id`) REFERENCES `dtable_external_apps` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_app_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `role_id` int(11) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_app_user_app_id_username_key_123` (`app_id`,`username`),
  KEY `dtable_app_user_role` (`role_id`),
  KEY `dtable_app_user_app_id_key_jajfie` (`app_id`),
  CONSTRAINT `dtable_app_user_role` FOREIGN KEY (`role_id`) REFERENCES `dtable_app_roles` (`id`),
  CONSTRAINT `dtable_app_users_external_app` FOREIGN KEY (`app_id`) REFERENCES `dtable_external_apps` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_app_invite_links` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `token` varchar(100) NOT NULL,
  `ctime` datetime(6) NOT NULL,
  `password` varchar(128) DEFAULT NULL,
  `expire_date` datetime(6) DEFAULT NULL,
  `app_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `dtable_share_links_dtable_id_19974ba2_fk_dtables_id` (`app_id`),
  KEY `dtable_share_links_username_0fcbefa6` (`username`),
  KEY `dtable_app_links_app_role_218391ad` (`role_id`),
  CONSTRAINT `dtable_app_links_app_id_19974ba2_fk_dtables_id` FOREIGN KEY (`app_id`) REFERENCES `dtable_external_apps` (`id`),
  CONSTRAINT `dtable_app_links_app_role_218391ad` FOREIGN KEY (`role_id`) REFERENCES `dtable_app_roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `org_external_apps_statistics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `org_id` int(11) NOT NULL,
  `visit_date` date NOT NULL,
  `visit_count` int(11) NOT NULL DEFAULT 1,
  `latest_visit_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_id_visit_date_l980p4o8_uniq_key` (`org_id`,`visit_date`),
  KEY `visite_date_ddaifh0` (`visit_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `user_external_apps_statistics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `visit_date` date NOT NULL,
  `visit_count` int(11) NOT NULL DEFAULT 1,
  `latest_visit_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_visit_date_nyfiyib_uniq_key` (`username`,`visit_date`),
  KEY `visite_date_oiwh9802` (`visit_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_group_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `detail` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_group_order_username_uwuyehjb` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `page_design_snapshot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `page_id` varchar(36) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `commit_id` varchar(40) NOT NULL,
  `ctime` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `page_design_snapshot_page_id_commit_id_02846775_uniq` (`page_id`,`commit_id`),
  KEY `page_design_snapshot_page_id_18b38d9c` (`page_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_app_user_sync` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_id` int(11) NOT NULL,
  `dst_table_id` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `app_sync_app_user_foreign_key` (`app_id`),
  CONSTRAINT `app_sync_app_user_foreign_key` FOREIGN KEY (`app_id`) REFERENCES `dtable_external_apps` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `big_data_storage_stats` ADD COLUMN IF NOT EXISTS `org_id` int(11) NOT NULL DEFAULT -1;
ALTER TABLE `big_data_storage_stats` ADD INDEX IF NOT EXISTS `big_data_storage_stats_idx_org_id` (`org_id`);

ALTER TABLE dtable_external_apps ADD COLUMN IF NOT EXISTS org_id int(11) DEFAULT NULL;

DELETE FROM dtable_workflow_task_participants WHERE is_current=0;
ALTER TABLE dtable_workflow_task_participants DROP COLUMN has_operated;
ALTER TABLE dtable_workflow_task_participants DROP COLUMN is_current;

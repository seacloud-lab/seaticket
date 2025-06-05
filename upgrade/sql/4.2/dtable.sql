CREATE TABLE IF NOT EXISTS `department_v2_groups` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `department_id` int(11) NOT NULL,
  `group_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `department_id_group_id_h5v3u6f9_uniq_key` (`department_id`,`group_id`),
  UNIQUE KEY `group_id_b4g2g5v8_uniq_key` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE IF NOT EXISTS `dtable_app_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `to_user` varchar(255) NOT NULL,
  `msg_type` varchar(255) NOT NULL,
  `detail` longtext NOT NULL,
  `app_id` int(11) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `seen` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_app_ notification_foreign_key_app` (`app_id`),
  KEY `dtable_app_notifications_to_user_key` (`to_user`),
  KEY `dtable_app_notification_created_at_key` (`created_at`),
  CONSTRAINT `dtable_app_ notification_foreign_key_app` FOREIGN KEY (`app_id`) REFERENCES `dtable_external_apps` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `workflow_folders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `username` varchar(50) DEFAULT NULL,
  `folder_type` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_username_id_n3o0u7t3_uniq_key` (`name`,`username`,`folder_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `workflow_folder_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folder_id` int(11) NOT NULL,
  `workflow_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `wf_folder_items_folder_id_key_138` (`folder_id`, `workflow_id`),
  KEY `wf_folder_items_workflow_id_ji228n` (`workflow_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_app_snapshot` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_id` int(11) NOT NULL,
  `created_at` bigint(20) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `app_version` bigint(20) NOT NULL,
  `app_config` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_app_snapshot_02846775_uniq` (`app_id`,`app_version`),
  CONSTRAINT `dtable_app_snapshot_app_id_19974ba2_fk_dtables_id` FOREIGN KEY (`app_id`) REFERENCES `dtable_external_apps` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `profile_profile` ADD COLUMN IF NOT EXISTS is_manually_set_contact_email tinyint(1) DEFAULT 0;

ALTER TABLE `dtable_external_apps` ADD COLUMN IF NOT EXISTS `inactive` tinyint(1) DEFAULT 0;
ALTER TABLE `dtable_external_apps` ADD COLUMN IF NOT EXISTS `version` INT(11) DEFAULT 1;

ALTER TABLE `departments_v2` ADD COLUMN IF NOT EXISTS `path` varchar(1024);
ALTER TABLE `departments_v2` ADD KEY IF NOT EXISTS `path_b3v2l4h9_key` (`path`);
ALTER TABLE `departments_v2` DROP KEY IF EXISTS `org_id_parent_id_name_b3k1o8p2_uniq_key`;

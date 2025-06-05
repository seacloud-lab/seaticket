CREATE TABLE IF NOT EXISTS `user_share_folders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_name_n3o847t3_uniq_key` (`username`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_asset_trash` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `delete_from` varchar(20) NOT NULL,
  `item_type` varchar(20) NOT NULL,
  `basedir` varchar(4096) NOT NULL,
  `commit_id` varchar(40) NOT NULL,
  `size` bigint(20) DEFAULT 0,
  `deleted_at` datetime(6) DEFAULT NULL,
  `detail` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `deleted_at_j4b2o3j8_key` (`deleted_at`),
  KEY `basedir_k3b4l2o9_key` (`basedir`),
  KEY `dtable_uuid_b4l2p9m8_key` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `dtable_share` ADD COLUMN IF NOT EXISTS share_folder_id int(11) DEFAULT NULL;
ALTER TABLE `dtable_share` ADD CONSTRAINT FOREIGN KEY IF NOT EXISTS (`share_folder_id`) REFERENCES `user_share_folders`(`id`);

ALTER TABLE `dtable_view_user_share` ADD COLUMN IF NOT EXISTS share_folder_id int(11) DEFAULT NULL;
ALTER TABLE `dtable_view_user_share` ADD CONSTRAINT FOREIGN KEY IF NOT EXISTS (`share_folder_id`) REFERENCES `user_share_folders`(`id`);

CREATE TABLE IF NOT EXISTS `departments_v2` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `parent_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `id_in_org` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_id_parent_id_name_b3k1o8p2_uniq_key` (`org_id`,`parent_id`, `name`),
  UNIQUE KEY `org_id_id_in_org_b4g2l0b1_uniq_key` (`org_id`,`id_in_org`),
  KEY `parent_id_j2u7g4v8_key` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `department_members_v2` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `department_id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `is_staff` tinyint(1) DEFAULT 0,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `department_id_username_b4j7v3l9_uniq_key` (`department_id`,`username`),
  KEY `username_h3v3j7b9_key` (`username`),
  CONSTRAINT `department_members_departments_id_fkb4g7_key` FOREIGN KEY (`department_id`) REFERENCES `departments_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `dtable_seafile_connectors`;

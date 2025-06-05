CREATE TABLE IF NOT EXISTS `dtable_common_dataset_sync` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dst_dtable_uuid` char(32) NOT NULL,
  `dst_table_id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `creator` varchar(255) NOT NULL,
  `last_sync_time` datetime(6) NOT NULL,
  `dataset_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_common_dataset_sy_dst_dtable_uuid_dst_tabl_9e70666b_uniq` (`dst_dtable_uuid`,`dst_table_id`),
  KEY `dtable_common_datase_dataset_id_b1473f04_fk_dtable_co` (`dataset_id`),
  KEY `dtable_common_dataset_sync_dst_dtable_uuid_8d8d4f16` (`dst_dtable_uuid`),
  KEY `dtable_common_dataset_sync_dst_table_id_54dc1cc3` (`dst_table_id`),
  KEY `dtable_common_dataset_sync_creator_a099c047` (`creator`),
  CONSTRAINT `dtable_common_datase_dataset_id_b1473f04_fk_dtable_co` FOREIGN KEY (`dataset_id`) REFERENCES `dtable_common_dataset` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_view_user_share` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `from_user` varchar(255) NOT NULL,
  `to_user` varchar(255) NOT NULL,
  `permission` varchar(15) NOT NULL,
  `table_id` varchar(36) NOT NULL,
  `view_id` varchar(36) NOT NULL,
  `dtable_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_view_user_share_dtable_id_to_user_table__7427273d_uniq` (`dtable_id`,`to_user`,`table_id`,`view_id`),
  KEY `dtable_view_user_share_from_user_a902a682` (`from_user`),
  KEY `dtable_view_user_share_to_user_11c9dad1` (`to_user`),
  KEY `dtable_view_user_share_table_id_d6743e78` (`table_id`),
  KEY `dtable_view_user_share_view_id_cce1c469` (`view_id`),
  CONSTRAINT `dtable_view_user_share_dtable_id_0752f361_fk_dtables_id` FOREIGN KEY (`dtable_id`) REFERENCES `dtables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_view_group_share` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `from_user` varchar(255) NOT NULL,
  `to_group_id` int(11) NOT NULL,
  `permission` varchar(15) NOT NULL,
  `table_id` varchar(36) NOT NULL,
  `view_id` varchar(36) NOT NULL,
  `dtable_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_view_group_share_dtable_id_to_group_id_ta_cee5acd9_uniq` (`dtable_id`,`to_group_id`,`table_id`,`view_id`),
  KEY `dtable_view_group_share_from_user_19f5f54b` (`from_user`),
  KEY `dtable_view_group_share_to_group_id_8048d12e` (`to_group_id`),
  KEY `dtable_view_group_share_table_id_7fa4344d` (`table_id`),
  KEY `dtable_view_group_share_view_id_7cf93b71` (`view_id`),
  CONSTRAINT `dtable_view_group_share_dtable_id_832e8f1a_fk_dtables_id` FOREIGN KEY (`dtable_id`) REFERENCES `dtables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `user_quota` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `asset_quota` bigint(20) DEFAULT NULL,
  `row_limit` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_x3m8s0l2_uniq` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `organizations_org_quota` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `org_id` int(11) NOT NULL,
  `asset_quota` bigint(20) DEFAULT NULL,
  `row_limit` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_id_n3d9m1n7_uniq` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_system_plugin` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `added_by` varchar(255) NOT NULL,
  `added_time` datetime(6) NOT NULL,
  `info` longtext NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_system_plugin_name_1b19cd3c` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `operation_log` CHANGE  `operation` `operation` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

alter table dtable_plugin drop added_by, drop added_time, drop info;

ALTER TABLE `user_activities` ADD INDEX `user_activities_username_timestamp` (`username`, `timestamp`);

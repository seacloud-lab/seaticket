CREATE TABLE IF NOT EXISTS `dtable_plugin` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `added_by` varchar(255) NOT NULL,
  `added_time` datetime(6) NOT NULL,
  `dtable_id` int(11) NOT NULL,
  `info` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_plugin_dtable_id_60e96e09_fk_dtables_id` (`dtable_id`),
  KEY `dtable_plugin_name_244402d2` (`name`),
  CONSTRAINT `dtable_plugin_dtable_id_60e96e09_fk_dtables_id` FOREIGN KEY (`dtable_id`) REFERENCES `dtables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS `dtable_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `dtable_uuid` varchar(32) NOT NULL,
  `msg_type` varchar(40) NOT NULL,
  `created_at` datetime NOT NULL,
  `detail` longtext NOT NULL,
  `seen` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `dtable_notifications_username_dtable_uuid` (`username`, `dtable_uuid`),
  KEY `dtable_notifications_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS `dtable_common_dataset` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `org_id` int(11) NOT NULL,
  `dtable_uuid` char(32) NOT NULL,
  `table_id` varchar(36) NOT NULL,
  `view_id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `creator` varchar(255) NOT NULL,
  `dataset_name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_common_dataset_org_id_dtable_uuid_table_7a02fe88_uniq` (`org_id`,`dtable_uuid`,`table_id`,`view_id`),
  UNIQUE KEY `dtable_common_dataset_org_id_dataset_name_f98dea4a_uniq` (`org_id`,`dataset_name`),
  KEY `dtable_common_dataset_dtable_uuid_780a1b12` (`dtable_uuid`),
  KEY `dtable_common_dataset_creator_6dc5b17d` (`creator`),
  KEY `dtable_common_dataset_dataset_name_6cfd12e6` (`dataset_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_common_dataset_group_access` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `dataset_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_common_datase_dataset_id_c7dfe110_fk_dtable_co` (`dataset_id`),
  KEY `dtable_common_dataset_group_access_group_id_1598fb59` (`group_id`),
  CONSTRAINT `dtable_common_datase_dataset_id_c7dfe110_fk_dtable_co` FOREIGN KEY (`dataset_id`) REFERENCES `dtable_common_dataset` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE dtable_row_comments MODIFY COLUMN created_at datetime NOT NULL;
ALTER TABLE dtable_row_comments MODIFY COLUMN updated_at datetime NOT NULL;

CREATE TABLE IF NOT EXISTS `dtable_form_share` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `form_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_form_share_form_id_group_id_890fd26b_uniq` (`form_id`,`group_id`),
  KEY `dtable_form_share_group_id_68ef49a9` (`group_id`),
  CONSTRAINT `dtable_form_share_form_id_e3565e7d_fk_dtable_forms_id` FOREIGN KEY (`form_id`) REFERENCES `dtable_forms` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE dtable_forms ADD share_type varchar(20) NOT NULL DEFAULT 'anonymous';

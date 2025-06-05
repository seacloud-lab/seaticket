CREATE TABLE IF NOT EXISTS `custom_asset_uuid` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(36) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `parent_path` longtext NOT NULL,
  `dtable_uuid_parent_path_md5` varchar(100) NOT NULL,
  `file_name` varchar(1024) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  KEY `custom_asset_uuid_dtable_uuid_parent_path_md5` (`dtable_uuid_parent_path_md5`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_workflow_task_schedules` (
  `id` bigint(11) unsigned NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL,
  `schedule_time` datetime(6) NOT NULL,
  `action` text DEFAULT NULL,
  `is_executed` tinyint(1) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `task_id_h4v5n3b9_key` (`task_id`),
  KEY `schedule_time_j3o0n7b5_key` (`schedule_time`),
  KEY `state_j4b2k9b6_key` (`is_executed`),
  CONSTRAINT `schedules_task_id_j4g5v3o9_fk_tasks_id` FOREIGN KEY (`task_id`) REFERENCES `dtable_workflow_tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `dtable_external_apps` ADD COLUMN IF NOT EXISTS `custom_url` VARCHAR(255) UNIQUE DEFAULT NULL;

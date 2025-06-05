CREATE TABLE IF NOT EXISTS `dtable_data_syncs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(36) NOT NULL,
  `sync_type` varchar(20) NOT NULL,
  `detail` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `is_valid` tinyint(1) NULL DEFAULT 1,
  `last_sync_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `dtable_uuid_sync_type`(`dtable_uuid`, `sync_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `dtable_common_dataset_sync` ADD COLUMN IF NOT EXISTS `sync_interval` VARCHAR(20) NULL DEFAULT 'per_day' AFTER `is_valid`;

ALTER TABLE `dtable_automation_rules` ADD COLUMN IF NOT EXISTS `is_pause` tinyint(1) NULL DEFAULT 0 AFTER `org_id`;

ALTER TABLE `profile_profile` ADD COLUMN IF NOT EXISTS `sms_2fa` tinyint(1) DEFAULT 0;

ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS `is_valid` TINYINT(1) DEFAULT 1;

ALTER TABLE auto_rules_task_log ADD COLUMN IF NOT EXISTS `warnings` text;

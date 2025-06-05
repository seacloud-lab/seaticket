CREATE TABLE IF NOT EXISTS `organizations_orgadminsettings` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `org_id` int(11) NOT NULL,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_id_key_o0u4b7x9_unique_key` (`org_id`,`key`),
  KEY `org_id_n3x9b4v0_key` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE organizations_orgsettings DROP COLUMN enable_force_2fa;

ALTER TABLE `dtable_notifications` CHANGE  `detail` `detail` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

ALTER TABLE `dtable_row_comments` CHANGE  `comment` `comment` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

alter table dtables add column color varchar(50), add column text_color varchar(50), add column icon varchar(50);

ALTER TABLE dtable_notification_rules ADD COLUMN dtable_uuid varchar(36) NOT NULL;
ALTER TABLE dtable_notification_rules ADD INDEX(`dtable_uuid`);
ALTER TABLE dtable_notification_rules DROP FOREIGN KEY dtable_notification_rules_dtable_id_c53b28ac_fk_dtables_id;
ALTER TABLE dtable_notification_rules DROP COLUMN dtable_id;

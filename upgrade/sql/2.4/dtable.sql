CREATE TABLE IF NOT EXISTS `user_auto_rules_statistics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `trigger_date` date NOT NULL,
  `trigger_count` int(11) DEFAULT 0,
  `update_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_trigger_date_n3x0p2i8_uniq_key` (`username`,`trigger_date`),
  KEY `username_m0o1g4d0_key` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `org_auto_rules_statistics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `org_id` int(11) NOT NULL,
  `trigger_date` date NOT NULL,
  `trigger_count` int(11) DEFAULT 0,
  `update_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_id_trigger_date_n3x0p2i8_uniq_key` (`org_id`,`trigger_date`),
  KEY `org_id_m0o1g4d0_key` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE dtable_automation_rules ADD COLUMN IF NOT EXISTS org_id int(11) DEFAULT NULL;

ALTER TABLE `activities` ADD COLUMN IF NOT EXISTS `row_count` int(11) NOT NULL DEFAULT 1;

ALTER TABLE `avatar_avatar` ADD INDEX IF NOT EXISTS `idx_emailuser` (`emailuser`);

ALTER TABLE `workspaces` ADD INDEX IF NOT EXISTS `idx_org_id` (`org_id`);

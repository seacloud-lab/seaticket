CREATE TABLE IF NOT EXISTS `dtable_share_permission` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(500) NOT NULL,
  `permission` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_share_permission_dtable_uuid_9ac100fe` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_abuse_report` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reporter` varchar(255) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `external_link_token` varchar(100) NOT NULL,
  `create_time` datetime(6) NOT NULL,
  `abuse_type` varchar(255) NOT NULL,
  `description` longtext DEFAULT NULL,
  `handled` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_abuse_report_external_link_token` (`external_link_token`),
  KEY `dtable_abuse_report_dtable_uuid_034cf288` (`dtable_uuid`),
  KEY `dtable_abuse_report_handled_3b7da945` (`handled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `operation_log` ADD INDEX `operation_log_op_time` (`op_time`);

ALTER TABLE `profile_profile` ADD COLUMN `need_show_video` bool DEFAULT 0 NOT NULL;

DROP INDEX `user_dtables_user_uuid_date` ON `user_dtables`;
ALTER TABLE `user_dtables` ADD INDEX `ix_user_dtables_username` (`username`);

ALTER TABLE `activities` ADD INDEX `ix_activities_op_time_dtable_uuid` (`op_time`,`dtable_uuid`);

CREATE TABLE IF NOT EXISTS `invitation_links` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `token` varchar(40) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `registration_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `source` varchar(40) NOT NULL DEFAULT '',
  `token` varchar(40) DEFAULT NULL,
  `accepter` varchar(255) DEFAULT NULL,
  `registered_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `registration_logs_source_c4868a74` (`source`),
  KEY `registration_logs_registered_at_b899305c` (`registered_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

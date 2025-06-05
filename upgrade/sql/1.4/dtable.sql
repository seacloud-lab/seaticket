CREATE TABLE IF NOT EXISTS `webhook_jobs` (
`id` int(11) unsigned NOT NULL AUTO_INCREMENT,
`webhook_id` int(11) unsigned NOT NULL,
`created_at` datetime(6) DEFAULT current_timestamp(6),
`trigger_at` datetime(6) DEFAULT NULL,
`status` tinyint(1) DEFAULT NULL,
`url` varchar(2000) NOT NULL,
`request_headers` text DEFAULT NULL,
`request_body` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
`response_status` int(5) DEFAULT NULL,
`response_body` text DEFAULT NULL,
PRIMARY KEY (`id`),
KEY `webhook_id_l2o9j3x6_key` (`webhook_id`),
KEY `status_b7n3m0x1_key` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `webhooks` (
`id` int(11) unsigned NOT NULL AUTO_INCREMENT,
`dtable_uuid` varchar(32) NOT NULL,
`url` varchar(2000) NOT NULL,
`settings` text DEFAULT NULL,
`creator` varchar(255) NOT NULL,
`created_at` datetime(6) DEFAULT current_timestamp(6),
PRIMARY KEY (`id`),
KEY `dtable_uuid_k3nx9o5y7_key` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_opened_bys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(36) NOT NULL,
  `opened_by_user` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_open_dtable__daa364_idx` (`dtable_uuid`,`opened_by_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `table_activities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid_date_md5` varchar(32) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `op_date` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid_date_md5` (`uuid_date_md5`),
  KEY `ix_table_activities_dtable_uuid` (`dtable_uuid`),
  KEY `ix_table_activities_op_date` (`op_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `user_dtables` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_uuid_date_md5` varchar(32) NOT NULL,
  `username` varchar(255) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `op_date` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_uuid_date_md5` (`user_uuid_date_md5`),
  KEY `ix_user_dtables_op_date` (`op_date`),
  KEY `user_dtables_user_uuid_date` (`username`,`dtable_uuid`,`op_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `organizations_org_corp_auth` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `org_id` int(11) DEFAULT NULL,
  `corp_id` varchar(255) DEFAULT NULL,
  `corp_name` varchar(255) NOT NULL,
  `permanent_code` varchar(255) NOT NULL,
  `extra_data` longtext NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_id` (`org_id`),
  UNIQUE KEY `corp_id` (`corp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

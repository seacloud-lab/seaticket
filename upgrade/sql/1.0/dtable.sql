CREATE TABLE IF NOT EXISTS `dtable_notification_rules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `run_condition` varchar(32) NOT NULL,
  `trigger` longtext NOT NULL,
  `action` longtext NOT NULL,
  `creator` varchar(255) NOT NULL,
  `ctime` datetime(6) NOT NULL,
  `last_trigger_time` datetime(6) DEFAULT NULL,
  `dtable_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_notification_rules_dtable_id_c53b28ac_fk_dtables_id` (`dtable_id`),
  CONSTRAINT `dtable_notification_rules_dtable_id_c53b28ac_fk_dtables_id` FOREIGN KEY (`dtable_id`) REFERENCES `dtables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_rows_count` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(36) NOT NULL,
  `rows_count` int(11) DEFAULT 0,
  `rows_count_update_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_uuid_n3v0m5n8_unique_key` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `org_rows_count` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `org_id` int(11) NOT NULL,
  `rows_count` int(11) DEFAULT 0,
  `rows_count_update_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_id_n3x0l1x0_unique_key` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `user_rows_count` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `rows_count` int(11) DEFAULT 0,
  `rows_count_update_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_n3x0l1x0_unique_key` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `chargebee_customer` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(255) NOT NULL,
  `plan_id` varchar(255) DEFAULT NULL,
  `subscription_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

alter table dtable_external_link add column is_custom tinyint(1) default 0, add column password varchar(128) DEFAULT NULL, add column expire_date datetime(6) DEFAULT NULL;

alter table organizations_orgsettings add column enable_force_2fa tinyint(1) default 0;

CREATE TABLE IF NOT EXISTS `email_sending_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `timestamp` datetime NOT NULL,
  `host` varchar(255) NOT NULL,
  `success` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_email_sending_log_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_plugins_install_count`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_name` varchar(60) NOT NULL,
  `count` int(11) NOT NULL,
  `updated_at` datetime(6),
  `created_at` datetime(6),
  PRIMARY KEY (`id`),
 UNIQUE KEY `dtable_plugins_install_count_plugin_name`(`plugin_name`)
) ENGINE = InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_automation_rules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(36) NOT NULL,
  `run_condition` varchar(32) NOT NULL,
  `trigger` longtext NOT NULL,
  `actions` longtext NOT NULL,
  `creator` varchar(255) NOT NULL,
  `ctime` datetime(6) NOT NULL,
  `last_trigger_time` datetime(6) DEFAULT NULL,
  `is_valid` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `dtable_uuid` (`dtable_uuid`),
  KEY `is_valid_u7h3b0j1_key` (`is_valid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `dtable_external_apps` ADD COLUMN IF NOT EXISTS `created_at` datetime(6) DEFAULT NULL;

ALTER TABLE `dtable_external_apps` ADD INDEX IF NOT EXISTS `dtable_external_apps_created_at_164f4499` (`created_at`);

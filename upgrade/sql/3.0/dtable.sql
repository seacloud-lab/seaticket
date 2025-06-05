CREATE TABLE IF NOT EXISTS storage_server_dtable_backups (
  id int AUTO_INCREMENT PRIMARY KEY,
  dtable_id varchar(255) NOT NULL,
  backup_id varchar(255) NOT NULL,
  partition_id varchar(255) NOT NULL,
  backup_version bigint unsigned NOT NULL,
  created_at bigint NOT NULL,
  size bigint NOT NULL,
  KEY index_backups_on_dtable_id (dtable_id)
) ENGINE = InnoDB, COLLATE = utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS storage_server_dtable_snapshots (
  id int AUTO_INCREMENT PRIMARY KEY,
  dtable_id varchar(255) NOT NULL,
  snapshot_id varchar(255) NOT NULL,
  ctime bigint NOT NULL,
  KEY index_snapshots_on_dtable_id (dtable_id)
) ENGINE = InnoDB, COLLATE = utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `dtable_workflow_task_logs` (
  `id` bigint(11) unsigned NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL,
  `log_type` varchar(20) NOT NULL,
  `node_id` varchar(50) DEFAULT NULL,
  `next_node_id` varchar(50) DEFAULT NULL,
  `operator` varchar(255) DEFAULT NULL,
  `row_data` text DEFAULT NULL,
  `start_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_workflow_task_id_j3b8h4o0_key` (`task_id`),
  KEY `operator_j3b2l9h4_key` (`operator`),
  KEY `log_type_p3b5k8b1_key` (`log_type`),
  CONSTRAINT `log_task_id_b3m2o0h7_fk_tasks_id` FOREIGN KEY (`task_id`) REFERENCES `dtable_workflow_tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `auto_rules_task_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `trigger_time` datetime(6) NOT NULL,
  `success` tinyint(1) NOT NULL,
  `rule_id` int(11) NOT NULL,
  `run_condition` varchar(255) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `org_id` int(11) NOT NULL,
  `owner` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `auto_rule_task_log_rule_id_f2jasf81` (`rule_id`),
  KEY `auto_rule_task_log_org_id_f2yuuahjd` (`org_id`),
  KEY `auto_rule_task_log_owner_fwhiyvye` (`owner`),
  KEY `auto_rule_task_log_dtable_uuid_uybhe82` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `group_id_ldap_uuid_pair` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `group_uuid` char(32) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_id` (`group_id`),
  UNIQUE KEY `group_uuid` (`group_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `big_data_storage_stats` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(36) NOT NULL,
  `total_rows` bigint(20) NOT NULL,
  `total_storage` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `big_data_storage_stats_dtable_uuid` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `dtables` ADD COLUMN IF NOT EXISTS `in_storage` TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE dtable_workflow_tasks ADD COLUMN IF NOT EXISTS finished_at DATETIME(6) DEFAULT NULL;
ALTER TABLE dtable_workflow_tasks ADD COLUMN IF NOT EXISTS is_valid tinyint(1) DEFAULT 1;

ALTER TABLE `dtable_common_dataset` ADD COLUMN IF NOT EXISTS `is_valid` tinyint(1) DEFAULT 1 AFTER `dataset_name`;
ALTER TABLE `dtable_common_dataset_sync` ADD COLUMN IF NOT EXISTS `is_valid` tinyint(1) DEFAULT 1 AFTER `is_sync_periodically`;

ALTER TABLE `organizations_org_quota` ADD COLUMN IF NOT EXISTS `big_data_row_limit` bigint(20) DEFAULT NULL;

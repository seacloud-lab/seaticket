CREATE TABLE IF NOT EXISTS `VirusFile` (
  `vid` int(11) NOT NULL AUTO_INCREMENT,
  `repo_id` varchar(36) NOT NULL,
  `commit_id` varchar(40) NOT NULL,
  `file_path` text NOT NULL,
  `has_deleted` tinyint(1) NOT NULL,
  `has_ignored` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`vid`),
  KEY `ix_VirusFile_has_ignored` (`has_ignored`),
  KEY `ix_VirusFile_has_deleted` (`has_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `VirusScanRecord` (
  `repo_id` varchar(36) NOT NULL,
  `scan_commit_id` varchar(40) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`repo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `dtable_row_comments` ADD KEY IF NOT EXISTS `created_at_y5g3o0l1_key` (`created_at`);

ALTER TABLE `dtables` ADD KEY IF NOT EXISTS `updated_at_h3g4o9u6_key` (`updated_at`);

ALTER TABLE `session_log` ADD KEY IF NOT EXISTS `op_time_g4i9u7k1_key` (`op_time`);

ALTER TABLE `auto_rules_task_log` ADD KEY IF NOT EXISTS `trigger_time_u3h9o0n1_key` (`trigger_time`);

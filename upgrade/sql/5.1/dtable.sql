CREATE TABLE IF NOT EXISTS `sdoc_operation_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `doc_uuid` varchar(36) NOT NULL,
  `op_id` bigint(20) NOT NULL,
  `op_time` bigint(20) NOT NULL,
  `operations` longtext NOT NULL,
  `author` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sdoc_operation_log_op_time` (`op_time`),
  KEY `sdoc_operation_log_doc_uuid` (`doc_uuid`),
  KEY `sdoc_idx_operation_log_doc_uuid_op_id` (`doc_uuid`,`op_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `dtable_db_op_log`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `base_id` varchar(32) NOT NULL,
  `op_type` varchar(20) NOT NULL,
  `op_time` bigint NOT NULL,
  `operation` longtext NOT NULL,
  `author` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_db_op_log_base_id` (`base_id`),
  KEY `dtable_db_op_log_op_time` (`op_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `ai_assistant` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `assistant_uuid` varchar(36) NOT NULL,
  `assistant_name` varchar(255) NOT NULL,
  `assistant_type` varchar(255) NOT NULL,
  `assistant_avatar` varchar(255) NULL DEFAULT NULL,
  `config` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated` datetime(6) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `assistant_uuid`(`assistant_uuid`)
) ENGINE = InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `index_assistant_tables`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `assistant_uuid` varchar(36) NOT NULL,
  `index_range` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated` datetime(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `assistant_uuid`(`assistant_uuid`)
) ENGINE = InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `assistant_need_clean`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `assistant_uuid` varchar(36) NOT NULL,
  `clean_range` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated` datetime(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `assistant_uuid`(`assistant_uuid`)
) ENGINE = InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS `stats_api_gateway_by_base` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(32) NOT NULL,
  `api_name` varchar(50) NOT NULL,
  `count` bigint(20) unsigned DEFAULT NULL,
  `month` date DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_month_api_y5f3b0z9_uniq_key` (`dtable_uuid`,`month`,`api_name`),
  KEY `month_h3k2l1p0_key` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `stats_api_gateway_by_team` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `api_name` varchar(50) NOT NULL,
  `count` bigint(20) unsigned DEFAULT NULL,
  `month` date DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_month_api_h2x0m1r4_uniq_key` (`org_id`,`month`,`api_name`),
  KEY `month_p3j6m2z9_key` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `stats_api_gateway_by_owner` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `owner_id` varchar(255) NOT NULL,
  `api_name` varchar(50) NOT NULL,
  `count` bigint(20) unsigned DEFAULT NULL,
  `month` date DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `owner_month_api_r4f5v6b9_uniq_key` (`owner_id`,`month`,`api_name`),
  KEY `month_y5g6b4x0_key` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `audit_log_auditlog` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `operation` varchar(255) NOT NULL,
  `detail` longtext NOT NULL,
  `org_id` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_log_auditlog_created_at` (`created_at`),
  KEY `audit_log_auditlog_org_id_created_at` (`org_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `file_access_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `timestamp` datetime(0) NOT NULL,
  `etype` varchar(128) NOT NULL,
  `user` varchar(255) NOT NULL,
  `ip` varchar(45) NOT NULL,
  `device` text NOT NULL,
  `org_id` int(11) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `file_path` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_file_access_log_timestamp`(`timestamp`),
  KEY `ix_file_access_log_org_id_timestamp`(`org_id`, `timestamp`)
) ENGINE = InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

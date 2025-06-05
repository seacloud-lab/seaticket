CREATE TABLE IF NOT EXISTS `assistant_history`  (
  `id` bigint(11) NOT NULL AUTO_INCREMENT,
  `assistant_uuid` varchar(36) NOT NULL,
  `username` varchar(255) NOT NULL,
  `role` varchar(36) NOT NULL,
  `content` longtext,
  `tool_calls` longtext,
  `tool_call_id` varchar(36),
  `created_at` datetime(6) NOT NULL,
  `updated` datetime(6),
  PRIMARY KEY (`id`),
  KEY `assistant_uuid_username_mode` (`assistant_uuid`,`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `exceed_api_quota_teams` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) DEFAULT NULL,
  `owner_id` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_id_owner_id_h3u7f0p1_uniq_key` (`org_id`,`owner_id`),
  KEY `owner_id_b3g4j0l7_key` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `dtable_app_anonymous_access_password` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_id` int(11) NOT NULL,
  `password` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `app_id_h3g2i8v9_uniq_key` (`app_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `stats_ai_by_team` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `org_id` bigint(20) NOT NULL,
  `month` date NOT NULL,
  `model` varchar(100) NOT NULL,
  `input_tokens` int(11) DEFAULT NULL,
  `output_tokens` int(11) DEFAULT NULL,
  `cost` double NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_month_model_h5f4v6m9_uniq_key` (`org_id`,`month`,`model`),
  KEY `month_h3o2b6k7_key` (`month`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `stats_ai_by_owner` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `owner_id` varchar(255) NOT NULL,
  `month` date NOT NULL,
  `model` varchar(100) NOT NULL,
  `input_tokens` int(11) DEFAULT NULL,
  `output_tokens` int(11) DEFAULT NULL,
  `cost` double NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `owner_month_model_g2u6b9c7_uniq_key` (`owner_id`,`month`,`model`),
  KEY `month_g5v4l0d2_key` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `dtable_row_comments` ADD COLUMN `comment_from` varchar(20) NOT NULL DEFAULT 'base';
ALTER TABLE `dtable_row_comments` ADD INDEX `idx_base_comment_from` (`comment_from`);

ALTER TABLE `organizations_org_quota` ADD COLUMN monthly_api_call_limit_per_user int(11);
ALTER TABLE `user_quota` ADD COLUMN `monthly_api_call_limit_per_user` int(11) DEFAULT NULL;

ALTER TABLE `dtable_data_syncs` 
ADD COLUMN `consecutive_errors_times` tinyint(0) NULL DEFAULT 0,
ADD COLUMN `error_type` varchar(255) NULL;

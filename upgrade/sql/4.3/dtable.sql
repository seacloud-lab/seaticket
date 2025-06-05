CREATE TABLE IF NOT EXISTS storage_server_dtable_backups_v2 (
  id int AUTO_INCREMENT PRIMARY KEY,
  dtable_id varchar(36) NOT NULL,
  backup_version bigint unsigned NOT NULL,
  created_at bigint NOT NULL,
  size bigint NOT NULL,
  UNIQUE KEY index_backups_on_dtable_id (dtable_id, backup_version)
) ENGINE = InnoDB, COLLATE = utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `dtable_app_row_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `author` varchar(255) NOT NULL,
  `comment` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `app_id` int(11) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `table_id` varchar(255) NOT NULL,
  `row_id` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `resolved` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `key_row_comment_created_at` (`created_at`),
  KEY `dtable_table_row_union_key` (`dtable_uuid`,`table_id`,`row_id`),
  CONSTRAINT `dtable_app_comments_foreign_key_app` FOREIGN KEY (`app_id`) REFERENCES `dtable_external_apps` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

CREATE TABLE IF NOT EXISTS `dtable_app_row_participants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_id` int(11) NOT NULL,
  `app_user` varchar(255) NOT NULL,
  `table_id` varchar(255) NOT NULL,
  `row_id` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dtable_app_participants_foreign_key_app_user` (`app_user`),
  KEY `dtable_table_row_union_key` (`dtable_uuid`, `table_id`, `row_id`),
  CONSTRAINT `dtable_app_participants_foreign_key_app` FOREIGN KEY (`app_id`) REFERENCES `dtable_external_apps` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

CREATE TABLE IF NOT EXISTS `org_saml_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `org_id` int(11) NOT NULL,
  `metadata_url` longtext NOT NULL,
  `domain` varchar(255) DEFAULT NULL,
  `dns_txt` varchar(64) DEFAULT NULL,
  `domain_verified` tinyint(1) NOT NULL DEFAULT 0,
  `idp_certificate` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_id` (`org_id`),
  UNIQUE KEY `domain` (`domain`),
  KEY `domain_verified` (`domain_verified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_form_custom_urls` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `form_token` varchar(36) NOT NULL,
  `custom_url` varchar(100) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `custom_url` (`custom_url`),
  KEY `form_token_key` (`form_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;


ALTER TABLE `organizations_org_quota` ADD COLUMN IF NOT EXISTS `big_data_storage_quota` bigint(20) DEFAULT NULL;

ALTER TABLE `session_log` MODIFY COLUMN `user_agent` varchar(512) NOT NULL;
ALTER TABLE `dtable_external_apps` RENAME COLUMN `token` to `app_uuid`;


CREATE TABLE IF NOT EXISTS `onlyoffice_doc_key` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `doc_key` varchar(36) NOT NULL,
  `username` varchar(255) NOT NULL,
  `repo_id` varchar(36) NOT NULL,
  `file_path` longtext NOT NULL,
  `repo_id_file_path_md5` varchar(100) NOT NULL,
  `created_time` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `onlyoffice_doc_key_doc_key_49b6ca92` (`doc_key`),
  KEY `onlyoffice_doc_key_repo_id_file_path_md5_27c46737` (`repo_id_file_path_md5`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `dtable_forms` CHANGE  `form_config` `form_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;

ALTER TABLE `session_log` ADD COLUMN IF NOT EXISTS `session_key` varchar(40) NOT NULL AFTER `remote_address`, ADD KEY `session_key`(`session_key`);

ALTER TABLE `dtable_external_apps` ADD COLUMN IF NOT EXISTS `creator` varchar(255) DEFAULT NULL;

ALTER TABLE `profile_profile` ADD COLUMN IF NOT EXISTS `unit` longtext NULL;

ALTER TABLE `dtables` ADD INDEX IF NOT EXISTS `dtables_created_at_e6716f4b` (`created_at`);

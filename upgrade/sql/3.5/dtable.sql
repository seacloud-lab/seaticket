CREATE TABLE IF NOT EXISTS `admin_log_orgadminlog` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(254) NOT NULL,
  `operation` varchar(255) NOT NULL,
  `detail` longtext NOT NULL,
  `datetime` datetime(6) NOT NULL,
  `org_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `admin_log_orgadminlog_email_7213c993`(`email`),
  KEY `admin_log_orgadminlog_operation_4bad7bd1`(`operation`),
  KEY `admin_log_org_id`(`org_id`)
) ENGINE = InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `webhook_jobs` MODIFY COLUMN `response_body` longtext;

ALTER TABLE `profile_profile` CHANGE `contact_email` `contact_email` varchar(225) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;

ALTER TABLE `profile_profile` CHANGE `phone` `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;



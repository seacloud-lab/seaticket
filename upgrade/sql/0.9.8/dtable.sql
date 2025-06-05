CREATE TABLE IF NOT EXISTS `dtable_group_share` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  `permission` varchar(15) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_group_share_dtable_id_group_id_p0o3n6x7_uniq` (`dtable_id`,`group_id`),
  KEY `dtable_group_share_dtable_id_k3n4n5y2` (`dtable_id`),
  KEY `dtable_group_share_group_id_a7q9o2p3` (`group_id`),
  CONSTRAINT `dtable_group_share_dtable_id_nao83b6s_fk_dtables_id` FOREIGN KEY (`dtable_id`) REFERENCES `dtables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `user_starred_dtables` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(254) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_starred_dtables_email_dtable_uuid_n8s7b3s0_uniq` (`email`,`dtable_uuid`),
  KEY `user_starred_dtables_dtable_uuid_n3s8l4n8` (`dtable_uuid`),
  KEY `user_starred_dtables_email_n9x0l3n8` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

alter table dtable_external_link add column view_cnt int(11) default 0;

ALTER TABLE `profile_profile` CHANGE  `nickname` `nickname` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

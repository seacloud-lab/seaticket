ALTER TABLE `dtable_forms` DROP INDEX `dtable_forms_dtable_uuid_form_id_51b8bb12_uniq`;


CREATE TABLE IF NOT EXISTS `notifications_sysusernotification` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `to_user` varchar(255) NOT NULL,
  `message` longtext NOT NULL,
  `seen` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_sysusernotification_seen_djfwp829` (`seen`),
  KEY `notifications_sysusernotification_created_at_uurdf334` (`created_at`),
  KEY `notifications_sysusernotification_to_user_7605g569` (`to_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS `id_in_org_tuple` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `virtual_id` varchar(255) NOT NULL,
  `id_in_org` varchar(255) NOT NULL,
  `org_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id_in_org_virtual_id_41ccd900` (`virtual_id`),
  KEY `id_in_org_id_in_org_ffee1607` (`id_in_org`),
  KEY `id_in_org_org_id_169def82` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

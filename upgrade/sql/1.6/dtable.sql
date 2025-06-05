CREATE TABLE IF NOT EXISTS `group_invite_link` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token` varchar(40) NOT NULL,
  `group_id` int(11) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `group_invite_link_token_7f96850f` (`token`),
  KEY `group_invite_link_group_id_4b619114` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

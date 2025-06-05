CREATE TABLE IF NOT EXISTS `dtable_seafile_connectors` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `seafile_url` varchar(255) NOT NULL,
  `repo_api_token` varchar(40) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(255) NOT NULL,
  `dtable_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_seafile_connectors_dtable_id_repo_api_token_d657267a_uniq` (`dtable_id`,`repo_api_token`),
  KEY `dtable_seafile_connectors_repo_token_e5cb5e4f` (`repo_api_token`),
  KEY `dtable_seafile_connectors_dtable_id_613d5b8a` (`dtable_id`),
  CONSTRAINT `dtable_seafile_connectors_dtable_id_613d5b8a_fk_dtables_id` FOREIGN KEY (`dtable_id`) REFERENCES `dtables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS `dtable_forms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `workspace_id` int(11) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `form_id` varchar(36) NOT NULL,
  `form_config` longtext DEFAULT NULL,
  `token` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  UNIQUE KEY `dtable_forms_dtable_uuid_form_id_51b8bb12_uniq` (`dtable_uuid`,`form_id`),
  KEY `dtable_forms_username_c507c6cc` (`username`),
  KEY `dtable_forms_workspace_id_2520d284` (`workspace_id`),
  KEY `dtable_forms_dtable_uuid_a4dbea23` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

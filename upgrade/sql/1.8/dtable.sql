CREATE TABLE IF NOT EXISTS `dtable_collection_tables` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `workspace_id` int(11) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `config` longtext DEFAULT NULL,
  `token` varchar(36) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `dtable_collection_tables_username_31a4ba98` (`username`),
  KEY `dtable_collection_tables_workspace_id_003b9f84` (`workspace_id`),
  KEY `dtable_collection_tables_dtable_uuid_fdc09bc2` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_view_external_link` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `creator` varchar(255) NOT NULL,
  `table_id` varchar(36) NOT NULL,
  `view_id` varchar(36) NOT NULL,
  `token` varchar(100) NOT NULL,
  `permission` varchar(50) NOT NULL,
  `view_cnt` int(11) NOT NULL,
  `create_at` datetime(6) NOT NULL,
  `is_custom` tinyint(1) NOT NULL,
  `password` varchar(128) DEFAULT NULL,
  `expire_date` datetime(6) DEFAULT NULL,
  `dtable_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `dtable_view_external_link_dtable_id_ed96fdf4_fk_dtables_id` (`dtable_id`),
  CONSTRAINT `dtable_view_external_link_dtable_id_ed96fdf4_fk_dtables_id` FOREIGN KEY (`dtable_id`) REFERENCES `dtables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `bound_third_party_accounts` (
	`id` INT ( 11 ) NOT NULL AUTO_INCREMENT,
	`dtable_uuid` VARCHAR ( 36 ) NOT NULL,
	`account_name` VARCHAR ( 255 ) NOT NULL,
	`account_type` VARCHAR ( 255 ) NOT NULL,
	`detail` LONGTEXT NOT NULL,
	`created_at` datetime ( 6 ) NOT NULL,
	PRIMARY KEY ( `id` ),
	UNIQUE KEY `bound_third_party_accounts_du_an_2ur5sjfd_uniq` ( `dtable_uuid`, `account_name` )
) ENGINE=INNODB DEFAULT CHARSET=utf8;


ALTER TABLE `dtable_view_user_share` ADD COLUMN `shared_name` VARCHAR (255) DEFAULT NULL;
ALTER TABLE `dtable_view_group_share` ADD COLUMN `shared_name` VARCHAR (255) DEFAULT NULL;

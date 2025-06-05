CREATE TABLE IF NOT EXISTS `dtable_external_link` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_id` int(11) NOT NULL,
  `token` varchar(100) NOT NULL,
  `creator` varchar(255) NOT NULL,
  `create_at` datetime(6) NOT NULL,
  `permission` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_key` (`token`),
  KEY `dtable_id_key` (`dtable_id`),
  CONSTRAINT `dtable_external_link_ibf83fk_1` FOREIGN KEY (`dtable_id`) REFERENCES `dtables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

alter table dtables add column deleted tinyint(1) not null default 0, add column delete_time datetime(6) null;

alter table dtables add key `dtables_deleted_n3b4o5b2_key` (`deleted`);

alter table activities add column op_app varchar(255);

alter table operation_log add column app varchar(255);
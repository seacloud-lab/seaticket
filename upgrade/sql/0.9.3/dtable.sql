alter table profile_profile add column phone varchar(20);
alter table profile_profile add unique key `phone` (`phone`);


CREATE TABLE `dtable_row_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `author` varchar(255) NOT NULL,
  `comment` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `dtable_uuid` char(32) NOT NULL,
  `row_id` char(36) NOT NULL DEFAULT '',
  `detail` longtext DEFAULT NULL,
  `resolved` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `dtable_uuid_key` (`dtable_uuid`),
  KEY `row_id_key` (`row_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS `activities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(36) NOT NULL,
  `row_id` varchar(36) NOT NULL,
  `op_user` varchar(255) NOT NULL,
  `op_type` varchar(128) NOT NULL,
  `op_time` datetime NOT NULL,
  `detail` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_activities_row_id` (`row_id`),
  KEY `ix_activities_op_time` (`op_time`),
  KEY `ix_activities_dtable_uuid` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS `user_activities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `activity_id` int(11) DEFAULT NULL,
  `username` varchar(255) NOT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `activity_id` (`activity_id`),
  KEY `ix_user_activities_timestamp` (`timestamp`),
  CONSTRAINT `user_activities_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `user_activity_statistics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_time_md5` varchar(32) DEFAULT NULL,
  `username` varchar(255) NOT NULL,
  `timestamp` datetime NOT NULL,
  `org_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_time_md5` (`user_time_md5`),
  KEY `ix_user_activity_statistics_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS `dtable_snapshot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(36) NOT NULL,
  `dtable_name` varchar(255) NOT NULL,
  `commit_id` varchar(40) NOT NULL,
  `ctime` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `commit_id` (`commit_id`),
  KEY `dtable_snapshot_dtable_uuid_57ef9f7f` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

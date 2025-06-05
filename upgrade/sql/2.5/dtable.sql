CREATE TABLE IF NOT EXISTS `session_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_name` varchar(255) NOT NULL,
  `user_agent` varchar(255) NOT NULL,
  `remote_address` varchar(60) NOT NULL,
  `op_time` datetime(0) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `session_log_user_name`(`user_name`),
  KEY `session_log_remote_address`(`remote_address`)
) ENGINE = InnoDB DEFAULT CHARSET=utf8;

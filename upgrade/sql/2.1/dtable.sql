CREATE TABLE IF NOT EXISTS `dtable_external_apps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token` varchar(36) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `app_type` varchar(255) NOT NULL,
  `app_config` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `dtable_external_apps_dtable_uuid_3403d0a2` (`dtable_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `delete_operation_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_uuid` varchar(64) NOT NULL,
  `op_id` bigint(20) NOT NULL,
  `op_type` varchar(255) NOT NULL,
  `op_time` bigint(20) NOT NULL,
  `operation` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `author` varchar(255) NOT NULL,
  `app` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `delete_operation_log_op_time_type_dtable_uuid` (`dtable_uuid`,`op_time`),
  KEY `delete_operation_log_dtable_uuid` (`dtable_uuid`),
  KEY `delete_operation_log_op_time` (`op_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `operation_checkpoint` ADD COLUMN IF NOT EXISTS `op_time` bigint(20) NOT NULL DEFAULT 0;
ALTER TABLE `operation_checkpoint` ADD INDEX IF NOT EXISTS `idx_operation_checkpoint_op_time` (`op_time`);

ALTER TABLE dtable_collection_tables ADD COLUMN view_count int(11) NOT NULL DEFAULT 0;

ALTER TABLE dtable_notification_rules ADD COLUMN is_valid TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE dtable_rows_count ADD COLUMN owner varchar(255) NULL;
ALTER TABLE dtable_rows_count ADD COLUMN org_id INT(11) NULL;
ALTER TABLE dtable_rows_count ADD KEY owner_k3h7x8j1_key (owner), ADD KEY org_id_n4o9y6g8_key (org_id);

UPDATE dtable_rows_count drc
JOIN dtables d ON drc.dtable_uuid=d.uuid
JOIN workspaces w ON d.workspace_id=w.id
SET drc.owner=w.owner, drc.org_id=w.org_id;

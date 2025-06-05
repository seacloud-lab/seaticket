CREATE TABLE IF NOT EXISTS `folders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `color` varchar(50) DEFAULT NULL,
  `workspace_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_workspace_id_n3o0u7t3_uniq_key` (`name`,`workspace_id`),
  KEY `workspace_id_j3b8g5q0p8_key` (`workspace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `folder_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folder_id` int(11) NOT NULL,
  `item_type` varchar(50) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `folder_id_item_type_item_id_k8h5b6q1_uniq_key` (`folder_id`,`item_type`,`item_id`),
  KEY `item_type_item_id_k3n8u0i0_union_key` (`item_type`,`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


ALTER TABLE dtable_common_dataset ADD COLUMN group_id int(11) NOT NULL AFTER org_id;

ALTER TABLE dtable_common_dataset ADD KEY group_id_h4y7t5r9_key (group_id);

UPDATE dtable_common_dataset dcd JOIN dtables d ON dcd.dtable_uuid = d.uuid JOIN workspaces w ON d.workspace_id = w.id SET dcd.group_id = CAST(substring_index(w.owner, '@', 1) AS signed);

ALTER TABLE `operation_log` ADD INDEX IF NOT EXISTS `idx_operation_log_dtable_uuid_op_id` (`dtable_uuid`,`op_id`);

DROP TABLE IF EXISTS user_dtables;

DROP TABLE IF EXISTS user_activities;

DROP TABLE IF EXISTS table_activities;

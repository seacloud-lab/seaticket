ALTER TABLE `dtable_common_dataset_sync` ADD COLUMN IF NOT EXISTS `is_sync_periodically` bool DEFAULT false AFTER `src_version`;

ALTER TABLE `dtable_common_dataset_sync` ADD KEY IF NOT EXISTS `dtable_common_dataset_last_sync_time`(`last_sync_time`), ADD KEY `is_sync_periodically_last_sync_time_j3j2p0_key` (`is_sync_periodically`, `last_sync_time`);

ALTER TABLE `workspaces` ADD COLUMN IF NOT EXISTS `deleted` TINYINT(1) NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS `delete_time` DATETIME(6) NULL;

ALTER TABLE `workspaces` ADD INDEX IF NOT EXISTS `workspaces_deleted_idx` (`deleted`);

ALTER TABLE dtable_workflows CHANGE COLUMN app_config workflow_config text;
ALTER TABLE dtable_workflow_tasks CHANGE COLUMN task_state task_state varchar(40) DEFAULT NULL;

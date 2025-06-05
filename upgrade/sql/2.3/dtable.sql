ALTER TABLE dtable_notification_rules ADD KEY `ctime_k3x7o2p4_key` (`ctime`), ADD KEY `last_trigger_time_b3n4m2l1_key` (`last_trigger_time`);

ALTER TABLE dtable_snapshot DROP INDEX IF EXISTS `commit_id`;
ALTER TABLE dtable_snapshot ADD CONSTRAINT `dtable_snapshot_dtable_uuid_commit_id_b16af249_uniq` UNIQUE (`dtable_uuid`, `commit_id`);

ALTER TABLE dtable_external_apps ADD COLUMN visit_times int(11) NOT NULL DEFAULT 0 AFTER created_at;

ALTER TABLE dtable_automation_rules ADD COLUMN trigger_count int(11) NOT NULL DEFAULT 0;

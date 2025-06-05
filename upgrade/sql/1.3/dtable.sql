DROP TABLE IF EXISTS dtable_plugin;

ALTER TABLE dtable_forms ADD COLUMN created_at DATETIME(6), ADD COLUMN submit_count INT(11) DEFAULT 0;

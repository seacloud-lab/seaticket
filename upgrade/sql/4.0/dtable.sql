ALTER TABLE storage_server_dtable_snapshots CHANGE dtable_id dtable_id varchar(36);
ALTER TABLE storage_server_dtable_snapshots CHANGE snapshot_id snapshot_id varchar(36);

ALTER TABLE storage_server_dtable_backups CHANGE dtable_id dtable_id varchar(36);
ALTER TABLE storage_server_dtable_backups DROP backup_id, DROP partition_id;
ALTER TABLE storage_server_dtable_backups DROP KEY index_backups_on_dtable_id;
ALTER TABLE storage_server_dtable_backups ADD UNIQUE KEY index_backups_on_dtable_id (dtable_id, backup_version);

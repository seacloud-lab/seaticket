ALTER TABLE `onlyoffice_doc_key` DROP INDEX IF EXISTS `onlyoffice_doc_key_repo_id_file_path_md5_27c46737`;

ALTER TABLE `onlyoffice_doc_key` ADD UNIQUE IF NOT EXISTS (repo_id_file_path_md5);

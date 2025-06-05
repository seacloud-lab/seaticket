CREATE TABLE IF NOT EXISTS `ai_assistant_owner`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `assistant_uuid` varchar(36) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `assitant_uuid_uniq_key`(`assistant_uuid`),
  KEY `owner_key`(`owner`)
) ENGINE = InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE IF NOT EXISTS `dtable_app_folders` (
  `id` INT (11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR ( 255 ) NOT NULL,
  `username` VARCHAR ( 50 ) NULL,
  `folder_type` VARCHAR ( 255 ) NOT NULL,
  PRIMARY KEY ( `id` ),
  UNIQUE INDEX `name_username_folder_type_uniq_key`(`name`, `username`, `folder_type`)
) ENGINE = InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE IF NOT EXISTS `dtable_app_folder_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folder_id` int(11) NOT NULL,
  `app_id` int (11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `folder_id_app_id_uniq_key` (`folder_id`, `app_id`),
  KEY `app_id_key` (`app_id`)
) ENGINE = InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

ALTER TABLE dtable_asset_trash DROP INDEX IF EXISTS `basedir_k3b4l2o9_key`;

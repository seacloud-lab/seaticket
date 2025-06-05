CREATE TABLE IF NOT EXISTS `dtable_workflows` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token` varchar(36) NOT NULL,
  `dtable_uuid` varchar(36) NOT NULL,
  `app_config` longtext DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `visit_times` int(11) NOT NULL DEFAULT 0,
  `creator` varchar(255) DEFAULT NULL,
  `owner` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_workflow_token_h3b3j2k1` (`token`),
  KEY `dtable_workflows_dtable_uuid_h4v32g29` (`dtable_uuid`),
  KEY `dtable_workflows_created_at_b4h4k2vw` (`created_at`),
  KEY `dtable_workflows_owner_h4v3h2j2o6` (`owner`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_workflow_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_workflow_id` int(11) NOT NULL,
  `row_id` varchar(36) NOT NULL,
  `initiator` varchar(255) DEFAULT NULL,
  `node_id` varchar(50) NOT NULL,
  `state` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `task_state` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `initiator_j3b0o1l9_key` (`initiator`),
  KEY `node_id_k3s0l1b8_key` (`node_id`),
  KEY `row_id_j3b4l52_key` (`row_id`),
  KEY `state_p2o3h4b5_key` (`state`),
  KEY `task_state_jk32v4c5_key` (`task_state`),
  KEY `task_workflow_id_fk_workflow_jh3b2` (`dtable_workflow_id`),
  CONSTRAINT `task_workflow_id_fk_workflow_jh3b2` FOREIGN KEY (`dtable_workflow_id`) REFERENCES `dtable_workflows` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_workflow_task_participants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_workflow_task_id` int(11) NOT NULL,
  `node_id` varchar(50) NOT NULL,
  `participant` varchar(255) NOT NULL DEFAULT '',
  `has_operated` tinyint(1) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `is_current` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `is_current_k4h5v6c7_key` (`is_current`),
  KEY `approvers_task_id_b3m2o0h7_fk_tasks_id` (`dtable_workflow_task_id`),
  KEY `participant_n3b2l4b1_key` (`participant`),
  KEY `has_operated_j3b3v4g2_key` (`has_operated`),
  CONSTRAINT `approvers_task_id_b3m2o0h7_fk_tasks_id` FOREIGN KEY (`dtable_workflow_task_id`) REFERENCES `dtable_workflow_tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `dtable_workflow_share` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dtable_workflow_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dtable_workflow_id_group_id_j3b2k4_key` (`dtable_workflow_id`,`group_id`),
  KEY `group_id_h3b4l5l9_key` (`group_id`),
  CONSTRAINT `wf_group_share_wf_id_fk_workflow_bk38` FOREIGN KEY (`dtable_workflow_id`) REFERENCES `dtable_workflows` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `dtables` ADD COLUMN IF NOT EXISTS `password` VARCHAR(255) DEFAULT NULL;

ALTER TABLE `dtable_common_dataset_sync` ADD COLUMN IF NOT EXISTS `src_version` int(11) NOT NULL AFTER `dataset_id`;

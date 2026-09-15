import React, { useState } from 'react';
import { Dropdown } from 'reactstrap';
import classnames from 'classnames';
import {
  CommonOperationConfirmationDialog,
  CustomizeDropdownItem,
  CustomizeDropdownMenu,
  CustomizeDropdownMoreToggle,
  Switch,
  toaster,
} from '@/components';
import { gettext } from '@/constants';
import { skillsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';

import './skills-list-item.css';

const SkillsListItem = ({ skill, isActive, onSelectSkill, onEditSkill, onToggleSkill, onDeleted, projectUuid, isProjectAdmin, isToggling }) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const isToggleDisabled = !isProjectAdmin || isToggling;
  const canEdit = isProjectAdmin && skill.source !== 'builtin';
  const canDelete = isProjectAdmin && skill.source !== 'builtin' && !isDeleting;

  const executeDelete = () => {
    if (!canDelete) return;
    setDeleting(true);
    skillsAPI.deleteSkill(projectUuid, skill.name).then(() => {
      toaster.success(gettext('Skill deleted.'));
      setDeleteDialogOpen(false);
      onDeleted && onDeleted();
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => setDeleting(false));
  };

  return (
    <div
      className={classnames('skills-list-item', { active: isActive })}
      onClick={() => onSelectSkill(skill.name)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectSkill(skill.name);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="skills-list-item-switch" onClick={(event) => event.stopPropagation()}>
        <Switch
          checked={Boolean(skill.enabled)}
          onChange={(event) => {
            event.stopPropagation();
            if (isToggleDisabled) return;
            onToggleSkill && onToggleSkill(skill);
          }}
          disabled={isToggleDisabled}
          checkedTooltip={gettext('Disable skill')}
          uncheckedTooltip={gettext('Enable skill')}
          tooltipPosition="top"
        />
      </div>
      <div className="skills-list-item-content">
        <div className="skills-list-item-header">
          <span className="skills-name">{skill.name}</span>
          <span className={classnames('skills-source', skill.source)}>
            {skill.source === 'builtin' ? gettext('Built-in') : gettext('Custom')}
          </span>
        </div>
        <div className="skills-desc">{skill.description || gettext('No description')}</div>
      </div>
      <div className="skills-list-item-chat-status">{!skill.support_agent && gettext('Chat only')}</div>
      <div className="skills-list-item-more" onClick={(event) => event.stopPropagation()}>
        <Dropdown isOpen={isMoreMenuOpen} toggle={() => setIsMoreMenuOpen(!isMoreMenuOpen)}>
          <CustomizeDropdownMoreToggle isOpen={isMoreMenuOpen} title={gettext('More')} />
          <CustomizeDropdownMenu className="position-fixed">
            <CustomizeDropdownItem
              disabled={!canEdit}
              onClick={() => {
                if (!canEdit) return;
                setIsMoreMenuOpen(false);
                onEditSkill(skill.name);
              }}
            >
              {gettext('Edit')}
            </CustomizeDropdownItem>
            <CustomizeDropdownItem
              disabled={!canDelete}
              onClick={() => {
                if (!canDelete) return;
                setIsMoreMenuOpen(false);
                setDeleteDialogOpen(true);
              }}
            >
              {gettext('Delete')}
            </CustomizeDropdownItem>
          </CustomizeDropdownMenu>
        </Dropdown>
      </div>
      {isDeleteDialogOpen && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete skill')}
          message={gettext('Are you sure you want to delete this skill?')}
          confirmBtnText={gettext('Delete')}
          toggleDialog={() => setDeleteDialogOpen(false)}
          executeOperation={executeDelete}
        />
      )}
    </div>
  );
};

export default SkillsListItem;

import React from 'react';
import { gettext, mediaUrl } from '@/constants';
import { EmptyTip } from '@/components';
import SkillsListItem from './skills-list-item';

import './skills-list.css';

const SkillsList = ({ skills, activeSkillName, onSelectSkill, onEditSkill, onToggleSkill, onDeleted, projectUuid, isProjectAdmin, togglingSkillNameMap }) => {
  if (!Array.isArray(skills) || skills.length === 0) {
    return (
      <EmptyTip text={gettext('No skills yet.')} src={`${mediaUrl}img/no-items-tip.png`} />
    );
  }

  return (
    <div className="skills-list">
      {skills.map((skill) => (
        <SkillsListItem
          key={`${skill.source}-${skill.name}`}
          skill={skill}
          isActive={skill.name === activeSkillName}
          onSelectSkill={onSelectSkill}
          onEditSkill={onEditSkill}
          onToggleSkill={onToggleSkill}
          onDeleted={onDeleted}
          projectUuid={projectUuid}
          isProjectAdmin={isProjectAdmin}
          isToggling={Boolean(togglingSkillNameMap?.[skill.name])}
        />
      ))}
    </div>
  );
};

export default SkillsList;

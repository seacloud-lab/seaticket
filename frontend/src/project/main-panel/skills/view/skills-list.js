import React from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { EmptyTip, Switch } from '@/components';


const SkillsList = ({ skills, activeSkillName, onSelectSkill, onToggleSkill, isProjectAdmin, togglingSkillNameMap }) => {
  if (!Array.isArray(skills) || skills.length === 0) {
    return (
      <EmptyTip className="skills-empty-tip" text={gettext('No skills yet.')} />
    );
  }

  return (
    <div className="skills-list">
      {skills.map((skill) => {
        const isActive = skill.name === activeSkillName;
        const isToggling = Boolean(togglingSkillNameMap?.[skill.name]);
        const isToggleDisabled = !isProjectAdmin || isToggling;

        return (
          <div
            key={`${skill.source}-${skill.name}`}
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
              />
            </div>
            <div className="skills-list-item-content">
              <div className="skills-list-item-header">
                <span className="skills-name">/{skill.name}</span>
                <span className={classnames('skills-source', skill.source)}>
                  {skill.source === 'builtin' ? gettext('Builtin') : gettext('Custom')}
                </span>
              </div>
              <div className="skills-desc">{skill.description || gettext('No description')}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SkillsList;

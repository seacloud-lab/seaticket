import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'reactstrap';
import TopBar from '../top-bar';
import { CenteredLoading, Icon, toaster } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { skillsAPI } from '@/project/api';
import { SKILL_DETAIL_MODE, SKILLS_PAGE_TYPE } from './constants';
import SkillsList from './view/skills-list';
import SkillDetailDialog from './view/skill-detail-dialog';

import './index.css';

const { projectUuid, isProjectAdmin } = window.app.pageOptions;

const Skills = ({ title }) => {
  const [isLoading, setLoading] = useState(true);
  const [skills, setSkills] = useState([]);
  const [skillName, setSkillName] = useState(null);
  const [togglingSkillNameMap, setTogglingSkillNameMap] = useState({});
  const [pageType, setPageType] = useState(SKILLS_PAGE_TYPE.LIST);
  const [mode, setMode] = useState(SKILL_DETAIL_MODE.EDIT);

  const showSkillList = useCallback(() => {
    setPageType(SKILLS_PAGE_TYPE.LIST);
    setSkillName(null);
  }, []);

  const showCreateSkill = useCallback(() => {
    setPageType(SKILLS_PAGE_TYPE.CREATE);
    setSkillName(null);
  }, []);

  const showSkillDetail = useCallback((nextSkillName) => {
    setPageType(SKILLS_PAGE_TYPE.DETAIL);
    setSkillName(nextSkillName);
  }, []);

  const loadSkills = useCallback(() => {
    setLoading(true);
    skillsAPI.listSkills(projectUuid).then((res) => {
      const nextSkills = Array.isArray(res?.data?.skills) ? res.data.skills : [];
      setSkills(nextSkills);
      setLoading(false);
    }).catch((error) => {
      setLoading(false);
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const activeSkillName = useMemo(() => {
    if (pageType !== SKILLS_PAGE_TYPE.DETAIL) {
      return '';
    }
    return skillName;
  }, [pageType, skillName]);

  const onSaved = useCallback(() => {
    loadSkills();
    showSkillList();
  }, [loadSkills, showSkillList]);

  const onDeleted = useCallback(() => {
    loadSkills();
    showSkillList();
  }, [loadSkills, showSkillList]);

  const onCreate = useCallback(() => {
    setMode(SKILL_DETAIL_MODE.EDIT);
    showCreateSkill();
  }, [showCreateSkill]);

  const onPreviewSkill = useCallback((skillName) => {
    setMode(SKILL_DETAIL_MODE.PREVIEW);
    showSkillDetail(skillName);
  }, [showSkillDetail]);

  const onEditSkill = useCallback((skillName) => {
    setMode(SKILL_DETAIL_MODE.EDIT);
    showSkillDetail(skillName);
  }, [showSkillDetail]);

  const onEditCurrentSkill = useCallback(() => {
    setMode(SKILL_DETAIL_MODE.EDIT);
  }, []);

  const onToggleSkill = useCallback((skill) => {
    if (!isProjectAdmin) return;

    const nextEnabled = !skill.enabled;
    setTogglingSkillNameMap((prev) => ({ ...prev, [skill.name]: true }));
    skillsAPI.updateSkill(projectUuid, skill.name, { enabled: nextEnabled }).then(() => {
      setSkills((prevSkills) => prevSkills.map((item) => {
        if (item.name !== skill.name) return item;
        return { ...item, enabled: nextEnabled };
      }));
      toaster.success(gettext('Skill updated.'));
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => {
      setTogglingSkillNameMap((prev) => {
        const { [skill.name]: _, ...rest } = prev;
        return rest;
      });
    });
  }, []);

  return (
    <>
      <TopBar>
        <div className="w-100 text-truncate">{title}</div>
        {isProjectAdmin && (
          <Button color="primary" className="btn-sm create-skill-btn" onClick={onCreate}>
            <Icon symbol="plus" className="mr-1" aria-hidden="true" />
            {gettext('New skill')}
          </Button>
        )}
      </TopBar>
      {isLoading ? (
        <CenteredLoading />
      ) : (
        <SkillsList
          skills={skills}
          activeSkillName={activeSkillName}
          onSelectSkill={onPreviewSkill}
          onEditSkill={onEditSkill}
          onToggleSkill={onToggleSkill}
          onDeleted={onDeleted}
          projectUuid={projectUuid}
          isProjectAdmin={isProjectAdmin}
          togglingSkillNameMap={togglingSkillNameMap}
        />
      )}
      {pageType !== SKILLS_PAGE_TYPE.LIST && (
        <SkillDetailDialog
          projectUuid={projectUuid}
          pageType={pageType}
          skillName={skillName}
          mode={pageType === SKILLS_PAGE_TYPE.CREATE ? SKILL_DETAIL_MODE.EDIT : mode}
          isProjectAdmin={isProjectAdmin}
          onSaved={onSaved}
          onEdit={onEditCurrentSkill}
          onCancel={showSkillList}
        />
      )}
    </>
  );
};

export default Skills;

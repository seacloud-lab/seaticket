import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'reactstrap';
import TopBar from '../top-bar';
import { CenteredLoading, Icon, toaster } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { skillsAPI } from '@/project/api';
import { SkillsPageProvider, useSkillsPage } from './hooks/skills-page';
import { SKILL_DETAIL_MODE, SKILLS_PAGE_SLUG_ID } from './constants';
import SkillsList from './view/skills-list';
import SkillDetailDialog from './view/skill-detail-dialog';

import './index.css';

const { projectUuid, workspaceID, projectName, isProjectAdmin } = window.app.pageOptions;

const Content = ({ title }) => {
  const { isLoading: isPageLoading, pageSlugId, togglePageSlugId } = useSkillsPage();
  const [isDataLoading, setLoading] = useState(true);
  const [skills, setSkills] = useState([]);
  const [togglingSkillNameMap, setTogglingSkillNameMap] = useState({});
  const [detailMode, setDetailMode] = useState(SKILL_DETAIL_MODE.EDIT);

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
    if (pageSlugId === SKILLS_PAGE_SLUG_ID.ALL || pageSlugId === SKILLS_PAGE_SLUG_ID.NEW) {
      return '';
    }
    return pageSlugId;
  }, [pageSlugId]);

  const onSaved = useCallback(() => {
    loadSkills();
    togglePageSlugId(SKILLS_PAGE_SLUG_ID.ALL);
  }, [loadSkills, togglePageSlugId]);

  const onDeleted = useCallback(() => {
    loadSkills();
    togglePageSlugId(SKILLS_PAGE_SLUG_ID.ALL);
  }, [loadSkills, togglePageSlugId]);

  const onCreate = useCallback(() => {
    setDetailMode(SKILL_DETAIL_MODE.EDIT);
    togglePageSlugId(SKILLS_PAGE_SLUG_ID.NEW);
  }, [togglePageSlugId]);

  const onPreviewSkill = useCallback((skillName) => {
    setDetailMode(SKILL_DETAIL_MODE.PREVIEW);
    togglePageSlugId(skillName);
  }, [togglePageSlugId]);

  const onEditSkill = useCallback((skillName) => {
    setDetailMode(SKILL_DETAIL_MODE.EDIT);
    togglePageSlugId(skillName);
  }, [togglePageSlugId]);

  const onEditCurrentSkill = useCallback(() => {
    setDetailMode(SKILL_DETAIL_MODE.EDIT);
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

  const isLoading = isPageLoading || isDataLoading;

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
      {pageSlugId !== SKILLS_PAGE_SLUG_ID.ALL && (
        <SkillDetailDialog
          projectUuid={projectUuid}
          pageSlugId={pageSlugId}
          mode={pageSlugId === SKILLS_PAGE_SLUG_ID.NEW ? SKILL_DETAIL_MODE.EDIT : detailMode}
          isProjectAdmin={isProjectAdmin}
          onSaved={onSaved}
          onEdit={onEditCurrentSkill}
          onCancel={() => togglePageSlugId(SKILLS_PAGE_SLUG_ID.ALL)}
        />
      )}
    </>
  );
};

const Skills = ({ title }) => {
  return (
    <SkillsPageProvider workspaceID={workspaceID} projectName={projectName}>
      <Content title={title} />
    </SkillsPageProvider>
  );
};

export default Skills;

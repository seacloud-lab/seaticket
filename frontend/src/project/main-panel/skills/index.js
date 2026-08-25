import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '../top-bar';
import { CenteredLoading, toaster } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { skillsAPI } from '@/project/api';
import { SkillsPageProvider, useSkillsPage } from './hooks/skills-page';
import { SKILLS_PAGE_SLUG_ID } from './constants';
import SkillsList from './view/skills-list';
import SkillDetail from './view/skill-detail';

import './index.css';

const { projectUuid, workspaceID, projectName, isProjectAdmin } = window.app.pageOptions;

const Content = ({ title }) => {
  const { isLoading: isPageLoading, pageSlugId, togglePageSlugId } = useSkillsPage();
  const [isDataLoading, setLoading] = useState(true);
  const [skills, setSkills] = useState([]);
  const [togglingSkillNameMap, setTogglingSkillNameMap] = useState({});

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
    togglePageSlugId(SKILLS_PAGE_SLUG_ID.NEW);
  }, [togglePageSlugId]);

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
          <button className="btn btn-primary btn-sm" onClick={onCreate}>
            {gettext('New')}
          </button>
        )}
      </TopBar>
      {isLoading ? (
        <CenteredLoading />
      ) : (
        <div className="skills-page">
          <SkillsList
            skills={skills}
            activeSkillName={activeSkillName}
            onSelectSkill={togglePageSlugId}
            onToggleSkill={onToggleSkill}
            isProjectAdmin={isProjectAdmin}
            togglingSkillNameMap={togglingSkillNameMap}
          />
        </div>
      )}
      {pageSlugId !== SKILLS_PAGE_SLUG_ID.ALL && (
        <SkillDetail
          projectUuid={projectUuid}
          pageSlugId={pageSlugId}
          isProjectAdmin={isProjectAdmin}
          onSaved={onSaved}
          onDeleted={onDeleted}
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

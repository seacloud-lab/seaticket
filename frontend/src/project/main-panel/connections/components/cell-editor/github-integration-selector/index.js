import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import projectAPI from '@/project/api/project-api';
import { Collaborator, CollaboratorEditor, IconButton } from '@/components';
import { generatorProjectGitHubOauthURL } from '../../../../../utils';
import { Utils } from '@/utils/utils';

import './index.css';

const { isProjectAdmin } = window.app.pageOptions;

const GitHubAppSelector = ({ githubOauth, value = '', projectUuid, onChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [isShowEditor, setShowEditor] = useState(false);

  const editorRef = useRef(null);

  const organizationsOptions = useMemo(() => {
    if (!Array.isArray(organizations) || organizations.length === 0) return [];
    return organizations.map(organization => {
      return {
        email: organization.installation_id,
        name: organization.organization,
        avatar_url: organization.avatar,
      };
    });
  }, [organizations]);

  const openEditor = useCallback(() => {
    setShowEditor(true);
  }, []);

  const closeEditor = useCallback(() => {
    setShowEditor(false);
  }, []);

  const handleChange = useCallback((value) => {
    onChange && onChange(value);
  }, [onChange]);

  const jumpToGitHubOauthConfig = useCallback(() => {
    location.href = generatorProjectGitHubOauthURL(projectUuid);
  }, [projectUuid]);

  useEffect(() => {
    if (!githubOauth) {
      setOrganizations([]);
      setErrorMessage('');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    projectAPI.getGitHubIntegrationOrganizations(projectUuid).then(res => {
      const records = res.data?.records || [];
      setOrganizations(records);
      setErrorMessage('');
      setIsLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
      setIsLoading(false);
    });
  }, [githubOauth]);

  if (!githubOauth) {
    if (isProjectAdmin) {
      return (
        <div className="sea-qa-connection-github-integration-formatter editable" onClick={jumpToGitHubOauthConfig}>
          {gettext('GitHub has not been integrated yet, click to go to integration.')}
        </div>
      );
    }
    return (
      <div className="sea-qa-connection-github-integration-formatter">
        {gettext('GitHub is not yet integrated, please contact the administrator.')}
      </div>
    );
  }

  const option = organizationsOptions.find(o => o.email === value);
  let emptyTip = '';
  if (isLoading) {
    emptyTip = gettext('Loading organizations');
  }
  if (errorMessage) {
    emptyTip = (
      <span className="sea-qa-tip-danger">
        {errorMessage}
      </span>
    );
  }

  return (
    <>
      <div
        className={classnames('sea-qa-connection-github-integration-selector custom-select', { 'focus': isShowEditor })}
        onClick={openEditor}
        ref={editorRef}
      >
        {option ? (<Collaborator collaborator={option} />) : (<span></span>)}
        <IconButton className="no-hover-bg" icon="down" style={{ height: 12, width: 12 }} />
      </div>
      {isShowEditor && (
        <CollaboratorEditor
          target={editorRef}
          value={value}
          isShowDeleteArea={false}
          isSearchEnabled={false}
          isMultiple={false}
          emptyTip={emptyTip}
          collaborators={organizationsOptions}
          onChange={handleChange}
          onClose={closeEditor}
        />
      )}
    </>
  );

};

export default GitHubAppSelector;

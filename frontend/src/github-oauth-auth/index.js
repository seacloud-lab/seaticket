import React, { useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from 'reactstrap';
import { gettext } from '@/constants';
import { Logo } from '@/components';

import './index.css';

const { workspaceID, projectName, projectUuid, name, server } = window.app.pageOptions;
const { siteTitle } = window.app.config;

const GitHubOauthAuth = () => {

  const cancelOauthAuth = useCallback(() => {
    location.href = `${server}/workspace/${workspaceID}/project/${projectName}/github-integration/`;
  }, []);

  const handleAllow = useCallback(() => {
    location.href = `${server}/github/login/?project_uuid=${projectUuid}`;
  }, []);

  return (
    <div className="sea-qa-github-oauth-auth">
      <div className="sea-qa-github-oauth-auth-container">
        <div className="sea-qa-github-oauth-auth-header">
          <Logo />
        </div>
        <div className="sea-qa-github-oauth-auth-body">
          <div className="sea-qa-github-oauth-auth-permission-list">
            <div
              className="sea-qa-github-oauth-auth-permission-title mb-3"
              dangerouslySetInnerHTML={{
                __html:
                  gettext('The {GitHub} application requires the following permissions:').replace('{GitHub}', `<b>${gettext('GitHub')}</b>`)
              }}
            >
            </div>
            <ul className="sea-qa-github-oauth-auth-permission-list-content">
              <li>{gettext('The application will be able to do most GET requests associated with projects/resources/statistics/etc')}</li>
              <li>{gettext('The application will get the user\'s email address')}</li>
              <li>{gettext('The application will be able to create/delete resources, upload/download source files, download translations and create source strings (for FILELESS resources)')}</li>
              <li>{gettext('The application will be able to upload translation files and change translations')}</li>
              <li>{gettext('The application will be able to do CRUD operations on webhooks')}</li>
            </ul>
            <div className="sea-qa-github-oauth-auth-permission-project mt-3">
              <b>{gettext('Project')}{': '}</b>
              {projectName}
            </div>
            <div className="sea-qa-github-oauth-auth-op-btns">
              <Button onClick={cancelOauthAuth}>{gettext('Cancel')}</Button>
              <Button color="primary" onClick={handleAllow}>{gettext('Allow')}</Button>
            </div>
            <div
              className="sea-qa-github-oauth-auth-use-other"
              dangerouslySetInnerHTML={{
                __html:
                  gettext('Already logged in as {user} not you? {Log_in} as another user')
                    .replace('{user}', `<b>${name}</b>`)
                    .replace('{Log_in}', `<a href="/accounts/logout/?next=${location.href}">${gettext('Log in')}</a>`)
              }}
            >
            </div>
          </div>
        </div>
        <div className="sea-qa-github-oauth-auth-footer">
          {`${siteTitle} © ${(new Date()).getFullYear()} ${gettext('all rights reserved')}`}
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<GitHubOauthAuth />);

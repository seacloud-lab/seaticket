import React, { useCallback } from 'react';
import { Button } from 'reactstrap';
import { gettext } from '@/constants';
import TopBar from '../top-bar';
import { EmptyTip } from '@/components';
import { generatorProjectGitHubOauthURL } from '../../utils';

const { projectUuid } = window.app.pageOptions;

const GitHubIntegration = ({ title, githubOauth, modifyGithubOauth }) => {

  const handleInstall = useCallback(() => {
    location.href = generatorProjectGitHubOauthURL(projectUuid);
  }, []);

  const handleRemove = useCallback(() => {
    modifyGithubOauth(null);
  }, [modifyGithubOauth]);

  console.log(githubOauth);

  return (
    <>
      <TopBar>
        <div className="w-100 text-truncate">{title}</div>
        {githubOauth ? (
          <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={handleRemove}>
            {gettext('Remove')}
          </Button>
        ) : (
          <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={handleInstall}>
            {gettext('Install')}
          </Button>
        )}
      </TopBar>
      {githubOauth ? (
        <EmptyTip src={githubOauth.avatar_url} text={githubOauth.username} />
      ) : (
        <EmptyTip text={gettext('No GitHub')} />
      )}
    </>
  );

};

export default GitHubIntegration;

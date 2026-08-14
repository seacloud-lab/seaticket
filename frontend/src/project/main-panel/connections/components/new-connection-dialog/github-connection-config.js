import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { gettext } from '@/constants';
import { Loading } from '@/components';

const GithubConnectionConfig = ({
  isLoadingRepositories,
  githubRepositories,
  installGitHubAppURL,
  name,
  isSubmitting,
  onNameChange,
  customColumns,
  renderConnectionField,
}) => {
  if (isLoadingRepositories) {
    return (
      <div className="seaqa-project-connection-github-tip d-flex flex-column align-items-center justify-content-center">
        <Loading />
        <h4 className="mt-5">{gettext('Checking GitHub App installation status...')}</h4>
        <p>{gettext('Install GitHub app to your repositories to enable SeaTicket to sync issues from these repositories')}</p>
      </div>
    );
  }

  if (githubRepositories.length === 0) {
    return (
      <div className="seaqa-project-connection-github-tip d-flex flex-column align-items-center justify-content-center">
        <h4>{gettext('GitHub app not installed')}</h4>
        <p>{gettext('Install GitHub app to your repositories to enable SeaTicket to sync issues from these repositories')}</p>
        <Button color="primary" outline onClick={() => window.open(installGitHubAppURL, '_blank')}>
          {gettext('Install GitHub app')}
        </Button>
      </div>
    );
  }

  return (
    <div className="seaqa-project-new-connection-config">
      <FormGroup>
        <Label>
          {gettext('Connection name')}
          <span className="required-tip" title={gettext('Required')}>{'*'}</span>
        </Label>
        <Input value={name} onChange={onNameChange} disabled={isSubmitting} />
      </FormGroup>
      {customColumns.map(renderConnectionField)}
    </div>
  );
};

GithubConnectionConfig.propTypes = {
  isLoadingRepositories: PropTypes.bool.isRequired,
  githubRepositories: PropTypes.array.isRequired,
  installGitHubAppURL: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  onNameChange: PropTypes.func.isRequired,
  customColumns: PropTypes.array.isRequired,
  renderConnectionField: PropTypes.func.isRequired,
};

export default GithubConnectionConfig;

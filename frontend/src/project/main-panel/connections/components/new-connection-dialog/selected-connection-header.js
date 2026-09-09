import React from 'react';
import PropTypes from 'prop-types';
import { SecondaryBtn } from '@/components';
import { gettext } from '@/constants';
import { CONNECTION_TYPE } from '../../constants';
import { getConnectionIcon } from '../../utils';

import './selected-connection-header.css';

const SelectedConnectionHeader = ({ connection, hasGithubRepositories, installGitHubAppURL }) => {
  return (
    <div className="seaqa-project-selected-connection">
      <div className="seaqa-project-connection-help">
        {connection.help_text}
        <a className="ml-1" href={connection.help_link} target="_blank" rel="noopener noreferrer">
          {gettext('Help Docs')}
        </a>
      </div>
      <div className="seaqa-project-new-connection-type">
        <div className="d-flex align-items-center">
          <img
            src={getConnectionIcon(connection.type)}
            alt={connection.name}
            className="seaqa-project-new-connection-icon"
          />
          <span>{connection.name}</span>
        </div>
        {connection.type === CONNECTION_TYPE.GITHUB_ISSUE && hasGithubRepositories && (
          <SecondaryBtn
            text={gettext('Manage GitHub app')}
            onClick={() => window.open(installGitHubAppURL, '_blank')}
          />
        )}
      </div>
    </div>
  );
};

SelectedConnectionHeader.propTypes = {
  connection: PropTypes.shape({
    type: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    help_text: PropTypes.string,
    help_link: PropTypes.string,
  }).isRequired,
  hasGithubRepositories: PropTypes.bool.isRequired,
  installGitHubAppURL: PropTypes.string.isRequired,
};

export default SelectedConnectionHeader;

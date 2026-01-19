import React from 'react';
import PropTypes from 'prop-types';
import { gettext, canAddGroup, orgName } from '../../../../constants';
import { Icon } from '../../../../components';

import './org-title.css';

function OrgTitle(props) {
  const { isDesktop, onCreateGroupToggle } = props;
  return (
    <div className={`project-org-title d-flex justify-content-between align-items-center flex-direction-row ${isDesktop ? '' : ' project-mobile-org-title'}`}>
      <div className="project-org-title-left">
        <h1 title={orgName} aria-label={orgName} className="project-org-name">{orgName}</h1>
      </div>
      <div className="project-org-title-right">
        {isDesktop && canAddGroup &&
          <div
            className="project-org-title-btn d-flex align-items-center"
            onClick={onCreateGroupToggle}
            title={gettext('New group')}
            aria-label={gettext('New group')}
          >
            <Icon symbol="new-group" className="mr-2" />
            <span>{gettext('New group')}</span>
          </div>
        }
      </div>
    </div>
  );
}

OrgTitle.propTypes = {
  isDesktop: PropTypes.bool.isRequired,
  onCreateGroupToggle: PropTypes.func,
};

export default OrgTitle;

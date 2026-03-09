import React from 'react';
import PropTypes from 'prop-types';
import { gettext, canAddGroup, orgName } from '../../../../constants';
import { IconTextBtn } from '@/components';

import './org-title.css';

function OrgTitle(props) {
  const { isDesktop, onCreateGroupToggle } = props;
  return (
    <div className={`project-org-title d-flex justify-content-between align-items-center flex-direction-row ${isDesktop ? '' : ' project-mobile-org-title'}`}>
      <div className="project-org-title-left">
        <h1 title={orgName} aria-label={orgName} className="project-org-name">{orgName}</h1>
      </div>
      <div className="project-org-title-right">
        {isDesktop && canAddGroup && (
          <IconTextBtn onClick={onCreateGroupToggle} text={gettext('New group')} icon="new-group" />
        )}
      </div>
    </div>
  );
}

OrgTitle.propTypes = {
  isDesktop: PropTypes.bool.isRequired,
  onCreateGroupToggle: PropTypes.func,
};

export default OrgTitle;

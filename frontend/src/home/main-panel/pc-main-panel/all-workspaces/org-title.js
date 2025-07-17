import React from 'react';
import PropTypes from 'prop-types';
import { gettext, canAddGroup, orgName } from '../../../../constants';
import './org-title.css';
import { Icon } from '../../../../components';

function OrgTitle(props) {
  const { isDesktop, onCreateGroupToggle } = props;
  return (
    <div className={`justify-content-between project-org-title${isDesktop ? '' : ' project-mobile-org-title'}`}>
      <div className="project-org-title-left">
        <Icon symbol="organization-name" className="project-org-icon" />
        <h1 title={orgName} aria-label={orgName} className="project-org-name">{orgName}</h1>
      </div>
      <div className="project-org-title-right">
        {isDesktop && canAddGroup &&
          <button
            className="btn btn-primary"
            onClick={onCreateGroupToggle}
            title={gettext('New group')}
            aria-label={gettext('New group')}
          >
            <Icon symbol="add" className="mr-1" />
            <span>{gettext('New group')}</span>
          </button>
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

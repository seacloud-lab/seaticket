import React from 'react';
import PropTypes from 'prop-types';
import { gettext, canAddGroup, orgName } from '../../../../constants';
import './org-title.css';

function OrgTitle(props) {
  const { isDesktop, onCreateGroupToggle } = props;
  return (
    <div className={`dtable-org-title${isDesktop ? '' : ' dtable-mobile-org-title'}`}>
      <div className="dtable-org-title-left">
        <i aria-hidden="true" className="dtable-org-icon dtable-font dtable-icon-organization-name"></i>
        <h1 title={orgName} aria-label={orgName} className="dtable-org-name">{orgName}</h1>
      </div>
      <div className="dtable-org-title-right">
        {isDesktop && canAddGroup &&
          <button
            className="btn btn-primary"
            onClick={onCreateGroupToggle}
            title={gettext('New group')}
            aria-label={gettext('New group')}
          >
            <i className="dtable-font dtable-icon-new mr-1"></i>
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

import React from 'react';
import PropTypes from 'prop-types';
import { Router } from '@gatsbyjs/reach-router';
import OrgDepartmentsList from './org-departments-list';
import OrgDepartmentItem from './org-department-item';

import '../../../css/org-department-item.css';

const propTypes = {
  onCloseSidePanel: PropTypes.func,
};

class OrgDepartments extends React.Component {

  render() {
    const { onCloseSidePanel } = this.props;

    return (
      <div className="h-100 org-departments">
        <Router role='group'>
          <OrgDepartmentsList path='/' onCloseSidePanel={onCloseSidePanel} />
          <OrgDepartmentItem path='groups/:groupID/*' onCloseSidePanel={onCloseSidePanel} />
        </Router>
      </div>
    );
  }
}

OrgDepartments.propTypes = propTypes;

export default OrgDepartments;

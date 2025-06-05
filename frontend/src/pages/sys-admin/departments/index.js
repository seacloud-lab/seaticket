import React from 'react';
import PropTypes from 'prop-types';
import { Router } from '@gatsbyjs/reach-router';
import DepartmentsList from './departments-list';
import DepartmentItem from './department-item';

import '../../../css/org-department-item.css';

class Departments extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    const { onCloseSidePanel } = this.props;
    return (
      <div className="h-100 org-departments">
        <Router role='group'>
          <DepartmentsList path='/' onCloseSidePanel={onCloseSidePanel} />
          <DepartmentItem path='/:groupID/*' onCloseSidePanel={onCloseSidePanel} />
        </Router>
      </div>
    );
  }
}

const propTypes = {
  onCloseSidePanel: PropTypes.func,
};

Departments.propTypes = propTypes;

export default Departments;

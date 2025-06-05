import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Loading from '../../../../../components/loading';
import DepartmentGroup from './department-group';

const gettext = window.gettext;
const { isOrgContext } = window.app.pageOptions;

class DepartmentGroups extends Component {

  constructor(props) {
    super(props);
    this.state = {
      allMembersClick: !!isOrgContext
    };
  }

  toggleExpanded = (id, state) => {
    let departments = this.props.departmentsTree.slice(0);
    let index = departments.findIndex(item => item.id === id);
    departments[index].isExpanded = state;
    this.setState({ departments });
  };

  getMembers = (department_id) => {
    this.props.getMembers(department_id);
    this.setState({ allMembersClick: false });
  };

  getOrgMembers = () => {
    this.props.getOrgMembers();
    this.setState({
      allMembersClick: true
    });
  };

  render() {
    const { loading } = this.props;
    let departments = this.props.departmentsTree;
    if (loading) {
      return (<Loading/>);
    }
    const { allMembersClick } = this.state;
    return (
      <div className="department-dialog-group">
        <div>
          {isOrgContext &&
            <div className={allMembersClick ? 'tr-highlight group-item' : 'group-item'} onClick={this.getOrgMembers}>
              <span
                className={'dtable-font pr-2'}
                style={{ color: allMembersClick ? '#fff' : '#666666', fontSize: '12px' }}
              />
              <span>{gettext('All users')}</span>
            </div>
          }
          {departments.length > 0 && departments.map((department, index) => {
            if (department.parent_id !== -1) return null;
            return (
              <DepartmentGroup
                key={department.id}
                department={department}
                departments={departments}
                getMembers={this.getMembers}
                setCurrent={this.props.setCurrent}
                toggleExpanded={this.toggleExpanded}
                currentDepartment={this.props.currentDepartment}
                allMembersClick={this.state.allMembersClick}
              />
            );
          })}
        </div>
      </div>
    );
  }
}

DepartmentGroups.propTypes = {
  loading: PropTypes.bool,
  departments: PropTypes.array.isRequired,
  currentDepartment: PropTypes.object.isRequired,
  departmentsTree: PropTypes.array,
  getOrgMembers: PropTypes.func,
  getMembers: PropTypes.func.isRequired,
  setCurrent: PropTypes.func.isRequired,
};

export default DepartmentGroups;

import React from 'react';
import PropTypes from 'prop-types';

class DepartmentGroup extends React.Component {

  getMembers = (e) => {
    e.stopPropagation();
    const { department } = this.props;
    this.props.getMembers(department.id);
    this.props.setCurrent(department);
  };

  toggleExpanded = (e) => {
    e.stopPropagation();
    this.props.toggleExpanded(this.props.department.id, !this.props.department.isExpanded);
  };

  renderSubDepartments = () => {
    const { departments } = this.props;
    return (
      <div style={{ paddingLeft: '10px' }}>
        {departments.map(department => {
          if (department.parent_id !== this.props.department.id) return null;
          return (
            <DepartmentGroup
              key={department.id}
              department={department}
              departments={departments}
              getMembers={this.props.getMembers}
              setCurrent={this.props.setCurrent}
              toggleExpanded={this.props.toggleExpanded}
              currentDepartment={this.props.currentDepartment}
              allMembersClick={this.props.allMembersClick}
            />
          );
        })}
      </div>
    );
  };

  render() {
    const { department, currentDepartment, allMembersClick } = this.props;
    const isCurrent = !allMembersClick && currentDepartment.id === department.id;
    const { hasChild, isExpanded } = department;
    return (
      <>
        <div className={isCurrent ? 'tr-highlight group-item' : 'group-item'} onClick={this.getMembers}>
          {hasChild &&
            <span
              className={`dtable-font dtable-icon-${isExpanded ? 'drop-down' : 'right-slide'} pr-2`}
              onClick={this.toggleExpanded}
              style={{ color: isCurrent ? '#fff' : '#666666', fontSize: '12px' }}
            >
            </span>
          }
          <span style={hasChild ? {} : { paddingLeft: '20px' }}>{department.name}</span>
        </div>
        {(isExpanded && hasChild) && this.renderSubDepartments()}
      </>
    );
  }
}

DepartmentGroup.propTypes = {
  allMembersClick: PropTypes.bool,
  department: PropTypes.object,
  currentDepartment: PropTypes.object,
  departments: PropTypes.array,
  getMembers: PropTypes.func.isRequired,
  setCurrent: PropTypes.func.isRequired,
  toggleExpanded: PropTypes.func.isRequired,
};

export default DepartmentGroup;

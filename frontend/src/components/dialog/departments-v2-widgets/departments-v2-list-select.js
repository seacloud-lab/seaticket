import React from 'react';
import PropTypes from 'prop-types';

const itemPropTypes = {
  department: PropTypes.object,
  departments: PropTypes.array,
  selectedDepartments: PropTypes.array,
  toggleExpanded: PropTypes.func,
  onSelectDepartment: PropTypes.func
};

class Item extends React.Component {

  toggleExpanded = (e) => {
    e.stopPropagation();
    this.props.toggleExpanded(this.props.department.id, !this.props.department.isExpanded);
  };

  renderSubDepartments = () => {
    const { departments, selectedDepartments } = this.props;
    return (
      <div className="pl-2">
        {departments.map((department) => {
          if (department.parent_id !== this.props.department.id) return null;
          return (
            <Item
              key={department.id}
              department={department}
              departments={departments}
              selectedDepartments={selectedDepartments}
              toggleExpanded={this.props.toggleExpanded}
              onSelectDepartment={this.props.onSelectDepartment}
            />
          );
        })}
      </div>
    );
  };

  render() {
    const { department, selectedDepartments } = this.props;
    const { hasChild, isExpanded } = department;
    const checked = !!selectedDepartments.find(dep => dep.id === department.id);
    return (
      <>
        <div className='group-item d-flex' >
          {hasChild &&
            <span
              className={`dtable-font dtable-icon-down3 ${isExpanded ? '' : 'rotate-270'}`}
              onClick={this.toggleExpanded}
              style={{ color: '#999' }}
            >
            </span>
          }
          <span className="d-flex" style={hasChild ? { paddingLeft: '8px' } : { paddingLeft: '21px' }}>
            <input type='checkbox' checked={checked ? 'checked' : ''} onClick={this.props.onSelectDepartment.bind(this, department)} />
            <span className="pl-1">{department.name}</span>
          </span>
        </div>
        {(isExpanded && hasChild) && this.renderSubDepartments()}
      </>
    );
  }
}

Item.propTypes = itemPropTypes;

const propTypes = {
  departmentsTree: PropTypes.array,
  selectedDepartments: PropTypes.array,
  onSelectDepartment: PropTypes.func
};

class DepartmentsV2ListSelect extends React.Component {

  toggleExpanded = (id, state) => {
    let departments = this.props.departmentsTree.slice(0);
    let index = departments.findIndex(item => item.id === id);
    departments[index].isExpanded = state;
    this.setState({ departments });
  };

  render() {
    const { departmentsTree: departments, selectedDepartments } = this.props;
    return (
      <div className='department-dialog-group'>
        {departments.length > 0 && departments.map((department) => {
          if (department.parent_id !== -1) return null;
          return (
            <Item
              key={department.id}
              department={department}
              departments={departments}
              selectedDepartments={selectedDepartments}
              toggleExpanded={this.toggleExpanded}
              onSelectDepartment={this.props.onSelectDepartment}
            />
          );
        })}
      </div>
    );
  }

}

DepartmentsV2ListSelect.propTypes = propTypes;

export default DepartmentsV2ListSelect;

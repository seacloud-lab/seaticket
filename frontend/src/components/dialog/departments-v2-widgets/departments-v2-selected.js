import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../constants';
import { Button, ModalFooter } from 'reactstrap';

const itemPropTypes = {
  department: PropTypes.object,
  removeSelectedDepartment: PropTypes.func
};

class Item extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false
    };
  }

  handleMouseEnter = () => {
    this.setState({ highlight: true });
  };

  handleMouseLeave = () => {
    this.setState({ highlight: false });
  };

  removeSelectedDepartment = (department) => {
    this.props.removeSelectedDepartment(department);
  };

  render() {
    const { department } = this.props;
    return (
      <tr
        className={this.state.highlight ? 'tr-highlight group-item' : 'group-item'}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        <td width="78%">{department.name}</td>
        <td width="10%">
          <i
            className="dtable-font dtable-icon-cancel"
            name={department.name}
            onClick={this.removeSelectedDepartment.bind(this, department)}>
          </i>
        </td>
      </tr>
    );
  }
}

Item.propTypes = itemPropTypes;

const propTypes = {
  selectedDepartments: PropTypes.array,
  toggle: PropTypes.func,
  addUserToDepartments: PropTypes.func,
  removeSelectedDepartment: PropTypes.func
};

class DepartmentsV2Selected extends React.Component {

  render() {
    const { selectedDepartments } = this.props;
    return (
      <div className='department-dialog-member-selected pt-4'>
        <div style={{ height: 'calc(100% - 70px)' }}>
          <div className='department-dialog-member-head px-4'>
            <div className='department-name'>{gettext('Selected')}</div>
          </div>
          {selectedDepartments.length > 0 &&
            <table className='department-dialog-member-table'>
              <tbody>
                {selectedDepartments.map(department => {
                  return (
                    <Item
                      key={department.id}
                      department={department}
                      removeSelectedDepartment={this.props.removeSelectedDepartment}
                    />
                  );
                })}
              </tbody>
            </table>
          }
        </div>
        <ModalFooter>
          <Button color='secondary' onClick={this.props.toggle}>{gettext('Cancel')}</Button>
          <Button color='primary' onClick={this.props.addUserToDepartments.bind(this, selectedDepartments)}>{gettext('Add')}</Button>
        </ModalFooter>
      </div>
    );
  }
}

DepartmentsV2Selected.propTypes = propTypes;

export default DepartmentsV2Selected;

import React from 'react';
import PropTypes from 'prop-types';
import { Button, ModalFooter } from 'reactstrap';
import SelectedDepartmentGroupMember from './selected-department-group-member';

const gettext = window.gettext;

function SelectedDepartmentGroupMembers(props) {
  const { members } = props;
  return (
    <div className="department-dialog-member-selected pt-4">
      <div style={{ height: 'calc(100% - 70px)' }}>
        <div className='department-dialog-member-head px-4'>
          <div className='department-name'>
            {gettext('Selected')}
          </div>
        </div>
        {Object.keys(members).length > 0 &&
          <table className="department-dialog-member-table">
            <tbody>
              {Object.keys(members).map(email => {
                return (
                  <SelectedDepartmentGroupMember
                    key={email}
                    member={members[email]}
                    onRemoveMember={props.onRemoveMember}
                  />
                );
              })}
            </tbody>
          </table>
        }
      </div>
      <ModalFooter>
        <Button color="secondary" onClick={props.onToggle}>
          {gettext('Cancel')}
        </Button>
        <Button color="primary" onClick={props.onAddMembers}>
          {gettext('Add')}
        </Button>
      </ModalFooter>
    </div>
  );
}

SelectedDepartmentGroupMembers.propTypes = {
  members: PropTypes.object.isRequired,
  onRemoveMember: PropTypes.func.isRequired,
  onAddMembers: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default SelectedDepartmentGroupMembers;

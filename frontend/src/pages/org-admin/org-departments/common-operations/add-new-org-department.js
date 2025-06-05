import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import ModalPortal from '../../../../components/modal-portal';
import AddDepartDialog from '../../../../components/dialog/org-add-department-dialog';

const propTypes = {
  groupID: PropTypes.string,
  title: PropTypes.string,
  onDepartChanged: PropTypes.func,
};

class AddNewOrgDepartment extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowAddDepartDialog: false,
    };
  }

  toggleAddDepartDialog = () => {
    this.setState({ isShowAddDepartDialog: !this.state.isShowAddDepartDialog });
  };

  render() {
    const { groupID, onDepartChanged, title } = this.props;
    const { isShowAddDepartDialog } = this.state;

    return (
      <Fragment>
        <button
          className="btn btn-secondary operation-item"
          title={title}
          aria-label={title}
          onClick={this.toggleAddDepartDialog}
        >
          {title}
        </button>
        {isShowAddDepartDialog && (
          <ModalPortal>
            <AddDepartDialog
              parentGroupID={groupID}
              onDepartChanged={onDepartChanged}
              toggle={this.toggleAddDepartDialog}
            />
          </ModalPortal>
        )}
      </Fragment>
    );
  }
}

AddNewOrgDepartment.propTypes = propTypes;

export default AddNewOrgDepartment;

import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../../constants';
import AddDepartMemberDialog from '../../../../components/dialog/sysadmin-dialog/sysadmin-add-depart-member-dialog';

const propTypes = {
  groupID: PropTypes.string,
  onMemberChanged: PropTypes.func.isRequired,
};

class AddMemberOperation extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowDialog: false,
    };
  }

  toggleDialog = () => {
    this.setState({ isShowDialog: !this.state.isShowDialog });
  };

  render() {
    const operationTip = gettext('Add member');
    const btnProps = {
      className: 'btn btn-secondary operation-item',
      title: operationTip,
      'aria-label': operationTip,
      onClick: this.toggleDialog
    };

    const { groupID } = this.props;
    const { isShowDialog } = this.state;

    return (
      <>
        <button {...btnProps}>{operationTip}</button>
        {isShowDialog && (
          <AddDepartMemberDialog
            groupID={groupID}
            onMemberChanged={this.props.onMemberChanged}
            toggle={this.toggleDialog}
          />
        )}
      </>
    );
  }
}

AddMemberOperation.propTypes = propTypes;

export default AddMemberOperation;

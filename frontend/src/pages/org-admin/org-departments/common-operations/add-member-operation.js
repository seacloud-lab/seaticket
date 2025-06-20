import React from 'react';
import PropTypes from 'prop-types';
import AddMemberDialog from '../../../../components/dialog/org-add-member-dialog';
import { gettext } from '../../../../constants';

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
    const { groupID } = this.props;
    const { isShowDialog } = this.state;
    const operationTip = gettext('Add member');
    const btnProps = {
      className: 'btn btn-secondary operation-item',
      title: operationTip,
      'aria-label': operationTip,
      onClick: this.toggleDialog
    };

    return (
      <>
        <button {...btnProps}>{operationTip}</button>
        {isShowDialog && (
          <AddMemberDialog
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

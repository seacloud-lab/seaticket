import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../../constants';
import AddDepartmentDialog from '../../../../components/dialog/sysadmin-dialog/sysadmin-add-department-dialog';

const propTypes = {
  title: PropTypes.string,
  groupID: PropTypes.string,
  onDepartChanged: PropTypes.func.isRequired,
};

class AddDepartmentOperation extends React.Component {

  static defaultProps = {
    title: gettext('New department'),
  };

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
    const { groupID, title } = this.props;
    const { isShowDialog } = this.state;

    const btnProps = {
      className: 'btn btn-secondary operation-item',
      title: title,
      'aria-label': title,
      onClick: this.toggleDialog
    };

    return (
      <>
        <button {...btnProps}>{title}</button>
        {isShowDialog && (
          <AddDepartmentDialog
            parentGroupID={groupID}
            onDepartChanged={this.props.onDepartChanged}
            toggle={this.toggleDialog}
          />
        )}
      </>
    );
  }
}

AddDepartmentOperation.propTypes = propTypes;

export default AddDepartmentOperation;

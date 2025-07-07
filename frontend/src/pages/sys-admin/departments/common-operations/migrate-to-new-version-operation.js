import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../../../constants';
import { toaster, ModalHeader } from '../../../../components';
import { Utils } from '../../../../utils/utils';
import { sysAdminServiceApi } from '../../../../api/sys-admin-service-api';

const propTypes = {
  title: PropTypes.string,
  onMigrateSuccess: PropTypes.func
};

class MigrateToNewVersionOperation extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowDialog: false,
      isMigrating: false
    };
  }

  toggleDialog = () => {
    this.setState({ isShowDialog: !this.state.isShowDialog });
  };

  handleSubmit = () => {
    this.setState({ isMigrating: true });
    sysAdminServiceApi.sysAdminListAddressBookV2Departments(-1).then(res => {
      if (res.data.department_list.length === 0) {
        toaster.danger(gettext('Please create a top-level department in the new version departments feature first'));
        return;
      }
      sysAdminServiceApi.sysAdminAddressBookV2DepartmentsMigrate().then(() => {
        toaster.success(gettext('Migrated to new version'));
        this.setState({ isMigrating: false });
        this.props.onMigrateSuccess();
        this.toggleDialog();
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
        this.setState({ isMigrating: false });
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({ isMigrating: false });
    });
  };

  render() {
    const { isShowDialog, isMigrating } = this.state;
    const { title } = this.props;

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
          <Modal isOpen={true} toggle={this.toggleDialog}>
            <ModalHeader toggle={this.toggleDialog}>
              {gettext('Migrate departments to new version')}
            </ModalHeader>
            <ModalBody>
              <p>
                <span>{gettext('Are you sure to migrate departments and members to new version?')}</span>
              </p>
            </ModalBody>
            <ModalFooter>
              <Button color="secondary" onClick={this.toggleDialog}>{gettext('Cancel')}</Button>
              <Button color="primary" disable={isMigrating} onClick={this.handleSubmit}>{gettext('Submit')}</Button>
            </ModalFooter>
          </Modal>
        )}
      </>
    );
  }
}

MigrateToNewVersionOperation.propTypes = propTypes;

export default MigrateToNewVersionOperation;

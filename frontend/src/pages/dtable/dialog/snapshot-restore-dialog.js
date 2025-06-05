import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Input, InputGroup, Alert, Label } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import Loading from '../../../components/loading';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import { toaster, DTableSelect } from 'dtable-ui-component';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  restoreSnapshot: PropTypes.func.isRequired,
  dtable: PropTypes.object.isRequired,
  workspace: PropTypes.object.isRequired,
};

class SnapshotRestoreDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      snapshotName: this.props.dtable.name + '(restored)',
      errMessage: '',
      isShowLoading: false,
      isPasswordVisible: true,
      password: '',
      backups: [],
      bigDataEnabled: false,
      currentSelected: null
    };
  }

  componentDidMount() {
    this.getBigDataState();
  }

  getBigDataState = () => {
    let { workspace, dtable } = this.props;
    dtableWebAPI.getBigDataState(workspace.id, dtable.name).then(res => {
      let bigDataEnabled = res.data.big_data_enabled;
      this.setState({ bigDataEnabled });
      if (bigDataEnabled) {
        this.listArchiveBackups();
      }
    }).catch(err => {
      let errMessage = Utils.getErrorMsg(err);
      toaster.danger(errMessage);
    });
  };

  listArchiveBackups = () => {
    let { workspace, dtable } = this.props;
    dtableWebAPI.listArchiveBackups(workspace.id, dtable.name).then(res => {
      let backups = res.data.backup_list.map(item => {
        return { value: item.version, label: dayjs(item.ctime).format('YYYY-MM-DD HH:mm') };
      });
      this.setState({ backups: backups });
    }).catch(err => {
      let errMessage = Utils.getErrorMsg(err);
      toaster.danger(errMessage);
    });
  };

  toggle = () => {
    this.props.toggle();
  };

  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  handleSnapshotNameChange = (e) => {
    let value = e.target.value;
    this.setState({
      snapshotName: value,
    });
  };

  onPasswordChange = (e) => {
    this.setState({ password: e.target.value });
  };

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.handleSubmit();
      e.preventDefault();
    }
  };

  handleSubmit = () => {
    let { snapshotName, password, currentSelected } = this.state;
    snapshotName = snapshotName.trim();
    if (!snapshotName) {
      this.setState({ errMessage: gettext('Name is required.') });
      return;
    }
    this.setState({ isShowLoading: true });
    let backupVersion = currentSelected ? currentSelected.value : null;
    this.props.restoreSnapshot(snapshotName, password, backupVersion);
  };

  setBackup = (e) => {
    this.setState({ currentSelected: e });
  };

  render() {
    let { dtable } = this.props;
    const { snapshotName, isShowLoading, isPasswordVisible, password, backups, bigDataEnabled, currentSelected } = this.state;
    const { canUseAdvancedCustomization } = window.app.pageOptions;
    const isSupportRestoreBackup = canUseAdvancedCustomization && bigDataEnabled;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Restore snapshot')}</DTableModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <p>{gettext('Restore snapshot as base')}</p>
              <InputGroup>
                <Input
                  type="text"
                  className="form-control"
                  value={snapshotName}
                  onKeyDown={this.onKeyDown}
                  onChange={this.handleSnapshotNameChange}
                />
              </InputGroup>
            </FormGroup>
            {dtable.is_encrypted &&
              <FormGroup>
                <Label for="copy-to-group">{gettext('Password')}</Label>
                <InputGroup>
                  <Input
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={this.onPasswordChange}
                  />
                  <Button onClick={this.togglePasswordVisible}>
                    <i className={`dtable-font dtable-icon-eye ${isPasswordVisible ? '' : '-slash'}`}></i>
                  </Button>
                </InputGroup>
              </FormGroup>
            }
            {isSupportRestoreBackup &&
              <FormGroup>
                <Label>{gettext('Backups')}</Label>
                <DTableSelect
                  menuPortalTarget="#wrapper"
                  value={currentSelected}
                  options={backups}
                  placeholder={gettext('Select backup')}
                  onChange={this.setBackup}
                />
              </FormGroup>
            }
          </Form>
          {this.state.errMessage && <Alert color="danger" className="mt-2">{this.state.errMessage}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          {isShowLoading ?
            <Button color="primary"><Loading /></Button> :
            <Button color="primary" onClick={this.handleSubmit}>{gettext('Submit')}</Button>
          }
        </ModalFooter>
      </Modal>
    );
  }
}

SnapshotRestoreDialog.propTypes = propTypes;

export default SnapshotRestoreDialog;

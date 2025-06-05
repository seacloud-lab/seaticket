import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'react-sweet-progress';
import AsyncSelect from 'react-select/async';
import { Modal, ModalBody, ModalFooter, Button, Label, FormGroup } from 'reactstrap';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import { gettext } from '../../../utils/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Loading from '../../../components/loading';
import { Utils } from '../../../utils/utils';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

import 'react-sweet-progress/lib/style.css';

const groupSelectPropTypes = {
  placeholder: PropTypes.string.isRequired,
  onSelectChange: PropTypes.func.isRequired,
  isMulti: PropTypes.bool.isRequired,
  className: PropTypes.string,
};

const customStyles = {
  indicatorSeparator: () => ({
    display: 'none',
  }),
  dropdownIndicator: () => ({
    display: 'none',
  }),
  clearIndicator: () => ({
    display: 'none',
  }),
  singleValue: () => {
    return {
      backgroundColor: 'hsl(0, 0%, 90%)',
      borderRadius: '2px',
      display: 'flex',
      margin: '2px',
      minWidth: 0,
      boxSizing: 'border-box',
      padding: '3px 6px',
    };
  }
};

class GroupSelect extends React.Component {

  constructor(props) {
    super(props);
    this.options = [];
    this.state = {
      searchValue: '',
    };
  }

  handleSelectChange = (option) => {
    this.options = [];
    this.props.onSelectChange(option);
  };

  onInputChange = (searchValue) => {
    this.setState({ searchValue });
  };

  loadOptions = (input, callback) => {
    const value = input.trim();
    if (value.length > 0) {
      sysAdminServiceApi.sysAdminSearchGroups(value).then((res) => {
        this.options = [];
        for (let i = 0 ; i < res.data.group_list.length; i++) {
          const item = res.data.group_list[i];
          let obj = {};
          obj.value = item.name;
          obj.workspace_id = item.workspace_id;
          obj.label =
            <React.Fragment>
              <span className='select-module select-module-name'>{item.name}</span>
            </React.Fragment>;
          this.options.push(obj);
        }
        callback(this.options);
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    }
  };

  render() {
    return (
      <AsyncSelect
        isClearable
        classNamePrefix
        components={{
          NoOptionsMessage: (props) => {
            return (
              <div
                {...props.innerProps}
                style={{ margin: '6px 10px', textAlign: 'center', color: 'hsl(0,0%,50%)' }}
              >{this.state.searchValue ? gettext('Group not found') : gettext('Enter characters to start searching')}
              </div>
            );
          }
        }}
        isMulti={this.props.isMulti}
        loadOptions={this.loadOptions}
        onChange={this.handleSelectChange}
        onInputChange={this.onInputChange}
        placeholder={this.props.placeholder}
        className={`group-select ${this.props.className}`}
        ref="groupSelect"
        theme={theme => ({
          ...theme,
          colors: {
            ...theme.colors,
            primary25: '#f5f5f5',
          },
        })}
        styles={customStyles}
      />
    );
  }
}

GroupSelect.propTypes = groupSelectPropTypes;

const propTypes = {
  dtable: PropTypes.object.isRequired,
  onCopyDTableToggle: PropTypes.func.isRequired,
};

class SysAdminCopyDTableDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowCopyProcess: false,
      totalAssets: 0,
      copiedAssets: 0,
      isCopyingAssets: false,
      doneCopy: false,
      selectedGroup: null,
      submitBtnDisabled: true,
    };
    this.timer = null;
  }

  componentWillUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  toggle = () => {
    this.props.onCopyDTableToggle();
  };

  openCopyDTableProcess = () => {
    this.setState({ isShowCopyProcess: true });
  };

  closeCopyDTableProcess = () => {
    setTimeout(() => {
      this.toggle();
    }, 1000);
  };

  onSubmit = () => {
    let { dtable } = this.props;
    let { selectedGroup } = this.state;
    let dstWorkspaceId = selectedGroup.workspace_id;
    let taskId = '';
    let newDtable = '';
    this.openCopyDTableProcess();
    let total;
    let done;
    // Copy Dtable: 1. Copy table content 2. Copy assets(attachments)
    sysAdminServiceApi.sysAdminCopyDTable(dtable.workspace_id, dstWorkspaceId, dtable.name).then((res) => {
      taskId = res.data.task_id || '';
      newDtable = res.data.dtable;
      if (!taskId){
        toaster.success(gettext('Successfully copy {name}').replace('{name}', newDtable.name));
        this.closeCopyDTableProcess();
        return;
      }
      // Copy assets may take much time, so query the copy progress per 1000ms and show a progress bar
      return dtableWebAPI.queryCopyDTableStatus(taskId);
    }).then((res) => {
      if (!res) return null;
      total = res.data.total;
      done = res.data.done;
      this.setState({
        totalAssets: total,
        copiedAssets: done,
        isCopyingAssets: true,
      });
      if (res.data && res.data.successful === true) {
        this.setState({ doneCopy: true });
        toaster.success(gettext('Successfully copy {name}').replace('{name}', newDtable.name));
        this.closeCopyDTableProcess();
        // Do something after the assets have been copied, such as page design（update page design static image）
        return sysAdminServiceApi.sysAdminDoTaskAfterCopyDTable(newDtable.uuid);
      }
      this.timer = setInterval(() => {
        dtableWebAPI.queryCopyDTableStatus(taskId).then(res => {
          total = res.data.total;
          done = res.data.done;
          this.setState({
            totalAssets: total,
            copiedAssets: done,
          });
          if (res.data.successful === true) {
            clearInterval(this.timer);
            this.setState({ doneCopy: true });
            toaster.success(gettext('Successfully copy {name}').replace('{name}', newDtable.name));
            this.closeCopyDTableProcess();
            return sysAdminServiceApi.sysAdminDoTaskAfterCopyDTable(newDtable.uuid);
          }
        });
      }, 1000);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  getPercent = () => {
    const { copiedAssets, totalAssets, doneCopy } = this.state;
    if (doneCopy) {
      return 100;
    }
    return totalAssets === 0 ? 0 : Math.round(copiedAssets / totalAssets * 100);
  };

  handleSelectChange = (option) => {
    this.setState({
      selectedGroup: option,
      submitBtnDisabled: option == null
    });
  };

  renderHeader = () => {
    let { dtable } = this.props;
    let { isShowCopyProcess } = this.state;
    return (
      <DTableModalHeader toggle={this.toggle}>
        <span className="mr-1">{isShowCopyProcess ? gettext('Copying') : gettext('Copy')}</span>
        <span className="op-target" title={dtable.name}>{dtable.name}</span>
      </DTableModalHeader>
    );
  };

  render() {
    let { isCopyingAssets, isShowCopyProcess, submitBtnDisabled } = this.state;

    const loadingBodyStyle = {
      minHeight: '186px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    };
    if (isShowCopyProcess) {
      return (
        <Modal isOpen={true} toggle={this.toggle} size="md">
          {this.renderHeader()}
          <ModalBody style={isCopyingAssets ? { minHeight: '186px' } : loadingBodyStyle}>
            {isCopyingAssets ?
              <>
                <div className="mb-1 mt-6">{gettext('Copying assets...')}</div>
                <Progress
                  percent={this.getPercent()}
                  theme={{
                    success: {
                      color: '#ED7109'
                    },
                    active: {
                      color: '#ED7109'
                    }
                  }}
                />
              </>
              :
              <div><Loading /></div>
            }
          </ModalBody>
        </Modal>
      );
    }

    return (
      <Modal isOpen={true} toggle={this.toggle} size="md">
        {this.renderHeader()}
        <ModalBody >
          <FormGroup>
            <Label for="copy-to-group">{gettext('Copy to group')}</Label>
            <GroupSelect
              ref="groupSelect"
              isMulti={false}
              className="reviewer-select"
              placeholder={gettext('Select a group')}
              onSelectChange={this.handleSelectChange}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.onSubmit} disabled={submitBtnDisabled}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SysAdminCopyDTableDialog.propTypes = propTypes;

export default SysAdminCopyDTableDialog;

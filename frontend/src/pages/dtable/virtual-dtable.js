import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { dtableWebAPI } from '../../api/dtable-web-api';
import Base from './model/base';
import { Utils, validateName } from '../../utils/utils';
import DTableItem from './dtable-item';
import DtableSettingPopover from './dtable-popover/dtable-setting-popover';

const gettext = window.gettext;

const propTypes = {
  currentWorkspace: PropTypes.object,
  createBlankTable: PropTypes.func,
  hideVirtualDtable: PropTypes.func,
  currentFolder: PropTypes.object,
};

class VirtualDtable extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      dtableName: gettext('Untitled base'),
      dtableIcon: '',
      dtableColor: '',
      isChange: true,
      isDataLoaded: false,
      baseCreated: [],
    };
  }

  componentDidMount() {
    let baseCreated = [];
    dtableWebAPI.getAccountInfo().then((res) => {
      let obj = {};
      obj.value = 'personal';
      obj.email = res.data.email;
      obj.label = 'Personal';
      baseCreated.push(obj);
      dtableWebAPI.listGroups().then((res) => {
        for (let i = 0 ; i < res.data.length; i++) {
          let obj = {};
          obj.value = res.data[i].id;
          obj.email = res.data[i].id + '@seafile_group';
          obj.label = res.data[i].name;
          baseCreated.push(obj);
        }
        this.setState({ baseCreated, isDataLoaded: true });
      }).catch((err) => {
        this.handleError(err);
        this.props.hideVirtualDtable();
      });
    }).catch((error) => {
      this.handleError(error);
      this.props.hideVirtualDtable();
    });
  }

  onCreateTable = () => {
    const { dtableName, dtableIcon, dtableColor, baseCreated, isChange } = this.state;
    if (!isChange) return;
    const { currentWorkspace, currentFolder } = this.props;
    let folderID;
    if (currentFolder) {
      folderID = currentFolder.id;
    }
    let response = validateName(dtableName);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }
    let email;
    if (currentWorkspace) {
      for (let i = 0; i < baseCreated.length; i++) {
        if ((currentWorkspace.type === 'personal' && baseCreated[i].value === 'personal') ||
          (currentWorkspace.type === 'group' && baseCreated[i].value === currentWorkspace.group_id)) {
          email = baseCreated[i].email;
          break;
        }
      }
    }
    dtableWebAPI.createTable(response.message, email, dtableIcon, dtableColor, null, folderID).then((res) => {
      let newTable = new Base(res.data.table);
      this.props.createBlankTable(newTable);
    }).catch((error) => {
      this.setState({ isChange: false });
      this.handleError(error);
    });
  };

  handleError = (err) => {
    let errMsg = Utils.getErrorMsg(err, true);
    if (!err.response || err.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  onColorChange = (dtableColor) => {
    this.setState({ dtableColor, isChange: true });
  };

  onIconChange = (dtableIcon) => {
    this.setState({ dtableIcon, isChange: true });
  };

  onNameChange = (dtableName) => {
    this.setState({ dtableName, isChange: true });
  };

  render() {
    const { dtableName, dtableIcon, dtableColor } = this.state;
    return (
      <div
        className={'virtual-table table-item tr-highlight'}
        id="create-base"
      >
        <DTableItem dtableColor={''} dtableIcon={''} />
        <div className="table-name">{gettext('Untitled base')}</div>
        {this.state.isDataLoaded && (
          <DtableSettingPopover
            placement='bottom-start'
            popoverClassName='virtual-table-icon-settings'
            tableIconSettingsId={'create-base'}
            onTableIconToggle={this.onCreateTable}
            dtableName={dtableName}
            dtableColor={dtableColor}
            dtableIcon={dtableIcon}
            onColorChange={this.onColorChange}
            onIconChange={this.onIconChange}
            onNameChange={this.onNameChange}
          />
        )}
      </div>
    );
  }
}

VirtualDtable.propTypes = propTypes;

export default VirtualDtable;

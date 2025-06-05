import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import FormData from 'form-data';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { gettext, siteRoot, mediaUrl } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import DeletePluginDialog from '../../dtable/dialog/delete-plugin-dialog';
import Loading from '../../../components/loading';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const propTypes = {
  plugin: PropTypes.object.isRequired,
  onUpdatePlugin: PropTypes.func.isRequired,
  onDeletePlugin: PropTypes.func.isRequired,
};

class PluginInstalledItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowDeletePluginDialog: false,
      isMenuShow: false,
      pluginFile: '',
      isInstalling: false
    };

    this.fileInput = React.createRef();
  }

  toggleUpdatePlugin = (e) => {
    e.stopPropagation();
    this.fileInput.current.click();
  };

  toggleDeletePlugin = () => {
    this.setState({ isShowDeletePluginDialog: !this.state.isShowDeletePluginDialog });
  };

  updateMarketPlugin = () => {
    let { plugin } = this.props;
    let formData = new FormData();
    formData.append('plugin_name', plugin.info.name);
    formData.append('from_market', true);
    this.setState({ isInstalling: true });
    sysAdminServiceApi.sysAdminUpdatePlugin(plugin.id, formData).then(res => {
      let plugin = res.data;
      plugin.isUpdateable = false;
      this.props.onUpdatePlugin(plugin);
      this.setState({ isInstalling: false, isShowUpdateButton: false });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
      this.setState({ isInstalling: false, isShowUpdateButton: false });
    });
  };

  onUpdatePlugin = (event) => {
    let files = event.target.files;
    if (files.length === 0) {
      return;
    }
    let { plugin } = this.props;
    let formData = new FormData();
    formData.append('plugin', files[0]);
    sysAdminServiceApi.sysAdminUpdatePlugin(plugin.id, formData).then((res) => {
      let plugin = res.data;
      this.props.onUpdatePlugin(plugin);
      toaster.success(gettext('Plugin updated'));
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  onDeletePlugin = () => {
    let { plugin } = this.props;
    sysAdminServiceApi.sysAdminDeletePlugin(plugin.id).then(res => {
      this.props.onDeletePlugin(plugin);
      const msg = gettext('plugin {name} deleted.').replace('{name}', plugin.plugin_name);
      toaster.success(msg);
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  onFileInputClick = (e) => {
    e.nativeEvent.stopImmediatePropagation();
    e.stopPropagation();
  };

  onDropdownToggleClick = (e) => {
    this.setState({ isMenuShow: !this.state.isMenuShow });
  };

  render() {
    let { plugin } = this.props;
    let iconUrl = mediaUrl + 'plugins/default.png';
    if (plugin.info.has_icon) {
      iconUrl = `${siteRoot}dtable-plugins/${plugin.plugin_name}/?path=/media/icon.png`;
    }

    let bgStyle = null;
    if (plugin.info.has_card_image) {
      let card_image_url = `${siteRoot}dtable-plugins/${plugin.plugin_name}/?path=/media/card_image.png`;
      bgStyle = {
        backgroundImage: `url(${card_image_url})`,
        backgroundSize: 'cover',
      };
    }

    return (
      <Fragment>
        <div className="plugin-item">
          <div className="plugin-version">{plugin.info.version}</div>
          <input ref={this.fileInput} className="d-none" accept="Application/zip" type="file" onClick={this.onFileInputClick} onChange={this.onUpdatePlugin}/>
          <div className="plugin-item-icon" style={bgStyle}>
            {!bgStyle && <img src={iconUrl} width="60" alt="icon" />}
          </div>
          <div className="plugin-item-info">
            <div className="item-content">
              <div className="item-name">{Utils.getPluginName(plugin)}</div>
              {plugin.isUpdateable && (
                <span className="plugin-update-btn" onClick={this.updateMarketPlugin} >
                  {this.state.isInstalling ? <Loading /> : gettext('Updatable')}
                </span>
              )}
              <div className="item-op">
                <Dropdown className="dtable-dropdown-menu" isOpen={this.state.isMenuShow} toggle={this.onDropdownToggleClick}>
                  <DropdownToggle
                    tag="a"
                    role="button"
                    data-toggle="dropdown"
                    aria-expanded={this.state.isMenuShow}
                  >
                    <i
                      className="toggle-icon dtable-font dtable-icon-more-level"
                      title={gettext('More operations')}
                      aria-label={gettext('More operations')}
                    >
                    </i>
                  </DropdownToggle>
                  <DropdownMenu className="dtable-dropdown-menu dropdown-menu" end>
                    <DropdownItem onClick={this.toggleUpdatePlugin}>
                      <i className="item-icon dtable-font dtable-icon-update user-select-none"></i>
                      <span className="item-text">{gettext('Update')}</span>
                    </DropdownItem>
                    <DropdownItem onClick={this.toggleDeletePlugin}>
                      <i className="item-icon dtable-font dtable-icon-delete user-select-none"></i>
                      <span className="item-text">{gettext('Delete')}</span>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
            <div className="item-description text-truncate">{Utils.getPluginDescription(plugin)}</div>
          </div>
        </div>
        {this.state.isShowDeletePluginDialog && (
          <DeletePluginDialog
            plugin={plugin}
            handleSubmit={this.onDeletePlugin}
            deleteCancel={this.toggleDeletePlugin}
          />
        )}
      </Fragment>
    );
  }
}

PluginInstalledItem.propTypes = propTypes;

export default PluginInstalledItem;

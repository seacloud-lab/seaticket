import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { loginUrl, gettext, lang } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import Loading from '../../../components/loading';
import MainPanelTopbar from '../main-panel-topbar';
import PluginMarketDialog from './plugin-market-dialog';
import PluginsInstalledList from './plugins-installed-list';
import seaTableMarketAPI from '../../../utils/seatable-market-api';
import PluginNav from './plugin-nav';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

import '../../../css/system-plugins.css';

const PluginsPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class Plugins extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      plugins: [],
      marketPluginList: [],
      isPluginMarketDialogShow: false,
      seatableMarketUrl: lang === 'zh-cn' ? 'https://market.seatable.cn' : 'https://market.seatable.io'
    };

    this.fileInput = React.createRef();
  }

  async componentDidMount() {
    try {
      let installedRes = await sysAdminServiceApi.sysAdminListPlugins();
      this.setState({
        loading: false,
        plugins: installedRes.data.plugin_list,
      }, () => {
        this.listSeatableMarketPlugin();
      });
    } catch (error) {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else {
          this.setState({
            loading: false,
            errorMsg: gettext('Error')
          });
        }
      } else {
        this.setState({
          loading: false,
          errorMsg: gettext('Please check the network.')
        });
      }
    }
  }

  async listSeatableMarketPlugin() {
    try {
      let marketRes = await seaTableMarketAPI.listPlugins();
      let marketPluginList = marketRes.data.plugin_list.map(pluginItem => {
        let installedPlugin = this.state.plugins.find(plugin => plugin.info.name === pluginItem.name);
        pluginItem.installed = installedPlugin ? true : false;
        if (installedPlugin) {
          let isUpdateable = Utils.compareVersion(installedPlugin.info.version, pluginItem.version);
          installedPlugin.isUpdateable = isUpdateable;
        }
        return pluginItem;
      });
      this.setState({
        marketPluginList: marketPluginList,
      });
    } catch (error) {
      if (error.response && error.response.status === 403) {
        toaster.danger(gettext('Permission denied'));
      } else {
        toaster.danger(gettext('Unable to get latest plugins from SeaTable plugin market'));
      }
    }
  }

  togglePluginMarketDialog = () => {
    this.setState({ isPluginMarketDialogShow: !this.state.isPluginMarketDialogShow });
  };

  deletePlugin = (deletedPlugin) => {
    let plugins = this.state.plugins.filter(plugin => {
      return plugin.id !== deletedPlugin.id;
    });
    let marketPluginList = this.state.marketPluginList.map(plugin => {
      if (deletedPlugin.info.name === plugin.name) {
        plugin.installed = false;
      }
      return plugin;
    });
    this.setState({
      plugins: plugins,
      marketPluginList: marketPluginList
    });
  };

  updatePlugin = (newPlugin) => {
    let plugins = this.state.plugins;
    let pluginIndex = plugins.findIndex(plugin => plugin.id === newPlugin.id);
    plugins.splice(pluginIndex, 1, newPlugin);
    this.setState({ plugins: plugins });
  };

  openFileInput = () => {
    this.fileInput.current.click();
  };

  uploadPlugin = (e) => {

    // no file selected
    if (!this.fileInput.current.files.length) {
      return;
    }

    this.fileInput.current.files = null;

    let file = e.target.files[0];
    let formData = new FormData();
    formData.append('plugin', file);
    sysAdminServiceApi.sysAdminAddPlugin(formData).then((res) => {
      let newPlugin = res.data;
      let { plugins, marketPluginList } = this.state;
      plugins.push(newPlugin);

      let pluginInMarket = marketPluginList.find(plugin => newPlugin.info.name === plugin.name);
      if (pluginInMarket) {
        pluginInMarket.installed = true;
        newPlugin.isUpdateable = Utils.compareVersion(newPlugin.info.version, pluginInMarket.version);
      }

      this.setState({ plugins: plugins });
      toaster.success(gettext('Plugin uploaded'));
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error);
      toaster.danger(errMsg);
    });
  };

  onInstallPlugin = (newPlugin) => {
    let { plugins, marketPluginList } = this.state;
    // update market plugin state
    let newMarketPluginList = marketPluginList.map(plugin => {
      if (newPlugin.info.name === plugin.name) {
        plugin.installed = true;
      }
      return plugin;
    });

    // add into installed list
    plugins.push(newPlugin);

    this.setState({
      plugins: plugins,
      marketPluginList: newMarketPluginList
    });
  };

  render() {

    let { loading, errorMsg, plugins, marketPluginList } = this.state;

    return (
      <Fragment>
        <Fragment>
          <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}>
            <input className="d-none" type="file" onChange={this.uploadPlugin} ref={this.fileInput} />
            <button className="btn btn-secondary operation-item" onClick={this.openFileInput}>{gettext('Upload plugin')}</button>
            <button className="btn btn-secondary operation-item" onClick={this.togglePluginMarketDialog}>{gettext('Import plugin from market')}</button>
          </MainPanelTopbar>
          <div className="main-panel-center flex-row">
            <div className="cur-view-container">
              <PluginNav currentItem='plugins' />
              <div className="cur-view-content">
                {loading && <Loading />}
                {(!loading && errorMsg) && <p className="error text-center">{errorMsg}</p>}
                {(!loading && !errorMsg) && (
                  <PluginsInstalledList
                    plugins={plugins}
                    onDeletePlugin={this.deletePlugin}
                    onUpdatePlugin={this.updatePlugin}
                  />
                )}
              </div>
            </div>
          </div>
        </Fragment>
        {this.state.isPluginMarketDialogShow && (
          <PluginMarketDialog
            marketPluginList={marketPluginList}
            toggle={this.togglePluginMarketDialog}
            onInstallPlugin={this.onInstallPlugin}
            seatableMarketUrl={this.state.seatableMarketUrl}
          />
        )}
      </Fragment>
    );
  }
}

Plugins.propTypes = PluginsPropTypes;

export default Plugins;

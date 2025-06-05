import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import { gettext, mediaUrl } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const propTypes = {
  plugin: PropTypes.object.isRequired,
  onInstallPlugin: PropTypes.func.isRequired,
  seatableMarketUrl: PropTypes.string,
};

class PluginMarketItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isInstalling: false,
    };
  }

  onInstallPlugin = () => {
    let { plugin } = this.props;
    this.setState({ isInstalling: true });
    let formData = new FormData();
    formData.append('plugin_name', plugin.name);
    formData.append('from_market', true);
    sysAdminServiceApi.sysAdminAddPlugin(formData).then((res) => {
      let installedNewPlugin = res.data;
      this.props.onInstallPlugin(installedNewPlugin);
      this.setState({ isInstalling: false });
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error);
      toaster.danger(errMsg);
    });
  };

  render() {
    let { plugin, seatableMarketUrl } = this.props;
    let server = seatableMarketUrl.replace(/\/+$/, '');
    let iconUrl = mediaUrl + 'plugins/default.png';

    let bgStyle = null;
    if (plugin.card_image_url) {
      let card_image_url = server + plugin.card_image_url;
      bgStyle = {
        backgroundImage: `url(${card_image_url})`,
        backgroundSize: 'cover',
      };
    }
    const pluginVersion = plugin.version;
    return (
      <div className="plugin-item">
        {pluginVersion && <div className="plugin-version">{plugin.version}</div>}
        <div className="plugin-item-icon" style={bgStyle}>
          {!bgStyle && <img src={iconUrl} width="60" alt="icon" />}
        </div>
        <div className="plugin-item-info">
          <div className="item-content">
            <div className="item-name">{plugin.display_name}</div>
            <button
              className="btn btn-primary"
              onClick={this.onInstallPlugin}
              disabled={plugin.installed}
            >
              {this.state.isInstalling && (<Loading />)}
              {!this.state.isInstalling && (
                <Fragment>
                  {plugin.installed ? gettext('Installed') : gettext('Install')}
                </Fragment>
              )}
            </button>
          </div>
          <div className="item-description text-truncate">{plugin.description}</div>
        </div>
      </div>
    );
  }
}

PluginMarketItem.propTypes = propTypes;

export default PluginMarketItem;

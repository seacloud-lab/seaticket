import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import PluginMarketItem from './plugin-market-item';
import { gettext } from '../../../utils/constants';

const propTypes = {
  marketPluginList: PropTypes.array.isRequired,
  onInstallPlugin: PropTypes.func.isRequired,
  seatableMarketUrl: PropTypes.string,
};

class PluginsMarketList extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    let { marketPluginList } = this.props;

    if (!marketPluginList.length) {
      return <div className="no-content-tip"><h2>{gettext('No plugins')}</h2></div>;
    }

    return (
      <Fragment>
        {this.props.marketPluginList.map((plugin, index) => {
          return (
            <PluginMarketItem
              key={index}
              plugin={plugin}
              onInstallPlugin={this.props.onInstallPlugin}
              seatableMarketUrl={this.props.seatableMarketUrl}
            />
          );
        })}
        {/* placeholder */}
        <div className="plugin-item border-0"></div>
        <div className="plugin-item border-0"></div>
        <div className="plugin-item border-0"></div>
      </Fragment>
    );
  }
}

PluginsMarketList.propTypes = propTypes;

export default PluginsMarketList;

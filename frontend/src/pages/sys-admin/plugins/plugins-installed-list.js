import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { gettext, mediaUrl } from '../../../utils/constants';
import PluginInstalledItem from './plugin-installed-item';
import { DTableEmptyTip } from 'dtable-ui-component';

const propTypes = {
  plugins: PropTypes.array.isRequired,
  onDeletePlugin: PropTypes.func.isRequired,
  onUpdatePlugin: PropTypes.func.isRequired,
};

class PluginsInstalledList extends Component {

  render() {
    const { plugins } = this.props;

    if (plugins.length === 0) {
      return (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No plugins')} />
      );
    }

    return (
      <div className="plugin-installed-container">
        {plugins.map(plugin => {
          return (
            <PluginInstalledItem
              key={plugin.id}
              plugin={plugin}
              onDeletePlugin={this.props.onDeletePlugin}
              onUpdatePlugin={this.props.onUpdatePlugin}
            />
          );
        })}
        {/* placeholder */}
        <div className="plugin-item border-0"></div>
        <div className="plugin-item border-0"></div>
        <div className="plugin-item border-0"></div>
        <div className="plugin-item border-0"></div>
      </div>
    );
  }
}

PluginsInstalledList.propTypes = propTypes;

export default PluginsInstalledList;

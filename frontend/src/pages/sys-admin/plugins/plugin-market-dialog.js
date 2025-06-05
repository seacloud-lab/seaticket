import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import PluginsMarketList from './plugins-market-list';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  marketPluginList: PropTypes.array.isRequired,
  onInstallPlugin: PropTypes.func.isRequired,
  toggle: PropTypes.func.isRequired,
  seatableMarketUrl: PropTypes.string,
};

class PluginMarketDialog extends React.Component {

  toggle = () => {
    this.props.toggle();
  };

  render() {
    const { marketPluginList, seatableMarketUrl } = this.props;

    return (
      <Modal isOpen={true} toggle={this.toggle} size="lg" className="dtable-plugins-manager-dialog" contentClassName="dtable-plugins-manager-content">
        <DTableModalHeader toggle={this.toggle}>{gettext('Plugin market')}</DTableModalHeader>
        <ModalBody className="plugins-manager-container">
          {!seatableMarketUrl && (
            <div className="no-content-tip">{gettext('Please add seatable market configs.')}</div>
          )}
          {seatableMarketUrl &&
            <PluginsMarketList
              marketPluginList={marketPluginList}
              onInstallPlugin={this.props.onInstallPlugin}
              seatableMarketUrl={this.props.seatableMarketUrl}
            />
          }
        </ModalBody>
      </Modal>
    );
  }
}

PluginMarketDialog.propTypes = propTypes;

export default PluginMarketDialog;

import React, { Component } from 'react';
import { List } from 'antd-mobile';
import PropTypes from 'prop-types';
import MobileCommonHeader from '../../../pages/dtable/mobile/mobile-common-header';

const gettext = window.gettext;
const Item = List.Item;

class MoreNodeSettingsView extends Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedNodeId: null
    };
  }

  onSelectTaskNode = (id) => {
    if (id === this.state.selectedNodeId) return;
    this.setState({ selectedNodeId: id });
  };

  onSubmit = () => {
    const { selectedNodeId } = this.state;
    if (selectedNodeId) {
      this.props.onMoveTaskNode(selectedNodeId);
    }
  };

  render() {
    const { otherNodes } = this.props;
    const { selectedNodeId } = this.state;
    return (
      <div className="workflow-list-view">
        <MobileCommonHeader
          title={gettext('Move to node...')}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
          onLeftClick={this.props.toggleNodeSettingView}
          onRightClick={this.onSubmit}
        />
        <List renderHeader={() => gettext('Move task to a specific node')}>
          {otherNodes.map((node, index) => {
            const id = node._id;
            return (
              <Item
                key={`node-id-${index}`}
                onClick={this.onSelectTaskNode.bind(this, id)}
                extra={selectedNodeId === id ? <span className="dtable-font dtable-icon-check-mark"></span> : ''}
              >
                <span>{node.name}</span>
              </Item>
            );
          })}
        </List>
      </div>
    );
  }
}

MoreNodeSettingsView.propTypes = {
  otherNodes: PropTypes.array,
  onMoveTaskNode: PropTypes.func,
  toggleNodeSettingView: PropTypes.func,
};

export default MoreNodeSettingsView;

import React from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import classnames from 'classnames';
import WorkflowNodeDropdown from '../dropdown/workflow-node-dropdown';
import { NODE_TYPE, NODE_WIDTH, NODE_HEIGHT, NODE_Z_INDEX } from '../../constants';

import '../../css/workflow-nodes.css';

class WorkflowNode extends React.Component {

  constructor(props) {
    super(props);
    const { currentNode } = props;
    this.state = {
      isShowRename: false,
      nodeName: currentNode.name,
    };
    this.nodeNameRef = null;
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const nextNodeName = nextProps.currentNode.name;
    if (nextNodeName !== this.state.nodeName) {
      this.setState({ nodeName: nextNodeName });
    }
  }

  onClick = (event) => {
    if (this.props.readonly) return;
    event.stopPropagation();
    this.props.setSelectedNode(this.props.currentNode);
  };

  onDoubleClick = (event) => {
    if (this.props.readonly) return;
    event.stopPropagation();
    this.setState({ isShowRename: true });
  };

  onDeleteNode = () => {
    this.props.onDeleteNode(this.props.currentNode);
  };

  onCopyNode = () => {
    this.props.onCopyNode(this.props.currentNode);
  };

  onAddNode = () => {
    this.props.onAddNode(this.props.currentNode);
  };

  onNodeNameChange = (event) => {
    const newName = event.target.value;
    if (newName === this.state.nodeName) return;
    this.setState({ nodeName: newName });
  };

  onNodeNameKeyDown = (event) => {
    if (isHotkey('enter', event)) {
      this.nodeNameRef.blur();
    }
  };

  onUpdateNodeName = () => {
    this.setState({ isShowRename: false });
    const { currentNode } = this.props;
    const { name: oldNodeName } = currentNode;
    const { nodeName } = this.state;
    const validNodeName = nodeName ? nodeName.trim() : '';
    if (!validNodeName) {
      this.setState({ nodeName: oldNodeName });
      return;
    }
    if (validNodeName === oldNodeName) return;
    this.props.onUpdateNode({ ...currentNode, name: validNodeName });
  };

  renderMoreOperation = () => {
    const { currentNode, isSelectedNode, readonly } = this.props;
    if (readonly) return null;
    if (!isSelectedNode) return null;
    if (currentNode.type === NODE_TYPE.INIT
      || currentNode.type === NODE_TYPE.COMPLETED
      || currentNode.type === NODE_TYPE.CANCELED
    ) return null;
    return (
      <WorkflowNodeDropdown
        onDeleteNode={this.onDeleteNode}
        onCopyNode={this.onCopyNode}
      />
    );
  };

  renderParticipants = () => {
    const { currentNode, workflowRelatedUsers } = this.props;
    if (currentNode.participants_type === 'dynamic') return [];
    const participants = currentNode.participants || [];
    return participants.map(email => {
      let item = workflowRelatedUsers.find(user => user.email === email);
      if (!item) return null;
      return (
        <img key={email} className="collaborator-avatar mr-1" alt={item.name} src={item.avatar_url}/>
      );
    });
  };

  renderNode = () => {
    const { isShowRename, nodeName } = this.state;
    if (isShowRename) {
      return (
        <input
          className="form-control rename-workflow-node"
          autoFocus={true}
          ref={ref => this.nodeNameRef = ref}
          type="text"
          value={nodeName}
          onChange={this.onNodeNameChange}
          onKeyDown={this.onNodeNameKeyDown}
          onBlur={this.onUpdateNodeName}
        />
      );
    }
    return (
      <>
        <div className="workflow-app-node-participants">{this.renderParticipants()}</div>
        <div className="workflow-app-node-name-content" title={nodeName}>
          {nodeName}
        </div>
        {this.renderMoreOperation()}
      </>
    );
  };

  render() {
    const { isSelectedNode, readonly, style } = this.props;
    const { isShowRename } = this.state;

    return (
      <>
        <div
          className={classnames('workflow-app-node position-relative d-flex align-items-center justify-content-between', {
            'selected': isSelectedNode,
            'readonly': readonly,
            'editing-name p-0': isShowRename
          })}
          onClick={this.onClick}
          onDoubleClick={this.onDoubleClick}
          style={{
            ...style,
            height: NODE_HEIGHT,
            width: NODE_WIDTH,
            zIndex: NODE_Z_INDEX
          }}
        >
          {this.renderNode()}
        </div>
      </>
    );
  }
}

WorkflowNode.propTypes = {
  isSelectedNode: PropTypes.bool,
  readonly: PropTypes.bool,
  style: PropTypes.object,
  currentNode: PropTypes.object,
  setSelectedNode: PropTypes.func,
  onDeleteNode: PropTypes.func,
  onAddNode: PropTypes.func,
  onCopyNode: PropTypes.func,
  onUpdateNode: PropTypes.func,
  workflowRelatedUsers: PropTypes.array,
};

WorkflowNode.defaultProps = {
  readonly: false,
  workflowRelatedUsers: [],
};

export default WorkflowNode;

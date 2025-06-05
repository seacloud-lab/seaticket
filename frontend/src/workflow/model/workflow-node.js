import Point from './point';
import { NODE_WIDTH, NODE_WIDTH_GAP, NODE_HEIGHT, NODE_HEIGHT_GAP, NODE_DIRECTION } from '../constants';

class WorkflowNode {

  constructor(node) {
    this._id = node._id;
    this.node = node; // old node obj
    this.nextNode = null;
    this.conditionalNextNodes = [];
    this.nextNodes = [];
    this.loc = new Point(0, 0);
    this.anchorPoint = {
      'top': new Point(0, 0),
      'right': new Point(0, 0),
      'bottom': new Point(0, 0),
      'left': new Point(0, 0),
    };
  }

  initOthers = (id2Node) => {
    let { next_node_id, conditional_next_nodes } = this.node;
    this.nextNode = next_node_id ? id2Node[next_node_id] : null;
    let validConditionalNextNodeIds = [];
    const conditionalNextNodeIds = Array.isArray(conditional_next_nodes) ? conditional_next_nodes.map(item => item.next_node_id) : [];
    conditionalNextNodeIds.forEach(nodeId => {
      if (nodeId && !validConditionalNextNodeIds.includes(nodeId)) {
        validConditionalNextNodeIds.push(nodeId);
      }
    });
    this.conditionalNextNodes = validConditionalNextNodeIds.map(item => id2Node[item]).filter(item => item);
  };

  _updateAnchorPoint = () => {
    const { x, y } = this.loc;
    const xCenter = parseInt(x + NODE_WIDTH / 2);
    const yCenter = parseInt(y + NODE_HEIGHT / 2);
    this.anchorPoint.top = new Point(xCenter, y);
    this.anchorPoint.right = new Point(x + NODE_WIDTH, yCenter);
    this.anchorPoint.bottom = new Point(xCenter, y + NODE_HEIGHT);
    this.anchorPoint.left = new Point(x, yCenter);
  };

  updateLoc = (pathIdx, nodeIdx, nodeDirection) => {
    if (nodeDirection === NODE_DIRECTION.TB) {
      this.loc.x = pathIdx * (NODE_WIDTH + NODE_WIDTH_GAP);
      this.loc.y = nodeIdx * (NODE_HEIGHT + NODE_HEIGHT_GAP);
    } else {
      this.loc.x = nodeIdx * (NODE_WIDTH + NODE_WIDTH_GAP);
      this.loc.y = pathIdx * (NODE_HEIGHT + NODE_HEIGHT_GAP);
    }
    this._updateAnchorPoint();
  };

}

export default WorkflowNode;

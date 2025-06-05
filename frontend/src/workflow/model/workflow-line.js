import Point from './point';
import { NODE_WIDTH, HALF_NODE_WIDTH_GAP, NODE_HEIGHT, HALF_NODE_HEIGHT_GAP, ARROW_DIRECTION } from '../constants';

const generateLineId = (from, to) => {
  return `${from}---${to}`;
};

const getStartAndEndPoint = (fromNode, toNode) => {
  if (!fromNode || !toNode) return {};
  const nodeXDiff = toNode.loc.x - fromNode.loc.x;
  const nodeYDiff = toNode.loc.y - fromNode.loc.y;
  if (nodeXDiff > 0) {
    if (nodeYDiff > 0) {
      return {
        startPoint: fromNode.anchorPoint.bottom,
        endPoint: toNode.anchorPoint.top,
        arrowDirection: ARROW_DIRECTION.BOTTOM,
      };
    }
    if (nodeYDiff < 0) {
      return {
        startPoint: fromNode.anchorPoint.top,
        endPoint: toNode.anchorPoint.bottom,
        arrowDirection: ARROW_DIRECTION.TOP,
      };
    }
    return {
      startPoint: fromNode.anchorPoint.right,
      endPoint: toNode.anchorPoint.left,
      arrowDirection: ARROW_DIRECTION.RIGHT,
    };
  }
  if (nodeXDiff < 0) {
    if (nodeYDiff > 0) {
      return {
        startPoint: fromNode.anchorPoint.bottom,
        endPoint: toNode.anchorPoint.top,
        arrowDirection: ARROW_DIRECTION.BOTTOM,
      };
    }
    if (nodeYDiff < 0) {
      return {
        startPoint: fromNode.anchorPoint.top,
        endPoint: toNode.anchorPoint.bottom,
        arrowDirection: ARROW_DIRECTION.TOP,
      };
    }
    return {
      startPoint: fromNode.anchorPoint.left,
      endPoint: toNode.anchorPoint.right,
      arrowDirection: ARROW_DIRECTION.LEFT,
    };
  }
  if (nodeYDiff > 0) {
    return {
      startPoint: fromNode.anchorPoint.bottom,
      endPoint: toNode.anchorPoint.top,
      arrowDirection: ARROW_DIRECTION.BOTTOM,
    };
  }
  return {
    startPoint: fromNode.anchorPoint.top,
    endPoint: toNode.anchorPoint.bottom,
    arrowDirection: ARROW_DIRECTION.TOP,
  };
};

const isHitNode = (startPoint, endPoint, nodes) => {
  const xDiff = Math.abs(endPoint.x - startPoint.x);
  const yDiff = Math.abs(endPoint.y - startPoint.y);
  const minY = Math.min(startPoint.y, endPoint.y);
  const maxY = Math.max(startPoint.y, endPoint.y);
  const minX = Math.min(startPoint.x, endPoint.x);
  const maxX = Math.max(startPoint.x, endPoint.x);

  if (xDiff === 0) {
    const x = minX;
    const node = nodes.find(node => (node.loc.x < x && x < node.loc.x + NODE_WIDTH) &&
      ((minY < node.loc.y && node.loc.y + NODE_HEIGHT < maxY) || (minY > node.loc.y && node.loc.y + NODE_HEIGHT > minY) || (maxY > node.loc.y && node.loc.y + NODE_HEIGHT > maxY)));
    return node ? true : false;
  }
  if (yDiff === 0) {
    const y = minY;
    const node = nodes.find(node => (node.loc.y < y && y < node.loc.y + NODE_HEIGHT) &&
      ((minX < node.loc.x && node.loc.x + NODE_WIDTH < maxX) || (minX > node.loc.x && minX < node.loc.x + NODE_WIDTH) || (maxX > node.loc.x && maxX < node.loc.x + NODE_WIDTH)));
    return node ? true : false;
  }
  return false;
};


class WorkflowLine {

  constructor({ from, to, isCondition }) {
    this.id = generateLineId(from, to);
    this.from = from;
    this.to = to;
    this.isCondition = isCondition;
    this.route = [];
    this.addLoc = new Point(0, 0);
    this.arrowDirection = ARROW_DIRECTION.RIGHT;
  }

  isValid = (mainNodeIds = [], lineIds = []) => {
    if (!Array.isArray(mainNodeIds) || mainNodeIds.length === 0) return false;
    if (lineIds.includes(this.id)) return false;
    if (mainNodeIds.includes(this.from) && mainNodeIds.includes(this.to)) return true;
    return false;
  };

  computeRoute = (id2Node) => {
    this.route = [];
    const fromNode = id2Node[this.from];
    if (!fromNode) return;
    const toNode = id2Node[this.to];
    if (!toNode) return;
    if (fromNode.loc.x === toNode.loc.x && fromNode.loc.y === toNode.loc.y) return;
    const nodes = Object.values(id2Node);
    let { startPoint, endPoint, arrowDirection } = getStartAndEndPoint(fromNode, toNode, nodes);
    this.arrowDirection = arrowDirection;

    const xDiff = endPoint.x - startPoint.x;
    const yDiff = endPoint.y - startPoint.y;
    if ((xDiff === 0 || yDiff === 0) && !isHitNode(startPoint, endPoint, nodes)) {
      this.route.push(startPoint);
      this.route.push(endPoint);
      return;
    }

    if (yDiff === 0 && isHitNode(startPoint, endPoint, nodes)) {
      startPoint = fromNode.anchorPoint.bottom;
      endPoint = toNode.anchorPoint.bottom;
      this.arrowDirection = ARROW_DIRECTION.TOP;
      this.route.push(startPoint);
      this.route.push(new Point(startPoint.x, startPoint.y + HALF_NODE_HEIGHT_GAP));
      this.route.push(new Point(endPoint.x, startPoint.y + HALF_NODE_HEIGHT_GAP));
      this.route.push(endPoint);
      return;
    }

    if (xDiff === 0 && isHitNode(startPoint, endPoint, nodes)) {
      startPoint = fromNode.anchorPoint.right;
      endPoint = toNode.anchorPoint.right;
      this.arrowDirection = ARROW_DIRECTION.LEFT;
      this.route.push(startPoint);
      this.route.push(new Point(startPoint.x + HALF_NODE_WIDTH_GAP, startPoint.y));
      this.route.push(new Point(startPoint.x + HALF_NODE_WIDTH_GAP, endPoint.y));
      this.route.push(endPoint);
      return;
    }

    // first choice
    const firstChoiceStartPoint = xDiff > 0 ? fromNode.anchorPoint.right : fromNode.anchorPoint.left;
    const firstChoiceEndPoint = yDiff > 0 ? toNode.anchorPoint.top : toNode.anchorPoint.bottom;
    const firstChoiceTurningPoint = new Point(firstChoiceEndPoint.x, firstChoiceStartPoint.y);
    if (!isHitNode(firstChoiceStartPoint, firstChoiceTurningPoint, nodes) && !isHitNode(firstChoiceTurningPoint, firstChoiceEndPoint, nodes)) {
      this.arrowDirection = yDiff > 0 ? ARROW_DIRECTION.BOTTOM : ARROW_DIRECTION.TOP;
      this.route.push(firstChoiceStartPoint);
      this.route.push(firstChoiceTurningPoint);
      this.route.push(firstChoiceEndPoint);
      return;
    }

    // second choice
    const secondChoiceStartPoint = yDiff > 0 ? fromNode.anchorPoint.bottom : fromNode.anchorPoint.top;
    const secondChoiceEndPoint = xDiff > 0 ? toNode.anchorPoint.left : toNode.anchorPoint.right;
    const secondChoiceTurningPoint = new Point(secondChoiceStartPoint.x, secondChoiceEndPoint.y);
    if (!isHitNode(secondChoiceStartPoint, secondChoiceTurningPoint, nodes) && !isHitNode(secondChoiceTurningPoint, secondChoiceEndPoint, nodes)) {
      this.arrowDirection = xDiff > 0 ? ARROW_DIRECTION.RIGHT : ARROW_DIRECTION.LEFT;
      this.route.push(secondChoiceStartPoint);
      this.route.push(secondChoiceTurningPoint);
      this.route.push(secondChoiceEndPoint);
      return;
    }

    const xDisplacement = xDiff > 0 ? HALF_NODE_WIDTH_GAP : -1 * HALF_NODE_WIDTH_GAP;
    const yDisplacement = yDiff > 0 ? -1 * HALF_NODE_HEIGHT_GAP : HALF_NODE_HEIGHT_GAP;

    // third choice
    const thirdChoiceStartPoint = xDiff > 0 ? fromNode.anchorPoint.right : fromNode.anchorPoint.left;
    const thirdChoiceEndPoint = xDiff > 0 ? toNode.anchorPoint.left : toNode.anchorPoint.right;
    const thirdChoiceTurningPoint = new Point(thirdChoiceEndPoint.x - xDisplacement, thirdChoiceStartPoint.y);
    if (!isHitNode(thirdChoiceStartPoint, thirdChoiceTurningPoint, nodes)) {
      this.arrowDirection = xDiff > 0 ? ARROW_DIRECTION.RIGHT : ARROW_DIRECTION.LEFT;
      this.route.push(thirdChoiceStartPoint);
      this.route.push(thirdChoiceTurningPoint);
      this.route.push(new Point(thirdChoiceTurningPoint.x, thirdChoiceEndPoint.y));
      this.route.push(thirdChoiceEndPoint);
      return;
    }

    // fourth choice
    const fourthChoiceTurningPoint = new Point(startPoint.x, endPoint.y + yDisplacement);
    if (!isHitNode(startPoint, fourthChoiceTurningPoint, nodes)) {
      this.route.push(startPoint);
      this.route.push(fourthChoiceTurningPoint);
      this.route.push(new Point(endPoint.x, endPoint.y + yDisplacement));
      this.route.push(endPoint);
      return;
    }

    // fifth choice
    const fifthChoiceStartPoint = xDiff > 0 ? fromNode.anchorPoint.right : fromNode.anchorPoint.left;
    this.route.push(fifthChoiceStartPoint);
    this.route.push(new Point(fifthChoiceStartPoint.x + xDisplacement, fifthChoiceStartPoint.y));
    this.route.push(new Point(fifthChoiceStartPoint.x + xDisplacement, endPoint.y + yDisplacement));
    this.route.push(new Point(endPoint.x, endPoint.y + yDisplacement));
    this.route.push(endPoint);
  };

  computeAddLoc = () => {
    const routeCount = this.route.length;
    let maxLineStartPoint = this.route[0];
    let maxLineEndPoint = this.route[1];
    let maxLineIndex = 0;
    let lastLineLength = Math.abs(maxLineEndPoint.x - maxLineStartPoint.x) + Math.abs(maxLineEndPoint.y - maxLineStartPoint.y);
    for (let i = 1; i < routeCount; i++) {
      const lastPoint = this.route[i - 1];
      const nextPoint = this.route[i];
      const nextLineLength = Math.abs(nextPoint.x - lastPoint.x) + Math.abs(nextPoint.y - lastPoint.y);
      if (nextLineLength > lastLineLength) {
        maxLineIndex = i;
        lastLineLength = nextLineLength;
        maxLineStartPoint = lastPoint;
        maxLineEndPoint = nextPoint;
      }
    }
    const xDiff = maxLineEndPoint.x - maxLineStartPoint.x;
    const yDiff = maxLineEndPoint.y - maxLineStartPoint.y;
    let xDisplacement = 0;
    if (maxLineIndex === routeCount - 2) { // min count: 2
      if (yDiff === 0) {
        xDisplacement = this.arrowDirection === ARROW_DIRECTION.LEFT ? 6 : -6;
      }
    }
    this.addLoc = new Point(maxLineStartPoint.x + xDiff / 2 + xDisplacement, maxLineStartPoint.y + yDiff / 2);
  };

}

export default WorkflowLine;

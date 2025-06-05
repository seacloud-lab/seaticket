import { generateId, findLastExistNodeIndex } from './utils';
import { NODE_TYPE, NODE_DIRECTION } from '../constants';
import WorkflowLine from '../model/workflow-line';
import WorkflowNode from '../model/workflow-node';

const initNodes = (nodes) => {
  let id2Node = {};
  if (!Array.isArray(nodes) || nodes.length === 0) return id2Node;
  nodes.forEach(node => {
    const nodeId = node._id;
    id2Node[nodeId] = new WorkflowNode(node);
  });
  for (let key in id2Node) {
    let node = id2Node[key];
    node.initOthers(id2Node);
  }
  return id2Node;
};

const updatePaths = (paths, pathIdx, id2Node, startNodeId) => {
  const startNode = id2Node[startNodeId];
  if (!startNode) return;
  const currentPath = [...paths[pathIdx]];
  if (startNode.nextNode && !currentPath.includes(startNode.nextNode._id)) {
    paths[pathIdx].push(startNode.nextNode._id);
    updatePaths(paths, pathIdx, id2Node, startNode.nextNode._id);
  }
  if (startNode.conditionalNextNodes) {
    startNode.conditionalNextNodes.forEach(nextNode => {
      if (!currentPath.includes(nextNode._id)) {
        const newPath = [...currentPath, nextNode._id];
        paths.push(newPath);
        const newPathIdx = paths.length - 1;
        updatePaths(paths, newPathIdx, id2Node, nextNode._id);
      }
    });
  }
};

const getPaths = (id2Node) => {
  let paths = [];
  paths[0] = [NODE_TYPE.INIT];
  updatePaths(paths, 0, id2Node, NODE_TYPE.INIT);
  return paths;
};

const getLines = (id2Node, mainNodeIds) => {
  let lines = [];
  let lineIds = [];
  for (let key in id2Node) {
    const node = id2Node[key];
    const nextNode = node.nextNode;
    const conditionalNextNodes = node.conditionalNextNodes;
    if (nextNode) {
      let line = new WorkflowLine({ from: key, to: nextNode._id, isCondition: false });
      if (line.isValid(mainNodeIds, lineIds)) {
        lineIds.push(line.id);
        line.computeRoute(id2Node);
        line.computeAddLoc();
        lines.push(line);
      }
    }
    if (conditionalNextNodes.length > 0) {
      conditionalNextNodes.forEach(conditionNextNode => {
        let line = new WorkflowLine({ from: key, to: conditionNextNode._id, isCondition: true });
        if (line.isValid(mainNodeIds, lineIds)) {
          lineIds.push(line.id);
          line.computeRoute(id2Node);
          line.computeAddLoc();
          lines.push(line);
        }
      });
    }
  }
  return lines;
};

const getDisplayPathsAndNodeIds = (paths, id2Node, nodeDirection) => {
  let mainNodeIds = [];
  let displayPathsArray = [];
  paths.forEach((paths, pathIdx) => {
    displayPathsArray[pathIdx] = [];
    paths.forEach(nodeId => {
      if (mainNodeIds.includes(nodeId)) {
        displayPathsArray[pathIdx].push(null);
      } else {
        const node = id2Node[nodeId];
        displayPathsArray[pathIdx].push(node);
        mainNodeIds.push(nodeId);
      }
    });
  });

  const displayPaths = displayPathsArray
    .filter(paths => !paths.every(node => !node))
    .map((paths, pathIdx) => {
      return paths.map((node, nodeIdx) => {
        if (!node) return null;
        node.updateLoc(pathIdx, nodeIdx, nodeDirection);
        return node.node;
      });
    })
    .map(path => {
      const lastNodeIndex = findLastExistNodeIndex(path);
      if (lastNodeIndex === path.length - 1) return path;
      return path.slice(0, lastNodeIndex + 1);
    });
  return { displayPaths, mainNodeIds };
};

/**
 *
 * @param {*} nodes: array
 * @param {*} mainWorkflowDirection: TB or LR
 * @returns
 */
export const getWorkflowPathsAndLines = (nodes, nodeDirection = NODE_DIRECTION.TB) => {
  const validNodeDirection = nodeDirection ? nodeDirection.toUpperCase() : NODE_DIRECTION.TB;
  const id2Node = initNodes(nodes);
  const paths = getPaths(id2Node);
  const { displayPaths, mainNodeIds } = getDisplayPathsAndNodeIds(paths, id2Node, validNodeDirection);
  const lines = getLines(id2Node, mainNodeIds);
  return {
    paths: displayPaths,
    otherNodes: nodes.filter(node => !mainNodeIds.includes(node._id)),
    lines
  };
};

export const generatorConditionalNextNode = (conditionalNextNodes = []) => {
  let conditionalNextNodeId = generateId();
  while (conditionalNextNodes.find(node => node._id === conditionalNextNodeId)) {
    conditionalNextNodeId = generateId();
  }
  return {
    _id: conditionalNextNodeId,
    next_node_id: '',
    filters: [],
    filter_conjunction: 'And'
  };
};

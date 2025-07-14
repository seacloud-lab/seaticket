import React from 'react';
import Node from '../node';

const NodeGroup = ({ node, activeNode, level = 0, toggleNode }) => {
  const { name, children = [] } = node;

  return (
    <>
      {name && <Node node={node} activeNode={activeNode} level={level} onClick={toggleNode} />}
      {children.length > 0 && children.map(n => (<NodeGroup node={n} key={n.key} activeNode={activeNode} level={level + 1} toggleNode={toggleNode} />))}
    </>
  );
};

export default NodeGroup;

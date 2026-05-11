import React from 'react';

import './index.css';

const CustomizeLinkReference = ({ element, onClick, attributes, editor }) => {
  return (
    <span
      onClick={onClick}
      className="sea-ai-chat-customize-link-reference"
      data-id={element.id}
      {...attributes}
      title={element.label}
    >
      {element.identifier}
    </span>
  );
};

export default CustomizeLinkReference;

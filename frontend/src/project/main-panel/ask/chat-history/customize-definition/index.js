import React from 'react';
import Definition from './definition';
import MoreDefinition from './more-definition';

import './index.css';

const CustomizeDefinition = ({ element, sources, ...props }) => {
  if (!element) return null;
  if (!Array.isArray(sources) || sources.length === 0) return null;

  if (sources.length < 4) {
    return (
      <Definition element={element} sources={sources} { ...props }/>
    );
  }

  const identifier = Number(element.identifier);
  if (identifier < 4) {
    return (
      <Definition element={element} sources={sources} { ...props } />
    );
  }

  if (identifier === 4) {
    return (
      <>
        <MoreDefinition sources={sources} { ...props } />
        <div data-id={element.id} { ...props?.attributes } className="sea-ai-chat-customize-definition-hidden"></div>
      </>
    );
  }

  return (
    <div data-id={element.id} { ...props?.attributes } className="sea-ai-chat-customize-definition-hidden"></div>
  );
};

export default CustomizeDefinition;

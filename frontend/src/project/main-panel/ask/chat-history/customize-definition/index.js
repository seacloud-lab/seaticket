import React, { useMemo } from 'react';
import { getNodePathById } from '@seafile/seafile-editor/dist/extension';
import { getNode } from '@seafile/seafile-editor/dist/extension/core/queries';
import Definition from './definition';
import MoreDefinition from './more-definition';

import './index.css';

const CustomizeDefinition = ({ element, sources, ...props }) => {
  const isValid = useMemo(() => {
    if (!element) return false;
    if (!Array.isArray(sources) || sources.length === 0) return false;
    return true;
  }, [element, sources]);
  const identifier = useMemo(() => isValid ? Number(element.identifier) : -1, [isValid, element]);

  const className = useMemo(() => {
    if (!isValid) return '';
    const identifierIndex = identifier - 1;
    try {
      let path = getNodePathById(props.editor, element.id);
      path[path.length - 1] = path[path.length - 1] - identifierIndex;
      const lastElementPath = [path[0] - 1];
      const lastElement = getNode(props.editor, lastElementPath);
      let _className = '';
      if (lastElement && ['table', 'ul', 'ol'].includes(lastElement?.type)) {
        _className = 'mt-3';
      }
      return _className;
    } catch {
      return '';
    }
  }, [isValid, identifier, element]);


  if (!isValid) return null;

  if (sources.length < 4) {
    return (
      <Definition element={element} sources={sources} className={className} { ...props }/>
    );
  }

  if (identifier < 4) {
    return (
      <Definition element={element} sources={sources} className={className} { ...props } />
    );
  }

  if (identifier === 4) {
    return (
      <>
        <MoreDefinition sources={sources} { ...props } className={className} />
        <div data-id={element.id} { ...props?.attributes } className="sea-ai-chat-customize-definition-hidden"></div>
      </>
    );
  }

  return (
    <div data-id={element.id} { ...props?.attributes } className="sea-ai-chat-customize-definition-hidden"></div>
  );
};

export default CustomizeDefinition;

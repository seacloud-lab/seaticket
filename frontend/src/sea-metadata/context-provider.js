import React, { createContext, forwardRef, useContext, useEffect, useSyncExternalStore, useId, useLayoutEffect, useRef, useState } from 'react';
import { createMetadataContext } from './context';

const MetadataRuntimeContext = createContext(null);

export const SeaMetadataContextProvider = ({ context, children }) => {
  const version = useSyncExternalStore(context.subscribe, context.getVersion, context.getVersion);

  useEffect(() => {
    const doc = context.root?.ownerDocument || document;
    let escapeKeydown = null;
    const reset = () => { escapeKeydown = null; };
    const onKeyDown = event => {
      if (event.key !== 'Escape' && event.keyCode !== 27) return;
      if (!event.repeat || !escapeKeydown) escapeKeydown = context.ownsEvent(event) ? event : null;
    };
    const onKeyUp = event => {
      if (event.key !== 'Escape' && event.keyCode !== 27) return;
      // Popovers can unmount and restore focus on keydown. Consume the matching
      // keyup too, before Reactstrap's outer Modal treats it as another Escape.
      if (escapeKeydown?.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
      }
      reset();
    };
    doc.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('keyup', onKeyUp, true);
    doc.defaultView.addEventListener('blur', reset);
    return () => {
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('keyup', onKeyUp, true);
      doc.defaultView.removeEventListener('blur', reset);
    };
  }, [context]);

  return <MetadataRuntimeContext.Provider value={{ context, version }}>{children}</MetadataRuntimeContext.Provider>;
};

export const useSeaMetadataContext = () => {
  const value = useContext(MetadataRuntimeContext);
  if (!value) throw new Error('SeaMetadata runtime provider is missing');
  return value.context;
};

export const withSeaMetadataContext = (Component) => {
  const Wrapped = forwardRef((props, ref) => {
    const value = useContext(MetadataRuntimeContext);
    if (!value) throw new Error('SeaMetadata runtime provider is missing');
    return <Component {...props} ref={ref} metadataContext={value.context} metadataContextVersion={value.version} />;
  });
  Wrapped.displayName = `withSeaMetadataContext(${Component.displayName || Component.name})`;
  return Wrapped;
};

// A scope for standalone metadata widgets, such as the ticket search cards.
export const SeaMetadataScope = ({ children }) => {
  const [context] = useState(createMetadataContext);
  const id = useId();
  const rootRef = useRef(null);
  context.id = `sea-metadata-scope-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  useLayoutEffect(() => {
    context.root = rootRef.current;
    return () => context.destroy();
  }, [context]);
  return (
    <div ref={rootRef} data-sea-metadata-instance={context.id} style={{ display: 'contents' }}>
      <SeaMetadataContextProvider context={context}>{children}</SeaMetadataContextProvider>
    </div>
  );
};

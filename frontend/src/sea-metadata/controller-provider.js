import React, { createContext, forwardRef, useContext, useMemo } from 'react';
import { createSeaMetadataController, normalizeMetadataID } from './controller';

const ControllerContext = createContext(null);

export const useSeaMetadataController = (metadataID) => {
  const id = normalizeMetadataID(metadataID);
  return useMemo(() => createSeaMetadataController(id), [id]);
};

// Existing page workflows share a controller through their nearest host scope.
export const useMetadataController = () => {
  const controller = useContext(ControllerContext);
  const fallback = useSeaMetadataController();
  return controller || fallback;
};

export const SeaMetadataControllerProvider = ({ metadataID, controller, children }) => {
  const own = useSeaMetadataController(metadataID);
  return <ControllerContext.Provider value={controller || own}>{children}</ControllerContext.Provider>;
};

export const withSeaMetadataController = (Component) => {
  const Wrapped = forwardRef((props, ref) => {
    const own = useSeaMetadataController(props.metadataID);
    const controller = props.controller || own;
    return (
      <SeaMetadataControllerProvider controller={controller}>
        <Component {...props} ref={ref} controller={controller} />
      </SeaMetadataControllerProvider>
    );
  });
  Wrapped.displayName = `withSeaMetadataController(${Component.displayName || Component.name})`;
  return Wrapped;
};

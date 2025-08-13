import React, { useCallback } from 'react';
import CenteredLoading from '@/components/centered-loading';
import Table from './table';
import { useMetadata } from '../hooks';
import { VIEW_TYPE } from '../constants';

const View = ({ expandRow }) => {
  const { isLoading, metadata, errorMessage } = useMetadata();

  const renderView = useCallback((metadata) => {
    if (!metadata) return null;
    const viewType = metadata?.view?.type;
    switch (viewType) {
      case VIEW_TYPE.TABLE: {
        return (<Table expandRow={expandRow} />);
      }
      default: {
        return (<Table expandRow={expandRow} />);
      }
    }
  }, []);

  if (isLoading) return (<CenteredLoading />);

  return (
    <div className="sea-metadata-wrapper">
      <div className="sea-metadata-main">
        {errorMessage ? <div className="d-center-middle error">{errorMessage}</div> : renderView(metadata)}
      </div>
    </div>
  );

};

export default View;

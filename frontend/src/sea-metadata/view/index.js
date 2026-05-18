import React, { useCallback } from 'react';
import CenteredLoading from '@/components/centered-loading';
import Table from './table';
import Card from './card';
import { useMetadata } from '../hooks';
import { VIEW_TYPE } from '../constants';

const View = (props) => {
  const { isLoading, metadata, errorMessage } = useMetadata();

  const renderView = useCallback((metadata) => {
    if (!metadata) return null;
    const viewType = metadata?.view?.type;
    switch (viewType) {
      case VIEW_TYPE.TABLE: {
        return (<Table { ...props } />);
      }
      case VIEW_TYPE.CARD: {
        return (<Card { ...props } />);
      }
      default: {
        return (<Table { ...props } />);
      }
    }
  }, [props]);

  if (isLoading) return (<CenteredLoading />);

  return (
    <div className="sea-metadata-wrapper">
      <div className="sea-metadata-main">
        {errorMessage ? <div className="d-center-middle seaqa-tip-danger">{errorMessage}</div> : renderView(metadata)}
      </div>
    </div>
  );

};

export default View;

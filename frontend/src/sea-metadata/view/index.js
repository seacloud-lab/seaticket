import React, { useCallback } from 'react';
import CenteredLoading from '@/components/centered-loading';
import Table from './table';
import Card from './card';
import { useMetadata } from '../hooks';
import { VIEW_TYPE } from '../constants';

const View = ({ CustomView, expandRow, onCustomViewRowClick, ...props }) => {
  const { isLoading, metadata, errorMessage } = useMetadata();

  const renderView = useCallback((metadata) => {
    if (!metadata) return null;
    if (CustomView) {
      return <CustomView metadata={metadata} onRowClick={onCustomViewRowClick || expandRow} />;
    }
    const viewType = metadata?.view?.type;
    switch (viewType) {
      case VIEW_TYPE.TABLE: {
        return (<Table { ...props } expandRow={expandRow} />);
      }
      case VIEW_TYPE.CARD: {
        return (<Card { ...props } expandRow={expandRow} metadata={metadata} />);
      }
      default: {
        return (<Table { ...props } expandRow={expandRow} />);
      }
    }
  }, [CustomView, expandRow, onCustomViewRowClick, props]);

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

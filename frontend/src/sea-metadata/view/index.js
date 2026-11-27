import React, { useCallback, useRef, useState } from 'react';
import CenteredLoading from '@/components/centered-loading';
import toaster from '@/components/toaster';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { PER_LOAD_NUMBER, VIEW_TYPE } from '../constants';
import { useMetadata } from '../hooks';
import Card from './card';
import Statistic from './statistic';
import Table from './table';

const View = ({ CustomView, onCustomViewRowClick, ...props }) => {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isLoadingMoreRef = useRef(false);
  const { isLoading, metadata, errorMessage, store, recalculateData } = useMetadata();

  const loadMore = useCallback(async () => {
    if (!metadata?.hasMore || metadata.isSearchView || isLoadingMoreRef.current) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      await store.loadMore(PER_LOAD_NUMBER);
    } catch (error) {
      toaster.danger(Utils.getErrorMsg(error));
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [metadata, store]);

  const renderView = useCallback((metadata) => {
    if (!metadata) return null;
    if (CustomView) {
      return (
        <CustomView
          metadata={metadata}
          hasMore={Boolean(metadata.hasMore && !metadata.isSearchView)}
          isLoadingMore={isLoadingMore}
          loadMore={loadMore}
          onRowClick={onCustomViewRowClick}
        />
      );
    }
    const viewType = metadata?.view?.type;
    switch (viewType) {
      case VIEW_TYPE.TABLE: {
        return (<Table { ...props } />);
      }
      case VIEW_TYPE.CARD: {
        return (<Card { ...props } />);
      }
      case VIEW_TYPE.STATISTIC: {
        return (<Statistic { ...props } />);
      }
      default: {
        return (<Table { ...props } />);
      }
    }
  }, [CustomView, isLoadingMore, loadMore, onCustomViewRowClick, props]);

  if (isLoading) return (<CenteredLoading />);

  const showIncompleteResults = !errorMessage && metadata?.hasIncompleteResults && store?.shouldLoadRemainingRows();
  return (
    <div className="sea-metadata-wrapper">
      {showIncompleteResults && (
        <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2 mb-0 rounded-0 px-3 py-2">
          <span role="alert">{gettext('Some results could not be loaded. The list may be incomplete.')}</span>
          <button type="button" className="btn btn-sm btn-secondary" onClick={recalculateData}>{gettext('Retry')}</button>
        </div>
      )}
      <div className="sea-metadata-main">
        {errorMessage ? <div className="d-flex justify-content-center align-items-center h-100 w-100 text-danger font-size-13">{errorMessage}</div> : renderView(metadata)}
      </div>
    </div>
  );

};

export default View;

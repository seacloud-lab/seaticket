import { useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { Icon, toaster } from '@/components';
import context from '../../../context';
import { Utils } from '@/utils/utils';

import './index.css';
import { useMetadata } from '@/sea-metadata/hooks';

const Views = ({ view, toggleView }) => {
  const [isLoading, setLoading] = useState(true);
  const [views, setViews] = useState([]);
  const isFirstRender = useRef(true);

  const { isLoading: metadataLoading } = useMetadata();

  const displayViews = useMemo(() => {
    if (isLoading) return [];
    if (views.length === 0) return [view];
    return views;
  }, [isLoading, views, view]);

  useEffect(() => {
    if (metadataLoading) return;
    if (!isFirstRender.current) return;
    context.getViews().then(res => {
      setViews(res.data.views);
      isFirstRender.current = false;
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      setLoading(false);
    });
  }, [metadataLoading]);

  if (isLoading) return (<div className="sea-metadata-view-views"></div>);

  return (
    <div className="sea-metadata-view-views">
      {displayViews.map(v => {
        const isSelect = v._id === view._id;
        return (
          <div className={classnames('sea-metadata-view-item', { 'active': isSelect })} onClick={() => toggleView(v._id)} key={v._id}>
            {v.name}
            {isSelect && (<Icon symbol="down" />)}
          </div>
        );
      })}
    </div>
  );
};

export default Views;

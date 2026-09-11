import React, { useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import EmptyTip from '@/components/empty-tip';
import { mediaUrl, gettext } from '@/constants';

import './index.css';

const Tip = ({ isAsyncSearch = false, searchValue, tip, src, isShowSrc = false }) => {
  const [tipImgSrc, setTipImgSrc] = useState(src || '');

  const tipRef = useRef(null);

  useEffect(() => {
    if (!tipRef.current || src) return;
    const { width } = tipRef.current.getBoundingClientRect() || { width: 200 };
    setTipImgSrc(width > 300 ? `${mediaUrl}img/no-results.png` : '');
  }, [src]);

  const className = classnames('options-editor-empty-tip', { 'options-editor-empty-img-tip': isShowSrc && tipImgSrc });
  if (!isAsyncSearch) {
    return (<EmptyTip innerRef={tipRef} src={isShowSrc && tipImgSrc} text={tip} className={className} />);
  }

  if (searchValue) {
    return (<EmptyTip innerRef={tipRef} src={isShowSrc && tipImgSrc} text={gettext('No results')} className={className} />);
  }

  return (
    <EmptyTip
      innerRef={tipRef}
      src={`${mediaUrl}img/start-searching.png`}
      text={gettext('Enter characters to start searching')}
      className="option-editor-empty-tip option-editor-start-searching-tip"
    />
  );
};

export default Tip;

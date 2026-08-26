import React, { useEffect, useRef, useState } from 'react';
import EmptyTip from '@/components/empty-tip';
import { mediaUrl, gettext } from '@/constants';

import './index.css';

const Tip = ({ isAsyncSearch = false, searchValue, tip, src }) => {
  const [tipImgSrc, setTipImgSrc] = useState(src);

  const tipRef = useRef(null);

  useEffect(() => {
    if (!tipRef.current || src) return;
    const { width } = tipRef.current.getBoundingClientRect() || { width: 200 };
    setTipImgSrc(width > 300 ? `${mediaUrl}img/no-items-tip.png` : '');
  }, [src]);

  const className = 'options-editor-empty-tip';
  if (!isAsyncSearch) {
    return (<EmptyTip innerRef={tipRef} src={tipImgSrc} text={tip} className={className} />);
  }

  if (searchValue) {
    return (<EmptyTip innerRef={tipRef} src={tipImgSrc} text={gettext('No results')} className={className} />);
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

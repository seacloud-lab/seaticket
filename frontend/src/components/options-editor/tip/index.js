import React, { useEffect, useRef, useState } from 'react';
import EmptyTip from '@/components/empty-tip';
import { mediaUrl, gettext } from '@/constants';

import './index.css';

const Tip = ({ isAsyncSearch, options, searchValue, tip, height }) => {
  const [tipImgSrc, setTipImgSrc] = useState('');

  const tipRef = useRef(null);

  useEffect(() => {
    if (!tipRef.current) return;
    const { width } = tipRef.current.getBoundingClientRect() || { width: 200 };
    setTipImgSrc(width > 300 ? `${mediaUrl}img/no-items-tip.png` : '');
  }, []);

  const className = 'options-editor-empty-tip';
  let style = {};
  if (!tipImgSrc && height) {
    style['height'] = height;
  } else {
    style['marginTop'] = 24;
    style['marginBottom'] = 32;
  }
  if (isAsyncSearch) {
    return searchValue ? (
      <EmptyTip style={style} innerRef={tipRef} src={tipImgSrc} text={gettext('No results')} className={className} />
    ) : (
      <EmptyTip
        innerRef={tipRef}
        src={`${mediaUrl}img/start-searching.png`}
        text={gettext('Enter characters to start searching')}
        className="option-editor-empty-tip option-editor-start-searching-tip"
      />
    );
  }

  if (!Array.isArray(options) || options.length === 0) {
    return (<EmptyTip innerRef={tipRef} style={style} src={tipImgSrc} text={gettext('No results')} className={className} />);
  }

  return (
    <EmptyTip innerRef={tipRef} style={style} src={tipImgSrc} text={tip} className={className} />
  );
};

export default Tip;

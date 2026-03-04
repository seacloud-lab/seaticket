import React from 'react';
import EmptyTip from '@/components/empty-tip';
import { mediaUrl, gettext } from '@/constants';

import './index.css';

const Tip = ({ isSearchEnabled, hasAvailableOptions, searchValue, tip }) => {
  if (!hasAvailableOptions || !isSearchEnabled) {
    return (
      <EmptyTip src={`${mediaUrl}img/no-results.png`} text={tip} className="option-editor-no-results-tip"/>
    );
  }

  if (searchValue) {
    return (
      <EmptyTip src={`${mediaUrl}img/no-results.png`} text={gettext('No results')} className="option-editor-no-results-tip" />
    );
  }

  return (
    <EmptyTip
      src={`${mediaUrl}img/start-searching.png`}
      text={gettext('Enter characters to start searching')}
      className="option-editor-start-searching-tip"
    />
  );
};

export default Tip;

import React from 'react';
import EmptyTip from '@/components/empty-tip';
import { mediaUrl, gettext } from '@/constants';

import './index.css';

const Tip = ({ isSearchEnabled, hasAvailableOptions, searchValue, tip }) => {
  if (!hasAvailableOptions || !isSearchEnabled) {
    return (
      <EmptyTip
        text={tip}
        className="option-editor-empty-tip option-editor-no-results-tip"
      />
    );
  }

  if (searchValue) {
    return (
      <EmptyTip
        text={gettext('No results')}
        className="option-editor-empty-tip option-editor-no-results-tip"
      />
    );
  }

  return (
    <EmptyTip
      src={`${mediaUrl}img/start-searching.png`}
      text={gettext('Enter characters to start searching')}
      className="option-editor-empty-tip option-editor-start-searching-tip"
    />
  );
};

export default Tip;

import React from 'react';
import EmptyTip from '@/components/empty-tip';
import { mediaUrl, gettext } from '@/constants';

import './index.css';

const Tip = ({ isSearchEnabled, searchValue, tip }) => {
  const useCustomizeTip = searchValue || !isSearchEnabled;

  return (
    <EmptyTip
      src={`${mediaUrl}img/${useCustomizeTip ? 'no-results' : 'start-searching'}.png`}
      text={useCustomizeTip ? tip : gettext('Enter characters to start searching')}
      className={useCustomizeTip ? 'option-editor-no-results-tip' : 'option-editor-start-searching-tip'}
    />
  );
};

export default Tip;

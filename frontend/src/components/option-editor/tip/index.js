import React from 'react';
import EmptyTip from '@/components/empty-tip';
import { mediaUrl, gettext } from '@/constants';

import './index.css';

const Tip = ({ searchValue, tip }) => {
  return (
    <EmptyTip
      src={`${mediaUrl}img/${searchValue ? 'no-results' : 'start-searching'}.png`}
      text={searchValue ? tip : gettext('Enter characters to start searching')}
      className={searchValue ? 'option-editor-no-results-tip' : 'option-editor-start-searching-tip'}
    />
  );
};

export default Tip;

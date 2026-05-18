import React from 'react';
import classNames from 'classnames';

import './index.css';

const TagOption = ({ tag = {}, hiddenDescription = true, className }) => {
  const { color, name, description } = tag;
  return (
    <>
      <div className={classNames('seaqa-tags-selector-tag-bg mr-2', className, { 'mt-0': hiddenDescription })} style={{ backgroundColor: color }}></div>
      <div className="seaqa-tags-selector-tag-name-description">
        <div className="seaqa-tags-selector-tag-name">{name}</div>
        {!hiddenDescription && description && (<div className="seaqa-tags-selector-tag-description">{description}</div>)}
      </div>
    </>
  );
};

export default TagOption;

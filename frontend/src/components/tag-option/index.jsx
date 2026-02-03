import React from 'react';
import './index.css';

const TagOption = ({ tag = {}, hiddenDescription = false }) => {
  const { color, name, description } = tag;
  return (
    <>
      <div className="sea-qa-tags-selector-tag-bg" style={{ backgroundColor: color }}></div>
      <div className="sea-qa-tags-selector-tag-name-description">
        <div className="sea-qa-tags-selector-tag-name">{name}</div>
        {!hiddenDescription && description && (<div className="sea-qa-tags-selector-tag-description">{description}</div>)}
      </div>
    </>
  );
};

export default TagOption;

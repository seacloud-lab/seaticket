import React from 'react';

const Title = ({ mainSrc, imageIndex, images }) => {
  const getImgTitle = () => {
    try {
      return mainSrc ? decodeURI(mainSrc.slice(mainSrc.lastIndexOf('/') + 1)) : '';
    } catch (error) {
      console.log('error', error);
      return '';
    }
  };
  return (
    <>
      <span className="d-flex">
        <span className="text-truncate">{getImgTitle()}</span>
        <span className="flex-shrink-0">({imageIndex + 1}/{images.length})</span>
      </span>
    </>
  );
};

export default Title;

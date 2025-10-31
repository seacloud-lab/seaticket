import React from 'react';

import './index.css';

const MultipleTextCard = ({ texts = [] }) => {
  return (
    <div className="multiple-text-card d-flex w-100 mt-3">
      {texts.map((text, index) => {
        return (
          <div key={index} className="multiple-text-item d-flex align-items-center">
            <p>{text.name}</p>
            <p>{text.value}</p>
          </div>
        );
      })}
    </div>
  );
};

export default MultipleTextCard;

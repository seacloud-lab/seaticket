import React from 'react';

import './index.css';

const MultipleTextCard = ({ texts = [], itemStyle }) => {
  return (
    <div className="multiple-text-card d-flex w-100 mt-3">
      {texts.map((text, index) => {
        return (
          <div key={index} className="multiple-text-item d-flex align-items-center" style={itemStyle}>
            <p>{text.name}</p>
            <p>{text.value}</p>
          </div>
        );
      })}
    </div>
  );
};

export default MultipleTextCard;

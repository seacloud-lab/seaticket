import React from 'react';

import './index.css';

const Legend = ({
  items,
  selectedCategories,
  onItemClick
}) => {
  if (!items || items.length === 0) return null;
  console.log(items);

  return (
    <div className="embedding-legend">
      {items.map((item, index) => {
        const isSelected = selectedCategories.length === 0 || selectedCategories.includes(item.categoryIndex);
        return (
          <div
            key={index}
            className="legend-item"
            style={{ opacity: isSelected ? 1 : 0.3, cursor: 'pointer' }}
            onClick={(e) => onItemClick(item.categoryIndex, e)}
          >
            <span
              className="legend-color"
              style={{ backgroundColor: item.color }}
            />
            <span className="legend-label">{item.label}</span>
            <span className="legend-count">({item.count})</span>
          </div>
        );
      })}
    </div>
  );
};

export default Legend;

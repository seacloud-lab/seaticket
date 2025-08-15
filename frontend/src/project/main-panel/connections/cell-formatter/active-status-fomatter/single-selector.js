import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './single-selector.css';
import { gettext } from '../../../../../constants';

const Selector = ({ value, row, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef(null);

  const options = [
    { value: 'active', text: gettext('Active') },
    { value: 'inactive', text: gettext('Inactive') }
  ];

  const currentOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (selectedValue) => {
    if (onUpdate && row?.id) {
      onUpdate(row.id, selectedValue === 'active');
    }
    setIsOpen(false);
  };

  return (
    <div className="sf-single-selector position-relative" ref={selectorRef}>
      <div 
        className="cur-option d-flex align-items-center"
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer' }}
      >
        <span>{currentOption.text}</span>
        <i className="sf3-font sf3-font-down ml-1 toggle-icon"></i>
      </div>

      {isOpen && (
        <div className="options-container position-absolute rounded shadow mt-1 bg-white">
          <ul className="option-list list-unstyled py-2 o-auto">
            {options.map((option) => (
              <li
                key={option.value}
                className={`option-item py-1 px-3 d-flex justify-content-between align-items-center ${
                  option.value === value ? 'bg-highlight' : 'hover-bg'
                }`}
                onClick={() => handleSelect(option.value)}
              >
                <span className="option-item-text">{option.text}</span>
                {option.value === value && (
                  <i className="sf2-icon-tick"></i>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

Selector.propTypes = {
  value: PropTypes.oneOf(['active', 'inactive']).isRequired,
  row: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired
  }).isRequired,
  onUpdate: PropTypes.func.isRequired
};

export default Selector;

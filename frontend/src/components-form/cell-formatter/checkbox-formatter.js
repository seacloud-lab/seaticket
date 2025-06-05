import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  column: PropTypes.object,
};

class CheckboxFormatter extends React.Component {

  shouldComponentUpdate(nextProps) {
    return nextProps.value !== this.props.value;
  }

  getStyle = () => {
    return {
      display: 'inline',
      marginLeft: '0',
      width: '20px',
      height: '20px',
      verticalAlign: 'middle',
      boxShadow: 'none',
      outline: 'none',
      transform: 'scale(1.1)',
    };
  };

  render() {
    // need optimized
    let value = this.props.value === true ? true : false;
    let style = this.getStyle();
    return (
      <div className="cell-formatter grid-cell-type-checkbox">
        <input className="checkbox" type='checkbox' style={style} readOnly checked={value}/>
      </div>
    );
  }
}

CheckboxFormatter.propTypes = propTypes;

export default CheckboxFormatter;

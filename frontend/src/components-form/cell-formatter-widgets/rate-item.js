import React from 'react';
import PropTypes from 'prop-types';
import { UncontrolledTooltip } from 'reactstrap';

const propTypes = {
  editable: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  rateItemIndex: PropTypes.number,
  enterRateItemIndex: PropTypes.number,
  column: PropTypes.object,
  onMouseEnterRateItem: PropTypes.func,
  onMouseLeaveRateItem: PropTypes.func,
  onChangeRateNumber: PropTypes.func,
};

class RateItem extends React.Component {

  constructor(props) {
    super(props);
    this.tooltipRef = React.createRef();
  }

  onMouseEnterRateItem = () => {
    this.props.onMouseEnterRateItem(this.props.rateItemIndex);
  };

  onMouseLeaveRateItem = () => {
    this.props.onMouseLeaveRateItem();
  };

  onChangeRateNumber = () => {
    const { onChangeRateNumber, rateItemIndex, editable } = this.props;
    if (onChangeRateNumber && editable) {
      onChangeRateNumber(rateItemIndex);
    }
  };

  getStyle = () => {
    const { enterRateItemIndex, rateItemIndex, value, column, editable } = this.props;
    const { rate_style_color } = column.data;
    let itemStyle = {
      cursor: editable ? 'pointer' : 'default',
      color: value >= rateItemIndex ? rate_style_color : '#e5e5e5'
    };
    let style = itemStyle;
    if (enterRateItemIndex >= rateItemIndex) {
      style = {
        ...itemStyle,
        color: rate_style_color,
        opacity: 0.4
      };
    }
    return style;
  };

  render() {
    const { rateItemIndex, value, editable, column } = this.props;
    const { rate_style_type } = column.data;
    const showRateType = rate_style_type ? rate_style_type : 'dtable-icon-rate';
    const style = this.getStyle();
    if (editable) {
      return (
        <div
          onMouseEnter={this.onMouseEnterRateItem}
          onMouseLeave={this.onMouseLeaveRateItem}
          style={style}
          onClick={this.onChangeRateNumber}
          className={`rate-item ${value >= rateItemIndex ? 'rate-item-active' : ''}`}
        >
          <span className={`dtable-font ${showRateType}`} ref={this.tooltipRef}></span>
          <UncontrolledTooltip placement='bottom' target={this.tooltipRef}>
            {rateItemIndex}
          </UncontrolledTooltip>
        </div>
      );
    }

    return (
      <div style={style} className={`rate-item ${value >= rateItemIndex ? 'rate-item-active' : ''}`}>
        <span className={`dtable-font ${showRateType}`} ref={this.tooltipRef}></span>
      </div>
    );
  }
}

RateItem.propTypes = propTypes;

export default RateItem;

import React from 'react';
import PropTypes from 'prop-types';
import { isNumber } from 'dtable-utils';
import RateItem from '../cell-formatter-widgets/rate-item';
import { Utils } from '../../utils/utils';

import '../../css/rate-formatter.css';

const gettext = window.gettext;

const keyCodesMap = {};

for (let i = 0; i < 10; i++) {
  keyCodesMap['Digit' + i] = i;
}

const propTypes = {
  isReadOnly: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  column: PropTypes.object,
  onCommit: PropTypes.func,
  value: PropTypes.number,
};

class RatingFormatter extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      enterRateItemIndex: -1,
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown = (event) => {
    event.stopPropagation();
    const { isReadOnly, isEditorShow, column } = this.props;
    if (!isEditorShow || isReadOnly || !Utils.numberKeyCodes[event.key]) return;
    const { rate_max_number } = column.data || {};
    const currentInputNum = Number(event.key);
    const isValidNumber = currentInputNum <= rate_max_number;
    if (isValidNumber) {
      this.onChangeRateNumber(currentInputNum);
    }
  };

  handleListContainerKeyDown = (event) => {
    event.stopPropagation();
    const { column } = this.props;
    const { rate_max_number } = column.data || {};
    const currentInputNum = keyCodesMap[event.code];
    if (!isNumber(currentInputNum)) return;
    const isValidNumber = currentInputNum <= rate_max_number;
    if (isValidNumber) {
      this.onChangeRateNumber(currentInputNum);
    }
  };

  onMouseEnterRateItem = (index) => {
    this.setState({ enterRateItemIndex: index });
  };

  onMouseLeaveRateItem = () => {
    this.setState({ enterRateItemIndex: -1 });
  };

  onChangeRateNumber = (index) => {
    const { value } = this.props;
    let { column, onCommit } = this.props;
    let updated;
    if (value === index) {
      updated = { [column.key]: '' };
    } else {
      updated = { [column.key]: index };
    }
    onCommit(updated);
  };

  getRatingList = () => {
    const { column, isReadOnly } = this.props;
    const { enterRateItemIndex } = this.state;
    const { rate_max_number } = column.data;

    let rateList = [];
    for (let i = 0; i < rate_max_number; i++) {
      let rateItem = (
        <RateItem
          key={i}
          enterRateItemIndex={enterRateItemIndex}
          rateItemIndex={i + 1}
          onMouseEnterRateItem={this.onMouseEnterRateItem}
          onMouseLeaveRateItem={this.onMouseLeaveRateItem}
          value={this.props.value}
          column={column}
          onChangeRateNumber={this.onChangeRateNumber}
          editable={!isReadOnly}
        />
      );
      rateList.push(rateItem);
    }
    return rateList;
  };

  render() {
    const { isEditorShow, isRequired, column } = this.props;
    let rateList = this.getRatingList();
    return (
      <div
        className={`d-flex rate-formatter ${isEditorShow && 'focus'}`}
        tabIndex={0}
        aria-label={isRequired ? column.name + ', ' + gettext('Required') : column.name}
        onKeyDown={this.handleListContainerKeyDown}
      >
        {rateList}
      </div>
    );
  }
}

RatingFormatter.propTypes = propTypes;

export default RatingFormatter;

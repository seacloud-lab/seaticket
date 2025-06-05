import React from 'react';
import PropTypes from 'prop-types';
import { BACKGROUND_TYPE, BACKGROUND_TYPES } from '../../../constants/form-constants';

import '../css/select-group.css';

const gettext = window.gettext;

const BACKGROUND_TYPE_SHOW = {
  [BACKGROUND_TYPE.TRANSPARENT]: gettext('Transparent'),
  [BACKGROUND_TYPE.FILLED]: gettext('Filled'),
};

export default class FormSelectGroup extends React.Component {

  static propTypes = {
    activeOption: PropTypes.string,
    onSelectChanged: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      activeOption: props.activeOption,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.activeOption !== this.state.activeOption) {
      this.setState({ activeOption: nextProps.activeOption });
    }
  }

  onSelectChanged = (event) => {
    const { option } = event.target.dataset;
    if (option === this.state.activeOption) return;
    this.setState({ activeOption: option });
    this.props.onSelectChanged(option);
  };

  render() {
    const { activeOption } = this.state;
    return (
      <div className="select-group-container">
        <div className="select-group">
          {BACKGROUND_TYPES.map(option => {
            const displayOption = BACKGROUND_TYPE_SHOW && BACKGROUND_TYPE_SHOW[option] ? BACKGROUND_TYPE_SHOW[option] : option;
            return (
              <div
                key={option}
                className={`select-group-item ${activeOption === option ? 'active' : ''}`}
                data-option={option}
                onClick={this.onSelectChanged}
              >
                {displayOption}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

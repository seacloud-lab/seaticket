import React from 'react';
import PropTypes from 'prop-types';

import './index.css';

const SLIDER_TRANSITION = '150ms cubic-bezier(.4, 0, .2, 1)';

class RadioGroup extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      value: props.value,
    };
    this.setTransitionTimer = null;
  }

  componentDidMount() {
    const { options } = this.props;
    if (!this.btn || !this.slider || !Array.isArray(options)) return;
    this.slider.style.width = `${100 / options.length}%`;
    this.setSliderTransition();
  }

  componentDidUpdate(prevProps) {
    const { activeOption } = this.props;
    if (activeOption !== prevProps.activeOption && activeOption !== this.state.activeOption) {
      this.setState({ activeOption });
    }
  }

  componentWillUnmount() {
    this.clearTransitionTimer();
  }

  setSliderTransition = () => {
    this.setTransitionTimer = setTimeout(() => {
      this.slider.style.transition = SLIDER_TRANSITION;
      this.clearTransitionTimer();
    }, 1);
  };

  removeSliderTransition = () => {
    if (!this.slider) return;
    this.slider.style.transition = 'none';
  };

  clearTransitionTimer = () => {
    if (!this.setTransitionTimer) return;
    clearTimeout(this.setTransitionTimer);
    this.setTransitionTimer = null;
  };

  handleChange = (nextValue) => {
    if (nextValue === this.state.value) return;
    this.setState({ value: nextValue }, () => {
      if (this.props.onChange) {
        this.props.onChange(nextValue);
      }
    });
  };

  render() {
    const { options, readOnly } = this.props;
    const { value } = this.state;

    return (
      <div className="radio-group-wrapper">
        <div className={`radio-group-options ${readOnly ? 'read-only' : ''}`}>
          {options.map(option => {
            const isActive = value === option.value ? true : false;
            return (
              <div
                key={option.value}
                ref={ref => this.btn = ref}
                className={`radio-group-button ${isActive ? 'active' : ''}`}
                onClick={() => this.handleChange(option.value)}
              >
                {option.label}
              </div>
            );
          })}
          <span className="radio-group-slider btn btn-primary" ref={ref => this.slider = ref}></span>
        </div>
      </div>
    );
  }
}

RadioGroup.propTypes = {
  readOnly: PropTypes.bool,
  value: PropTypes.any,
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default RadioGroup;

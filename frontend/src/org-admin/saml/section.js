import React, { Component } from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  headingText: PropTypes.string.isRequired,
  children: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

class Section extends Component {

  constructor(props) {
    super(props);
  }

  render() {
    const { headingText, children } = this.props;
    return (
      <>
        <div className="info-item-heading">{headingText}</div>
        {children}
      </>
    );
  }
}

Section.propTypes = propTypes;

export default Section;

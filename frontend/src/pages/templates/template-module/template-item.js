import React from 'react';
import PropTypes from 'prop-types';
import SeatableCard from '../seatable-card';

const propTypes = {
  template: PropTypes.object.isRequired,
  searchParams: PropTypes.object,
};

class TemplateItem extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    let { template } = this.props;
    return (<SeatableCard type={'template'} card={template} searchParams={this.props.searchParams} />);
  }
}

TemplateItem.propTypes = propTypes;

export default TemplateItem;

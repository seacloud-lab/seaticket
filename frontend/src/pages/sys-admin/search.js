import React from 'react';
import PropTypes from 'prop-types';
import { SearchInput } from '../../components';

const propTypes = {
  placeholder: PropTypes.string.isRequired,
  submit: PropTypes.func.isRequired
};

class Search extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      value: ''
    };
  }

  handleInputChange = (e) => {
    this.setState({
      value: e.target.value
    });
  };

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.handleSubmit();
    }
  };

  handleSubmit = () => {
    const value = this.state.value.trim();
    if (!value) {
      return false;
    }
    this.props.submit(value);
  };

  render() {
    return (
      <SearchInput
        className="h-6 mr-1"
        placeholder={this.props.placeholder}
        style={{ width: '15rem' }}
        size={32}
        onChange={this.handleInputChange}
        onKeyDown={this.onKeyDown}
      />
    );
  }
}

Search.propTypes = propTypes;

export default Search;

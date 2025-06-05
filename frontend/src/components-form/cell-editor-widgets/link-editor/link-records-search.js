import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  timer: PropTypes.number,
  onSearch: PropTypes.func.isRequired,
};

const gettext = window.gettext;

class LinkRecordsSearch extends React.Component {

  static defaultProps = {
    timer: 300
  };

  constructor(props) {
    super(props);
    this.state = {
      value: ''
    };
    this.isInputChinese = false;
    this.timer = null;
  }

  componentDidMount() {
    this.setFocus();
  }

  componentWillUnmount() {
    this.timer && clearTimeout(this.timer);
    this.timer = null;
  }

  onMouseDown = (e) => {
    e.nativeEvent.stopImmediatePropagation();
    e.stopPropagation();
  };

  onClick = (e) => {
    this.onMouseDown(e);
  };

  onCompositionStart = (e) => {
    e.stopPropagation();
    this.isInputChinese = true;
  };

  onCompositionEnd = (e) => {
    e.stopPropagation();
    this.isInputChinese = false;
    this.onChange(e);
  };

  onChange = (e) => {
    e.stopPropagation();
    const value = e.target.value;
    this.setState({ value }, () => {
      if (this.isInputChinese) return;
      clearTimeout(this.timer);
      const { timer } = this.props;
      this.timer = setTimeout(() => {
        const searchValue = value ? value.trim() : '';
        this.props.onSearch(searchValue);
      }, timer);
    });
  };

  setFocus = () => {
    if (this.input === document.activeElement) return;
    this.input.focus();
  };

  setInputRef = (ref) => {
    this.input = ref;
  };

  render() {
    return (
      <div className="link-search">
        <input
          ref={this.setInputRef}
          className="search form-control"
          placeholder={gettext('Search option')}
          value={this.state.value}
          onMouseDown={this.onMouseDown}
          onClick={this.onClick}
          onCompositionStart={this.onCompositionStart}
          onCompositionEnd={this.onCompositionEnd}
          onChange={this.onChange}
        />
      </div>
    );
  }
}

LinkRecordsSearch.propTypes = propTypes;

export default LinkRecordsSearch;

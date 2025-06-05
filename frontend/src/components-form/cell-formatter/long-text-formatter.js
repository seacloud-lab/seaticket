import React from 'react';
import PropTypes from 'prop-types';
import { processor } from '@seafile/seafile-editor';
import Loading from '../../components/loading';

const propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  column: PropTypes.object,
};


class LongTextFormatter extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      innerHtml: null,
      isFormatValue: true,
    };
  }

  componentDidMount() {
    let value = this.props.value;
    let mdFile = value ? value.text : '';
    if (mdFile) {
      this.formatterLongTextValue(mdFile);
    } else {
      this.setState({
        isFormatValue: false,
        innerHtml: ''
      });
    }
  }

  formatterLongTextValue = (mdFile) => {
    processor.process(mdFile).then((result) => {
      let innerHtml = String(result);
      this.setState({
        isFormatValue: false,
        innerHtml: innerHtml
      });
    });

  };

  render() {
    if (this.state.isFormatValue) {
      return <Loading />;
    }

    return (
      <div className="cell-formatter grid-cell-type-longtext-formatter">
        <div dangerouslySetInnerHTML={{ __html: this.state.innerHtml }}></div>
      </div>
    );
  }

}

LongTextFormatter.propTypes = propTypes;

export default LongTextFormatter;

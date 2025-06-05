import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { processor } from '@seafile/seafile-editor';
import { isFunction } from '../../utils/utils';
import Loading from '../../components/loading';

const propTypes = {
  isShowEditTextBtn: PropTypes.bool,
  className: PropTypes.string,
  newValue: PropTypes.object,
  style: PropTypes.object,
  onContentClick: PropTypes.func,
  onEditContentBtnClick: PropTypes.func,
  onDeleteContentBtnClick: PropTypes.func,
};

class LongTextEditorPreviewAll extends React.Component {

  static defaultProps = {
    isShowEditTextBtn: false,
    style: {},
  };

  constructor(props) {
    super(props);
    this.state = {
      innerHtml: null,
      isFormatValue: true,
    };
  }

  componentDidMount() {
    let newValue = this.props.newValue;
    let mdFile = newValue ? newValue.text : '';
    if (mdFile) {
      this.formatterLongTextValue(mdFile);
    } else {
      this.setState({
        isFormatValue: false,
        innerHtml: ''
      });
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    let mdFile = nextProps.newValue.text;
    this.formatterLongTextValue(mdFile);
  }

  formatterLongTextValue = (mdFile) => {
    processor.process(mdFile).then((result) => {
      let innerHtml = String(result).replace(/<a /ig, '<a target="_blank" rel="noreferrer noopener" ');
      this.setState({
        isFormatValue: false,
        innerHtml: innerHtml
      });
    });
  };

  onEditContentBtnClick = (event) => {
    event && event.stopPropagation();
    if (isFunction(this.props.onEditContentBtnClick)) {
      this.props.onEditContentBtnClick();
    }
  };

  onDeleteContentBtnClick = (event) => {
    event && event.stopPropagation();
    if (isFunction(this.props.onDeleteContentBtnClick)) {
      this.props.onDeleteContentBtnClick();
    }
  };

  onContentClick = (e) => {
    this.props.onContentClick && this.props.onContentClick(e);
  };

  render() {
    const { isShowEditTextBtn, style, className } = this.props;
    if (this.state.isFormatValue) {
      return <Loading />;
    }
    return (
      <div
        className={classnames('long-text-editor-container article', className)}
        style={style}
        onClick={this.onContentClick}
        aria-label={this.props.newValue.text}
        tabIndex={0}
      >
        {isShowEditTextBtn &&
          <>
            <span className="dtable-font dtable-icon-rename" onClick={this.onEditContentBtnClick}></span>
            <span className="dtable-font dtable-icon-delete" onClick={this.onDeleteContentBtnClick}></span>
          </>
        }
        <div dangerouslySetInnerHTML={{ __html: this.state.innerHtml }}></div>
      </div>
    );
  }

}

LongTextEditorPreviewAll.propTypes = propTypes;

export default LongTextEditorPreviewAll;

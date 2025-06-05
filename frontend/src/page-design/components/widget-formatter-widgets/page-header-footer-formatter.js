import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { getDateDisplayString } from 'dtable-utils';
import { getWidgetStyle } from '../../utils/style-utils';
import { STATIC_CELL_TYPE, DYNAMIC_CELL_TYPE, FIT_MAP, PAGE_HEADER_FOOTER_WIDGET_TYPES } from '../../constants';

class PageHeaderFooterFormatter extends Component {

  getWidgetValue = (widget) => {
    const { value } = this.props;
    const { config_data: configData } = widget;
    const { pageIdx, templateName, currentUser, currentDate } = value;
    switch (widget.type) {
      case STATIC_CELL_TYPE.STATIC_TEXT: {
        return widget.config_data.staticText || '';
      }
      case DYNAMIC_CELL_TYPE.PAGE_NUMBER: {
        const { format } = configData;
        if (format === '1') return pageIdx;
        if (format === '1-') return `-${pageIdx}-`;
        return pageIdx;
      }
      case DYNAMIC_CELL_TYPE.CURRENT_DATE: {
        const { format } = configData;
        return getDateDisplayString(currentDate, { format });
      }
      case DYNAMIC_CELL_TYPE.CURRENT_USER: {
        return currentUser;
      }
      case DYNAMIC_CELL_TYPE.TEMPLATE_NAME: {
        return templateName;
      }
      default: {
        return null;
      }
    }
  };

  renderWidget = (widget) => {
    if (!widget) return;
    const { layout_data, config_data, type } = widget;
    if (!PAGE_HEADER_FOOTER_WIDGET_TYPES.includes(type)) return null;
    const { height, width, x, y, zIndex } = layout_data;
    const contentStyle = {
      position: 'absolute',
      top: y,
      left: x,
      width: width,
      height: height,
      zIndex: zIndex
    };
    switch (type) {
      case STATIC_CELL_TYPE.STATIC_IMAGE: {
        const { fitMode = 'fitMode' } = config_data;
        return (
          <div
            key={widget.id}
            className="page-header-footer-widget-content"
            style={contentStyle}
          >
            <img
              src={config_data.staticImageUrl}
              alt={'attachment'}
              style={{
                height: height,
                width: width,
                pointerEvents: 'none',
                objectFit: FIT_MAP[fitMode],
              }}
            />
          </div>
        );
      }
      case STATIC_CELL_TYPE.STATIC_TEXT:
      case DYNAMIC_CELL_TYPE.PAGE_NUMBER:
      case DYNAMIC_CELL_TYPE.CURRENT_DATE:
      case DYNAMIC_CELL_TYPE.CURRENT_USER:
      case DYNAMIC_CELL_TYPE.TEMPLATE_NAME: {
        return (
          <div
            key={widget.id}
            className="page-header-footer-widget-content"
            style={{ ...getWidgetStyle(widget), ...contentStyle }}
          >
            {this.getWidgetValue(widget)}
          </div>
        );
      }
      default: {
        return null;
      }
    }
  };

  renderContent = () => {
    const { widget } = this.props;
    const { config_data: configData } = widget;
    const { widgets } = configData;
    if (Array.isArray(widgets) && widgets.length > 0) {
      return widgets.map(item => this.renderWidget(item));
    }
    return null;
  };

  render() {
    const { containerClassName } = this.props;
    return (
      <div className={`page-design-page-header-footer position-relative h-100 ${containerClassName}`}>
        {this.renderContent()}
      </div>
    );
  }
}

PageHeaderFooterFormatter.propTypes = {
  value: PropTypes.object,
  widget: PropTypes.object,
  iframeDocument: PropTypes.object,
  containerClassName: PropTypes.string,
  scalingRatio: PropTypes.number,
};

export default PageHeaderFooterFormatter;

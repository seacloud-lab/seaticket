import React from 'react';
import PropTypes from 'prop-types';
import { MarkdownViewer, processor } from '@seafile/seafile-editor';

const propTypes = {
  value: PropTypes.string.isRequired,
  showTOC: PropTypes.bool,
};

// Windows old Wechat (3.0 or earlier) inner core is chrome 53 and don't support ECMA6, can't use seafile-editor markdownViewer
// Windows new Wechat (lastest version 3.3.5) support seafile-editor markdownViewer
// so use dangerouslySetInnerHTML to preview
class CustomizeMarkdownViewer extends React.PureComponent {

  constructor(props) {
    super(props);
    this.state = {
      innerHtml: null,
    };
    this.isWindowsWechat = false;
    this.checkBrowser();
  }

  checkBrowser = () => {
    if (window.chrome) {
      const appVersion = navigator.appVersion;
      const appVersionList = appVersion.split(' ');
      const index = appVersionList.findIndex((version) => version.indexOf('Chrome') >= 0);
      if (index === -1) return;
      let chromeVersion = appVersionList[index];
      chromeVersion = parseInt(chromeVersion.slice(chromeVersion.indexOf('/') + 1));
      if (chromeVersion === 53 && navigator.appVersion && navigator.appVersion.includes('WindowsWechat')) {
        this.convertMarkdown(this.props.value);
        this.isWindowsWechat = true;
      }
    }
  };

  convertMarkdown = (mdFile) => {
    processor.process(mdFile).then((result) => {
      let innerHtml = String(result).replace(/<a /ig, '<a target="_blank" tabindex="-1"');
      this.setState({ innerHtml });
    });
  };

  render() {
    if (this.isWindowsWechat) {
      return (<div className="long-text-container article" dangerouslySetInnerHTML={{ __html: this.state.innerHtml }}></div>);
    }
    const { showTOC, value, beforeRenderCallback, onLinkClick } = this.props;
    return (
      <MarkdownViewer
        value={value}
        isShowOutline={showTOC}
        beforeRenderCallback={beforeRenderCallback}
        onLinkClick={onLinkClick}
      />
    );
  }
}

CustomizeMarkdownViewer.propTypes = propTypes;

export default CustomizeMarkdownViewer;

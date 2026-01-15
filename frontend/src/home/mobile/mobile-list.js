import React from 'react';

import '../../../css/mobile/mobile-list.css';

class MobileList extends React.Component {

  render() {
    const { children, renderHeader, renderFooter } = this.props;

    return (
      <div className="mobile-list">
        {renderHeader ? (
          <div className={'mobile-list-header'}>
            {typeof renderHeader === 'function' ? renderHeader() : renderHeader}
          </div>
        ) : null}
        {children ? (
          <div className="mobile-list-body">
            {children}
          </div>
        ) : null}
        {renderFooter ? (
          <div className={'mobile-list-footer'}>
            {typeof renderFooter === 'function' ? renderFooter() : renderFooter}
          </div>
        ) : null}
      </div>
    );
  }
}

export default MobileList;

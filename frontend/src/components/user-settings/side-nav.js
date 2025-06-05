import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  data: PropTypes.array,
  curItemID: PropTypes.string,
};

class SideNav extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    return (
      <ul className="nav flex-column user-setting-nav">
        {this.props.data.map((item, index) => {
          return item.show ?
            <li key={index} className={`nav-item ${this.props.curItemID === item.href.substr(1) && 'active'}`}><a className="nav-link" href={item.href}>{item.text}</a></li> : null;
        })}
      </ul>
    );
  }
}

SideNav.propTypes = propTypes;

export default SideNav;

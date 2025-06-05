import PropTypes from 'prop-types';
import React, { Component } from 'react';
import UserGuideItem from './user-guide-item';

export default class UserGuideList extends Component {

  static propTypes = {
    guideList: PropTypes.array.isRequired,
    style: PropTypes.object,
  };

  static defaultProps = {
    guideList: [],
    style: {},
  };

  render() {
    const { style, guideList } = this.props;
    return (
      <div className="user-guide-list row m-0" style={style}>
        {guideList.map((guideItem, index) => {
          return (
            <UserGuideItem guideItem={guideItem} key={index}/>
          );
        })}
      </div>
    );
  }
}

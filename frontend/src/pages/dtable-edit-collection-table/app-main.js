import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import PCAppMain from './pc-app-main';
import MBAppMain from './mb-app-main';

const propTypes = {
  tables: PropTypes.array.isRequired,
  formConfigInfo: PropTypes.object.isRequired,
};

class AppMain extends React.Component {

  render() {
    return (
      <Fragment>
        <MediaQuery query="(min-width: 767.8px)">
          <PCAppMain tables={this.props.tables} formConfigInfo={this.props.formConfigInfo}/>
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          <MBAppMain tables={this.props.tables} formConfigInfo={this.props.formConfigInfo}/>
        </MediaQuery>
      </Fragment>
    );
  }
}

AppMain.propTypes = propTypes;

export default AppMain;

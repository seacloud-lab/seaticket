import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { isValidEmail } from 'dtable-utils';
import { CollaboratorItem } from 'dtable-ui-component';

const { mediaUrl } = window.app.config;

class CollaboratorItemFormatter extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isDataLoaded: false,
      collaborator: null,
    };
  }

  componentDidMount() {
    this.calculateCollaboratorData(this.props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.calculateCollaboratorData(nextProps);
  }

  calculateCollaboratorData = (props) => {
    const { cellValue: value } = props;
    if (!value) {
      this.setState({ isDataLoaded: true, collaborator: null });
      return;
    }
    this.setState({ isDataLoaded: false, collaborator: null });
    let { collaborators } = this.props;
    let collaborator = collaborators && collaborators.find(c => c.email === value);
    if (collaborator) {
      this.setState({ isDataLoaded: true, collaborator: collaborator });
      return;
    }

    const defaultAvatarUrl = `${mediaUrl}/avatars/default.png`;
    if (value === 'anonymous') {
      collaborator = {
        name: 'anonymous',
        avatar_url: defaultAvatarUrl,
      };
      this.setState({ isDataLoaded: true, collaborator });
      return;
    }

    let dtableCollaborators = window.app.collaboratorsCache;
    collaborator = dtableCollaborators[value];
    if (collaborator) {
      this.setState({ isDataLoaded: true, collaborator });
      return;
    }

    if (!isValidEmail(value)) {
      collaborator = {
        name: value,
        avatar_url: defaultAvatarUrl,
      };
      dtableCollaborators[value] = collaborator;
      this.setState({ isDataLoaded: true, collaborator: collaborator });
      return;
    }

    window.dtableWebAPI.getUserCommonInfo(value).then(res => {
      collaborator = res.data;
      dtableCollaborators[value] = collaborator;
      this.setState({ isDataLoaded: true, collaborator: collaborator });
    }).catch(() => {
      let defaultAvatarUrl = `${mediaUrl}/avatars/default.png`;
      collaborator = {
        name: value,
        avatar_url: defaultAvatarUrl,
      };
      dtableCollaborators[value] = collaborator;
      this.setState({ isDataLoaded: true, collaborator: collaborator });
    });
  };

  render() {
    const { cellValue } = this.props;
    const { collaborator, isDataLoaded } = this.state;

    if (!cellValue || !collaborator) return null;
    if (!isDataLoaded) return null;
    return (
      <CollaboratorItem collaborator={collaborator} enableDeleteCollaborator={false} />
    );
  }
}

CollaboratorItemFormatter.propTypes = {
  cellValue: PropTypes.string,
  collaborators: PropTypes.array,
};

export default CollaboratorItemFormatter;

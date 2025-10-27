class OrgAdminRepo {
  constructor(object) {
    this.repoID = object.repo_id;
    this.repoName = object.repo_name;
    this.ownerName = object.owner_name;
    this.ownerEmail = object.owner_email;
    this.encrypted = object.encrypted;
    this.groupID = object.group_id;
  }
}

export default OrgAdminRepo;

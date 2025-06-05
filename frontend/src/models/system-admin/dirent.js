class Dirent {
  constructor(obj) {
    this.name = obj.obj_name;
    this.mtime = obj.last_update;
    this.size = obj.file_size;
    this.is_file = obj.is_file;
    this.obj_id = obj.obj_id;
  }

  isDir() {
    return !this.is_file;
  }
}

export default Dirent;

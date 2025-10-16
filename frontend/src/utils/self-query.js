class SelfQuery {
  constructor({
    api,
    callback,
    endCondition,
    interval = 3000,
    maxRetries = 200,
    onEnd,
  }) {
    this.api = api;
    this.callback = callback;
    this.endCondition = endCondition || (() => true);

    this.maxRetries = maxRetries || 200;
    this.interval = interval || 3000;
    this.onEnd = onEnd || (() => {});

    this.id2retries = {};
    this.ids = [];
    this.queryTimer = null;
  }

  start(ids = []) {
    this.ids = [...ids];

    if (this.ids.length === 0) return;
    if (this.queryTimer) {
      clearTimeout(this.queryTimer);
      this.queryTimer = null;
    }
    let newIdRetries = {};
    this.ids.forEach(id => {
      newIdRetries[id] = this.id2retries[id] || 0;
    });
    this.id2retries = newIdRetries;
    this._executeConcurrentQuery();
  }

  _executeConcurrentQuery() {
    const queriedIds = this.ids.filter(id => (this.id2retries[id] || 0) < this.maxRetries);
    if (queriedIds.length === 0) return;

    this.queryTimer = setTimeout(() => {
      queriedIds.forEach(id => {
        this.id2retries[id] = (this.id2retries[id] || 0) + 1;
      });

      this.api(queriedIds).then(results => {
        let endIds = [];
        queriedIds.forEach(id => {
          const result = results[id];
          if (this.endCondition(result, id)) {
            endIds.push(id);
          }
        });
        this.callback(results);
        this.ids = queriedIds.filter(id => !endIds.includes(id));

        if (endIds.length > 0) {
          this.onEnd(endIds);
        }
        this._executeConcurrentQuery();
      }).catch(error => {
        this._executeConcurrentQuery();
      });
    }, this.interval);
  }

  clear() {
    if (this.queryTimer) {
      clearTimeout(this.queryTimer);
      this.queryTimer = null;
    }
  }
}

export default SelfQuery;

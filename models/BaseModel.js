'use strict';

class BaseModel {
  constructor(lcObject) {
    Object.assign(this, lcObject);

    Object.assign(this.__proto__, lcObject.__proto__, lcObject.__proto__.__proto__);

    return this;
  }
}

module.exports = BaseModel;

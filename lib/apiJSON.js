'use strict';

const deepcopy = require('deepcopy'),
      _ = require('underscore');

const format = (json) => {
  json = json || {};

  const exludedFields = ['id', 'relationships'],
        formattedJSON = {
          attributes: deepcopy(_.omit(json, exludedFields))
        };

  if (json.objectId) {
    formattedJSON.id = json.objectId;
  }

  if (json.relationships) {
    formattedJSON.relationships = json.relationships;
  }

  return formattedJSON;
};

const parse = () => {

};

const addRelatedResource = (data, relatedResource, relatedResourceName) => {
  data.relationships = data.relationships || {};
  data.relationships[relatedResourceName] = {
    data: relatedResource
  };
  return data;
};

module.exports = {
  format,
  parse,
  addRelatedResource
};

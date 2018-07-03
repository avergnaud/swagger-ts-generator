#!/usr/bin/env node

var generateTSFiles = require('../index.js').generateTSFiles
var config = require('./swagger.config.js')

const { swagger : { swaggerFile, swaggerTSGeneratorOptions, url } } = config

function getSwaggerJsonAndCreateAfile(done) {
  var file = fs.createWriteStream(swaggerFile);
  var request = http.get(url, function(response) {
      response.pipe(file);
  });
  return file
}

function genWebapiDownloadSwagger(done) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'; // Ignore 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' authorization error
  getSwaggerJsonAndCreateAfile()
  return fs.createReadStream("./src/swagger/file.json")
}

function log(msg) {
  $.util.log($.util.colors.yellow(msg));
}

generateTSFiles(swaggerFile, swaggerTSGeneratorOptions);

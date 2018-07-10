#!/usr/bin/env node

var generateTSFiles = require('../index.js').generateTSFiles
var config = require('./swagger.config.js')

const { swagger : { swaggerFile, swaggerTSGeneratorOptions } } = config

generateTSFiles(swaggerFile, swaggerTSGeneratorOptions);

"use strict";
/* global __dirname */

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ENCODING = undefined;
exports.readAndCompileTemplateFile = readAndCompileTemplateFile;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.writeFileIfContentsIsChanged = writeFileIfContentsIsChanged;
exports.ensureFile = ensureFile;
exports.ensureFolder = ensureFolder;
exports.getDirectories = getDirectories;
exports.removeFolder = removeFolder;
exports.getPathToRoot = getPathToRoot;
exports.convertNamespaceToPath = convertNamespaceToPath;
exports.getTypeFromDescription = getTypeFromDescription;
exports.hasTypeFromDescription = hasTypeFromDescription;
exports.getSortedObjectProperties = getSortedObjectProperties;
exports.isInTypesToFilter = isInTypesToFilter;
exports.log = log;

var _fs = require('fs');

var fs = _interopRequireWildcard(_fs);

var _path = require('path');

var path = _interopRequireWildcard(_path);

var _handlebars = require('handlebars');

var _handlebars2 = _interopRequireDefault(_handlebars);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

let moment = require('moment');
let _ = require('lodash');
const TEMPLATE_FOLDER = '../templates';
const ENCODING = exports.ENCODING = 'utf8';
function readAndCompileTemplateFile(templateFileName) {
    let templateSource = fs.readFileSync(path.resolve(__dirname, TEMPLATE_FOLDER, templateFileName), ENCODING);
    _handlebars2.default.registerHelper('escape', function (variable) {
        return variable.replace(/(['"])/g, '\\$1');
    });
    let template = _handlebars2.default.compile(templateSource);
    return template;
}
function readFile(outputFileName) {
    let file = fs.readFileSync(outputFileName, ENCODING);
    return file;
}
function writeFile(outputFileName, contents) {
    fs.writeFileSync(outputFileName, contents, { flag: 'w', encoding: ENCODING });
}
function writeFileIfContentsIsChanged(outputFileName, contents) {
    let isChanged = true;
    if (fs.existsSync(outputFileName)) {
        let oldContents = readFile(outputFileName);
        isChanged = oldContents !== contents;
    }
    isChanged && writeFile(outputFileName, contents);
    return isChanged;
}
function ensureFile(outputFileName, contents) {
    ensureFolder(path.dirname(outputFileName));
    if (!fs.existsSync(outputFileName)) {
        fs.writeFileSync(outputFileName, contents, ENCODING);
    }
}
function ensureFolder(folder) {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
}
function getDirectories(srcpath) {
    return fs.readdirSync(srcpath).filter(file => {
        return fs.statSync(path.join(srcpath, file)).isDirectory();
    });
}
function removeFolder(folder) {
    if (fs.existsSync(folder)) {
        fs.readdirSync(folder).forEach((file, index) => {
            let curPath = folder + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                // recurse
                removeFolder(curPath);
            } else {
                // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folder);
    }
}
function getPathToRoot(namespace) {
    let path = './';
    if (namespace) {
        path = '';
        let namespaceLength = namespace.split('.').length;
        for (let i = 0; i < namespaceLength; ++i) {
            path += '../';
        }
    }
    return path;
}
function convertNamespaceToPath(namespace) {
    let parts = namespace.split('.');
    for (let index = 0; index < parts.length; index++) {
        parts[index] = _.kebabCase(parts[index]);
    }
    return parts.join('/');
}
function getTypeFromDescription(description) {
    const result = description && description.replace('ts-type', '').replace('type', '').trim();
    return hasTypeFromDescription(description) ? result : undefined;
}
function hasTypeFromDescription(description) {
    return description ? description.startsWith('ts-type') || description.startsWith('type') : false;
}
function getSortedObjectProperties(object) {
    const result = _(object).toPairs().sortBy(0).fromPairs().value();
    return result;
}
function isInTypesToFilter(item, key, options) {
    if (options && options.typesToFilter) {
        return !!options.typesToFilter.find(element => {
            return element === key;
        });
    }
    return false;
}
function log(message) {
    let time = moment().format('HH:mm:SS');
    console.log(`[${time}] ${message}`);
}
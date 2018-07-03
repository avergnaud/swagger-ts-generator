"use strict";
/* global __dirname */

Object.defineProperty(exports, "__esModule", {
    value: true
});
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
let fs = require('fs');
let path = require('path');
let handlebars = require('handlebars');
let moment = require('moment');
let _ = require('lodash');
const TEMPLATE_FOLDER = '../templates';
const ENCODING = exports.ENCODING = 'utf8';
function readAndCompileTemplateFile(templateFileName) {
    let templateSource = fs.readFileSync(path.resolve(__dirname, TEMPLATE_FOLDER, templateFileName), ENCODING);
    let template = handlebars.compile(templateSource);
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
    let result = parts.join('/');
    // let result = namespace.replace(/\./g, '/');
    return result;
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
        const result = !!_.find(options.typesToFilter, element => {
            return element === key;
        });
        // if (result) {
        //     console.log('item in typesToFilter', key, result);
        // }
        return result;
    }
    return false;
}
function log(message) {
    let time = moment().format('HH:mm:SS');
    console.log(`[${time}] ${message}`);
}
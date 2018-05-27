"use strict";
/* global __dirname */
let fs = require('fs');
let path = require('path');
let handlebars = require('handlebars');
let moment = require('moment');
let _ = require('lodash');
const TEMPLATE_FOLDER = '../templates';
export const ENCODING = 'utf8';
export function readAndCompileTemplateFile(templateFileName) {
    let templateSource = fs.readFileSync(path.resolve(__dirname, TEMPLATE_FOLDER, templateFileName), ENCODING);
    let template = handlebars.compile(templateSource);
    return template;
}
export function readFile(outputFileName) {
    let file = fs.readFileSync(outputFileName, ENCODING);
    return file;
}
export function writeFile(outputFileName, contents) {
    fs.writeFileSync(outputFileName, contents, { flag: 'w', encoding: ENCODING });
}
export function writeFileIfContentsIsChanged(outputFileName, contents) {
    let isChanged = true;
    if (fs.existsSync(outputFileName)) {
        let oldContents = readFile(outputFileName);
        isChanged = oldContents !== contents;
    }
    if (isChanged) {
        writeFile(outputFileName, contents);
    }
    return isChanged;
}
export function ensureFile(outputFileName, contents) {
    ensureFolder(path.dirname(outputFileName));
    if (!fs.existsSync(outputFileName)) {
        fs.writeFileSync(outputFileName, contents, ENCODING);
    }
}
export function ensureFolder(folder) {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
}
export function getDirectories(srcpath) {
    return fs.readdirSync(srcpath).filter((file) => {
        return fs.statSync(path.join(srcpath, file)).isDirectory();
    });
}
export function removeFolder(folder) {
    if (fs.existsSync(folder)) {
        fs.readdirSync(folder).forEach((file, index) => {
            let curPath = folder + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                removeFolder(curPath);
            }
            else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folder);
    }
}
export function getPathToRoot(namespace) {
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
export function convertNamespaceToPath(namespace) {
    let parts = namespace.split('.');
    for (let index = 0; index < parts.length; index++) {
        parts[index] = _.kebabCase(parts[index]);
    }
    let result = parts.join('/');
    // let result = namespace.replace(/\./g, '/');
    return result;
}
export function getTypeFromDescription(description) {
    if (hasTypeFromDescription(description)) {
        description = description.replace('ts-type', '');
        return description.replace('type', '').trim();
    }
    return description;
}
export function hasTypeFromDescription(description) {
    if (description) {
        return (description.startsWith('ts-type') || description.startsWith('type'));
    }
    return false;
}
export function getSortedObjectProperties(object) {
    const result = _(object).toPairs().sortBy(0).fromPairs().value();
    return result;
}
export function isInTypesToFilter(item, key, options) {
    if (options && options.typesToFilter) {
        const result = !!_.find(options.typesToFilter, (element) => { return element === key; });
        // if (result) {
        //     console.log('item in typesToFilter', key, result);
        // }
        return result;
    }
    return false;
}
export function log(message) {
    let time = moment().format('HH:mm:SS');
    console.log(`[${time}] ${message}`);
}

"use strict";
/* global __dirname */
let fs = require('fs');
let path = require('path');
let handlebars = require('handlebars');
let moment = require('moment');
let _ = require('lodash');

const TEMPLATE_FOLDER = '../templates';
export const ENCODING = 'utf8';

export function readAndCompileTemplateFile(templateFileName:any) {
    let templateSource = fs.readFileSync(path.resolve(__dirname, TEMPLATE_FOLDER, templateFileName), ENCODING);
    let template = handlebars.compile(templateSource);
    return template;
}

export function readFile(outputFileName:any) {
    let file = fs.readFileSync(outputFileName, ENCODING);
    return file;
}

export function writeFile(outputFileName:any, contents:any) {
    fs.writeFileSync(outputFileName, contents, { flag: 'w', encoding: ENCODING });
}

export function writeFileIfContentsIsChanged(outputFileName:any, contents:any) {
    let isChanged = true;
    if (fs.existsSync(outputFileName)) {
        let oldContents = readFile(outputFileName);
        isChanged = oldContents !== contents;
    }
    isChanged && writeFile(outputFileName, contents);

    return isChanged;
}

export function ensureFile(outputFileName:any, contents:any) {
    ensureFolder(path.dirname(outputFileName));
    if (!fs.existsSync(outputFileName)) {
        fs.writeFileSync(outputFileName, contents, ENCODING);
    }
}

export function ensureFolder(folder:any) {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
}

export function getDirectories(srcpath:any) {
    return fs.readdirSync(srcpath).filter((file:any) => {
        return fs.statSync(path.join(srcpath, file)).isDirectory();
    });
}

export function removeFolder(folder:any) {
    if (fs.existsSync(folder)) {
        fs.readdirSync(folder).forEach((file:any, index:any) => {
            let curPath = folder + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                removeFolder(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folder);
    }
}

export function getPathToRoot(namespace:any) {
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

export function convertNamespaceToPath(namespace:any) {
    let parts = namespace.split('.');
    for (let index = 0; index < parts.length; index++) {
        parts[index] =_.kebabCase(parts[index]);
    }
    let result = parts.join('/');
    // let result = namespace.replace(/\./g, '/');
    return result;
}

export function getTypeFromDescription(description:any) {
    if (hasTypeFromDescription(description)) {
        description = description.replace('ts-type', '');
        return description.replace('type', '').trim();
    }
    return description;
}
export function hasTypeFromDescription(description:any) {
    if (description) {
        return (description.startsWith('ts-type') || description.startsWith('type'));
    }
    return false;
}

export function getSortedObjectProperties(object:any) {
    const result = _(object).toPairs().sortBy(0).fromPairs().value();
    return result;
}

export function isInTypesToFilter(item:any, key:any, options:any) {
    if (options && options.typesToFilter) {
        const result = !!_.find(options.typesToFilter, (element:any) => { return element === key; });
        // if (result) {
        //     console.log('item in typesToFilter', key, result);
        // }
        return result;
    }
    return false;
}

export function log(message:string) {
    let time = moment().format('HH:mm:SS');
    console.log(`[${time}] ${message}`);
}

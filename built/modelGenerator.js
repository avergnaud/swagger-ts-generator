"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.generateModelTSFiles = generateModelTSFiles;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lodash = require('lodash');

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const TS_SUFFIX = '.ts';
const MODEL_SUFFIX = '.model';
const MODEL_FILE_SUFFIX = `${MODEL_SUFFIX}${TS_SUFFIX}`;
const ROOT_NAMESPACE = 'root';
const VALDIDATORS_FILE_NAME = 'validators.ts';
const BASE_MODEL_FILE_NAME = 'base-model.ts';
function generateModelTSFiles(swagger, options) {
    let folder = _path2.default.normalize(options.modelFolder);
    // generate fixed file with the BaseModel class
    generateTSBaseModel(folder, options);
    // get type definitions from   swagger
    let typeCollection = getTypeDefinitions(swagger, options, MODEL_SUFFIX, MODEL_FILE_SUFFIX);
    // group types per namespace
    let namespaceGroups = getNamespaceGroups(typeCollection);
    // generate model files
    generateTSModels(namespaceGroups, folder, options);
    // generate barrel files (index files to simplify import statements)
    generateBarrelFiles(namespaceGroups, folder, options);
}
function generateTSBaseModel(folder, options) {
    if (!options.generateClasses) return;
    let outputFileName = _path2.default.join(folder, BASE_MODEL_FILE_NAME);
    let data = {};
    let template = utils.readAndCompileTemplateFile('generate-base-model-ts.hbs');
    let result = template(data);
    utils.ensureFolder(folder);
    let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
    if (isChanged) {
        utils.log(`generated ${outputFileName}`);
    }
}
function getTypeDefinitions(swagger, options, suffix, fileSuffix) {
    let typeCollection = new Array();
    (0, _lodash.forEach)(swagger.definitions, (item, key) => {
        if (!utils.isInTypesToFilter(item, key, options)) {
            let type = getTypeDefinition(swagger, typeCollection, item, key, options, suffix, fileSuffix);
            if (type) {
                typeCollection.push(type);
            }
        }
    });
    return (0, _lodash.uniq)(typeCollection); // filter on unique types
}
function getTypeDefinition(swagger, typeCollection, item, key, options, suffix, fileSuffix) {
    // filter enum types (these are gererated by the enumGenerator)
    let isEnumType = getIsEnumType(item);
    if (isEnumType) {
        return undefined;
    }
    let required = item.required || [];
    let namespace = getNamespace(key, options, true);
    let fullNamespace = getNamespace(key, options, false);
    let typeName = getTypeName(key, options);
    if (getIsGenericType(typeName)) {
        typeName = convertGenericToGenericT(typeName);
    }
    let pathToRoot = utils.getPathToRoot(namespace);
    let properties = options.sortModelProperties ? utils.getSortedObjectProperties(item.properties) : item.properties;
    let baseImportFile = undefined;
    let isSubType = getIsSubType(item);
    const baseType = isSubType ? getBaseType(typeCollection, item, options) : undefined;
    if (isSubType) {
        baseImportFile = getImportFile(baseType.typeName, baseType.namespace, pathToRoot, suffix);
        required = getSubTypeRequired(item);
        properties = getSubTypeProperties(item, baseType);
    }
    let type = {
        fileName: getFileName(key, options, fileSuffix),
        typeName, namespace, fullNamespace, isSubType, baseType, baseImportFile,
        path: utils.convertNamespaceToPath(namespace), pathToRoot, properties: []
    };
    (0, _lodash.forEach)(properties, (item, key) => {
        let property = getTypePropertyDefinition(swagger, type, baseType, required, item, key, options, suffix, fileSuffix);
        type.properties.push(property);
    });
    return type;
}
function getTypePropertyDefinition(swagger, type, baseType, required, item, key, options, suffix, fileSuffix) {
    let isRefType = item.$ref;
    let isArray = item.type == 'array';
    let isEnum = item.type == 'string' && item.enum || isArray && item.items && item.items.type == 'string' && item.items.enum || (isRefType || isArray) && getIsEnumRefType(swagger, item, isArray);
    // enum ref types are not handles as model types (they are handled in the enumGenerator)
    if (isEnum) {
        isRefType = false;
    }
    let propertyType = getPropertyType(item, key, options, isEnum);
    let isImportType = isRefType || isArray && item.items.$ref && !isEnum;
    let importType = isImportType ? getImportType(propertyType.typeName, isArray) : undefined;
    let importFile = isImportType ? getImportFile(importType, propertyType.namespace, type.pathToRoot, suffix) : undefined;
    let importTypeIsPropertyType = importType === type.typeName;
    let isUniqueImportType = isImportType && !importTypeIsPropertyType && getIsUniqueImportType(importType, baseType, type.properties); // import this type
    let validators = getTypePropertyValidatorDefinitions(required, item, key, propertyType.typeName, isEnum);
    let hasValidation = (0, _lodash.keys)(validators.validation).length > 0;
    let importEnumType = isEnum ? removeGenericArray(propertyType.typeName, isArray) : undefined;
    let isUniqueImportEnumType = isEnum && getIsUniqueImportEnumType(propertyType.typeName, type.properties); // import this enumType
    const { typeName, namespace, isArrayComplexType, arrayTypeName } = propertyType;
    let property = {
        name: key, typeName, namespace,
        description: item.description, hasValidation,
        isComplexType: isRefType || isArray,
        isImportType, isUniqueImportType, importType, importFile, isEnum, isUniqueImportEnumType,
        importEnumType, isArray, isArrayComplexType, arrayTypeName, validators, enum: item.enum
    };
    return property;
}
function getTypePropertyValidatorDefinitions(required, item, key, typeName, isEnum) {
    let isRequired = required.indexOf(key) !== -1;
    // console.log('key=', key, 'typeName', typeName, 'item=', item, 'enum=', item.enum);
    let validators = {
        validation: {},
        validatorArray: []
    };
    function pusher(validationkey, value, key) {
        validators.validation[validationkey] = value;
        validators.validatorArray.push(key);
    }
    isRequired && pusher('required', isRequired, 'Validators.required');
    (0, _lodash.has)(item, 'minimum') && pusher('minimum', item.minimum, `minValueValidator(${item.minimum})`);
    (0, _lodash.has)(item, 'maximum') && pusher('maximum', item.maximum, `maxValueValidator(${item.maximum})`);
    isEnum && pusher('enum', `'${item.enum}'`, `enumValidator(${typeName})`);
    (0, _lodash.has)(item, 'minLength') && pusher('minLength', item.minLength, `Validators.minLength(${item.minLength})`);
    (0, _lodash.has)(item, 'maxLength') && pusher('maxLength', item.maxLength, `Validators.maxLength(${item.maxLength})`);
    (0, _lodash.has)(item, 'pattern') && pusher('pattern', `'${item.pattern}'`, `Validators.pattern('${item.pattern}')`);
    return validators;
}
function getIsUniqueImportType(currentTypeName, baseType, typeProperties) {
    let baseTypeName = baseType ? baseType.typeName : undefined;
    if (currentTypeName === baseTypeName) {
        return false;
    } else return !typeProperties.some(property => property.importType === currentTypeName);
}
function getIsUniqueImportEnumType(currentTypeName, typeProperties) {
    return !typeProperties.some(property => {
        return property.importEnumType === currentTypeName;
    });
}
function getTypeNameWithoutNamespacePrefixesToRemove(key, options) {
    if (!options || !options.namespacePrefixesToRemove) {
        return key;
    }
    let namespaces = options.namespacePrefixesToRemove;
    namespaces.forEach(item => {
        key = key.replace(item, '');
        if (key[0] === '.') {
            key = key.substring(1);
        }
    });
    return key;
}
const getTypeNameFromItem = (item, propname, options, isEnum) => {
    if (item.type == 'integer') {
        return 'number';
    } else if (item.type == 'string' && (item.format == 'date' || item.format == 'date-time')) {
        return 'Date';
    } else if (item.type == 'string' && item.enum) {
        return propname;
    } else if (item.type == 'array' && item.items) {
        const arrayPropType = getPropertyType(item.items, propname, options, isEnum);
        return `Array<${arrayPropType.typeName}>`;
    }
    return item.type;
};
function getPropertyType(item, propname, options, isEnum) {
    let result = {
        typeName: '',
        namespace: '',
        fullNamespace: undefined,
        isArrayComplexType: false,
        arrayTypeName: undefined
    };
    if (item.type) {
        result.typeName = getTypeNameFromItem(item, propname, options, isEnum);
        if (item.type == 'array' && item.items) {
            let arrayPropType = getPropertyType(item.items, propname, options, isEnum);
            result.namespace = arrayPropType.namespace;
            result.isArrayComplexType = !isEnum ? item.items.$ref : false;
            result.arrayTypeName = arrayPropType.typeName;
        }
        ;
        // description may contain an overrule type for enums, eg /** type CoverType */
        if (utils.hasTypeFromDescription(item.description)) {
            result.typeName = (0, _lodash.lowerFirst)(utils.getTypeFromDescription(item.description));
            // fix enum array with overrule type
            if (item.type == 'array' && item.items) {
                result.arrayTypeName = result.typeName;
                result.typeName = `Array<${result.typeName}>`;
            }
        }
        return result;
    } else if (item.$ref) {
        let type = removeDefinitionsRef(item.$ref);
        result.typeName = getTypeName(type, options);
        result.namespace = getNamespace(type, options, true);
        result.fullNamespace = getNamespace(type, options, false);
        // TODO add more C# primitive types
        if (getIsGenericType(result.typeName)) {
            let genericTType = getGenericTType(result.typeName);
            if (genericTType && genericTType === 'System.DateTime') {
                result.typeName = result.typeName.replace(genericTType, 'Date');
            }
        }
        return result;
    }
    console.log("cas inattendu");
    return result;
}
function removeDefinitionsRef(value) {
    let result = value.replace('#/definitions/', '');
    return result;
}
function getFileName(type, options, fileSuffix) {
    let typeName = removeGenericTType(getTypeName(type, options));
    return `${(0, _lodash.kebabCase)(typeName)}${fileSuffix}`;
}
function getTypeName(type, options) {
    let typeName;
    if (getIsGenericType(type)) {
        let startGenericT = type.indexOf('[');
        let startGenericType = type.lastIndexOf('.', startGenericT) + 1;
        typeName = type.substring(startGenericType);
        typeName = convertGenericTypeName(typeName);
        typeName = getTypeNameWithoutSuffixesToRemove(typeName, options);
    } else {
        typeName = type.split('.').pop();
        typeName = getTypeNameWithoutSuffixesToRemove(typeName, options);
        // C# Object affects Typescript Object - fix this
        if (typeName === 'Object') {
            typeName = 'SystemObject';
        }
        //classNameSuffixesToRemove
    }
    return (0, _lodash.upperFirst)(typeName);
}
function getTypeNameWithoutSuffixesToRemove(typeName, options) {
    if (!options || !options.typeNameSuffixesToRemove) {
        return typeName;
    }
    let typeNameSuffixesToRemove = options.typeNameSuffixesToRemove;
    typeNameSuffixesToRemove.forEach(item => {
        if ((0, _lodash.endsWith)(typeName, item)) {
            typeName = typeName.slice(0, -item.length);
        }
    });
    return typeName;
}
function getIsGenericType(type) {
    return type.indexOf('[') !== -1 || type.indexOf('<') !== -1;
}
/**
 * NullableOrEmpty<System.Date> -> System.Data
 */
function getGenericTType(type) {
    if (getIsGenericType(type)) {
        const t = /\<(.*)\>/.exec(type);
        return t && t[1];
    }
    return undefined;
}
/**
 * NullableOrEmpty<System.Date> -> NullableOrEmpty
 */
function removeGenericTType(type) {
    if (getIsGenericType(type)) {
        type = type.substring(0, type.indexOf('<'));
    }
    return type;
}
/**
 * NullableOrEmpty[System.Date] -> NullableOrEmpty<System.Date>
 */
function convertGenericTypeName(typeName) {
    return typeName.replace('[', '<').replace(']', '>');
}
/**
 * NullableOrEmpty<System.Date> -> NullableOrEmpty<T>
 */
function convertGenericToGenericT(typeName) {
    return typeName.replace(/\<.*\>/, '<T>');
}
function getIsSubType(item) {
    return item.allOf !== undefined;
}
function getBaseType(typeCollection, item, options) {
    // TODO how about more than one baseType?
    let type = removeDefinitionsRef(item.allOf[0].$ref);
    let typeName = getTypeName(type, options);
    //let namespace = getNamespace(type, options);
    let baseType = typeCollection.find(type => {
        return type.typeName === typeName;
        //return type.typeName === typeName && type.namespace === namespace;
    });
    return baseType;
}
function getSubTypeProperties(item, baseType) {
    // TODO strip properties which are defined in the baseType?
    let properties = item.allOf[1].properties;
    return properties;
}
function getSubTypeRequired(item) {
    let required = item.allOf[1].required || [];
    return required;
}
function getIsEnumType(item) {
    return item && item.enum;
}
function getIsEnumRefType(swagger, item, isArray) {
    let refItemName;
    if (isArray) {
        // "perilTypesIncluded": {
        //     "type": "array",
        //     "items": {
        //         "$ref": "#/definitions/PerilTypeIncluded"
        //     }
        // },
        if (item.items.$ref) {
            refItemName = removeDefinitionsRef(item.items.$ref);
        }
    } else {
        // "riskLocationSupraentity": {
        //     "$ref": "#/definitions/LocationSupraentity",
        //     "description": "type LocationSupraentity "
        // },
        refItemName = removeDefinitionsRef(item.$ref);
    }
    let refItem = swagger.definitions[refItemName];
    return getIsEnumType(refItem);
}
function getNamespace(type, options, removePrefix) {
    let typeName = removePrefix ? getTypeNameWithoutNamespacePrefixesToRemove(type, options) : type;
    if (getIsGenericType(typeName)) {
        let first = typeName.substring(0, typeName.indexOf('['));
        typeName = first + first.substring(typeName.indexOf(']'));
    }
    let parts = typeName.split('.');
    parts.pop();
    return parts.join('.');
}
function getImportType(type, isArray) {
    if (isArray) {
        let result = removeGenericArray(type, isArray);
        return result;
    }
    type = removeGenericTType(type);
    return type;
}
function removeGenericArray(type, isArray) {
    if (isArray) {
        let result = type.replace('Array<', '').replace('>', '');
        return result;
    }
    return type;
}
function getImportFile(propTypeName, propNamespace, pathToRoot, suffix) {
    let importPath = `${(0, _lodash.kebabCase)(propTypeName)}${suffix}`;
    if (propNamespace) {
        let namespacePath = utils.convertNamespaceToPath(propNamespace);
        importPath = `${namespacePath}/${importPath}`;
    }
    return (pathToRoot + importPath).toLocaleLowerCase();
}
function getNamespaceGroups(typeCollection) {
    let namespaces = {
        [ROOT_NAMESPACE]: []
    };
    for (let i = 0; i < typeCollection.length; ++i) {
        let type = typeCollection[i];
        let namespace = type.namespace || ROOT_NAMESPACE;
        if (!namespaces[namespace]) {
            namespaces[namespace] = [];
        }
        namespaces[namespace].push(type);
    }
    return namespaces;
}
function generateTSModels(namespaceGroups, folder, options) {
    let data = {
        generateClasses: options.generateClasses,
        moduleName: options.modelModuleName,
        enumModuleName: options.enumModuleName,
        enumRef: options.enumRef,
        type: undefined
    };
    let template = utils.readAndCompileTemplateFile('generate-model-ts.hbs');
    utils.ensureFolder(folder);
    for (let namespace in namespaceGroups) {
        let typeCol = namespaceGroups[namespace];
        let firstType = typeCol[0] || {
            namespace: ''
        };
        let namespacePath = utils.convertNamespaceToPath(firstType.namespace);
        let typeFolder = `${folder}${namespacePath}`;
        let folderParts = namespacePath.split('/');
        let prevParts = folder;
        folderParts.forEach(part => {
            prevParts += part + '/';
            utils.ensureFolder(prevParts);
        });
        let nrGeneratedFiles = 0;
        (0, _lodash.each)(typeCol, type => {
            let outputFileName = _path2.default.join(typeFolder, type.fileName);
            data.type = type;
            let result = template(data);
            let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
            if (isChanged) {
                nrGeneratedFiles++;
            }
            //fs.writeFileSync(outputFileName, result, { flag: 'w', encoding: utils.ENCODING });
        });
        utils.log(`generated ${nrGeneratedFiles} type${nrGeneratedFiles === 1 ? '' : 's'} in ${typeFolder}`);
        removeFilesOfNonExistingTypes(typeCol, typeFolder, options, MODEL_FILE_SUFFIX);
    }
    let namespacePaths = Object.keys(namespaceGroups).map(namespace => {
        return _path2.default.join(folder, utils.convertNamespaceToPath(namespace));
    });
    cleanFoldersForObsoleteFiles(folder, namespacePaths);
}
function cleanFoldersForObsoleteFiles(folder, namespacePaths) {
    utils.getDirectories(folder).forEach(name => {
        let folderPath = _path2.default.join(folder, name);
        // TODO bij swagger-zib-v2 wordt de webapi/ZIB folder weggegooid !
        let namespacePath = namespacePaths.find(path => {
            return path.startsWith(folderPath);
        });
        if (!namespacePath) {
            utils.removeFolder(folderPath);
            utils.log(`removed obsolete folder ${name} in ${folder}`);
        } else {
            cleanFoldersForObsoleteFiles(folderPath, namespacePaths);
        }
    });
}
function generateBarrelFiles(namespaceGroups, folder, options) {
    let data = {
        fileNames: undefined
    };
    let template = utils.readAndCompileTemplateFile('generate-barrel-ts.hbs');
    for (let key in namespaceGroups) {
        data.fileNames = namespaceGroups[key].map(type => {
            return removeTsExtention(type.fileName);
        });
        if (key === ROOT_NAMESPACE) {
            addRootFixedFileNames(data.fileNames, options);
        }
        let namespacePath = namespaceGroups[key][0] ? namespaceGroups[key][0].path : '';
        let outputFileName = _path2.default.join(folder + namespacePath, 'index.ts');
        let result = template(data);
        let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
        if (isChanged) {
            utils.log(`generated ${outputFileName}`);
        }
    }
}
function addRootFixedFileNames(fileNames, options) {
    let enumOutputFileName = _path2.default.normalize(options.enumTSFile.split('/').pop());
    fileNames.splice(0, 0, removeTsExtention(enumOutputFileName));
    if (options.generateClasses) {
        let validatorsOutputFileName = _path2.default.normalize(VALDIDATORS_FILE_NAME);
        fileNames.splice(0, 0, removeTsExtention(validatorsOutputFileName));
    }
}
function removeTsExtention(fileName) {
    return fileName.replace('.ts', '');
}
function removeFilesOfNonExistingTypes(typeCollection, folder, options, suffix) {
    // remove files of types which are no longer defined in typeCollection
    let counter = 0;
    let files = _fs2.default.readdirSync(folder);
    (0, _lodash.each)(files, file => {
        if ((0, _lodash.endsWith)(file, suffix) && !typeCollection.find(type => {
            return type.fileName == file;
        })) {
            counter++;
            _fs2.default.unlinkSync(_path2.default.join(folder, file));
            utils.log(`removed ${file} in ${folder}`);
        }
    });
    if (counter > 0) {
        utils.log(`removed ${counter} types in ${folder}`);
    }
}
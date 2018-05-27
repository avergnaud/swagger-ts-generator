"use strict";

import fs from 'fs'
import path from 'path'
import { keys, has, lowerFirst, kebabCase, upperFirst, each, endsWith, uniq, forEach } from 'lodash'
import * as  utils from "./utils"

const TS_SUFFIX = '.ts';
const MODEL_SUFFIX = '.model';
const MODEL_FILE_SUFFIX = `${MODEL_SUFFIX}${TS_SUFFIX}`;
const ROOT_NAMESPACE = 'root';
const VALDIDATORS_FILE_NAME = 'validators.ts';
const BASE_MODEL_FILE_NAME = 'base-model.ts';

export function generateModelTSFiles(swagger:any, options:any) {
    let folder = path.normalize(options.modelFolder);

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

function generateTSBaseModel(folder:any, options:any) {
    if(!options.generateClasses)
        return;

    let outputFileName = path.join(folder, BASE_MODEL_FILE_NAME);
    let data = {}
    let template = utils.readAndCompileTemplateFile('generate-base-model-ts.hbs');
    let result = template(data);
    utils.ensureFolder(folder);
    let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
    if (isChanged) {
        utils.log(`generated ${outputFileName}`);
    }
}

function getTypeDefinitions(swagger:any, options:any, suffix:string, fileSuffix:string):Array<any> {
    let typeCollection = new Array();
    // console.log('typesToFilter', options.typesToFilter);
    forEach(swagger.definitions, (item:any, key:any) => {
        if (!utils.isInTypesToFilter(item, key, options)) {
            let type = getTypeDefinition(swagger, typeCollection, item, key, options, suffix, fileSuffix);
            if (type) {
                typeCollection.push(type);
            }
        }
    });
    // filter on unique types
    return uniq(typeCollection)
}

interface Type {
    typeName: string
    namespace: string
    fullNamespace?: string
}

interface TypeDefinition extends Type {
    fileName: string
    isSubType: boolean
    baseType: string
    baseImportFile?: string
    path: string
    pathToRoot: string
    properties: Array<any>
}

function getTypeDefinition(swagger:any, typeCollection:any, item:any, key:any, options:any, suffix:string, fileSuffix:string) {
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
    let properties = options.sortModelProperties ?  utils.getSortedObjectProperties(item.properties) : item.properties;
    let baseImportFile = undefined;
    let isSubType = getIsSubType(item);
    const baseType= isSubType ?  getBaseType(typeCollection, item, options) : undefined
    if (isSubType) {
        baseImportFile = getImportFile(baseType.typeName, baseType.namespace, pathToRoot, suffix);
        required = getSubTypeRequired(item);
        properties = getSubTypeProperties(item, baseType);
    }

    let type:TypeDefinition = {
        fileName: getFileName(key, options, fileSuffix),
        typeName,namespace,fullNamespace,isSubType,baseType,baseImportFile,
        path: utils.convertNamespaceToPath(namespace),pathToRoot,properties: []
    }
    forEach(properties, (item:any, key:any) => {
        let property = getTypePropertyDefinition(swagger, type, baseType, required, item, key, options, suffix, fileSuffix)
        type.properties.push(property);
    });
    return type;
}

function getTypePropertyDefinition(swagger:any, type:any, baseType:any|undefined, required:any, item:any, key:any, options:any, suffix:any, fileSuffix:any) {
    let isRefType = item.$ref;
    let isArray = item.type == 'array';
    let isEnum = (item.type == 'string' && item.enum) ||
        (isArray && item.items && item.items.type == 'string' && item.items.enum) ||
        ((isRefType || isArray) && getIsEnumRefType(swagger, item, isArray));
    // enum ref types are not handles as model types (they are handled in the enumGenerator)
    if (isEnum) {
        isRefType = false;
    }
    let propertyType = getPropertyType(item, key, options, isEnum);
    let isImportType = isRefType || (isArray && item.items.$ref && !isEnum);
    let importType = isImportType ? getImportType(propertyType.typeName, isArray) : undefined;
    let importFile = isImportType ? getImportFile(importType, propertyType.namespace, type.pathToRoot, suffix) : undefined;
    let importTypeIsPropertyType = importType === type.typeName;
    let isUniqueImportType = isImportType && !importTypeIsPropertyType && getIsUniqueImportType(importType, baseType, type.properties); // import this type

    let validators = getTypePropertyValidatorDefinitions(required, item, key, propertyType.typeName, isEnum);
    let hasValidation = keys(validators.validation).length > 0;

    let importEnumType = isEnum ? removeGenericArray(propertyType.typeName, isArray) : undefined;
    let isUniqueImportEnumType = isEnum && getIsUniqueImportEnumType(propertyType.typeName, type.properties); // import this enumType
    const { typeName, namespace, isArrayComplexType, arrayTypeName  } = propertyType
    let property = {
        name: key,typeName,namespace,
        description: item.description,hasValidation,
        isComplexType: isRefType || isArray, // new this one in constructor ,
        isImportType,isUniqueImportType,importType,importFile,isEnum,isUniqueImportEnumType,
        importEnumType,isArray,isArrayComplexType,arrayTypeName,validators,enum: item.enum,
    }
    return property;
}

interface validationType {
    required?:boolean
    minimum?: number
    maximum?: number
    enum?: string
    minLength?: number
    maxLength?: number
    pattern?: string
}

interface validatorsDef {
    validation:validationType
    validatorArray:Array<string>
}

function getTypePropertyValidatorDefinitions(required:any, item:any, key:any, typeName:any, isEnum:any) {
    let isRequired = required.indexOf(key) !== -1;
    // console.log('key=', key, 'typeName', typeName, 'item=', item, 'enum=', item.enum);

    let validators:validatorsDef = {
        validation: {},
        validatorArray: []
    }
    if (isRequired) {
        validators.validation.required = isRequired
        validators.validatorArray.push('Validators.required');
    }
    if (has(item, 'minimum')) {
        validators.validation.minimum = item.minimum
        validators.validatorArray.push(`minValueValidator(${item.minimum})`);
    }
    if (has(item, 'maximum')) {
        validators.validation.maximum = item.maximum
        validators.validatorArray.push(`maxValueValidator(${item.maximum})`);
    }
    if (isEnum) {
        validators.validation.enum = `'${item.enum}'`
        validators.validatorArray.push(`enumValidator(${typeName})`);
    }
    if (has(item, 'minLength')) {
        validators.validation.minLength = item.minLength
        validators.validatorArray.push(`Validators.minLength(${item.minLength})`);
    }
    if (has(item, 'maxLength')) {
        validators.validation.maxLength = item.maxLength
        validators.validatorArray.push(`Validators.maxLength(${item.maxLength})`);
    }
    if (has(item, 'pattern')) {
        validators.validation.pattern = `'${item.pattern}'`
        validators.validatorArray.push(`Validators.pattern('${item.pattern}')`);
    }
    return validators;
}

function getIsUniqueImportType(currentTypeName:any, baseType:any, typeProperties:any) {
    let baseTypeName = baseType ? baseType.typeName : undefined;
    if (currentTypeName === baseTypeName) {
        return false;
    } else return !typeProperties.some( (property:any) => property.importType === currentTypeName);
}

function getIsUniqueImportEnumType(currentTypeName:any, typeProperties:any) {
    return !typeProperties.some((property:any) => {
        return property.importEnumType === currentTypeName;
    })
}

function getTypeNameWithoutNamespacePrefixesToRemove(key:any, options:any) {
    if (!options || !options.namespacePrefixesToRemove) {
        return key;
    }
    let namespaces = options.namespacePrefixesToRemove;
    namespaces.forEach((item:any) => {
        key = key.replace(item, '');
        if (key[0] === '.') {
            key = key.substring(1);
        }
    });
    return key;
}

interface PropertyType extends Type {
    isArrayComplexType: boolean
    arrayTypeName?: string
}

const getTypeNameFromItem = (item:any,propname:any, options?:any, isEnum?:boolean):string => {
    if (item.type == 'integer') {
        return 'number'
    } else if (item.type == 'string' && item.format == 'date') {
        return 'Date'
    } else if (item.type == 'string' && item.format == 'date-time') {
        return 'Date'
    } else if (item.type == 'string' && item.enum) {
        return propname
    } else if (item.type == 'array' && item.items) {
        const arrayPropType = getPropertyType(item.items, propname, options, isEnum);
        return `Array<${arrayPropType.typeName}>`;
    }
    return item.type
}


function getPropertyType(item:any, propname:any, options:any, isEnum:any): PropertyType {
    let result: PropertyType = {
        typeName: '',
        namespace: '',
        fullNamespace: undefined,
        isArrayComplexType: false,
        arrayTypeName: undefined
    }
    if (item.type) {
        result.typeName = getTypeNameFromItem(item, options,isEnum, propname)
        if (item.type == 'array' && item.items) {
            let arrayPropType = getPropertyType(item.items, propname, options, isEnum);
            result.namespace = arrayPropType.namespace;
            result.isArrayComplexType = !isEnum ? item.items.$ref : false;
            result.arrayTypeName = arrayPropType.typeName;
        };
        // description may contain an overrule type for enums, eg /** type CoverType */
        if (utils.hasTypeFromDescription(item.description)) {
            result.typeName = lowerFirst(utils.getTypeFromDescription(item.description))
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
    console.log("cas inattendu")
    return result
}

function removeDefinitionsRef(value:any) {
    let result = value.replace('#/definitions/', '');
    return result;
}

function getFileName(type:any, options:any, fileSuffix:any) {
    let typeName = removeGenericTType(getTypeName(type, options));
    return `${kebabCase(typeName)}${fileSuffix}`;
}

function getTypeName(type:any, options:any) {
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
    return upperFirst(typeName);
}

function getTypeNameWithoutSuffixesToRemove(typeName:any, options:any) {
    if (!options || !options.typeNameSuffixesToRemove) {
        return typeName;
    }
    let typeNameSuffixesToRemove = options.typeNameSuffixesToRemove;
    typeNameSuffixesToRemove.forEach((item:any) => {
        if (endsWith(typeName, item)) {
            typeName = typeName.slice(0, -item.length);
        }
    });
    return typeName;
}

function getIsGenericType(type:any) {
    return type.indexOf('[') !== -1 || type.indexOf('<') !== -1;
}
/**
 * NullableOrEmpty<System.Date> -> System.Data
 */
function getGenericTType(type:string) {
    if (getIsGenericType(type)) {
        const t = /\<(.*)\>/.exec(type)
        return t && t[1];
    }
    return undefined;
}
/**
 * NullableOrEmpty<System.Date> -> NullableOrEmpty
 */
function removeGenericTType(type:any) {
    if (getIsGenericType(type)) {
        type = type.substring(0, type.indexOf('<'));
    }
    return type;
}
/**
 * NullableOrEmpty[System.Date] -> NullableOrEmpty<System.Date>
 */
function convertGenericTypeName(typeName:string) {
    return typeName.replace('[', '<').replace(']', '>');
}
/**
 * NullableOrEmpty<System.Date> -> NullableOrEmpty<T>
 */
function convertGenericToGenericT(typeName:string) {
    return typeName.replace(/\<.*\>/, '<T>');
}

function getIsSubType(item:any) {
    return item.allOf !== undefined;
}

function getBaseType(typeCollection:any, item:any, options:any) {
    // TODO how about more than one baseType?
    let type = removeDefinitionsRef(item.allOf[0].$ref);
    let typeName = getTypeName(type, options);
    //let namespace = getNamespace(type, options);
    let baseType = typeCollection.find( (type:any) => {
        return type.typeName === typeName;
        //return type.typeName === typeName && type.namespace === namespace;
    })
    return baseType;
}

function getSubTypeProperties(item:any, baseType:any) {
    // TODO strip properties which are defined in the baseType?
    let properties = item.allOf[1].properties;
    return properties;
}

function getSubTypeRequired(item:any) {
    let required = item.allOf[1].required || [];
    return required;
}

function getIsEnumType(item:any) {
    return item && item.enum;
}

function getIsEnumRefType(swagger:any, item:any, isArray:any) {
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

function getNamespace(type:any, options:any, removePrefix:any) {
    let typeName = removePrefix ? getTypeNameWithoutNamespacePrefixesToRemove(type, options) : type;

    if (getIsGenericType(typeName)) {
        let first = typeName.substring(0, typeName.indexOf('['));
        typeName = first + first.substring(typeName.indexOf(']'));
    }
    let parts = typeName.split('.');
    parts.pop();
    return parts.join('.');
}

function getImportType(type:any, isArray:boolean) {
    if (isArray) {
        let result = removeGenericArray(type, isArray);
        return result;
    }
    type = removeGenericTType(type);

    return type;
}

function removeGenericArray(type:any, isArray:boolean) {
    if (isArray) {
        let result = type.replace('Array<', '').replace('>', '');
        return result;
    }
    return type;
}

function getImportFile(propTypeName:any, propNamespace:any, pathToRoot:any, suffix:any) {
    let importPath = `${kebabCase(propTypeName)}${suffix}`;
    if (propNamespace) {
        let namespacePath = utils.convertNamespaceToPath(propNamespace);
        importPath = `${namespacePath}/${importPath}`;
    }

    return (pathToRoot + importPath).toLocaleLowerCase();
}

function getNamespaceGroups(typeCollection:any) {
    let namespaces:{[key:string]:Array<string>} = {
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

function generateTSModels(namespaceGroups:any, folder:any, options:any) {
    let data = {
        generateClasses: options.generateClasses,
        moduleName: options.modelModuleName,
        enumModuleName: options.enumModuleName,
        enumRef: options.enumRef,
        type: undefined,
    }
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
        folderParts.forEach((part:any) => {
            prevParts += part + '/';
            utils.ensureFolder(prevParts);
        });

        let nrGeneratedFiles = 0;
        each(typeCol, (type:any) => {
            let outputFileName = path.join(typeFolder, type.fileName);
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
        return path.join(folder, utils.convertNamespaceToPath(namespace));
    });
    cleanFoldersForObsoleteFiles(folder, namespacePaths);
}

function cleanFoldersForObsoleteFiles(folder:any, namespacePaths:any) {
    utils.getDirectories(folder).forEach((name:string) => {
        let folderPath = path.join(folder, name);
        // TODO bij swagger-zib-v2 wordt de webapi/ZIB folder weggegooid !
        let namespacePath = namespacePaths.find( (path:any) => {
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

function generateBarrelFiles(namespaceGroups:any, folder:any, options:any) {
    let data = {
        fileNames: undefined
    };
    let template = utils.readAndCompileTemplateFile('generate-barrel-ts.hbs');

    for (let key in namespaceGroups) {
        data.fileNames = namespaceGroups[key].map((type:any) => {
            return removeTsExtention(type.fileName);
        });
        if (key === ROOT_NAMESPACE) {
            addRootFixedFileNames(data.fileNames, options);
        }
        let namespacePath = namespaceGroups[key][0] ? namespaceGroups[key][0].path : '';
        let outputFileName = path.join(folder + namespacePath, 'index.ts');

        let result = template(data);
        let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
        if (isChanged) {
            utils.log(`generated ${outputFileName}`);
        }
    }
}

function addRootFixedFileNames(fileNames:any, options:any) {
    let enumOutputFileName = path.normalize(options.enumTSFile.split('/').pop());
    fileNames.splice(0, 0, removeTsExtention(enumOutputFileName));
    if(options.generateClasses) {
        let validatorsOutputFileName = path.normalize(VALDIDATORS_FILE_NAME);
        fileNames.splice(0, 0, removeTsExtention(validatorsOutputFileName));
    }
}

function removeTsExtention(fileName:string) {
    return fileName.replace('.ts', '');
}

function removeFilesOfNonExistingTypes(typeCollection:any, folder:any, options:any, suffix:any) {
    // remove files of types which are no longer defined in typeCollection
    let counter = 0;
    let files = fs.readdirSync(folder);
    each(files, (file:any) => {
        if (endsWith(file, suffix) && !typeCollection.find( (type:any) => {
                return type.fileName == file;
            })) {
            counter++;
            fs.unlinkSync(path.join(folder, file));
            utils.log(`removed ${file} in ${folder}`);
        }
    });
    if (counter > 0) {
        utils.log(`removed ${counter} types in ${folder}`);
    }
}

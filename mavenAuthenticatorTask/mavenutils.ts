import fs = require('fs');
import Q = require('q');
import taskLib = require('azure-pipelines-task-lib/task');
import path = require('path');

const stripbom = require('strip-bom');
import {getSystemAccessToken} from 'azure-pipelines-tasks-artifacts-common/webapi'

import * as xml2js from 'xml2js';
import * as os from 'os';
import * as fse from 'fs-extra';

import {
    getPackagingServiceConnections,
    PrivateKeyServiceConnection,
    ServiceConnection,
    ServiceConnectionAuthType,
    TokenServiceConnection,
    UsernamePasswordServiceConnection
} from "azure-pipelines-tasks-artifacts-common/serviceConnectionUtils";

export const getInternalFeedsServerElements = (input: string) => {
    const feeds: string[] = taskLib.getDelimitedInput(input, ",", false);
    const serverElements: unknown[] = [];
    const useHttpHeader = taskLib.getBoolInput("httpHeader");

    if (!feeds || feeds.length === 0) {
        return serverElements;
    }

    taskLib.debug(taskLib.loc('Info_GeneratingInternalFeeds', feeds.length));
    for (let feed of feeds) {
        if (useHttpHeader === true) {
            addHttpHeaderConfig(serverElements, feed, "AzureDevOps", getSystemAccessToken());
        } else {
            serverElements.push({
                id: feed,
                username: "AzureDevOps",
                password: getSystemAccessToken()
            });
        }
    }

    return serverElements;
}

export const getExternalServiceEndpointsServerElements = (input: string) => {
    const serviceConnections = getPackagingServiceConnections(input, ["REPOSITORYID"]);
    const useHttpHeader = taskLib.getBoolInput("httpHeader");
    const serverElements: any[] = [];
    if (!serviceConnections || serviceConnections.length === 0) {
        return serverElements;
    }

    taskLib.debug(taskLib.loc("Info_GeneratingExternalRepositories", serviceConnections.length));
    for (let serviceConnection of serviceConnections) {
        switch (serviceConnection.authType) {
            case (ServiceConnectionAuthType.UsernamePassword):
                const usernamePasswordAuthInfo = serviceConnection as UsernamePasswordServiceConnection;

                if (useHttpHeader === true) {
                    addHttpHeaderConfig(serverElements, getRepositoryId(serviceConnection), usernamePasswordAuthInfo.username,
                        usernamePasswordAuthInfo.password);
                } else {
                    serverElements.push({
                        id: getRepositoryId(serviceConnection),
                        username: usernamePasswordAuthInfo.username,
                        password: usernamePasswordAuthInfo.password,

                    });
                }

                taskLib.debug(`Detected username/password credentials for '${serviceConnection.packageSource.uri}'`);
                break;
            case (ServiceConnectionAuthType.Token):
                const tokenAuthInfo = serviceConnection as TokenServiceConnection;
                if (useHttpHeader === true) {
                    addHttpHeaderConfig(serverElements, getRepositoryId(serviceConnection), "AzureDevOps", tokenAuthInfo.token);
                } else {
                    serverElements.push({
                        id: getRepositoryId(serviceConnection),
                        username: "AzureDevOps",
                        password: tokenAuthInfo.token
                    });
                }

                taskLib.debug(`Detected token credentials for '${serviceConnection.packageSource.uri}'`);
                break;
            case (ServiceConnectionAuthType.PrivateKey):
                const privateKeyAuthInfo = serviceConnection as PrivateKeyServiceConnection;
                if (useHttpHeader === true) {
                    addHttpHeaderConfig(serverElements, getRepositoryId(serviceConnection), privateKeyAuthInfo.privateKey,
                        privateKeyAuthInfo.passphrase);
                } else {
                    serverElements.push({
                        id: getRepositoryId(serviceConnection),
                        privateKey: privateKeyAuthInfo.privateKey,
                        passphrase: privateKeyAuthInfo.passphrase
                    });
                }

                taskLib.debug(`Detected token credentials for '${serviceConnection.packageSource.uri}'`);
                break;
            default:
                throw Error(taskLib.loc('Error_InvalidServiceConnection', serviceConnection.packageSource.uri));
        }
    }

    return serverElements;
}

export const readXmlFileAsJson = (filePath: string): Q.Promise<any> => {
    return readFile(filePath, 'utf-8')
        .then(convertXmlStringToJson);
}

export const jsonToXmlConverter = (filePath: string, jsonContent: any): Q.Promise<void> => {
    return writeJsonAsXmlFile(filePath, jsonContent.settings, 'settings');
}

export const addRepositoryEntryToSettingsJson = (json: any, serverJson: any): any => {
    if (!json) {
        json = {};
    }
    if (!json.settings || typeof json.settings === "string") {
        json.settings = {};
    }
    if (!json.settings.$) {
        json.settings.$ = {};
        json.settings.$['xmlns'] = 'http://maven.apache.org/SETTINGS/1.0.0';
        json.settings.$['xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
        json.settings.$['xsi:schemaLocation'] = 'http://maven.apache.org/SETTINGS/1.0.0' + os.EOL + 'https://maven.apache.org/xsd/settings-1.0.0.xsd';
    }
    if (!json.settings.servers) {
        json.settings.servers = {};
    }
    addPropToJson(json.settings.servers, 'server', serverJson);
    return json;
}

const getRepositoryId = (serviceConnection: ServiceConnection): string | undefined => {
    return serviceConnection.additionalData ? serviceConnection.additionalData["REPOSITORYID"] : undefined;
}

const addPropToJson = (obj: any, propName: string, value: any): void => {
    if (!obj) {
        obj = {};
    }

    // If the root 'obj' already contains a 'server' property set it as the root object.
    if (obj instanceof Array) {
        let propNode = obj.find(o => o[propName]);
        if (propNode) {
            obj = propNode;
        }
    }

    // Checks if an array contains a key
    let containsId: (o: any) => boolean = function (o) {
        if (value && value.id) {
            if (o.id instanceof Array) {
                return o.id.find((v: any) => {
                    return v === value.id;
                });
            } else {
                return value.id === o.id;
            }
        }
        return false;
    };

    if (propName in obj) { // If the 'server' property is a key within this object
        if (obj[propName] instanceof Array) { // if the 'server' value is an array, append our value to this array
            let existing = obj[propName].find(containsId);
            if (existing) { // Skip replacing existing value.
                taskLib.warning(taskLib.loc('Warning_FeedEntryAlreadyExists', value.id));
                taskLib.debug('Entry: ' + value.id);
            } else {
                obj[propName].push(value);
            }
        } else if (typeof obj[propName] !== 'object') { // If the 'server' element is not an 'object', destroy it
            // and replace with a server element with our value.
            obj[propName] = [obj[propName], value];
        } else { // If 'server' value is an object, combine our and their value into an array and assign it to 'server'
            let prop: { [key: string]: string; } = {};
            prop[propName] = value;
            obj[propName] = [obj[propName], value];
        }
    } else if (obj instanceof Array) { // If we simply get an array of 'server' objects
        let existing = obj.find(containsId);
        if (existing) {  // Don't replace existing value.
            taskLib.warning(taskLib.loc('Warning_FeedEntryAlreadyExists', value.id));
            taskLib.debug('Entry: ' + value.id);
        } else { // Append our value to the 'server' array.
            let prop: { [key: string]: string; } = {};
            prop[propName] = value;
            obj.push(prop);
        }
    } else { // The root object was empty, simply assign our value to it.
        obj[propName] = value;
    }
}


const writeJsonAsXmlFile = (filePath: string, jsonContent: any, rootName: string): Q.Promise<void> => {
    let builder = new xml2js.Builder({
        renderOpts: {pretty: true},
        headless: true,
        rootName: rootName
    });
    let xml = builder.buildObject(jsonContent);
    xml = xml.replace(/&#xD;/g, '');
    return writeFile(filePath, xml);
}

const addHttpHeaderConfig = (serverElements: any[], id: string | undefined, userName: string, password: string) => {
    serverElements.push({
        id: id,
        configuration: {
            httpHeaders: {
                property: {
                    name: userName,
                    value: password,
                }
            }
        }
    });
}

const writeFile = (filePath: string, fileContent: string): Q.Promise<void> => {
    fse.mkdirpSync(path.dirname(filePath));
    return Q.nfcall<void>(fs.writeFile, filePath, fileContent, {encoding: 'utf-8'});
}

const readFile = (filePath: string, encoding: string): Q.Promise<string> => {
    return Q.nfcall<string>(fs.readFile, filePath, encoding);
}

async function convertXmlStringToJson(xmlContent: string): Promise<any> {
    return Q.nfcall<any>(xml2js.parseString, stripbom(xmlContent));
}

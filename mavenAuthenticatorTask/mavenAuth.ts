import taskLib = require('azure-pipelines-task-lib/task');
import util = require('./mavenutils');

import * as path from 'path';
import {emitTelemetry} from 'azure-pipelines-tasks-artifacts-common/telemetry';

const m2FolderName: string = ".m2";
const settingsXmlName: string = "settings.xml";
const backupSettingsXmlName: string = "_settings.xml";

taskLib.setResourcePath(path.join(__dirname, 'task.json'));

async function run(): Promise<void> {
    let internalFeedServerElements: any[] = [];
    let externalServiceEndpointsServerElements: any[] = [];
    try {
        internalFeedServerElements = util.getInternalFeedsServerElements("artifactsFeeds");
        externalServiceEndpointsServerElements = util.getExternalServiceEndpointsServerElements("mavenServiceConnections");
        const newServerElements = internalFeedServerElements.concat(externalServiceEndpointsServerElements);

        if (newServerElements.length === 0) {
            taskLib.warning(taskLib.loc("Warning_NoEndpointsToAuth"));
            return;
        }

        // Determine the user's M2 folder:
        let userM2FolderPath = taskLib.getPlatform() === taskLib.Platform.Windows ? path.join(<string>process.env.USERPROFILE, m2FolderName)
            : path.join(<string>process.env.HOME, m2FolderName);

        // Create user's M2 folder if not exists
        if (!taskLib.exist(userM2FolderPath)) {
            taskLib.debug(taskLib.loc("Info_M2FolderDoesntExist", userM2FolderPath));
            taskLib.mkdirP(userM2FolderPath);
        }

        let userSettingsXmlFilePath = path.join(userM2FolderPath, settingsXmlName);
        let backupSettingsXmlFilePath = path.join(userM2FolderPath, backupSettingsXmlName);

        // Store user setting path for cleanup later
        taskLib.setTaskVariable('userM2SettingsXmlPath', userSettingsXmlFilePath);

        let settingsJson: unknown;
        if (taskLib.exist(userSettingsXmlFilePath)) {
            taskLib.debug(taskLib.loc("Info_SettingsXmlRead", userSettingsXmlFilePath));

            // Copy the original M2 file to the backup file and store it's name for cleanup later
            taskLib.cp(userSettingsXmlFilePath, backupSettingsXmlFilePath);
            taskLib.setTaskVariable("backupUserM2SettingsFilePath", backupSettingsXmlFilePath);

            // Load the user setting file if it exists such that we can append our settings
            settingsJson = await util.readXmlFileAsJson(userSettingsXmlFilePath);
        } else {
            taskLib.debug(taskLib.loc("Info_CreatingSettingsXml", userSettingsXmlFilePath));
        }

        // Add the feeds to the maven settings
        for (let serverElement of newServerElements) {
            settingsJson = util.addRepositoryEntryToSettingsJson(settingsJson, serverElement);
        }

        taskLib.debug(taskLib.loc("Info_WritingToSettingsXml"));
        await util.jsonToXmlConverter(userSettingsXmlFilePath, settingsJson);
    } catch (err) {
        taskLib.setResult(taskLib.TaskResult.Failed, err.message);
    } finally {
        emitTelemetry("Packaging", "MavenAuthenticate", {
            "InternalFeedAuthCount": internalFeedServerElements.length,
            "ExternalRepoAuthCount": externalServiceEndpointsServerElements.length
        });
    }
}

run();

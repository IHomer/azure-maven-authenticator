import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");

let taskPath = path.join(__dirname, "..", "mavenAuth.js");
let testRunner: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const testUserHomeDir = path.join(__dirname, "USER_HOME");
const m2DirName = ".m2"
const m2DirPath = path.join(testUserHomeDir, m2DirName);
const settingsXmlName = "settings.xml";
const settingsXmlPath = path.join(m2DirPath, settingsXmlName);

// Set inputs
testRunner.setInput("artifactsFeeds", "");
testRunner.setInput("mavenServiceConnections", "tokenBased,usernamePasswordBased,privateKeyBased");
testRunner.setInput("verbosity", "verbose");
testRunner.setInput("httpHeader", "true");

let mockApi = {
    getSystemAccessToken: () => {
        return "token";
    }
};
testRunner.registerMock('azure-pipelines-tasks-artifacts-common/webapi', mockApi);

process.env["ENDPOINT_URL_tokenBased"] = "https://endpoint";
process.env["ENDPOINT_DATA_tokenBased_REPOSITORYID"] = "tokenBased";
process.env["ENDPOINT_AUTH_SCHEME_tokenBased"] = "token";
process.env["ENDPOINT_AUTH_tokenBased"] = JSON.stringify({
    "parameters": {
        "apitoken": "--token--"
    }
}); 

process.env["ENDPOINT_URL_usernamePasswordBased"] = "https://endpoint";
process.env["ENDPOINT_DATA_usernamePasswordBased_REPOSITORYID"] = "usernamePasswordBased";
process.env["ENDPOINT_AUTH_SCHEME_usernamePasswordBased"] = "usernamepassword";
process.env["ENDPOINT_AUTH_usernamePasswordBased"] = JSON.stringify({
    "parameters": {
        "username": "--testUserName--",
        "password": "--testPassword--"
    }
}); 

process.env["ENDPOINT_URL_privateKeyBased"] = "https://endpoint";
process.env["ENDPOINT_DATA_privateKeyBased_REPOSITORYID"] = "privateKeyBased";
process.env["ENDPOINT_AUTH_SCHEME_privateKeyBased"] = "privateKey";
process.env["ENDPOINT_AUTH_privateKeyBased"] = JSON.stringify({
    "parameters": {
        "privateKey": "--privateKey--",
        "passphrase": "--passphrase--"
    }
}); 

// provide answers for task mock
testRunner.setAnswers({
    osType: {
        "osType": "Windows NT"
    },
    exist: {
        [m2DirPath]: false,
        [settingsXmlPath]: false
    }
});


testRunner.run();

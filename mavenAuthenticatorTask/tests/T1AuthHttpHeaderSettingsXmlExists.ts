import taskLibMockRun = require("azure-pipelines-task-lib/mock-run");
import path = require("path");

let taskPath = path.join(__dirname, "..", "mavenAuth.js");
let testRunner: taskLibMockRun.TaskMockRunner = new taskLibMockRun.TaskMockRunner(taskPath);

const testUserHomeDir = path.join(__dirname, "USER_HOME");
const m2DirName = ".m2"
const m2DirPath = path.join(testUserHomeDir, m2DirName);
const settingsXmlName = "settings.xml";
const settingsXmlPath = path.join(m2DirPath, settingsXmlName);

// Set inputs
testRunner.setInput("artifactsFeeds", "feedName1");
testRunner.setInput("verbosity", "verbose");
testRunner.setInput("mavenServiceConnections", "");
testRunner.setInput("httpHeader", "true");

let mockApi = {
    getSystemAccessToken: () => {
        return "token";
    }
};
testRunner.registerMock('azure-pipelines-tasks-artifacts-common/webapi', mockApi);

// provide answers for task mock
testRunner.setAnswers({
    osType: {
        "osType": "Windows NT"
    },
    exist: {
        [m2DirPath]: true,
        [settingsXmlPath]: true
    }
});

testRunner.run();

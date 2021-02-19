import fs = require("fs");
import assert = require("assert");
import path = require("path");
import * as taskLib from "azure-pipelines-task-lib/task";
import * as taskTest from "azure-pipelines-task-lib/mock-test";
import Dict = NodeJS.Dict;

const testUserHomeDir = path.join(__dirname, "USER_HOME");
const m2DirName = ".m2"
const m2DirPath = path.join(testUserHomeDir, m2DirName);
const settingsXmlName = "settings.xml";
const settingsXmlPath = path.join(m2DirPath, settingsXmlName);

const serversRegex = /<servers>/mig;
const serverRegex = /<server>/mig;

describe("authenticate azure artifacts feeds for maven", function() {
    this.timeout(parseInt(<string> process.env.TASK_TEST_TIMEOUT) || 20000);
    let env: Dict<string>;

    this.beforeAll(() => {
        env = Object.assign({}, process.env);
        process.env["USERPROFILE"] = testUserHomeDir;
        process.env["HOME"] = testUserHomeDir;
    });

    beforeEach(() => {
        taskLib.mkdirP(m2DirPath);
    })

    this.afterAll(() => {
        process.env = env;
    })

    afterEach(() => {
        taskLib.rmRF(m2DirPath);
    });

    it("it should create a new settings.xml in the .m2 folder and add auth for 1 feed.", (done: Mocha.Done) => {
        this.timeout(1000);
        // Given:
        let testFile: string = path.join(__dirname, "T1AuthSettingsXml.js");
        let testRunner: taskTest.MockTestRunner = new taskTest.MockTetRunner(testFile);

        // When:
        testRunner.run();

        // Then:
        assert.strictEqual(taskLib.ls('-A', [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = taskLib.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be created.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assert.strictEqual(data.match(serversRegex)?.length, 1, "Only one <servers> entry should be created.");
        assert.strictEqual(data.match(serverRegex)?.length, 1, "Only one <server> entry should be created.");
        assert.strictEqual(data.match(/<id>feedName1<\/id>/gi)?.length, 1, "Only one id entry should be created.");

        assert(testRunner.stderr.length === 0, "should not have written to stderr");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });
});

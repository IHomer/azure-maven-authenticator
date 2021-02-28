import fs = require("fs");
import assert = require("assert");
import path = require("path");
import Dict = NodeJS.Dict;
import * as taskLib from "azure-pipelines-task-lib/task";
import * as taskTest from "azure-pipelines-task-lib/mock-test";

const testUserHomeDir = path.join(__dirname, "USER_HOME");
const m2DirName = ".m2"
const m2DirPath = path.join(testUserHomeDir, m2DirName);
const settingsXmlName = "settings.xml";
const settingsXmlPath = path.join(m2DirPath, settingsXmlName);

const settingsOtherFeedName = path.join(__dirname, "Samples", "settingsOtherFeedName.xml");
const settingsFeedName1 = path.join(__dirname, "Samples", "settingsFeedName1.xml");

const serversRegex = /<servers>/mig;
const serverRegex = /<server>/mig;
const configurationRegex = /<configuration>/mig;
const httpHeaderRegex = /<httpHeaders>/mig;
const propertyRegex = /<property>/mig;
const nameRegex = /<name>/mig;
const valueRegex = /<value>/mig;

describe("authenticate azure artifacts feeds for maven", function () {
    this.timeout(parseInt(<string>process.env.TASK_TEST_TIMEOUT) || 20000);
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

    it("it should create a new settings.xml in the .m2 folder and add default auth for 1 feed.", (done: Mocha.Done) => {
        this.timeout(1000);
        // Given:
        let testFile: string = path.join(__dirname, "T1AuthSimpleSettingsXml.js");
        let testRunner: taskTest.MockTestRunner = new taskTest.MockTestRunner(testFile);

        // When:
        testRunner.run();

        // Then:
        assert.strictEqual(taskLib.ls('-A', [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = taskLib.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be created.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assertServer(data, 1);
        assertHttpHeader(data, 0);
        assertFeed(data, 'feedName1', 1);

        assertNoError(testRunner);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("it should create a new settings.xml in the .m2 folder and add http header auth for 1 feed.", (done: Mocha.Done) => {
        this.timeout(1000);
        // Given:
        let testFile: string = path.join(__dirname, "T1AuthHttpHeaderSettingsXml.js");
        let testRunner: taskTest.MockTestRunner = new taskTest.MockTestRunner(testFile);

        // When:
        testRunner.run();

        // Then:
        assert.strictEqual(taskLib.ls('-A', [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = taskLib.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be created.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assertServer(data, 1);
        assertHttpHeader(data, 1);
        assertFeed(data, 'feedName1', 1);

        assertNoError(testRunner);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("it should read the existing settings.xml and add simple auth for 1 new feed", (done: Mocha.Done) => {
        this.timeout(1000);

        let taskFile: string = path.join(__dirname, "T1AuthSimpleSettingsXmlExists.js");
        let testRunner: taskTest.MockTestRunner = new taskTest.MockTestRunner(taskFile);
        taskLib.cp(settingsOtherFeedName, settingsXmlPath);

        testRunner.run();

        assert.strictEqual(taskLib.ls('-A', [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = taskLib.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be present.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assertServer(data, 2);
        assertHttpHeader(data, 0);
        assertFeed(data, 'feedName1', 1);
        assertFeed(data, 'otherFeedName', 1);

        assertNoError(testRunner);
        assert(testRunner.succeeded, "task should have succeeded");
        done();
    });

    it("it should read the existing settings.xml and add http header auth for 1 new feed", (done: Mocha.Done) => {
        this.timeout(1000);

        let taskFile: string = path.join(__dirname, "T1AuthHttpHeaderSettingsXmlExists.js");
        let testRunner: taskTest.MockTestRunner = new taskTest.MockTestRunner(taskFile);
        taskLib.cp(settingsOtherFeedName, settingsXmlPath);

        testRunner.run();

        assert.strictEqual(taskLib.ls('-A', [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = taskLib.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be present.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assertServer(data, 2);
        assertHttpHeader(data, 1);
        assertFeed(data, 'feedName1', 1);
        assertFeed(data, 'otherFeedName', 1);

        assertNoError(testRunner);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("it should read the existing settings.xml and not add any new entries.", (done: Mocha.Done) => {
        this.timeout(1000);

        let taskFile: string = path.join(__dirname, "T1AuthSettingsXmlExists.js");

        let testRunner: taskTest.MockTestRunner = new taskTest.MockTestRunner(taskFile);
        taskLib.cp(settingsFeedName1, settingsXmlPath);

        testRunner.run();

        assert.strictEqual(taskLib.ls('-A', [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = taskLib.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be present.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assertServer(data, 1);
        assertFeed(data, 'feedName1', 1);

        assertNoError(testRunner);
        assert(testRunner.stdOutContained("vso[task.issue type=warning;]loc_mock_Warning_FeedEntryAlreadyExists"), "Entry already exists warning should be displayed");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("it should create a new settings.xml in the .m2 folder and add simple auth for 3 different types of service connections.", (done: Mocha.Done) => {
        this.timeout(1000);

        let taskFile: string = path.join(__dirname, "T1ServiceConnections.js");
        let testRunner: taskTest.MockTestRunner = new taskTest.MockTestRunner(taskFile);

        testRunner.run();

        assert.strictEqual(taskLib.ls('-A', [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = taskLib.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be created.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assertServer(data, 3);
        assertTokenBased(data);
        assertUserNamePwd(data, 'AzureDevOps', '--token--');
        assertUserNamePwdBased(data);
        assertUserNamePwd(data, '--testUserName--', '--testPassword--');
        assertPrivateKeyBased(data);
        assertPrivateKey(data, 'privateKey', 'passphrase');

        assertHttpHeader(data, 0);

        assertNoError(testRunner);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("it should create a new settings.xml in the .m2 folder and add http header auth for 3 different types of service connections.", (done: Mocha.Done) => {
        this.timeout(1000);

        let taskFile: string = path.join(__dirname, "T1HttpHeaderServiceConnections.js");
        let testRunner: taskTest.MockTestRunner = new taskTest.MockTestRunner(taskFile);

        testRunner.run();

        assert.strictEqual(taskLib.ls('-A', [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = taskLib.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be created.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assertServer(data, 3);
        assertTokenBased(data);
        assertUserNamePwdBased(data);
        assertPrivateKeyBased(data);

        assertHttpHeader(data, 3);

        assertNoError(testRunner);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

});

const assertPrivateKeyBased = (data: string): void => {
    assert.strictEqual(data.match(/<id>privateKeyBased<\/id>/gi)?.length, 1, "Only one privateKeyBased entry should be created.");
}

const assertUserNamePwdBased = (data: string): void => {
    assert.strictEqual(data.match(/<id>usernamePasswordBased<\/id>/gi)?.length, 1, `Only one usernamePasswordBased entry should be created. Data: ${data}`);
}

const assertTokenBased = (data: string): void => {
    assert.strictEqual(data.match(/<id>tokenBased<\/id>/gi)?.length, 1, `Only one tokenBased entry should be created. Data: ${data}`);
}

const assertUserNamePwd = (data: string, userName: string, pwd: string): void => {
    assert.strictEqual(data.match(`<username>${userName}<\/username>/gi`)?.length, 1, `Only one username entry should be created for api token. Data: ${data}`);
    assert.strictEqual(data.match(`<password>${pwd}<\/password>gi`)?.length, 1, `Only one password entry should be created for api token. Data: ${data} `);
}

const assertPrivateKey = (data: string, userName: string, pwd: string): void => {
    assert.strictEqual(data.match(`<privateKey>${userName}<\/privateKey>/gi`)?.length, 1, `Only one username entry should be created for api token. Data: ${data}`);
    assert.strictEqual(data.match(`<passphrase>${pwd}<\/passphrase>gi`)?.length, 1, `Only one password entry should be created for api token. Data: ${data} `);
}

const assertServer = (data: string, serverCount: number): void => {
    assert.strictEqual(matchCount(data, serversRegex), 1, "Only one <servers> entry should be created.");
    assert.strictEqual(matchCount(data, serverRegex), serverCount, `${serverCount} <server> entries should be created.`);
}

const assertHttpHeader = (data: string, serverCount: number): void => {
    assert.strictEqual(matchCount(data, configurationRegex), serverCount, `Only ${serverCount} <configuration> entry should be created. Data: ${data}`);
    assert.strictEqual(matchCount(data, httpHeaderRegex), serverCount, `Only ${serverCount} <httpHeaders> entry should be created.  Data: ${data}`);
    assert.strictEqual(matchCount(data, propertyRegex), serverCount, `Only ${serverCount} <property> entry should be created.  Data: ${data}`);
    assert.strictEqual(matchCount(data, propertyRegex), serverCount, `Only ${serverCount} <property> entry should be created.  Data: ${data}`);
    assert.strictEqual(matchCount(data, nameRegex), serverCount, `Only ${serverCount} <name> entry should be created.  Data: ${data}`);
    assert.strictEqual(matchCount(data, valueRegex), serverCount, `Only ${serverCount} <value> entry should be created.  Data: ${data}`);
}

const assertFeed = (data: string, feedName: string, expectedCount: number): void => {
    assert.strictEqual(data.match(new RegExp(`<id>${feedName}<\/id>`, 'gi'))?.length, expectedCount, `Only ${expectedCount} of feed ${feedName} expected`);
}

const assertNoError = (testRunner: taskTest.MockTestRunner): void => {
    assert(testRunner.stderr.length === 0, "should not have written to stderr");
}

const matchCount = (data: string, pattern: RegExp): number => {
    const match = data.match(pattern)?.length
    return match === undefined ? 0 : match;
}


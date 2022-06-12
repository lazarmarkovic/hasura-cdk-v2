
import * as cdk from 'aws-cdk-lib';
import { MainStack } from "../lib/main-stack";

const appName = process.env.APP_NAME;
if (!appName) {
  throw Error('APP_NAME must be defined in environment');
}

const app = new cdk.App();
const stagingStack = new MainStack(app, `${appName}-StagingStack`, {
  env: "staging"
});
cdk.Tags.of(stagingStack).add('AppName', appName);
cdk.Tags.of(stagingStack).add('Env', "staging");


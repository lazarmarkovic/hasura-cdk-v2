
import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Hasura } from './hasura';
import { VPC } from './vpc';
import { Actions } from './actions';

export class MainStack extends Stack {

  constructor(scope: Construct, id: string, props: any) {
    super(scope, id, props);

    const multiAz = false;

    const appName = process.env.APP_NAME;
    if (!appName) {
      throw Error('APP_NAME must be defined in environment');
    }

    const region = process.env.AWS_REGION;
    if (!region) {
      throw Error('AWS_REGION must be defined in environment');
    }

    const account = process.env.AWS_ACCOUNT_ID;
    if (!account) {
      throw Error('AWS_ACCOUNT_ID must be defined in environment');
    }

    const env = {
      region,
      account,
    };

    const hostedZoneId = process.env.HOSTED_ZONE_ID;
    if (!hostedZoneId) {
      throw Error('HOSTED_ZONE_ID must be defined in environment');
    }

    const hostedZoneName = process.env.HOSTED_ZONE_NAME;
    if (!hostedZoneName) {
      throw Error('HOSTED_ZONE_NAME must be defined in environment');
    }

    const hasuraHostname = process.env.HASURA_HOSTNAME;
    if (!hasuraHostname) {
      throw Error('HASURA_HOSTNAME must be defined in environment');
    }

    const actionsHostname = process.env.ACTIONS_HOSTNAME;
    if (!actionsHostname) {
      throw Error('ACTIONS_HOSTNAME must be defined in environment');
    }


    const vpc = new VPC(this, `${appName}-HasuraVPC`, { env });

    const hasura = new Hasura(this, `${appName}-Hasura`, {
      env,
      vpc: vpc.vpc,
      appName,
      hostedZoneId,
      hostedZoneName,
      hasuraHostname,
      multiAz,
    });

    const actions = new Actions(this, `${appName}-Actions`, {
      env,
      appName,
      hostedZoneId,
      hostedZoneName,
      actionsHostname,
    });
  }
}
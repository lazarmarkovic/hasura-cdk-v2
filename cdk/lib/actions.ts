import { StackProps, Stack, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { LambdaIntegration, RestApi, MethodLoggingLevel } from 'aws-cdk-lib/aws-apigateway';
import * as route53_targets from 'aws-cdk-lib/aws-route53-targets';
import { PublicHostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import * as path from 'path';
import { RetainedLambdaLayerVersion } from './retained-lambda-layer';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';

export interface ActionsProps extends StackProps {
  appName: string;
  actionsHostname: string;
  hostedZoneId: string;
}

export class Actions extends Stack {

  constructor(scope: Construct, id: string, props: ActionsProps) {
    super(scope, id, props);

    const hostedZone = PublicHostedZone.fromHostedZoneId(this, 'HasuraHostedZone', props.hostedZoneId);

    const actionsCert = new DnsValidatedCertificate(this, 'ActionsCertificate', {
      hostedZone,
      domainName: props.actionsHostname,
    });

    const api = new RestApi(this, 'ActionsApi', {
      domainName: {
        domainName: props.actionsHostname,
        certificate: actionsCert,
      },
      restApiName: 'Actions',
      description: 'Endpoint For Hasura Actions',
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // API DNS record
    new ARecord(this, 'ActionsApiAliasRecord', {
      zone: hostedZone,
      recordName: props.actionsHostname,
      target: RecordTarget.fromAlias(new route53_targets.ApiGateway(api)),
    });

    // Create a lambda layer to contain node_modules
    const handlerDependenciesLayer = new RetainedLambdaLayerVersion(this, 'ActionHandlerDependencies', {
      contentLocation: 'actions/dependencies-layer',
      description: 'Dependencies layer',
      compatibleRuntimes: [Runtime.NODEJS_16_X],
    });

    const actionHandler = new Function(this, 'ActionHandler', {
      functionName: `${props.appName}-ActionHandler`,
      handler: 'handler.handler',
      memorySize: 1024,
      runtime: Runtime.NODEJS_16_X,
      code: Code.fromAsset(path.join(__dirname, '../../actions/dist/')),
      timeout: Duration.seconds(4),
      layers: [handlerDependenciesLayer],
    });

    const handlerResource = api.root.addResource('handler');
    const actionHandlerIntegration = new LambdaIntegration(actionHandler);

    handlerResource.addMethod('POST', actionHandlerIntegration);
    handlerResource.addMethod('GET', actionHandlerIntegration);
  }
}
